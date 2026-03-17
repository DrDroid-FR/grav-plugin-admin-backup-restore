# Changelog

All notable changes to this plugin will be documented in this file.

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
