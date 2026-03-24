# Admin Backup Restore Plugin for GRAV CMS

![Grav Version](https://img.shields.io/badge/Grav-1.7+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Author](https://img.shields.io/badge/author-Dr%20Droid-blue.svg)

A Grav CMS plugin that adds **restore functionality** to the admin backup page. Easily restore your site from any backup within the admin plugin with automatic pre-restore backup creation.

## Features

- ↺ **Restore Button** - Add restore buttons to each backup in the admin backup page
- 🔒 **Automatic Pre-Restore Backup** - Creates a backup before restoring (excludes cache, images, logs, tmp, backup folders)
- ⚡ **Smart Detection** - Skips pre-restore backup when restoring another pre-restore backup
- 🎨 **Visual Distinction** - Grey buttons for restoring pre-restore backups, blue for regular backups
- ✨ **Beautiful UI** - Modal overlay with blur effect during restore process
- 🌐 **Bilingual** - Full support for English and French
- ❌ **File and Folder Exclusion** - Exclude files and folders from pre-restore backups

## Installation

### Manual Installation

1. Download the [latest release](https://github.com/DrDroid-FR/grav-plugin-admin-backup-restore/releases)
2. Extract the archive to `user/plugins/`
3. Rename the folder to `admin-backup-restore`
4. Clear the Grav cache

### Via GPM

Use the gpm direct-install command: 

```bash
bin/gpm direct-install https://github.com/DrDroid-FR/grav-plugin-admin-backup-restore/releases/download/v1.0.0-beta.1/backup-restore-main.zip
```

## Configuration

After installation, go to **Plugins** → **Admin Backup Restore** to configure:

| Option | Description | Default |
|--------|-------------|---------|
| Plugin Enabled | Enable/disable the plugin | Yes |
| Create Automatic Backup | Create a pre-restore backup before restore | Yes |
| Required Permissions | Who can restore backups | Super Admin |
| Folders to Exclude | Comma-separated folders to exclude from pre-restore backup | backup, cache, images, logs, tmp |

## Usage

1. Navigate to **Tools** → **Backups** in the admin panel
2. You'll see a **Restore** button (↻) next to each backup
3. Click the button to restore that backup
4. A confirmation modal will appear
5. Confirm to start the restore process

### Visual Button Indicators

- 🔵 **Blue button** - Restore regular backup (will create pre-restore backup)
- ⚫ **Grey button** - Restore Pre-restore backup (skips pre-restore backup creation)

## Excluded Folders

The automatic pre-restore backup excludes these folders by default (configurable in plugin settings):
- `/backup`
- `/cache`
- `/images`
- `/logs`
- `/tmp`

You can customize these exclusions in the plugin configuration page.

### Using Subfolder Exclusions

You can also exclude subfolders using the path format. For example:

```
backup, cache, images, logs, tmp, user/images/thumbs, user/files/temp
```

This will exclude:
- The top-level folders: `backup/`, `cache/`, `images/`, `logs/`, `tmp/`
- The subfolders: `user/images/thumbs/`, `user/files/temp/`

## Requirements

- Grav CMS 1.7+
- Admin Plugin 1.10+
- PHP 7.4+

## Support

- **Issues:** https://github.com/DrDroid-FR/grav-plugin-admin-backup-restore/issues
- **Author:** Julien Perret <gravdev@drdroid.fr>
- **GitHub:** https://github.com/DrDroid-FR

## TO-DO

My initial release is using a PHP ZipArchive because it was coded for my own personal use, I need to use the GRAV's native archiver.

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [Dr Droid](https://github.com/DrDroid-FR)
