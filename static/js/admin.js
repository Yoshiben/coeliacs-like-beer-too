// ================================================================================
// ADMIN.JS - Complete Refactor with STATE_KEYS and Modern Patterns
// Handles: Admin dashboard, validation queue, submission management
// ================================================================================

import { Constants } from './constants.js';
import { APIModule } from './api.js';
import { TrackingModule } from './tracking.js';
import { HelpersModule } from './helpers.js';

const STATE_KEYS = Constants.STATE_KEYS;

// ================================
// ADMIN MODULE
// ================================
export const AdminModule = (function() {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        currentTab: 'manual',
        adminToken: null,
        refreshInterval: null,
        currentModalType: null,
        modalData: null,
        stats: {
            pendingManual: 0,
            pendingSoft: 0,
            todaySubmissions: 0,
            autoApprovedToday: 0
        },
        cardAnimations: new Map()
    };
    
    const config = {
        refreshInterval: Constants.UI.REFRESH_INTERVALS.ADMIN_DASHBOARD,
        animation: {
            duration: Constants.UI.ANIMATION_DURATION,
            numberDuration: Constants.UI.NUMBER_ANIMATION_DURATION
        }
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get api() { return window.AdminApp?.getModule('api') || APIModule; },
        get tracking() { return window.AdminApp?.getModule('tracking') || TrackingModule; },
        get helpers() { return window.AdminApp?.getModule('helpers') || HelpersModule; }
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🔧 Initializing Admin Module...');
        
        // Get token from URL or environment
        state.adminToken = new URLSearchParams(window.location.search).get('token') || 
                          Constants.DEFAULTS.ADMIN_TOKEN;
        
        // Store token in app state
        window.AdminApp?.setState?.('adminToken', state.adminToken);
        
        // Initialize UI
        setupEventListeners();
        initializeKeyboardShortcuts();
        
        // Load initial data
        loadStats();
        loadTabData(state.currentTab);
        
        // Set up auto-refresh
        startAutoRefresh();
        
        console.log('✅ Admin Module initialized');
    };
    
    // ================================
    // TAB MANAGEMENT
    // ================================
    const switchTab = (tabName) => {
        console.log(`🔄 Switching to ${tabName} tab`);
        
        // Update state
        state.currentTab = tabName;
        window.AdminApp?.setState?.('adminCurrentTab', tabName);
        
        // Update UI
        updateTabUI(tabName);
        
        // Load data for the selected tab
        loadTabData(tabName);
        
        // Track tab switch
        modules.tracking?.trackEvent('admin_tab_switch', 'Admin Navigation', tabName);
    };
    
    const updateTabUI = (tabName) => {
        // Update tab buttons
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.toggle('active', tab.id === `${tabName}-tab-btn`);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-content`);
        });
    };
    
    // ================================
    // DATA LOADING
    // ================================
    const loadStats = async () => {
        try {
            const stats = await modules.api.admin.getValidationStats(state.adminToken);
            
            if (!stats || stats.error) {
                throw new Error(stats?.error || 'Failed to load stats');
            }
            
            // Update state
            state.stats = {
                pendingManual: stats.pending_manual || 0,
                pendingSoft: stats.pending_soft || 0,
                todaySubmissions: stats.today_submissions || 0,
                autoApprovedToday: stats.auto_approved_today || 0
            };
            
            // Update UI with animations
            animateStatUpdates(state.stats);
            
            // Update tab badges
            updateTabBadges(state.stats);
            
            // Setup clickable stat cards
            setupClickableStatCards(state.stats);
            
            console.log('✅ Stats updated:', state.stats);
            
        } catch (error) {
            console.error('❌ Error loading stats:', error);
            showToast('Failed to load statistics', 'error');
        }
    };
    
    const loadTabData = async (tabName) => {
        const containerMap = {
            'manual': 'manualReviewList',
            'soft': 'softValidationList', 
            'recent': 'recentActivityList'
        };
        
        const apiMap = {
            'manual': 'getPendingReviews',
            'soft': 'getSoftValidationQueue',
            'recent': 'getRecentSubmissions'
        };
        
        const container = document.getElementById(containerMap[tabName]);
        const apiMethod = apiMap[tabName];
        
        if (!container || !apiMethod) return;
        
        try {
            // Show loading state
            showLoadingState(container);
            
            const items = await modules.api.admin[apiMethod](state.adminToken);
            
            if (items.error) {
                throw new Error(items.error);
            }
            
            // Update UI
            if (items.length === 0) {
                showEmptyState(container, tabName);
            } else {
                displayItems(container, items, tabName);
            }
            
            console.log(`✅ Loaded ${items.length} items for ${tabName} tab`);
            
        } catch (error) {
            console.error(`❌ Error loading ${tabName} data:`, error);
            showErrorState(container, error);
            showToast(`Failed to load ${tabName} data`, 'error');
        }
    };
    
    // ================================
    // UI STATE MANAGEMENT
    // ================================
    const showLoadingState = (container) => {
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <div>Loading...</div>
            </div>
        `;
    };
    
    const showEmptyState = (container, tabName) => {
        const messages = {
            'manual': {
                icon: '🎉',
                title: 'All caught up!',
                message: 'No submissions need manual review right now.'
            },
            'soft': {
                icon: '⏰',
                title: 'Queue is empty',
                message: 'No items in soft validation queue.'
            },
            'recent': {
                icon: '📊',
                title: 'No recent activity',
                message: 'No submissions in the last 7 days.'
            }
        };
        
        const config = messages[tabName] || messages.manual;
        
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${config.icon}</div>
                <div class="empty-title">${config.title}</div>
                <div class="empty-message">${config.message}</div>
            </div>
        `;
    };
    
    const showErrorState = (container, error) => {
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <div class="error-title">Error loading data</div>
                <div class="error-message">${modules.helpers.escapeHtml(error.message)}</div>
                <button class="btn btn-primary" onclick="AdminModule.retryCurrentTab()">
                    Try Again
                </button>
            </div>
        `;
    };
    
    const displayItems = (container, items, tabType) => {
        container.innerHTML = items.map(item => createSubmissionCard(item, tabType)).join('');
        
        // Add animations
        container.querySelectorAll('.submission-card').forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.3s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 50);
        });
    };
    
    // ================================
    // CARD CREATION
    // ================================
    const createSubmissionCard = (submission, type) => {
        const isNewPub = !submission.pub_id || submission.pub_status === 'New Pub';
        const isNewBrewery = submission.brewery_status === 'New Brewery';
        
        // Determine card styling
        const cardClasses = ['submission-card'];
        if (isNewPub) cardClasses.push('new-pub');
        else if (isNewBrewery) cardClasses.push('new-brewery');
        else cardClasses.push('existing');
        
        // Create status badges
        const badges = createStatusBadges(isNewPub, isNewBrewery);
        
        // Format submission time
        const submissionTime = new Date(submission.submitted_at || submission.submission_time)
            .toLocaleString();
        
        return `
            <div class="${cardClasses.join(' ')}" data-submission-id="${submission.submission_id}">
                ${createCardHeader(submission, submissionTime, badges)}
                ${createCardDetails(submission)}
                ${createCardActions(submission, type)}
            </div>
        `;
    };
    
    const createStatusBadges = (isNewPub, isNewBrewery) => {
        const badges = [];
        if (isNewPub) badges.push('<span class="badge new-pub">New Pub</span>');
        if (isNewBrewery) badges.push('<span class="badge new-brewery">New Brewery</span>');
        if (!isNewPub && !isNewBrewery) badges.push('<span class="badge existing">Known Entities</span>');
        return badges;
    };
    
    const createCardHeader = (submission, submissionTime, badges) => `
        <div class="submission-header">
            <div class="submission-info">
                <h3>${modules.helpers.escapeHtml(submission.pub_name)}</h3>
                <div class="submission-meta">
                    📅 Submitted: ${submissionTime}
                    ${submission.review_reasons ? 
                        `<br>🔍 Reasons: ${modules.helpers.escapeHtml(submission.review_reasons)}` : ''}
                </div>
            </div>
            <div class="status-badges">
                ${badges.join('')}
            </div>
        </div>
    `;
    
    const createCardDetails = (submission) => `
        <div class="submission-details">
            <div class="detail-section">
                <h4>📍 Pub Details</h4>
                ${createDetailItem('Name', submission.pub_name)}
                ${createDetailItem('Address', submission.address || 'Not provided')}
                ${createDetailItem('Postcode', submission.postcode || 'Not provided')}
            </div>
            
            <div class="detail-section">
                <h4>🍺 Beer Details</h4>
                ${createDetailItem('Brewery', submission.brewery)}
                ${createDetailItem('Beer', submission.beer_name)}
                ${createDetailItem('Format', submission.beer_format)}
                ${submission.beer_style ? createDetailItem('Style', submission.beer_style) : ''}
                ${submission.beer_abv ? createDetailItem('ABV', `${submission.beer_abv}%`) : ''}
            </div>
        </div>
    `;
    
    const createDetailItem = (label, value) => `
        <div class="detail-item">
            <span class="detail-label">${label}:</span> 
            ${modules.helpers.escapeHtml(value)}
        </div>
    `;
    
    const createCardActions = (submission, type) => {
        const actionHandlers = {
            'manual': createManualReviewActions,
            'soft': createSoftValidationActions,
            'recent': createRecentActivityActions
        };
        
        const handler = actionHandlers[type] || actionHandlers.recent;
        return handler(submission);
    };
    
    const createManualReviewActions = (submission) => `
        <div class="notes-section">
            <textarea class="notes-input" 
                      placeholder="Add admin notes (optional)..." 
                      id="notes-${submission.submission_id}"
                      data-submission-id="${submission.submission_id}"></textarea>
        </div>
        
        <div class="admin-actions">
            <button class="btn btn-info" data-action="view-details" data-submission-id="${submission.submission_id}">
                👁️ View Details
            </button>
            <button class="btn btn-reject" data-action="reject" data-submission-id="${submission.submission_id}">
                ❌ Reject
            </button>
            <button class="btn btn-approve" data-action="approve" data-submission-id="${submission.submission_id}">
                ✅ Approve
            </button>
        </div>
    `;
    
    const createSoftValidationActions = (submission) => {
        const scheduledTime = submission.scheduled_approval_time ? 
            new Date(submission.scheduled_approval_time).toLocaleString() : 'Unknown';
        
        return `
            <div class="submission-details">
                <div class="detail-section">
                    <h4>⏰ Auto-Approval Schedule</h4>
                    ${createDetailItem('Scheduled', scheduledTime)}
                    ${createDetailItem('Status', submission.approval_status || 'Pending')}
                </div>
            </div>
            
            <div class="admin-actions">
                <button class="btn btn-info" data-action="view-details" data-submission-id="${submission.submission_id}">
                    👁️ View Details
                </button>
                <button class="btn btn-approve" data-action="approve-early" data-submission-id="${submission.submission_id}">
                    ⚡ Approve Now
                </button>
            </div>
        `;
    };
    
    const createRecentActivityActions = (submission) => `
        <div class="admin-actions">
            <button class="btn btn-info" data-action="view-details" data-submission-id="${submission.submission_id}">
                👁️ View Details
            </button>
            <span class="detail-item">
                <span class="detail-label">Status:</span> 
                <strong>${submission.status || submission.validation_status}</strong> 
                (Tier ${submission.validation_tier})
            </span>
        </div>
    `;
    
    // ================================
    // ACTION HANDLERS
    // ================================
    const handleAction = async (action, submissionId) => {
        const actionMap = {
            'approve': approveSubmission,
            'reject': rejectSubmission,
            'approve-early': approveSoftValidationEarly,
            'view-details': viewSubmissionDetails
        };
        
        const handler = actionMap[action];
        if (handler) {
            await handler(submissionId);
        } else {
            console.warn(`Unknown action: ${action}`);
        }
    };
    
    const approveSubmission = async (submissionId) => {
        const notes = document.getElementById(`notes-${submissionId}`)?.value || '';
        
        if (!confirm('Approve this submission?\n\nThis will update the live database immediately!')) {
            return;
        }
        
        try {
            showToast('Approving submission...', 'info');
            
            const result = await modules.api.admin.approveSubmission(
                state.adminToken, 
                submissionId, 
                notes
            );
            
            if (result.success) {
                showToast('✅ Submission approved successfully!', 'success');
                await refreshData();
                
                modules.tracking?.trackEvent('admin_submission_approved', 'Admin Action', 'manual');
            } else {
                throw new Error(result.error || 'Failed to approve');
            }
            
        } catch (error) {
            console.error('❌ Error approving submission:', error);
            showToast(`Failed to approve: ${error.message}`, 'error');
        }
    };
    
    const rejectSubmission = async (submissionId) => {
        const notes = document.getElementById(`notes-${submissionId}`)?.value || '';
        
        if (!notes.trim()) {
            showToast('Please add a note explaining the rejection', 'error');
            document.getElementById(`notes-${submissionId}`)?.focus();
            return;
        }
        
        if (!confirm('Reject this submission?\n\nMake sure you\'ve added a clear reason.')) {
            return;
        }
        
        try {
            showToast('Rejecting submission...', 'info');
            
            const result = await modules.api.admin.rejectSubmission(
                state.adminToken, 
                submissionId, 
                notes
            );
            
            if (result.success) {
                showToast('❌ Submission rejected', 'success');
                await refreshData();
                
                modules.tracking?.trackEvent('admin_submission_rejected', 'Admin Action', 'manual');
            } else {
                throw new Error(result.error || 'Failed to reject');
            }
            
        } catch (error) {
            console.error('❌ Error rejecting submission:', error);
            showToast(`Failed to reject: ${error.message}`, 'error');
        }
    };
    
    const approveSoftValidationEarly = async (submissionId) => {
        if (!confirm('Approve this early?\n\nThis will skip the 24-hour waiting period.')) {
            return;
        }
        
        try {
            showToast('Approving early...', 'info');
            
            const result = await modules.api.admin.approveSoftValidation(
                state.adminToken, 
                submissionId
            );
            
            if (result.success) {
                showToast('⚡ Approved early!', 'success');
                await refreshData();
                
                modules.tracking?.trackEvent('admin_submission_approved', 'Admin Action', 'soft_early');
            } else {
                throw new Error(result.error || 'Failed to approve');
            }
            
        } catch (error) {
            console.error('❌ Error approving early:', error);
            showToast(`Failed to approve: ${error.message}`, 'error');
        }
    };
    
    const viewSubmissionDetails = async (submissionId) => {
        // Open modal with full details
        state.modalData = { submissionId };
        openAdminModal('details');
    };
    
    // ================================
    // MODAL MANAGEMENT
    // ================================
    const openAdminModal = (modalType) => {
        console.log(`🔍 Opening ${modalType} modal`);
        
        state.currentModalType = modalType;
        
        const modal = document.getElementById('adminReviewModal');
        if (!modal) return;
        
        // Update modal content based on type
        updateModalContent(modalType);
        
        // Show modal
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Load content
        loadModalContent(modalType);
        
        modules.tracking?.trackEvent('admin_modal_open', 'Admin UI', modalType);
    };
    
    const closeAdminModal = () => {
        console.log('🔒 Closing admin modal');
        
        const modal = document.getElementById('adminReviewModal');
        if (!modal) return;
        
        modal.style.display = 'none';
        document.body.style.overflow = '';
        
        state.currentModalType = null;
        state.modalData = null;
        
        modules.tracking?.trackEvent('admin_modal_close', 'Admin UI');
    };
    
    const updateModalContent = (modalType) => {
        const titleEl = document.getElementById('adminModalTitle');
        if (!titleEl) return;
        
        const titles = {
            'manual': '⚠️ Manual Review Required',
            'soft': '⏰ Soft Validation Queue',
            'recent': '📊 Recent Activity',
            'details': '📋 Submission Details'
        };
        
        titleEl.textContent = titles[modalType] || 'Admin Review';
    };
    
    const loadModalContent = async (modalType) => {
        const contentEl = document.getElementById('adminModalContent');
        const loadingEl = document.getElementById('adminModalLoading');
        const emptyEl = document.getElementById('adminModalEmpty');
        
        if (!contentEl) return;
        
        // Show loading
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        
        try {
            if (modalType === 'details') {
                // Load specific submission details
                await loadSubmissionDetails(state.modalData?.submissionId);
            } else {
                // Load list based on modal type
                const apiMap = {
                    'manual': 'getPendingReviews',
                    'soft': 'getSoftValidationQueue',
                    'recent': 'getRecentSubmissions'
                };
                
                const items = await modules.api.admin[apiMap[modalType]](state.adminToken);
                
                if (loadingEl) loadingEl.style.display = 'none';
                
                if (items.length === 0) {
                    if (emptyEl) {
                        showEmptyStateModal(modalType, emptyEl);
                        emptyEl.style.display = 'block';
                    }
                } else {
                    if (contentEl) {
                        contentEl.style.display = 'block';
                        displayItems(contentEl, items, modalType);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error loading modal content:`, error);
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) {
                contentEl.style.display = 'block';
                showErrorState(contentEl, error);
            }
        }
    };
    
    const showEmptyStateModal = (modalType, container) => {
        const messages = {
            'manual': {
                icon: '🎉',
                title: 'All caught up!',
                message: 'No submissions need manual review.'
            },
            'soft': {
                icon: '⏰',
                title: 'Queue empty',
                message: 'No pending soft validations.'
            },
            'recent': {
                icon: '📊',
                title: 'No activity',
                message: 'No recent submissions.'
            }
        };
        
        const config = messages[modalType];
        container.innerHTML = `
            <div class="empty-icon">${config.icon}</div>
            <div class="empty-title">${config.title}</div>
            <div class="empty-message">${config.message}</div>
        `;
    };
    
    // ================================
    // STAT ANIMATIONS
    // ================================
    const animateStatUpdates = (stats) => {
        Object.entries(stats).forEach(([key, value]) => {
            const elementId = {
                pendingManual: 'pendingManualCount',
                pendingSoft: 'pendingSoftCount',
                todaySubmissions: 'todaySubmissions',
                autoApprovedToday: 'autoApprovedToday'
            }[key];
            
            if (elementId) {
                animateNumber(elementId, value);
            }
        });
    };
    
    const animateNumber = (elementId, targetNumber) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Cancel any existing animation
        if (state.cardAnimations.has(elementId)) {
            cancelAnimationFrame(state.cardAnimations.get(elementId));
        }
        
        const startNumber = parseInt(element.textContent) || 0;
        const duration = config.animation.numberDuration;
        const startTime = performance.now();
        
        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentNumber = Math.floor(startNumber + (targetNumber - startNumber) * easeOut);
            
            element.textContent = currentNumber;
            
            if (progress < 1) {
                const animationId = requestAnimationFrame(updateNumber);
                state.cardAnimations.set(elementId, animationId);
            } else {
                element.textContent = targetNumber;
                state.cardAnimations.delete(elementId);
            }
        };
        
        requestAnimationFrame(updateNumber);
    };
    
    // ================================
    // CLICKABLE STAT CARDS
    // ================================
    const setupClickableStatCards = (stats) => {
        const cards = [
            {
                selector: '.stat-card-danger',
                count: stats.pendingManual,
                modalType: 'manual',
                title: 'manual review'
            },
            {
                selector: '.stat-card-warning',
                count: stats.pendingSoft,
                modalType: 'soft',
                title: 'soft validation'
            },
            {
                selector: '.stat-card-primary',
                count: stats.todaySubmissions,
                modalType: 'recent',
                title: 'submission'
            }
        ];
        
        cards.forEach(({ selector, count, modalType, title }) => {
            const card = document.querySelector(selector);
            if (!card) return;
            
            // Remove existing listeners
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);
            
            if (count > 0) {
                newCard.style.cursor = 'pointer';
                newCard.title = `Click to view ${count} ${title}${count === 1 ? '' : 's'}`;
                
                newCard.addEventListener('click', () => openAdminModal(modalType));
                
                newCard.addEventListener('mouseenter', () => {
                    newCard.style.transform = 'translateY(-2px) scale(1.02)';
                });
                
                newCard.addEventListener('mouseleave', () => {
                    newCard.style.transform = '';
                });
            } else {
                newCard.style.cursor = 'default';
                newCard.removeAttribute('title');
            }
        });
    };
    
    // ================================
    // TAB BADGES
    // ================================
    const updateTabBadges = (stats) => {
        const badges = {
            'manual-count': stats.pendingManual,
            'soft-count': stats.pendingSoft
        };
        
        Object.entries(badges).forEach(([id, count]) => {
            const badge = document.getElementById(id);
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        });
    };
    
    // ================================
    // TOAST NOTIFICATIONS
    // ================================
    const showToast = (message, type = 'success') => {
        const toast = document.getElementById('adminToast');
        if (!toast) return;
        
        const icon = document.getElementById('toastIcon');
        const messageEl = document.getElementById('toastMessage');
        
        if (messageEl) messageEl.textContent = message;
        
        toast.className = `admin-toast ${type}`;
        
        const icons = {
            'success': '✅',
            'error': '❌',
            'info': 'ℹ️',
            'warning': '⚠️'
        };
        
        if (icon) icon.textContent = icons[type] || icons.info;
        
        // Show toast
        toast.style.display = 'block';
        toast.classList.add('show');
        
        // Auto hide
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.style.display = 'none';
            }, config.animation.duration);
        }, 4000);
    };
    
    // ================================
    // REFRESH & AUTO-REFRESH
    // ================================
    const refreshData = async () => {
        await loadStats();
        await loadTabData(state.currentTab);
        
        if (state.currentModalType) {
            await loadModalContent(state.currentModalType);
        }
    };
    
    const startAutoRefresh = () => {
        if (state.refreshInterval) {
            clearInterval(state.refreshInterval);
        }
        
        state.refreshInterval = setInterval(() => {
            refreshData();
        }, config.refreshInterval);
        
        console.log('🔄 Auto-refresh started');
    };
    
    const stopAutoRefresh = () => {
        if (state.refreshInterval) {
            clearInterval(state.refreshInterval);
            state.refreshInterval = null;
            console.log('⏹️ Auto-refresh stopped');
        }
    };
    
    // ================================
    // EVENT LISTENERS
    // ================================
    const setupEventListeners = () => {
        // Tab clicks
        document.addEventListener('click', (e) => {
            // Tab buttons
            const tab = e.target.closest('.admin-tab');
            if (tab) {
                const tabName = tab.id.replace('-tab-btn', '');
                switchTab(tabName);
            }
            
            // Action buttons
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                const submissionId = actionBtn.dataset.submissionId;
                
                if (action && submissionId) {
                    e.preventDefault();
                    handleAction(action, submissionId);
                }
            }
            
            // Modal close
            if (e.target.matches('.modal-close') || e.target.matches('.modal-backdrop')) {
                closeAdminModal();
            }
        });
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshData');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                showToast('Refreshing data...', 'info');
                refreshData();
            });
        }
    };
    
    // ================================
    // KEYBOARD SHORTCUTS
    // ================================
    const initializeKeyboardShortcuts = () => {
        document.addEventListener('keydown', (e) => {
            // Escape closes modal
            if (e.key === 'Escape' && state.currentModalType) {
                closeAdminModal();
            }
            
            // Alt+1/2/3 for quick modal access
            if (e.altKey && !e.ctrlKey && !e.shiftKey) {
                const shortcuts = {
                    '1': 'manual',
                    '2': 'soft',
                    '3': 'recent'
                };
                
                if (shortcuts[e.key]) {
                    e.preventDefault();
                    openAdminModal(shortcuts[e.key]);
                }
            }
            
            // Ctrl+R for refresh
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                showToast('Data refreshed!', 'info');
                refreshData();
            }
        });
    };
    
    // ================================
    // CLEANUP
    // ================================
    const cleanup = () => {
        stopAutoRefresh();
        
        // Cancel any running animations
        state.cardAnimations.forEach(animationId => {
            cancelAnimationFrame(animationId);
        });
        state.cardAnimations.clear();
        
        console.log('🧹 Admin module cleaned up');
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        switchTab,
        refreshData,
        retryCurrentTab: () => loadTabData(state.currentTab),
        openAdminModal,
        closeAdminModal,
        cleanup,
        
        // Expose for debugging
        getState: () => ({ ...state }),
        showToast
    };
})();

// ================================
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', () => {
    // Create minimal app structure if needed
    if (!window.AdminApp) {
        window.AdminApp = {
            modules: {},
            getModule: (name) => window.AdminApp.modules[name],
            setState: (key, value) => console.log(`State: ${key} =`, value),
            getState: (key) => null
        };
    }
    
    AdminModule.init();
    
    // Make available globally for debugging
    window.AdminModule = AdminModule;
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    AdminModule.cleanup();
});

console.log('🍺 Admin module loaded - will initialize when DOM ready');
