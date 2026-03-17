<?php

/**
 * Backup Restore Handler
 * 
 * Handles the AJAX request for restoring backups
 * This file is called directly from the JavaScript AJAX request
 */

// Get Grav instance
define('GRAV_ROOT', dirname(__DIR__, 2));
require_once GRAV_ROOT . '/vendor/autoload.php';

use Grav\Common\Backup\Backups;
use Grav\Common\Cache;
use Grav\Common\Filesystem\Archiver;
use Grav\Common\Filesystem\Folder;
use Grav\Common\Grav;
use Grav\Common\Utils;

// Initialize Grav
$grav = Grav::instance();
$grav['uri']->init();
$grav->initialize();

// Set JSON headers
header('Content-Type: application/json');

// Verify nonce
$nonce = $_GET['admin-nonce'] ?? null;
if (!Utils::verifyNonce($nonce, 'admin-form')) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Invalid security token'
    ]);
    exit;
}

// Verify permissions (check if user is logged in as admin)
$admin = $grav['admin'] ?? null;
if (!$admin || !$admin->authorize(['admin.maintenance', 'admin.super'])) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Unauthorized'
    ]);
    exit;
}

// Get backup filename
$backup_param = $_GET['backup'] ?? null;
if (null === $backup_param) {
    echo json_encode([
        'status' => 'error',
        'message' => 'No backup specified'
    ]);
    exit;
}

try {
    $filename = Utils::basename(base64_decode(urldecode($backup_param)));
    $locator = $grav['locator'];
    $backup_file = $locator->findResource("backup://{$filename}", true);

    if (!$backup_file || !file_exists($backup_file)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Backup file not found'
        ]);
        exit;
    }

    // Verify it's a valid zip file
    if (!Utils::endsWith($filename, '.zip', false)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid backup file format'
        ]);
        exit;
    }

    // Get backup directory
    $backup_dir = $locator->findResource('backup://', true, true);

    // Step 1: Create automatic backup before restore
    $inflector = $grav['inflector'];
    $profiles = Backups::getBackupProfiles();
    
    if (!empty($profiles)) {
        $profile = reset($profiles);
        $name = $inflector->underscorize($profile['name'] . '_pre_restore');
        $date = date(Backups::BACKUP_DATE_FORMAT, time());
        $pre_restore_filename = trim($name, '_') . '--' . $date . '.zip';
        $pre_restore_destination = $backup_dir . DS . $pre_restore_filename;
        
        // Create pre-restore backup
        $archiver = Archiver::create('zip');
        $archiver->setArchive($pre_restore_destination);
        
        $backup_root = $locator->findResource($profile['root'] ?? 'root://', true, true);
        
        $options = [
            'exclude_files' => Backups::convertExclude($profile['exclude_files'] ?? ''),
            'exclude_paths' => Backups::convertExclude($profile['exclude_paths'] ?? ''),
        ];
        
        $archiver->setOptions($options)->compress($backup_root);
        $grav['log']->notice('Pre-restore backup created: ' . $pre_restore_destination);
        
        $pre_restore_msg = ' A backup before restore was created: ' . $pre_restore_filename;
    } else {
        $pre_restore_msg = '';
    }

    // Step 2: Extract the selected backup
    $root_path = $locator->findResource('root://', true, true);
    
    // Extract the backup
    $archiver = Archiver::create('zip');
    $archiver->setArchive($backup_file)->extract($root_path);
    
    // Log the restore
    $grav['log']->notice('Backup restored from: ' . $backup_file);
    
    // Clear cache after restore
    Cache::clearCache('all');
    
    echo json_encode([
        'status' => 'success',
        'message' => 'Site restored successfully!' . $pre_restore_msg
    ]);
    
} catch (\Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Restore failed: ' . $e->getMessage()
    ]);
}
