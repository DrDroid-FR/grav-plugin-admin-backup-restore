<?php

/**
 * Admin Backup Restore Plugin
 * 
 * Adds restore functionality to the Grav Admin backup page
 * 
 * @package Grav\Plugin\AdminBackupRestorePlugin
 * @version 1.0.0
 * @author  Julien Perret <gravdev@drdroid.fr>
 * @license MIT
 * @github   https://github.com/DrDroid-FR
 */

namespace Grav\Plugin;

use Grav\Common\Cache;
use Grav\Common\Filesystem\Archiver;
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

            // Step 1: Create automatic backup before restore (unless restoring a pre_restore_backup)
            $backup_dir = $locator->findResource('backup://', true, true);
            $root_path = GRAV_ROOT;
            
            // Check if we're restoring a pre_restore_backup - if so, skip creating another pre-restore backup
            $is_pre_restore = (strpos($filename, 'pre_restore_backup') !== false);
            
            $status_message = '';
            
            if (!$is_pre_restore) {
                $date = date('YmdHis', time());
                $pre_restore_filename = 'pre_restore_backup--' . $date . '.zip';
                $pre_restore_destination = $backup_dir . DS . $pre_restore_filename;
                
                // Folders to exclude from pre-restore backup (from plugin config)
                $config = $this->config->get('plugins.admin-backup-restore.exclude_folders', 'backup, cache, images, logs, tmp');
                $exclude_folders = array_map('trim', explode(',', $config));
                
                // Use ZipArchive directly for the backup
                $zip = new \ZipArchive();
                if ($zip->open($pre_restore_destination, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) === TRUE) {
                    $this->addFolderToZip($root_path, $zip, $root_path, $exclude_folders);
                    $zip->close();
                    $grav['log']->notice('Pre-restore backup created: ' . $pre_restore_destination);
                    $status_message = ' Pre-restore backup created: ' . $pre_restore_filename;
                } else {
                    $status_message = ' (Warning: could not create pre-restore backup)';
                }
            } else {
                $status_message = ' (Restoring a pre-restore backup - no new pre-restore backup created)';
            }

            // Step 2: Extract the selected backup
            $archiver = Archiver::create('zip');
            $archiver->setArchive($backup_file)->extract($root_path);
            
            // Log the restore
            $grav['log']->notice('Backup restored from: ' . $backup_file);
            
            // Clear cache after restore
            Cache::clearCache('all');
            
            $this->jsonResponse([
                'status' => 'success',
                'message' => 'Restore complete!' . $status_message
            ]);
            
        } catch (\Exception $e) {
            $this->jsonResponse([
                'status' => 'error',
                'message' => 'Restore failed. Check the logs for details.'
            ]);
        }
    }

    /**
     * Add a folder and its contents to a ZipArchive
     * 
     * @param string $folder The folder to add
     * @param \ZipArchive $zip The ZipArchive instance
     * @param string $basePath The base path for relative paths
     * @param array $exclude_folders Folders to exclude from the backup
     */
    protected function addFolderToZip($folder, &$zip, $basePath, $exclude_folders = []) {
        $dir = dir($folder);
        while (false !== $entry = $dir->read()) {
            if ($entry == '.' || $entry == '..') continue;
            
            $fullPath = $folder . DS . $entry;
            $relativePath = str_replace($basePath . DS, '', $fullPath);
            $relativePath = str_replace('\\', '/', $relativePath); // Normalize path separators
            
            // Check if this path or any parent path should be excluded
            $shouldExclude = false;
            foreach ($exclude_folders as $excluded) {
                $excluded = str_replace('\\', '/', trim($excluded));
                // Check if relative path starts with excluded path
                if ($relativePath === $excluded || strpos($relativePath, $excluded . '/') === 0) {
                    $shouldExclude = true;
                    break;
                }
            }
            
            if ($shouldExclude) {
                continue;
            }
            
            if (is_dir($fullPath)) {
                $zip->addEmptyDir($relativePath);
                $this->addFolderToZip($fullPath, $zip, $basePath, $exclude_folders);
            } else {
                $zip->addFile($fullPath, $relativePath);
            }
        }
        $dir->close();
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
}
