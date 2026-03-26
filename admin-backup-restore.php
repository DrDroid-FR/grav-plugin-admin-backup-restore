<?php

/**
 * Admin Backup Restore Plugin
 * 
 * Adds restore functionality to the Grav Admin backup page
 * 
 * @package Grav\Plugin\AdminBackupRestorePlugin
 * @version 1.2.0
 * @author  Julien Perret <gravdev@drdroid.fr>
 * @license MIT
 * @github   https://github.com/DrDroid-FR
 */

namespace Grav\Plugin;

use Grav\Common\Cache;
use Grav\Common\Filesystem\Archiver;
use Grav\Common\Filesystem\Folder;
use Grav\Common\Grav;
use Grav\Common\Plugin;
use Grav\Common\Utils;
use RocketTheme\Toolbox\Event\Event;

/**
 * AdminBackupRestorePlugin
 * 
 * Provides restore functionality for backups in the Grav Admin
 */
class AdminBackupRestorePlugin extends Plugin
{
    /**
     * Subscribe to events
     *
     * @return array
     */
    public static function getSubscribedEvents()
    {
        return [
            'onPluginsInitialized' => ['onPluginsInitialized', 0],
            'onTwigSiteVariables' => ['onTwigSiteVariables', 0],
            'onAdminControllerInit' => ['onAdminControllerInit', 0],
            'onTwigTemplatePaths' => ['onTwigTemplatePaths', 0],
        ];
    }

    /**
     * Initialize plugin
     */
    public function onPluginsInitialized()
    {
        // Only run for admin
        if (!$this->isAdmin()) {
            return;
        }

        // Add assets
        $this->grav['assets']->addJs('plugin://admin-backup-restore/assets/admin-backup-restore.js');
        
        // Log for debugging
        $this->grav['log']->debug('[AdminBackupRestore] Plugin initialized');
    }

    /**
     * Add plugin template paths for Twig overrides
     */
    public function onTwigTemplatePaths()
    {
        array_unshift($this->grav['twig']->twig_paths, __DIR__ . '/templates');
    }

    /**
     * Handle admin controller initialization
     */
    public function onAdminControllerInit(Event $event)
    {
        // Get the task from URI
        $task = $this->grav['uri']->param('task');
        
        // Only handle our specific task
        if ($task !== 'backupRestore') {
            return;
        }
        
        // Prevent the default controller from handling this
        // and handle it ourselves
        $this->handleRestore();
    }

    /**
     * Add variables to Twig for JavaScript
     */
    public function onTwigSiteVariables()
    {
        if (!$this->isAdmin()) {
            return;
        }
        
        // Add inline JavaScript to set global variables
        $nonce = Utils::getNonce('admin-form');
        $script = <<<JS
window.admin_nonce = '$nonce';
JS;
        
        $this->grav['assets']->addInlineJs($script);
    }

