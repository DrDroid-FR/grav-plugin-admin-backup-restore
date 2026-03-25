/**
 * Admin Backup Restore Plugin
 * JavaScript for handling restore button in admin backup page
 */

(function() {
    'use strict';
    
    console.log('[AdminBackupRestore] Plugin JavaScript loaded');

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        // Add time column first
        injectTimeColumn();
        
        // Try to inject buttons immediately
        injectRestoreButtons();
        
        // Also try after a delay for AJAX-loaded content
        setTimeout(injectTimeColumn, 1000);
        setTimeout(injectTimeColumn, 2000);
        setTimeout(injectRestoreButtons, 1000);
        setTimeout(injectRestoreButtons, 2000);
        
        // Set up a mutation observer to watch for table changes
        observeTableChanges();
    });

    function injectTimeColumn() {
        const table = document.querySelector('.backups-history');
        if (!table) return;
        
        const thead = table.querySelector('thead tr');
        if (!thead) return;
        
        const headerCount = thead.querySelectorAll('th').length;
        
        if (headerCount === 5) {
            // Template doesn't have time column, add it via JS
            if (table.dataset.timeColumnInjected) return;
            
            // Add Time header after Date header
            const dateHeader = thead.querySelector('th:nth-child(2)');
            if (dateHeader && !thead.querySelector('.time-header')) {
                const timeHeader = document.createElement('th');
                timeHeader.className = 'time-header';
                timeHeader.textContent = 'Time';
                dateHeader.parentNode.insertBefore(timeHeader, dateHeader.nextSibling);
            }
            
            // Add time cells to each row
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(function(row) {
                if (row.querySelector('.error')) return;
                
                const dateCell = row.querySelector('td:nth-child(2)');
                if (dateCell && !row.querySelector('.time-cell')) {
                    const timeCell = document.createElement('td');
                    timeCell.className = 'time-cell';
                    const dateText = dateCell.textContent;
                    // Extract time from format like "Mar 25, 2026 6:30 PM" or "Mar 25, 2026 18:30"
                    const match = dateText.match(/(\d{1,2}:\d{2})/);
                    timeCell.textContent = match ? match[1] : '';
                    dateCell.parentNode.insertBefore(timeCell, dateCell.nextSibling);
                }
            });
            
            table.dataset.timeColumnInjected = 'true';
        } else if (headerCount >= 6) {
            // Template has time column but might be empty, try to populate from date column
            if (table.dataset.timeColumnPopulated) return;
            
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(function(row) {
                if (row.querySelector('.error')) return;
                
                const timeCell = row.querySelector('td:nth-child(3)');
                const dateCell = row.querySelector('td:nth-child(2)');
                
                if (timeCell && dateCell && !timeCell.textContent.trim()) {
                    const dateText = dateCell.textContent;
                    const match = dateText.match(/(\d{1,2}:\d{2})/);
                    timeCell.textContent = match ? match[1] : '';
                }
            });
            
            table.dataset.timeColumnPopulated = 'true';
        }
    }
    
    function injectRestoreButtons() {
        const tableBody = document.querySelector('.backups-history tbody');
        if (!tableBody) {
            console.log('[AdminBackupRestore] No backups history table found');
            return;
        }
        
        console.log('[AdminBackupRestore] Found backups table, checking if buttons already injected...');
        
        // Check if buttons already injected
        if (tableBody.dataset.restoreButtonsInjected) {
            console.log('[AdminBackupRestore] Buttons already injected');
            return;
        }
        
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
            const nameCell = row.querySelector('td:nth-child(4)');
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
                    injectTimeColumn();
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
        console.log('[AdminBackupRestore] Click event triggered on:', e.target);
        
        const restoreBtn = e.target.closest('.button-restore');
        console.log('[AdminBackupRestore] Found restore button:', restoreBtn);
        
        if (!restoreBtn) {
            console.log('[AdminBackupRestore] No restore button found, checking for backupDelete...');
            // Check if it's the delete button or another control
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Prevent any other handlers from running (including Grav's default backup modal)
        e.stopImmediatePropagation();

        console.log('[AdminBackupRestore] Restore button clicked, URL:', restoreBtn.dataset.backupRestore);

        const restoreUrl = restoreBtn.dataset.backupRestore;
        
        // Get the backup title from the row to determine backup type
        const row = restoreBtn.closest('tr');
        const titleCell = row ? row.querySelector('td:nth-child(4)') : null;
        const backupTitle = titleCell ? titleCell.textContent.trim() : 'this backup';
        
        // Show our custom orange modal for all restore operations
        showRestoreConfirm(restoreUrl, backupTitle);
    });

    // Prevent Grav's built-in backup modals from appearing
    // This intercepts any backup-related click events at document level
    document.addEventListener('click', function(e) {
        // Check if this might be a Grav backup modal trigger
        const target = e.target;
        
        // Look for any element that might be related to backup actions
        // that isn't our restore button
        if (target.closest('[data-remodal][data-backup]') || 
            target.closest('.remodal[data-backup]') ||
            (target.tagName === 'A' && target.href && target.href.includes('backup') && !target.classList.contains('button-restore'))) {
            console.log('[AdminBackupRestore] Detected potential Grav backup modal trigger, allowing custom handler');
        }
    });
    
    function showRestoreConfirm(restoreUrl, backupTitle) {
        const translations = getTranslations();
        console.log('[AdminBackupRestore] showRestoreConfirm called with:', { restoreUrl, backupTitle, translations });
        
        // Determine if this is a pre_restore backup
        const isPreRestore = backupTitle.toLowerCase().includes('pre restore');
        
        // Customize message based on backup type
        let message;
        if (isPreRestore) {
            message = translations.RESTORE_PRE_RESTORE_MESSAGE || 'You are about to restore a pre-restore backup. This will overwrite your current site with the backup content.';
        } else {
            message = translations.RESTORE_CONFIRM_MESSAGE || 'Are you sure you want to restore this backup? A backup of the current site will be created automatically before restoring.';
        }
        
        // Create custom translations object with the appropriate message
        const customTranslations = {
            ...translations,
            RESTORE_CONFIRM_MESSAGE: message
        };
        
        // Always use custom modal (not Remodal or browser confirm)
        showConfirmModal(customTranslations, restoreUrl, backupTitle, isPreRestore);
    }

    function showConfirmModal(translations, restoreUrl, backupTitle, isPreRestore) {
        console.log('[AdminBackupRestore] showConfirmModal called, isPreRestore:', isPreRestore);
        
        // Create a flag to track if restore is in progress
        let isRestoreInProgress = false;
        
        // Create a nice confirmation modal
        const modal = document.createElement('div');
        modal.id = 'restore-confirm-modal';
        modal.dataset.pluginRestore = 'true'; // Marker to identify our modal
        
        // Build modal HTML with nice styling
        let html = '';
        
        // Different color for pre_restore backups (orange) vs normal backups (purple)
        const gradient = isPreRestore 
            ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'  // Orange for pre_restore
            : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'; // Purple for normal
        
        // Backdrop
        html += '<div id="restore-backdrop" style="' +
            'position: fixed;' +
            'top: 0;' +
            'left: 0;' +
            'width: 100vw;' +
            'height: 100vh;' +
            'background: rgba(0,0,0,0.6);' +
            '-webkit-backdrop-filter: blur(4px);' +
            'backdrop-filter: blur(4px);' +
            'z-index: 99999;' +
            'display: flex;' +
            'justify-content: center;' +
            'align-items: center;' +
            'flex-direction: column;' +
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;">';
        
        // Modal content
        html += '<div style="' +
            'background: #fff;' +
            'padding: 0;' +
            'border-radius: 12px;' +
            'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);' +
            'max-width: 450px;' +
            'width: 90%;' +
            'overflow: hidden;' +
            'animation: modalSlideIn 0.3s ease-out;">';
        
        // Header with icon
        html += '<div style="' +
            'background: ' + gradient + ';' +
            'padding: 24px 32px;' +
            'text-align: center;">' +
            '<div style="' +
                'width: 64px;' +
                'height: 64px;' +
                'margin: 0 auto 16px;' +
                'background: rgba(255,255,255,0.2);' +
                'border-radius: 50%;' +
                'display: flex;' +
                'align-items: center;' +
                'justify-content: center;">' +
                // Different icon for pre_restore vs normal backup
                (isPreRestore 
                    ? '<svg style="width: 32px; height: 32px; fill: white;" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>'  // File icon for pre_restore
                    : '<svg style="width: 32px; height: 32px; fill: white;" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>') +  // File icon for normal
            '</div>' +
            '<h2 style="margin: 0; color: white; font-size: 22px; font-weight: 600;">' + (isPreRestore ? translations.RESTORE_PRE_RESTORE_TITLE || 'Restore Pre-Restore Backup' : translations.RESTORE_BACKUP_TITLE || 'Restore Backup') + '</h2>' +
        '</div>';
        
        // Content
        // Split the confirmation message into two parts for better readability
        // Handle both "?" and "." as separators
        const confirmMsg = translations.RESTORE_CONFIRM_MESSAGE || 'Are you sure you want to restore this backup? A backup of the current site will be created automatically before restoring.';
        let firstSentenceEnd = confirmMsg.indexOf('?');
        if (firstSentenceEnd === -1) {
            firstSentenceEnd = confirmMsg.indexOf('.');
        }
        const firstPart = firstSentenceEnd > 0 ? confirmMsg.substring(0, firstSentenceEnd + 1) : confirmMsg;
        const secondPart = firstSentenceEnd > 0 ? confirmMsg.substring(firstSentenceEnd + 1).trim() : '';
        
        html += '<div style="padding: 28px 32px; text-align: center;">' +
            '<p style="margin: 0 0 8px; color: #374151; font-size: 16px; line-height: 1.6;">' + firstPart + '</p>' +
            (secondPart ? '<p style="margin: 0 0 16px; color: #6b7280; font-size: 14px; line-height: 1.5;">' + secondPart + '</p>' : '') +
            '<p style="margin: 0; padding: 16px; background: #f3f4f6; border-radius: 8px; color: #111827; font-weight: 600; font-size: 15px;">' + backupTitle + '</p>' +
        '</div>';
        
        // Footer with buttons
        const buttonGradient = isPreRestore
            ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'  // Orange for pre_restore
            : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'; // Purple for normal
        const buttonBoxShadow = isPreRestore
            ? '0 4px 6px -1px rgba(249, 115, 22, 0.3)'
            : '0 4px 6px -1px rgba(99, 102, 241, 0.3)';
        
        html += '<div style="' +
            'padding: 20px 32px 28px;' +
            'display: flex;' +
            'gap: 12px;' +
            'justify-content: center;">' +
            '<button id="cancel-restore-btn" style="' +
                'padding: 12px 28px;' +
                'border: 2px solid #d1d5db;' +
                'background: white;' +
                'color: #374151;' +
                'font-size: 15px;' +
                'font-weight: 600;' +
                'border-radius: 8px;' +
                'cursor: pointer;' +
                'transition: all 0.2s;' +
                'font-family: inherit;">' + translations.BUTTON_CANCEL + '</button>' +
            '<button id="confirm-restore-btn" style="' +
                'padding: 12px 28px;' +
                'border: none;' +
                'background: ' + buttonGradient + ';' +
                'color: white;' +
                'font-size: 15px;' +
                'font-weight: 600;' +
                'border-radius: 8px;' +
                'cursor: pointer;' +
                'transition: all 0.2s;' +
                'box-shadow: ' + buttonBoxShadow + ';' +
                'font-family: inherit;">' + translations.BUTTON_RESTORE + '</button>' +
        '</div>';
        
        html += '</div>'; // Close modal content
        html += '</div>'; // Close backdrop
        
        // Add animation keyframes
        if (!document.getElementById('modal-animations')) {
            const style = document.createElement('style');
            style.id = 'modal-animations';
            style.textContent = '@keyframes modalSlideIn { from { opacity: 0; transform: translateY(-20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } } @keyframes progressPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; box-shadow: 0 0 10px rgba(52, 152, 219, 0.5); } }';
            document.head.appendChild(style);
        }
        
        modal.innerHTML = html;
        document.body.appendChild(modal);
        
        // Add event listeners
        const cancelBtn = modal.querySelector('#cancel-restore-btn');
        const confirmBtn = modal.querySelector('#confirm-restore-btn');
        
        cancelBtn.addEventListener('click', function() {
            // Only allow closing if restore is not in progress
            if (!isRestoreInProgress) {
                closeModal(modal);
            }
        });
        
        confirmBtn.addEventListener('click', function() {
            // Set the flag to indicate restore is in progress
            isRestoreInProgress = true;
            
            // Update confirmation modal to show progress instead of closing it
            updateModalForProgress(modal, translations, isPreRestore);
            performRestoreWithModalUpdates(restoreUrl, isPreRestore, modal);
        });
        
        // Close on backdrop click - only if restore is NOT in progress
        modal.addEventListener('click', function(e) {
            if (e.target.id === 'restore-backdrop' && !isRestoreInProgress) {
                closeModal(modal);
            }
        });
        
        // Close on Escape key - only if restore is NOT in progress
        const escapeHandler = function(e) {
            if (e.key === 'Escape' && !isRestoreInProgress) {
                closeModal(modal);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    
    // Close modal function - handles both element references and ID lookups
    function closeModal(elementOrId) {
        // If it's a string, treat as ID; if it has parentNode, it's an element
        if (typeof elementOrId === 'string') {
            const modal = document.getElementById(elementOrId);
            if (modal) modal.remove();
        } else if (elementOrId && elementOrId.parentNode) {
            elementOrId.parentNode.removeChild(elementOrId);
        }
    }

    // Update confirmation modal to show progress (keeps the same modal)
    function updateModalForProgress(modal, translations, isPreRestore) {
        // Get the content div
        const contentDiv = modal.querySelector('div:nth-child(2)');
        if (!contentDiv) return;
        
        const firstMsg = isPreRestore 
            ? (translations.RESTORE_RESTORING || 'Restoring from backup... Please wait !')
            : (translations.RESTORE_CREATING_PREBACKUP || 'Creating pre-restore backup...');
        
        // Update content to show progress bar and message
        contentDiv.innerHTML =
            '<div style="padding: 28px 32px; text-align: center;">' +
            '<p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">' + firstMsg + '</p>' +
            '<div style="width: 100%; background: #e5e7eb; border-radius: 8px; height: 8px; overflow: hidden;">' +
            '<div id="progress-bar" style="width: 0%; background: #3498db; height: 100%; transition: width 0.3s ease; border-radius: 8px;"></div>' +
            '</div>' +
            '</div>';
        
        // Hide the buttons by finding them and setting display none
        const cancelBtn = modal.querySelector('#cancel-restore-btn');
        const confirmBtn = modal.querySelector('#confirm-restore-btn');
        if (cancelBtn && cancelBtn.parentNode) {
            cancelBtn.parentNode.style.display = 'none';
        }
        if (confirmBtn && confirmBtn.parentNode) {
            confirmBtn.parentNode.style.display = 'none';
        }
        
        // Animate progress bar
        setTimeout(function() {
            const bar = modal.querySelector('#progress-bar');
            if (bar) bar.style.width = '30%';
        }, 100);
        
        setTimeout(function() {
            const bar = modal.querySelector('#progress-bar');
            if (bar) bar.style.width = '60%';
        }, 1000);
        
        setTimeout(function() {
            const bar = modal.querySelector('#progress-bar');
            if (bar) {
                bar.style.width = '90%';
                bar.style.animation = 'progressPulse 0.8s ease-in-out infinite';
            }
        }, 2000);
    }

    // Perform restore with updates to the same modal
    function performRestoreWithModalUpdates(url, isPreRestore, confirmModal) {
        const translations = getTranslations();
        const modal = confirmModal;
        
        // If not pre-restore, update to show "Restoring" after 1.5s
        if (!isPreRestore) {
            setTimeout(function() {
                const bar = modal.querySelector('#progress-bar');
                if (bar) bar.style.width = '60%';
                // Also update the text message
                const contentDiv = modal.querySelector('div:nth-child(2)');
                if (contentDiv) {
                    const msgEl = contentDiv.querySelector('p');
                    if (msgEl) msgEl.textContent = translations.RESTORE_RESTORING || 'Restoring from backup... Please wait !';
                }
            }, 1500);
        }
        
        // Make the AJAX request
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
            // Show full progress
            const bar = modal.querySelector('#progress-bar');
            if (bar) {
                bar.style.width = '100%';
                bar.style.animation = 'none';
            }
            
            // Short delay before closing modal
            setTimeout(function() {
                // Remove the confirmation modal
                closeModal(modal);
                
                if (data.status === 'success') {
                    // Parse the message to extract pre-restore backup info
                    let message = data.message || translations.RESTORE_FINISH || 'Restore complete! Refreshing...';
                    console.log('[AdminBackupRestore] Response:', data);
                    
                    // Check if there's details field with pre-restore backup info
                    let preRestoreInfo = '';
                    if (data.details) {
                        let details = data.details.trim();
                        console.log('[AdminBackupRestore] Details:', details);
                        if (details && details.includes('.zip')) {
                            // Extract the zip filename from details
                            let match = details.match(/([^\s]+\.zip)/);
                            if (match && match[1]) {
                                preRestoreInfo = '<br><span style="font-size: 14px; color: #6b7280; margin-top: 8px; display: block;">' + details + '</span>';
                            }
                        }
                    }
                    
                    console.log('[AdminBackupRestore] preRestoreInfo:', preRestoreInfo);
                    if (preRestoreInfo) {
                        showNotification(message + preRestoreInfo, 'success');
                    } else {
                        showNotification(message, 'success');
                    }
                    window.location.reload();
                } else {
                    showNotification(data.message || translations.RESTORE_ERROR, 'error');
                }
            }, 500);
        })
        .catch(function(error) {
            showNotification(translations.RESTORE_ERROR + ': ' + error.message, 'error');
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
        
        // Apply bigger font only for success messages
        if (type === 'success') {
            // Main message with bigger font
            html += '<div style="' +
                'text-align: center;' +
                'line-height: 1.4;' +
                'font-size: 24px;' +
                'font-weight: bold;' +
                'color: #1a1a1a;">' + message + '</div>';
        } else {
            // Standard message for info and error
            html += '<div style="' +
                'text-align: center;' +
                'line-height: 1.6;' +
                'font-size: 16px;">' + message + '</div>';
        }
        
        html += '</div>'; // Close modal content
        html += '</div>'; // Close backdrop
        
        modalContainer.innerHTML = html;
        document.body.appendChild(modalContainer);
    }

    function getTranslations() {
        // Try to get translations from Grav
        if (typeof Admin !== 'undefined' && Admin.translations) {
            return {
                WARNING: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.WARNING || 'Warning',
                RESTORE_BACKUP_TITLE: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_BACKUP_TITLE || 'Restore Backup',
                RESTORE_CONFIRM_MESSAGE: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_CONFIRM_MESSAGE || 'Are you sure you want to restore this backup?',
                RESTORE_PRE_RESTORE_MESSAGE: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_PRE_RESTORE_MESSAGE || 'You are about to restore a pre-restore backup. This will overwrite your current site with the backup content.',
                RESTORE_PRE_RESTORE_TITLE: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_PRE_RESTORE_TITLE || 'Restore Pre-Restore Backup',
                BUTTON_RESTORE: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.BUTTON_RESTORE || 'Restore',
                BUTTON_CANCEL: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.BUTTON_CANCEL || 'Cancel',
                RESTORE_ERROR: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_ERROR || 'Restore failed',
                RESTORE_STARTED: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_STARTED || 'Restore started...',
                RESTORE_CREATING_PREBACKUP: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_CREATING_PREBACKUP || 'Creating pre-restore backup...',
                RESTORE_RESTORING: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_RESTORING || 'Restoring from backup... Please Wait !',
                RESTORE_FINISH: Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE?.RESTORE_FINISH || 'Restore complete ! Refreshing...'
            };
        }
        
        // Default English translations
        return {
            WARNING: 'Warning',
            RESTORE_BACKUP_TITLE: 'Restore Backup',
            RESTORE_CONFIRM_MESSAGE: 'Are you sure you want to restore this backup? A backup of the current site will be created automatically before restoring.',
            RESTORE_PRE_RESTORE_MESSAGE: 'You are about to restore a pre-restore backup. This will overwrite your current site with the backup content.',
            RESTORE_PRE_RESTORE_TITLE: 'Restore Pre-Restore Backup',
            BUTTON_RESTORE: 'Restore',
            BUTTON_CANCEL: 'Cancel',
            RESTORE_ERROR: 'Failed to restore backup',
            RESTORE_STARTED: 'Restore started...',
            RESTORE_CREATING_PREBACKUP: 'Creating pre-restore backup...',
            RESTORE_RESTORING: 'Restoring from backup... Please wait !',
            RESTORE_FINISH: 'Restore complete ! Refreshing...'
        };
    }
})();
