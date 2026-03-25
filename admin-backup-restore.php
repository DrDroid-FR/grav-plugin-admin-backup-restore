<?php

/**
 * Admin Backup Restore Plugin
 * 
 * Adds restore functionality to the Grav Admin backup page
 * 
 * @package Grav\Plugin\AdminBackupRestorePlugin
 * @version 1.1.0
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

        // Add our template path for override
        $twig_paths = $this->grav['twig']->twig_paths;
        array_unshift($twig_paths, __DIR__ . '/templates');
        $this->grav['twig']->twig_paths = $twig_paths;

        // Add assets
        $this->grav['assets']->addJs('plugin://admin-backup-restore/assets/admin-backup-restore.js');
        
        // Log for debugging
        $this->grav['log']->debug('[AdminBackupRestore] Plugin initialized');
    }

    /**
     * Handle admin controller initialization
     */
    public function onAdminControllerInit(Event $event)
    {
        $controller = $event['controller'] ?? null;
        
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
     * Handle backup restore
     */
    protected function handleRestore()
    {
        $grav = Grav::instance();
        $uri = $grav['uri'];
        
        // Verify nonce
        $nonce = $uri->param('admin-nonce');
        if (!Utils::verifyNonce($nonce, 'admin-form')) {
            $this->jsonResponse([
                'status' => 'error',
                'message' => 'Invalid security token'
            ]);
            return;
        }

        // Verify permissions
        $admin = $grav['admin'];
        if (!$admin->authorize(['admin.maintenance', 'admin.super'])) {
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

        try {
            $filename = Utils::basename(base64_decode(urldecode($backup_param)));
            $locator = $grav['locator'];
            $backup_file = $locator->findResource("backup://{$filename}", true);

            if (!$backup_file || !file_exists($backup_file)) {
                $this->jsonResponse([
                    'status' => 'error',
                    'message' => 'Backup file not found'
                ]);
                return;
            }

            // Verify it's a valid zip file
            if (!Utils::endsWith($filename, '.zip', false)) {
                $this->jsonResponse([
                    'status' => 'error',
                    'message' => 'Invalid backup file format'
                ]);
                return;
            }

            // Get paths
            $root_path = GRAV_ROOT;
            
            // Remove .git folder if exists (can cause permission issues on restore)
            $git_path = $root_path . DS . '.git';
            $git_removed = false;
            if (is_dir($git_path)) {
                if ($this->config->get('plugins.admin-backup-restore.debug', false)) {
                    $grav['log']->debug('[AdminBackupRestore] Removing .git folder before restore');
                }
                Folder::delete($git_path);
                $git_removed = true;
            }

            // Step 1: Create automatic backup before restore (unless restoring a pre_restore_backup)
            $backup_dir = $locator->findResource('backup://', true, true);
            
            // Check if we're restoring a pre_restore_backup - if so, skip creating another pre-restore backup
            $is_pre_restore = (strpos($filename, 'pre_restore_backup') !== false);
            
            $status_message = '';
            $progress = 'started';
            
            if (!$is_pre_restore) {
                $progress = 'creating_backup';
                $date = date('YmdHis', time());
                $pre_restore_filename = 'pre_restore_backup--' . $date . '.zip';
                $pre_restore_destination = $backup_dir . DS . $pre_restore_filename;
                
                // Folders to exclude from pre-restore backup (from plugin config)
                $config = $this->config->get('plugins.admin-backup-restore.exclude_folders', 'backup, cache, images, logs, tmp');
                $exclude_folders = array_map('trim', explode(',', $config));
                
                // Use GRAV's native Archiver to create the backup
                $options = [
                    'exclude_files' => [],
                    'exclude_paths' => $exclude_folders,
                ];
                
                $archiver = Archiver::create('zip');
                $archiver->setArchive($pre_restore_destination)->setOptions($options)->compress($root_path);
                
                $grav['log']->notice('Pre-restore backup created: ' . $pre_restore_destination);
                $status_message = ' Pre-restore backup created: ' . $pre_restore_filename;
            } else {
                $status_message = ' (Restoring a pre-restore backup - no new pre-restore backup created)';
            }

            // Step 2: Extract the selected backup
            $progress = 'restoring';
            
            // Extract to temp folder first, then copy excluding .git to avoid permission issues
            $temp_extract = $root_path . DS . 'temp_restore_' . time();
            
            $archiver = Archiver::create('zip');
            $archiver->setArchive($backup_file)->extract($temp_extract);
            
            // Copy files from temp to root, excluding .git folder (case-insensitive)
            $this->copyExcludeGit($temp_extract, $root_path);
            
            // Clean up temp directory
            Folder::delete($temp_extract);
            
            // Log the restore
            $grav['log']->notice('Backup restored from: ' . $backup_file);
            
            // Clear cache after restore
            Cache::clearCache('all');
            
            // Add message if .git was removed
            if ($git_removed) {
                $status_message .= ' (.git folder was reset for compatibility)';
            }
            
            $progress = 'complete';
            
            $this->jsonResponse([
                'status' => 'success',
                'message' => 'Restore complete!',
                'details' => trim($status_message),
                'progress' => $progress
            ]);
            
        } catch (\Exception $e) {
            // Log the error for debugging
            $grav['log']->error('[AdminBackupRestore] Backup restore failed: ' . $e->getMessage());
            
            $this->jsonResponse([
                'status' => 'error',
                'message' => 'Restore failed: ' . $e->getMessage()
            ]);
        }
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
        $dir = opendir($src);
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
