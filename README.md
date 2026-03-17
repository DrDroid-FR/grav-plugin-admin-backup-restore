# Admin Backup Restore Plugin for GRAV CMS

![Grav Version](https://img.shields.io/badge/Grav-1.7+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Author](https://img.shields.io/badge/author-Julien%20Perret-blue.svg)

A Grav CMS plugin that adds **restore functionality** to the admin backup page. Easily restore your site from any backup with automatic pre-restore backup creation.

## Features

- ↺ **Restore Button** - Add restore buttons to each backup in the admin backup page
- 🔒 **Automatic Pre-Restore Backup** - Creates a backup before restoring (excludes cache, images, logs, tmp, backup folders)
- ⚡ **Smart Detection** - Skips pre-restore backup when restoring a pre-restore backup
- 🎨 **Visual Distinction** - Grey buttons for pre-restore backups, blue for regular backups
- 🌐 **Bilingual** - Full support for English and French
- ✨ **Beautiful UI** - Modal overlay with blur effect during restore process

## Installation

### Manual Installation

1. Download the [latest release](https://github.com/DrDroid-FR/grav-plugin-admin-backup-restore/releases)
2. Extract the archive to `user/plugins/`
3. Rename the folder to `admin-backup-restore`
4. Clear the Grav cache

### Via GPM

Use the gpm direct-install command: 

```bash
bin/gpm direct-install https://github.com/DrDroid-FR/grav-plugin-admin-backup-restore/releases/latest/download/admin-backup-restore.zip
```

## Configuration

After installation, go to **Plugins** → **Admin Backup Restore** to configure:

| Option | Description | Default |
|--------|-------------|---------|
| Plugin Enabled | Enable/disable the plugin | Yes |
| Create Automatic Backup | Create backup before restore | Yes |
| Required Permissions | Who can restore backups | Super Admin |
| Folders to Exclude | Comma-separated folders to exclude from pre-restore backup | backup, cache, images, logs, tmp |

## Usage

1. Navigate to **Tools** → **Backups** in the admin panel
2. You'll see a **Restore** button (↻) next to each backup
3. Click the button to restore that backup
4. A confirmation modal will appear
5. Confirm to start the restore process

### Visual Button Indicators

- 🔵 **Blue button** - Regular backup (will create pre-restore backup)
- ⚫ **Grey button** - Pre-restore backup (skips pre-restore backup creation)

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

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [Dr Droid](https://github.com/DrDroid-FR)
