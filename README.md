# Admin Backup Restore Plugin for GRAV CMS

![Grav Version](https://img.shields.io/badge/Grav-1.7+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Author](https://img.shields.io/badge/author-Dr%20Droid-blue.svg)
![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)

A Grav CMS plugin that adds **restore functionality** to the admin backup page.  
Easily restore your site from any backup with automatic pre-restore backup creation for safety.

## Features

- ↺ **Restore Button** - Adds a Restore button next to each backup in the Admin backups list
- 🎨 **Visual Distinction** - Grey buttons for pre-restore backups, blue for regular backups
- 🔄 **Confirmation Modal** - Double-check before restoring (configurable message)
- 🔒 **Automatic Pre-Restore Backup** - Creates a backup before restoring.
- ⚡ **Smart Detection** - Skips pre-restore backup when restoring a pre-restore backup
- 📁 **Folder Exclusion** - Exclude specific folders from pre-restore backup (configurable)
- 🔒 **Permission Control** - Configure who can restore backups (Super Admin by default)
- ✨ **Beautiful UI** - Modal overlay with blur effect during restore process
- 📊 **Real-Time Progress Streaming** - Live step-by-step progress via Server-Sent Events with percentage display and animated progress bar
- 🕐 **Time Column** - Backup time displayed directly below the date in the backups table
- 🌐 **Bilingual** - Full support for English and French


## Installation

### Manual Installation

1. Download the [latest release](https://github.com/DrDroid-FR/grav-plugin-admin-backup-restore/releases/latest/)
2. Extract the archive to `user/plugins/`
3. Rename the folder to `admin-backup-restore`
4. Clear the Grav cache : ```bash bin/grav clear-cache to clear the Grav cache```

### Via GPM

Use the gpm direct-install command: 

```bash
bin/gpm direct-install https://github.com/DrDroid-FR/grav-plugin-admin-backup-restore/releases/latest/download/admin-backup-restore-1.2.0.zip
```

## Configuration

After installation, go to **Plugins** → **Admin Backup Restore** to configure:

| Option | Description | Default |
|--------|-------------|---------|
| Plugin Enabled | Enable/disable the plugin | Yes |
| Create Automatic Backup | Create backup before restore | Yes |
| Required Permissions | Who can restore backups | Super Admin |
| Folders to Exclude | Comma-separated folders to exclude from pre-restore backup | backup, cache, images, logs, tmp |
| Enable Debug Logging | Enable/disable Debug | No |

## Usage

1. Navigate to **Tools** → **Backups** in the admin panel
2. You'll see a **Restore** button (↻) next to each backup
3. Click the button to restore that backup
4. A confirmation modal will appear
5. Confirm to start the restore process

### Visual Button Indicators

- 🔵 **Blue button** - Regular backup (will create pre-restore backup)
- ⚫ **Grey button** - Pre-restore backup (skips pre-restore backup creation)

### Restore Progress

The restore process uses **Server-Sent Events (SSE)** to stream real-time updates to the browser. You'll see a live progress bar with percentage and step-by-step messages.

The progress bar pulses during the two longest operations (creating backup and extracting) to indicate activity. The final success message displays additional details (pre-restore backup filename, .git status, etc.)

## Excluded Folders

The automatic pre-restore backup excludes standard folders by default but you can customize these exclusions in the plugin configuration page and also exclude specific subfolders.

For example:

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

For general information on Grav backups, see the official documentation:
[https://learn.getgrav.org/18/advanced/backups](https://learn.getgrav.org/18/advanced/backups)

## Support

- **Issues:** https://github.com/DrDroid-FR/grav-plugin-admin-backup-restore/issues
- **Author:** Julien Perret <gravdev@drdroid.fr>
- **GitHub:** https://github.com/DrDroid-FR

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [Dr Droid](https://github.com/DrDroid-FR)