    /**
     * Handle backup restore with SSE progress streaming
     */
    protected function handleRestore()
    {
        $grav = Grav::instance();
        $uri = $grav['uri'];
        $debug = $this->config->get('plugins.admin-backup-restore.debug', false);
        
        // Verify nonce
        $nonce = $uri->param('admin-nonce');
        if (!Utils::verifyNonce($nonce, 'admin-form')) {
            $this->jsonResponse([
                'status' => 'error',
                'message' => 'Invalid security token'
            ]);
            return;
        }

        // Verify permissions using configured permission level
        $required_permission = $this->config->get('plugins.admin-backup-restore.permissions', 'admin.super');
        $admin = $grav['admin'];
        if (!$admin->authorize($required_permission)) {
            $this->jsonResponse([
                'status' => 'error',
                'message' => 'Unauthorized'
            ]);
            return;
        }

        // Get backup filename
        $backup_param = $uri->param('backup');
        if (null === $backup_param) {
            $this->jsonResponse([
                'status' => 'error',
                'message' => 'No backup specified'
            ]);
            return;
        }

        // Set SSE headers
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');
        if (function_exists('apache_setenv')) {
            @apache_setenv('no-gzip', '1');
        }
        @ini_set('zlib.output_compression', 'Off');
        @ini_set('output_buffering', 'Off');

        try {
            $filename = Utils::basename(base64_decode(urldecode($backup_param)));
            $locator = $grav['locator'];
            $backup_file = $locator->findResource("backup://{$filename}", true);

            if (!$backup_file || !file_exists($backup_file)) {
                $this->sseSend(['status' => 'error', 'message' => 'Backup file not found']);
                return;
            }

            // Verify it's a valid zip file
            if (!Utils::endsWith($filename, '.zip', false)) {
                $this->sseSend(['status' => 'error', 'message' => 'Invalid backup file format']);
                return;
            }

            $this->sseSend(['status' => 'progress', 'message' => 'Validating backup file...', 'step' => 'validate', 'percent' => 5]);

            // Get paths
            $root_path = GRAV_ROOT;
            
            // Remove .git folder if exists (can cause permission issues on restore)
            $git_path = $root_path . DS . '.git';
            $git_removed = false;
            if (is_dir($git_path)) {
                if ($debug) {
                    $grav['log']->debug('[AdminBackupRestore] Removing .git folder before restore');
                }
                $this->sseSend(['status' => 'progress', 'message' => 'Preparing site (handling .git)...', 'step' => 'prepare', 'percent' => 10]);
                Folder::delete($git_path);
                $git_removed = true;
            }

            // Step 1: Create automatic backup before restore (unless restoring a pre_restore_backup)
            $backup_dir = $locator->findResource('backup://', true, true);
            
            // Check if we're restoring a pre_restore_backup
            $is_pre_restore = (strpos($filename, 'pre_restore_backup') !== false);
            $create_pre_restore = $this->config->get('plugins.admin-backup-restore.pre_restore_backup', true);
            
            $status_message = '';
            
            if ($create_pre_restore && !$is_pre_restore) {
                $this->sseSend(['status' => 'progress', 'message' => 'Creating pre-restore backup...', 'step' => 'pre_backup', 'percent' => 20]);
                
                $date = date('YmdHis', time());
                $pre_restore_filename = 'pre_restore_backup--' . $date . '.zip';
                $pre_restore_destination = $backup_dir . DS . $pre_restore_filename;
                
                $config_value = $this->config->get('plugins.admin-backup-restore.exclude_folders', 'backup, cache, images, logs, tmp');
                $exclude_folders = array_map('trim', explode(',', $config_value));
                
                $options = [
                    'exclude_files' => [],
                    'exclude_paths' => $exclude_folders,
                ];
                
                $archiver = Archiver::create('zip');
                $archiver->setArchive($pre_restore_destination)->setOptions($options)->compress($root_path);
                
                $this->sseSend(['status' => 'progress', 'message' => 'Pre-restore backup created: ' . $pre_restore_filename, 'step' => 'pre_backup_done', 'percent' => 50]);
                
                $grav['log']->notice('Pre-restore backup created: ' . $pre_restore_destination);
                $status_message = ' Pre-restore backup created: ' . $pre_restore_filename;
            } elseif (!$create_pre_restore) {
                $this->sseSend(['status' => 'progress', 'message' => 'Pre-restore backup skipped (disabled)', 'step' => 'pre_backup_skipped', 'percent' => 15]);
                $status_message = ' (Pre-restore backup disabled in plugin config)';
            } else {
                $this->sseSend(['status' => 'progress', 'message' => 'Restoring pre-restore backup (skipping new backup)...', 'step' => 'pre_backup_skipped', 'percent' => 15]);
                $status_message = ' (Restoring a pre-restore backup - no new pre-restore backup created)';
            }

            // Step 2: Extract the selected backup directly to root
            $this->sseSend(['status' => 'progress', 'message' => 'Extracting backup archive...', 'step' => 'extract', 'percent' => 60]);
            
            $archiver = Archiver::create('zip');
            $archiver->setArchive($backup_file)->extract($root_path);
            
            $this->sseSend(['status' => 'progress', 'message' => 'Cleaning up extracted files...', 'step' => 'cleanup', 'percent' => 80]);
            
            // Remove .git folder if it was extracted (can cause permission issues)
            if (is_dir($git_path)) {
                Folder::delete($git_path);
                $git_removed = true;
            }
            
            $grav['log']->notice('Backup restored from: ' . $backup_file);
            
            // Clear cache after restore
            $this->sseSend(['status' => 'progress', 'message' => 'Clearing cache...', 'step' => 'cache', 'percent' => 90]);
            Cache::clearCache('all');
            
            // Build status message
            if ($git_removed) {
                $status_message .= ' (.git folder was reset for compatibility)';
            }
            
            // Final success event
            $this->sseSend(['status' => 'success', 'message' => 'Restore complete!', 'details' => trim($status_message), 'step' => 'done', 'percent' => 100]);
            
        } catch (\Exception $e) {
            $grav['log']->error('[AdminBackupRestore] Backup restore failed: ' . $e->getMessage());
            $this->sseSend(['status' => 'error', 'message' => 'Restore failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Send SSE data event and flush
     */
    protected function sseSend(array $data)
    {
        echo 'data: ' . json_encode($data) . "\n\n";
        if (ob_get_level() > 0) ob_end_flush();
        @flush();
    }

    /**
     * Send JSON response
     */
    protected function jsonResponse(array $data)
    {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
    
    /**
     * Copy files from source to destination, excluding .git folder
     */
    protected function copyExcludeGit($src, $dst)
    {
        $dir = @opendir($src);
        if ($dir === false) {
            return;
        }
        
        if (!is_dir($dst)) {
            mkdir($dst, 0755, true);
        }
        
        while (false !== ($file = readdir($dir))) {
            // Skip . and ..
            if ($file === '.' || $file === '..') {
                continue;
            }
            
            // Skip .git folder (case-insensitive to catch .Git, .GIT, etc.)
            if (strtolower($file) === '.git') {
                continue;
            }
            
            $srcPath = $src . DS . $file;
            $dstPath = $dst . DS . $file;
            
            if (is_dir($srcPath)) {
                // Recursively copy subdirectories (except .git)
                $this->copyExcludeGit($srcPath, $dstPath);
            } else {
                // Copy files
                copy($srcPath, $dstPath);
            }
        }
        closedir($dir);
    }
}
