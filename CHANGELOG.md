# Changelog

All notable changes to this plugin will be documented in this file.

## [1.3.0] - 2026-03-31

### Added
- **Restore mode selection**: Users can now choose between "Add & Overwrite" (merge) and "Clean Restore" before confirming a restore
- **Clean restore mode**: Removes all existing site files (except protected paths: backup, cache, logs, tmp) before extracting the archive, ensuring the site matches the backup exactly
- **Backup analysis endpoint** (`task:analyzeRestore`): Returns zip metadata (file count, total size, top-level entries) before the restore modal is shown
- **Backup info box** in confirmation modal: Displays file count and top-level folder structure from the backup archive
- `default_restore_mode` config option (select: merge/clean) to set the default mode shown in the restore dialog
- `cleanBeforeExtract()` method for safe recursive cleanup with protected path exclusions
- Pre-restore backups always use clean restore mode (no choice needed)
- New translation keys (EN + FR): `RESTORE_MODE_LABEL`, `RESTORE_MODE_MERGE`, `RESTORE_MODE_MERGE_DESC`, `RESTORE_MODE_CLEAN`, `RESTORE_MODE_CLEAN_DESC`, `RESTORE_BACKUP_CONTAINS`, `RESTORE_FILES`, `RESTORE_TOP_LEVEL`

### Changed
- Confirmation modal now fetches backup analysis before displaying, showing metadata alongside the restore options
- Restore URL now includes `restore_mode` parameter passed to the SSE endpoint
- `onAdminControllerInit` now handles both `backupRestore` and `analyzeRestore` tasks

## [1.2.0] - 2026-03-25

### Added
- Server-Sent Events (SSE) for real-time progress streaming from server to browser
- Live percentage display with animated progress bar
- Pulse animation on progress bar during long operations (pre-backup creation, archive extraction)
- Time column displayed below date in backups table (backups_history template override)

### Fixed
- Permission check now correctly uses configured permission level (was passing array instead of string)
- `pre_restore_backup`, `permissions`, and `restore_confirm_message` config values are now properly wired to the PHP logic
- Template override path registration now uses `onTwigTemplatePaths` hook and `array_unshift` for correct precedence over admin plugin template

### Changed
- Archive extraction now happens directly to root instead of temp folder + recursive copy (major performance improvement)
- Progress updates are now streamed in real-time rather than returned at the end
- Temp directory generation uses `uniqid()` to prevent race conditions

### Removed
- Dead code file `backup-restore.php` (181 lines of duplicate logic)
- Unused `Grav\Common\Plugin` import in PHP

### Improved
- `opendir()` now has error handling (suppresses warnings, returns early on failure)
- `getTranslations()` simplified with defaults object and loop merge

## [1.1.0] - 2026-03-24

### Added
- Real-time progress updates during restore process
- Support for progress tracking in JSON response
- Enhanced modal design with details
- Debug switch in configuration, see console

### Changed
- **Use of native GRAV function to create pre-restore backups.**
- Confirmation modals and Pre-restore backup message now display message in two lines for better readability
- Success notifications now show details like pre-restore backup filename.

### Improved
- Better user feedback during long restore operations
- Clearer distinction between restore steps in UI
- More informative success messages

## [1.0.0] - 2026-03-17

### Added
- Initial release
- Restore button added to admin backup page
- Automatic backup before restore functionality
- Configurable folder exclusions for pre-restore backup
- Support for subfolder exclusions (e.g., user/images/thumbs)
- Visual differentiation between pre_restore backups (grey) and normal backups (blue)
- Modal overlay with blur effect during restore process
- Spinning icon animation for progress indicator
- Confirmation dialog before restore
- Bilingual support (English and French)
- Clean notification modal with centered icons

### Features
- **Restore Button**: Add restore buttons to each backup in the admin backup page
- **Pre-Restore Backup**: Creates a backup before restoring (excludes cache, images, logs, tmp, backup folders by default)
- **Smart Detection**: Skips pre-restore backup when restoring a pre_restore backup
- **Visual Distinction**: Grey buttons for pre_restore backups, blue for regular backups
- **Configurable Exclusions**: Custom folders to exclude from pre-restore backup

### Configuration Options
- Plugin Enabled (toggle)
- Create Automatic Backup Before Restore (toggle)
- Restore Confirmation Message (text)
- Required Permissions (select)
- Folders to Exclude from Pre-Restore Backup (text)

### Requirements
- Grav CMS 1.7+
- Admin Plugin 1.10+
- PHP 7.4+
