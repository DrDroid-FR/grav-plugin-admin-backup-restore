/**
 * Admin Backup Restore Plugin
 * JavaScript for handling restore button in admin backup page
 */

(function() {
    'use strict';

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        // Add time column first
        injectTimeColumn();
        
        // Try to inject buttons immediately
        injectRestoreButtons();
        
        // Set up a mutation observer to watch for table changes
        observeTableChanges();
    });

    function injectTimeColumn() {
        // Time is now rendered directly in the template (date + time in one cell)
        // No JS injection needed
    }
    
    function injectRestoreButtons() {
        const tableBody = document.querySelector('.backups-history tbody');
        if (!tableBody) return;
        
        // Check if buttons already injected
        if (tableBody.dataset.restoreButtonsInjected) return;
        
        const rows = tableBody.querySelectorAll('tr');
        if (rows.length === 0) return;
        
        // Get nonce from window
        const nonce = window.admin_nonce;
        
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
                    injectTimeColumn();
                    injectRestoreButtons();
                }
            });
        });
        
        observer.observe(table, { childList: true, subtree: true });
    }

    // Handle restore button clicks using event delegation
    document.addEventListener('click', function(e) {
        const restoreBtn = e.target.closest('.button-restore');
        
        if (!restoreBtn) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const restoreUrl = restoreBtn.dataset.backupRestore;
        
        // Get the backup title from the row to determine backup type
        const row = restoreBtn.closest('tr');
        const titleCell = row ? row.querySelector('td:nth-child(3)') : null;
        const backupTitle = titleCell ? titleCell.textContent.trim() : 'this backup';
        
        // Show our custom modal for all restore operations
        showRestoreConfirm(restoreUrl, backupTitle);
    });

    function showRestoreConfirm(restoreUrl, backupTitle) {
        const translations = getTranslations();

        // Determine if this is a pre_restore backup
        const isPreRestore = backupTitle.toLowerCase().includes('pre restore');

        // Build analyze URL from restore URL (swap task:backupRestore -> task:analyzeRestore)
        const analyzeUrl = restoreUrl.replace('/task:backupRestore/', '/task:analyzeRestore/');

        // Fetch backup analysis before showing the modal
        fetch(analyzeUrl, { method: 'GET', credentials: 'same-origin' })
            .then(function(response) { return response.json(); })
            .then(function(analysis) {
                if (analysis.status === 'success') {
                    showRestoreConfirmWithAnalysis(restoreUrl, backupTitle, isPreRestore, analysis, translations);
                } else {
                    // Analysis failed, show modal without analysis info
                    showRestoreConfirmWithAnalysis(restoreUrl, backupTitle, isPreRestore, null, translations);
                }
            })
            .catch(function() {
                // Network error, show modal without analysis info
                showRestoreConfirmWithAnalysis(restoreUrl, backupTitle, isPreRestore, null, translations);
            });
    }

    function showRestoreConfirmWithAnalysis(restoreUrl, backupTitle, isPreRestore, analysis, translations) {
        // Customize message based on backup type
        let message;
        if (isPreRestore) {
            message = translations.RESTORE_PRE_RESTORE_MESSAGE || 'You are about to restore a pre-restore backup. This will overwrite your current site with the backup content.';
        } else {
            message = translations.RESTORE_CONFIRM_MESSAGE || 'Are you sure you want to restore this backup? A backup of the current site will be created automatically before restoring.';
        }

        const customTranslations = {
            ...translations,
            RESTORE_CONFIRM_MESSAGE: message
        };

        showConfirmModal(customTranslations, restoreUrl, backupTitle, isPreRestore, analysis);
    }

    function showConfirmModal(translations, restoreUrl, backupTitle, isPreRestore, analysis) {
        // Create a flag to track if restore is in progress
        let isRestoreInProgress = false;
        // Track selected restore mode (use config default)
        let selectedMode = window.admin_default_restore_mode || 'merge';
        
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
                '<svg style="width: 32px; height: 32px; fill: white;" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>' +
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
            '<p style="margin: 0; padding: 16px; background: #f3f4f6; border-radius: 8px; color: #111827; font-weight: 600; font-size: 15px;">' + backupTitle + '</p>';

        // Show analysis info if available
        if (analysis && analysis.status === 'success') {
            html += '<div style="margin-top: 16px; padding: 12px 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; text-align: left;">' +
                '<p style="margin: 0 0 4px; color: #1e40af; font-size: 13px; font-weight: 600;">' + (translations.RESTORE_BACKUP_CONTAINS || 'Backup contents:') + '</p>' +
                '<p style="margin: 0; color: #3b82f6; font-size: 13px;">' +
                    (analysis.file_count || 0) + ' ' + (translations.RESTORE_FILES || 'files') +
                    ' &middot; ' + analysis.top_level.length + ' ' + (translations.RESTORE_TOP_LEVEL || 'top-level entries') +
                '</p>' +
            '</div>';
        }

        // Show restore mode selection (not for pre-restore backups)
        if (!isPreRestore) {
            html += '<div style="margin-top: 16px; text-align: left;">' +
                '<p style="margin: 0 0 10px; color: #374151; font-size: 14px; font-weight: 600;">' + (translations.RESTORE_MODE_LABEL || 'Restore mode:') + '</p>';

            // Merge mode radio
            const mergeChecked = selectedMode === 'merge';
            const cleanChecked = selectedMode === 'clean';

            html += '<label id="mode-merge-label" style="display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 2px solid ' + (mergeChecked ? '#6366f1' : '#d1d5db') + '; border-radius: 8px; margin-bottom: 8px; cursor: pointer; background: ' + (mergeChecked ? '#eef2ff' : 'white') + '; transition: all 0.2s;">' +
                '<input type="radio" name="restore_mode" value="merge"' + (mergeChecked ? ' checked' : '') + ' style="margin-top: 3px; accent-color: #6366f1;">' +
                '<span>' +
                    '<span style="display: block; color: #111827; font-size: 14px; font-weight: 600;">' + (translations.RESTORE_MODE_MERGE || 'Add & Overwrite') + '</span>' +
                    '<span style="display: block; color: #6b7280; font-size: 12px; margin-top: 2px; line-height: 1.4;">' + (translations.RESTORE_MODE_MERGE_DESC || 'Only add new files and overwrite existing ones. Files not in the backup will be kept.') + '</span>' +
                '</span>' +
            '</label>';

            // Clean mode radio
            html += '<label id="mode-clean-label" style="display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 2px solid ' + (cleanChecked ? '#6366f1' : '#d1d5db') + '; border-radius: 8px; cursor: pointer; background: ' + (cleanChecked ? '#eef2ff' : 'white') + '; transition: all 0.2s;">' +
                '<input type="radio" name="restore_mode" value="clean"' + (cleanChecked ? ' checked' : '') + ' style="margin-top: 3px; accent-color: #6366f1;">' +
                '<span>' +
                    '<span style="display: block; color: #111827; font-size: 14px; font-weight: 600;">' + (translations.RESTORE_MODE_CLEAN || 'Clean Restore') + '</span>' +
                    '<span style="display: block; color: #6b7280; font-size: 12px; margin-top: 2px; line-height: 1.4;">' + (translations.RESTORE_MODE_CLEAN_DESC || 'Remove all existing site files first, then restore. The site will match the backup exactly.') + '</span>' +
                '</span>' +
            '</label>';

            html += '</div>';
        }

        html += '</div>';
        
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

        // Radio button visual state management
        const radios = modal.querySelectorAll('input[name="restore_mode"]');
        for (var r = 0; r < radios.length; r++) {
            radios[r].addEventListener('change', function() {
                selectedMode = this.value;
                var mergeLabel = modal.querySelector('#mode-merge-label');
                var cleanLabel = modal.querySelector('#mode-clean-label');
                if (mergeLabel && cleanLabel) {
                    mergeLabel.style.borderColor = selectedMode === 'merge' ? '#6366f1' : '#d1d5db';
                    mergeLabel.style.background = selectedMode === 'merge' ? '#eef2ff' : 'white';
                    cleanLabel.style.borderColor = selectedMode === 'clean' ? '#6366f1' : '#d1d5db';
                    cleanLabel.style.background = selectedMode === 'clean' ? '#eef2ff' : 'white';
                }
            });
        }

        cancelBtn.addEventListener('click', function() {
            // Only allow closing if restore is not in progress
            if (!isRestoreInProgress) {
                closeModal(modal);
            }
        });
        
        confirmBtn.addEventListener('click', function() {
            // Set the flag to indicate restore is in progress
            isRestoreInProgress = true;

            // Append restore_mode to the restore URL
            var finalUrl = restoreUrl;
            if (!isPreRestore && selectedMode) {
                finalUrl = restoreUrl.replace('/task:backupRestore/', '/task:backupRestore/restore_mode:' + selectedMode + '/');
            }

            // Update confirmation modal to show progress instead of closing it
            updateModalForProgress(modal, translations, isPreRestore);
            performRestoreWithModalUpdates(finalUrl, isPreRestore, modal);
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
            ? (translations.RESTORE_RESTORING || 'Restoring from backup...')
            : (translations.RESTORE_CREATING_PREBACKUP || 'Creating pre-restore backup...');
        
        // Update content to show progress bar, step message and percent
        contentDiv.innerHTML =
            '<div style="padding: 28px 32px; text-align: center;">' +
            '<p id="restore-step-message" style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">' + firstMsg + '</p>' +
            '<div style="width: 100%; background: #e5e7eb; border-radius: 8px; height: 8px; overflow: hidden; margin-bottom: 8px;">' +
            '<div id="progress-bar" style="width: 0%; background: #3498db; height: 100%; transition: width 0.5s ease; border-radius: 8px;"></div>' +
            '</div>' +
            '<p id="restore-percent" style="margin: 0; color: #9ca3af; font-size: 13px; font-weight: 600;">0%</p>' +
            '</div>';
        
        // Hide the buttons
        const cancelBtn = modal.querySelector('#cancel-restore-btn');
        const confirmBtn = modal.querySelector('#confirm-restore-btn');
        if (cancelBtn && cancelBtn.parentNode) cancelBtn.parentNode.style.display = 'none';
        if (confirmBtn && confirmBtn.parentNode) confirmBtn.parentNode.style.display = 'none';
    }

    // Perform restore with real-time SSE streaming
    function performRestoreWithModalUpdates(url, isPreRestore, confirmModal) {
        const translations = getTranslations();
        const modal = confirmModal;
        const stepEl = modal.querySelector('#restore-step-message');
        const barEl = modal.querySelector('#progress-bar');
        const percentEl = modal.querySelector('#restore-percent');

        fetch(url, {
            method: 'GET',
            credentials: 'same-origin'
        }).then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            function read() {
                reader.read().then(function(result) {
                    if (result.done) return;

                    buffer += decoder.decode(result.value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line

                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (!line.startsWith('data: ')) continue;

                        try {
                            var data = JSON.parse(line.substring(6));

                            if (data.step) {
                                if (stepEl) stepEl.textContent = data.message;
                                if (barEl) {
                                    barEl.style.width = (data.percent || 0) + '%';
                                    // Pulse animation during long operations
                                    if (data.step === 'pre_backup' || data.step === 'extract') {
                                        barEl.style.animation = 'progressPulse 1.2s ease-in-out infinite';
                                    } else {
                                        barEl.style.animation = 'none';
                                    }
                                }
                                if (percentEl) percentEl.textContent = (data.percent || 0) + '%';
                            }

                            if (data.status === 'success') {
                                setTimeout(function() {
                                    closeModal(modal);
                                    var message = data.message || 'Restore complete!';
                                    var details = data.details ? data.details.trim() : '';
                                    if (details) {
                                        message += '<br><span style="font-size:14px;color:#6b7280;margin-top:8px;display:block;">' + details + '</span>';
                                    }
                                    updatePersistentModal(message, 'success');
                                    window.location.reload();
                                }, 400);
                                return;
                            }

                            if (data.status === 'error') {
                                setTimeout(function() {
                                    closeModal(modal);
                                    updatePersistentModal(data.message || translations.RESTORE_ERROR, 'error');
                                }, 400);
                                return;
                            }
                        } catch (e) {
                            // Skip malformed SSE lines
                        }
                    }

                    read();
                }).catch(function(err) {
                    closeModal(modal);
                    updatePersistentModal(translations.RESTORE_ERROR + ': ' + err.message, 'error');
                });
            }

            read();
        }).catch(function(error) {
            closeModal(modal);
            updatePersistentModal(translations.RESTORE_ERROR + ': ' + error.message, 'error');
        });
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
        const defaults = {
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
            RESTORE_FINISH: 'Restore complete ! Refreshing...',
            RESTORE_MODE_LABEL: 'Restore mode:',
            RESTORE_MODE_MERGE: 'Add & Overwrite',
            RESTORE_MODE_MERGE_DESC: 'Only add new files and overwrite existing ones. Files not in the backup will be kept.',
            RESTORE_MODE_CLEAN: 'Clean Restore',
            RESTORE_MODE_CLEAN_DESC: 'Remove all existing site files first, then restore. The site will match the backup exactly.',
            RESTORE_BACKUP_CONTAINS: 'Backup contents:',
            RESTORE_FILES: 'files',
            RESTORE_TOP_LEVEL: 'top-level entries'
        };
        
        if (typeof Admin !== 'undefined' && Admin.translations && Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE) {
            const grav = Admin.translations.PLUGIN_ADMIN_BACKUP_RESTORE;
            const result = {};
            for (const key in defaults) {
                result[key] = grav[key] || defaults[key];
            }
            return result;
        }
        
        return defaults;
    }
})();
