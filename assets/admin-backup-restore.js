/**
 * Admin Backup Restore Plugin
 * JavaScript for handling restore button in admin backup page
 */

(function() {
    'use strict';

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        // Try to inject buttons immediately
        injectRestoreButtons();
        
        // Also try after a delay for AJAX-loaded content
        setTimeout(injectRestoreButtons, 1000);
        setTimeout(injectRestoreButtons, 2000);
        
        // Set up a mutation observer to watch for table changes
        observeTableChanges();
    });

    function injectRestoreButtons() {
        const tableBody = document.querySelector('.backups-history tbody');
        if (!tableBody) return;
        
        // Check if buttons already injected
        if (tableBody.dataset.restoreButtonsInjected) return;
        
        const rows = tableBody.querySelectorAll('tr');
        if (rows.length === 0) return;
        
        // Get nonce from window
        const nonce = window.admin_nonce || getNonceFromPage();
        
        rows.forEach(function(row) {
            // Skip empty message row
            if (row.querySelector('.error')) return;
            
            // Check if restore button already exists
            if (row.querySelector('.button-restore')) return;
            
            const actionCell = row.querySelector('td:last-child');
            if (!actionCell) return;
            
            // Find the encoded filename from existing buttons
            const downloadBtn = actionCell.querySelector('a[href*="download"]');
            if (!downloadBtn) return;
            
            // Extract backup filename from download URL
            // Pattern: .../admin/task:backup/download:filename/admin-nonce:xxx
            const href = downloadBtn.href;
            
            // Match the download parameter
            let match = href.match(/download:([^/]+)/);
            if (!match) {
                // Try alternative pattern
                match = href.match(/download=([^&]+)/);
            }
            
            if (!match) {
                return;
            }
            
            const encodedFilename = match[1];
            
            // Get base URL - extract from the download button href
            // The base should include the admin path
            const urlParts = href.split('/admin/');
            let adminBase = '';
            if (urlParts.length > 1) {
                // Get everything up to and including /admin/
                const beforeAdmin = urlParts[0];
                adminBase = beforeAdmin + '/admin';
            } else {
                // Fallback - try to get from window
                adminBase = window.base_url || '';
            }
            
            // Use the correct endpoint format for backup tasks
            // Format: /admin/backup.json/backup:filename/task:backupRestore/admin-nonce:nonce
            const restoreUrl = adminBase + '/backup.json/backup:' + encodedFilename + '/task:backupRestore/admin-nonce:' + nonce;
            
            // Create restore button with proper styling
            const restoreBtn = document.createElement('a');
            restoreBtn.href = '#';
            restoreBtn.className = 'button button-small button-restore hint--bottom';
            restoreBtn.dataset.hint = 'Restore';
            
            // Check if this is a pre_restore_backup by looking at the backup name in the row
            const nameCell = row.querySelector('td:nth-child(3)');
            const backupName = nameCell ? nameCell.textContent.toLowerCase() : '';
            const isPreRestore = backupName.includes('pre restore');
            
            if (isPreRestore) {
                // Grey button - restoring a pre_restore backup won't create another pre-restore backup
                restoreBtn.classList.add('button-secondary');
                restoreBtn.style.cssText = 'background-color: #6c757d !important; border-color: #6c757d !important; color: #fff !important; margin-right: 4px !important; font-weight: bold;';
            } else {
                // Blue button - restoring a normal backup will create a pre-restore backup first
                restoreBtn.classList.add('button-primary');
                restoreBtn.style.cssText = 'background-color: #3498db !important; border-color: #3498db !important; color: #fff !important; margin-right: 4px !important; font-weight: bold;';
            }
            
            restoreBtn.dataset.backupRestore = restoreUrl;
            restoreBtn.innerHTML = '<i class="fa fa-rotate-left"></i>';
            
            // Insert before delete button
            const deleteBtn = actionCell.querySelector('[data-ajax*="backupDelete"]');
            if (deleteBtn) {
                actionCell.insertBefore(restoreBtn, deleteBtn);
            } else {
                actionCell.appendChild(restoreBtn);
            }
        });
        
        // Mark as processed
        tableBody.dataset.restoreButtonsInjected = 'true';
    }

    function observeTableChanges() {
        const table = document.querySelector('.backups-history');
        if (!table) return;
        
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    injectRestoreButtons();
                }
            });
        });
        
        observer.observe(table, { childList: true, subtree: true });
    }

    function getNonceFromPage() {
        // Try to get nonce from page
        const scripts = document.querySelectorAll('script');
        for (let i = 0; i < scripts.length; i++) {
            const match = scripts[i].textContent.match(/admin_nonce\s*=\s*['"]([^'"]+)['"]/);
            if (match) return match[1];
        }
        
        // Try from data attributes
        const body = document.body;
        if (body && body.dataset.adminNonce) {
            return body.dataset.adminNonce;
        }
        
        return '';
    }

    // Handle restore button clicks using event delegation
    document.addEventListener('click', function(e) {
        const restoreBtn = e.target.closest('.button-restore');
        if (!restoreBtn) return;

        e.preventDefault();
        e.stopPropagation();

        const restoreUrl = restoreBtn.dataset.backupRestore;
        
        // Get the backup title from the row
        const row = restoreBtn.closest('tr');
        const titleCell = row ? row.querySelector('td:nth-child(3)') : null;
        const backupTitle = titleCell ? titleCell.textContent.trim() : 'this backup';
        
        showRestoreConfirm(restoreUrl, backupTitle);
    });

    function showRestoreConfirm(restoreUrl, backupTitle) {
        const translations = getTranslations();
        
        // Create confirmation modal
        const modal = document.createElement('div');
        modal.className = 'remodal backup-restore-modal';
        modal.dataset.remodalId = 'backup-restore-confirm';
        
        modal.innerHTML = `
            <div class="remodal-content">
                <h2><i class="fa fa-warning"></i> ${translations.WARNING}</h2>
                <p>${translations.RESTORE_CONFIRM_MESSAGE}</p>
                <p class="backup-name"><strong>${backupTitle}</strong></p>
            </div>
            <div class="remodal-footer">
                <button class="button" data-remodal-action="cancel">${translations.BUTTON_CANCEL}</button>
                <button class="button button-danger" id="confirm-restore-btn">${translations.BUTTON_RESTORE}</button>
            </div>
        `;

        document.body.appendChild(modal);

        // Initialize Remodal if available
        if (typeof Remodal !== 'undefined') {
            const remodal = new Remodal(modal);
            remodal.open();
            
            modal.querySelector('#confirm-restore-btn').addEventListener('click', function() {
                remodal.close();
                performRestore(restoreUrl);
            });
        } else {
            // Fallback to native confirm
            if (confirm(translations.RESTORE_CONFIRM_MESSAGE)) {
                performRestore(restoreUrl);
            }
            modal.remove();
        }
        
        // Clean up modal after it's closed
        setTimeout(function() {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 1000);
    }

    function performRestore(url) {
        const translations = getTranslations();
        
        // Show initial message - Restore started
        showNotification(translations.RESTORE_STARTED || 'Restore started...', 'info');

        // Perform AJAX request
        fetch(url, {
            method: 'GET',
            credentials: 'same-origin'
        })
        .then(function(response) {
            return response.text().then(function(text) {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return { status: 'error', message: 'Server returned: ' + text.substring(0, 200) };
                }
            });
        })
        .then(function(data) {
            if (data.status === 'success') {
                // Show success message - keep modal visible until refresh
                showNotification(data.message || translations.RESTORE_FINISH || 'Restore complete! Refreshing...', 'success');
                
                // Refresh page immediately
                window.location.reload();
            } else {
                showNotification(data.message || translations.RESTORE_ERROR, 'error');
                
                // Close modal after showing error
                setTimeout(function() {
                    closeModal();
                }, 3000);
            }
        })
        .catch(function(error) {
            showNotification(translations.RESTORE_ERROR + ': ' + error.message, 'error');
            
            // Close modal after showing error
            setTimeout(function() {
                closeModal();
            }, 3000);
        });
    }

    
    function showNotification(message, type) {
        updatePersistentModal(message, type);
    }
    
    function updatePersistentModal(message, type) {
        
        const colors = {
            'success': 'rgb(40, 167, 69)',
            'error': 'rgb(220, 53, 69)',
            'info': 'rgb(23, 162, 184)'
        };
        
        const icon = {
            'success': '<div style="width: 48px; height: 48px; margin-bottom: 10px; border-radius: 50%; background: #28a745; display: flex; align-items: center; justify-content: center; place-self: anchor-center;"><span style="color: white; font-size: 28px; font-weight: bold;">✓</span></div>',
            'error': '<div style="width: 48px; height: 48px; border-radius: 50%; background: #dc3545; display: flex; align-items: center; justify-content: center; place-self: anchor-center;"><span style="color: white; font-size: 28px; font-weight: bold;">✕</span></div>',
            'info': '<div class="spinner-icon" style="width: 48px; height: 48px; margin-bottom: 10px; border: 4px solid #e9ecef; border-top: 4px solid #17a2b8; border-radius: 50%; animation: spin 1s linear infinite; place-self: anchor-center;"></div>'
        };
        
        const color = colors[type] || colors.info;
        const iconHtml = icon[type] || icon.info;
        
        // Remove existing modal if any
        const existing = document.getElementById('custom-restore-modal');
        if (existing) {
            existing.remove();
        }
        
        // Create modal container
        const modalContainer = document.createElement('div');
        modalContainer.id = 'custom-restore-modal';
        
        // Add spinner keyframes if not already added
        if (!document.getElementById('spinner-styles')) {
            const style = document.createElement('style');
            style.id = 'spinner-styles';
            style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
        
        // Build HTML with inline styles for maximum compatibility
        let html = '';
        
        // Backdrop with blur
        html += '<div style="' +
            'position: fixed;' +
            'top: 0;' +
            'left: 0;' +
            'width: 100vw;' +
            'height: 100vh;' +
            'background: rgba(0,0,0,0.7);' +
            '-webkit-backdrop-filter: blur(8px);' +
            'backdrop-filter: blur(8px);' +
            'z-index: 99999;' +
            'display: flex;' +
            'justify-content: center;' +
            'align-items: center;' +
            'flex-direction: column;">';
        
        // Modal content box
        html += '<div style="' +
            'background: white;' +
            'padding: 40px 50px;' +
            'border-radius: 12px;' +
            'box-shadow: 0 20px 60px rgba(0,0,0,0.5);' +
            'border-top: 6px solid ' + color + ';' +
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;' +
            'font-size: 18px;' +
            'color: #333;' +
            'max-width: 500px;' +
            'text-align: center;' +
            'display: flex;' +
            'flex-direction: column;' +
            'align-items: center;' +
            'gap: 25px;' +
            'margin: auto;">';
        
        // Icon
        html += iconHtml;
        
        // Message
        html += '<div style="' +
            'text-align: center;' +
            'line-height: 1.6;' +
            'font-size: 16px;">' + message + '</div>';
        
        html += '</div>'; // Close modal content
        html += '</div>'; // Close backdrop
        
        modalContainer.innerHTML = html;
        document.body.appendChild(modalContainer);
    }
    
    function closeModal() {
        const modal = document.getElementById('custom-restore-modal');
        if (modal) modal.remove();
    }

    function getTranslations() {
        // Try to get translations from Grav
        if (typeof Admin !== 'undefined' && Admin.translations) {
            return {
                WARNING: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.WARNING || 'Warning',
                RESTORE_CONFIRM_MESSAGE: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_CONFIRM_MESSAGE || 'Are you sure you want to restore this backup?',
                BUTTON_RESTORE: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.BUTTON_RESTORE || 'Restore',
                BUTTON_CANCEL: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.BUTTON_CANCEL || 'Cancel',
                RESTORE_ERROR: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_ERROR || 'Restore failed',
                RESTORE_STARTED: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_STARTED || 'Restore started...',
                RESTORE_FINISH: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_FINISH || 'Restore complete! Refreshing...'
            };
        }
        
        // Default English translations
        return {
            WARNING: 'Warning',
            RESTORE_CONFIRM_MESSAGE: 'Are you sure you want to restore this backup? A backup of the current site will be created automatically before restoring.',
            BUTTON_RESTORE: 'Restore',
            BUTTON_CANCEL: 'Cancel',
            RESTORE_ERROR: 'Failed to restore backup',
            RESTORE_STARTED: 'Restore started...',
            RESTORE_FINISH: 'Restore complete! Refreshing...'
        };
    }
})();
