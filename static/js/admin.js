/* ================================
   🚀 ADMIN DASHBOARD JAVASCRIPT
   Makes the dashboard interactive and connects to your API
   ================================ */

// ================================
// GLOBAL VARIABLES
// ================================
let currentTab = 'manual';
let adminToken = new URLSearchParams(window.location.search).get('token') || 'beer_admin_2025';
let refreshInterval;
let currentModalType = null;

// ================================
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🍺 Admin dashboard initializing...');
    
    // Load initial data
    loadStats();
    loadTabData(currentTab);
    
    // Set up auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
        loadStats();
        loadTabData(currentTab);
    }, 30000);
    
    console.log('✅ Admin dashboard ready!');
});

// ================================
// TAB MANAGEMENT
// ================================
function switchTab(tabName) {
    console.log(`🔄 Switching to ${tabName} tab`);
    
    // Update current tab
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${tabName}-tab-btn`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-content`).classList.add('active');
    
    // Load data for the selected tab
    loadTabData(tabName);
}

// ================================
// DATA LOADING FUNCTIONS
// ================================
async function loadStats() {
    try {
        const response = await fetch('/api/admin/validation-stats', {
            headers: { 'Authorization': adminToken }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const stats = await response.json();
        
        // Update dashboard numbers with animation
        animateNumber('pendingManualCount', stats.pending_manual || 0);
        animateNumber('pendingSoftCount', stats.pending_soft || 0);
        animateNumber('todaySubmissions', stats.today_submissions || 0);
        animateNumber('autoApprovedToday', stats.auto_approved_today || 0);
        
        // Update tab badges
        document.getElementById('manual-count').textContent = stats.pending_manual || 0;
        document.getElementById('soft-count').textContent = stats.pending_soft || 0;
        
        // 🔧 FIX: Make stat cards clickable based on data
        setupClickableStatCards(stats);
        
        console.log('✅ Stats updated:', stats);
        
    } catch (error) {
        console.error('❌ Error loading stats:', error);
        showToast('Failed to load statistics', 'error');
    }
}

// ================================
// 🔧 ADD: New function to make stat cards clickable
// Add this new function to static/admin.js
// ================================

function setupClickableStatCards(stats) {
    // Remove any existing click handlers
    document.querySelectorAll('.stat-card').forEach(card => {
        card.style.cursor = 'default';
        card.onclick = null;
        card.removeAttribute('title');
    });
    
    // Manual review card - only clickable if there are pending items
    const manualCard = document.querySelector('.stat-card-danger');
    if (manualCard && stats.pending_manual > 0) {
        manualCard.style.cursor = 'pointer';
        manualCard.onclick = () => openAdminModal('manual');
        manualCard.title = `Click to view ${stats.pending_manual} pending manual review${stats.pending_manual === 1 ? '' : 's'}`;
        
        // Add hover effect
        manualCard.addEventListener('mouseenter', () => {
            manualCard.style.transform = 'translateY(-2px) scale(1.02)';
        });
        manualCard.addEventListener('mouseleave', () => {
            manualCard.style.transform = '';
        });
    }
    
    // Soft validation card
    const softCard = document.querySelector('.stat-card-warning');
    if (softCard && stats.pending_soft > 0) {
        softCard.style.cursor = 'pointer';
        softCard.onclick = () => openAdminModal('soft');
        softCard.title = `Click to view ${stats.pending_soft} pending soft validation${stats.pending_soft === 1 ? '' : 's'}`;
        
        softCard.addEventListener('mouseenter', () => {
            softCard.style.transform = 'translateY(-2px) scale(1.02)';
        });
        softCard.addEventListener('mouseleave', () => {
            softCard.style.transform = '';
        });
    }
    
    // Recent activity card - always clickable if there are submissions today
    const recentCard = document.querySelector('.stat-card-primary');
    if (recentCard && stats.today_submissions > 0) {
        recentCard.style.cursor = 'pointer';
        recentCard.onclick = () => openAdminModal('recent');
        recentCard.title = `Click to view ${stats.today_submissions} submission${stats.today_submissions === 1 ? '' : 's'} from today`;
        
        recentCard.addEventListener('mouseenter', () => {
            recentCard.style.transform = 'translateY(-2px) scale(1.02)';
        });
        recentCard.addEventListener('mouseleave', () => {
            recentCard.style.transform = '';
        });
    }
    
    console.log('✅ Stat cards configured:', {
        manual: stats.pending_manual > 0 ? 'clickable' : 'disabled',
        soft: stats.pending_soft > 0 ? 'clickable' : 'disabled', 
        recent: stats.today_submissions > 0 ? 'clickable' : 'disabled'
    });
}

async function loadTabData(tabName) {
    const containerMap = {
        'manual': 'manualReviewList',
        'soft': 'softValidationList', 
        'recent': 'recentActivityList'
    };
    
    const endpointMap = {
        'manual': '/api/admin/pending-manual-reviews',
        'soft': '/api/admin/soft-validation-queue',
        'recent': '/api/admin/recent-submissions'
    };
    
    const container = document.getElementById(containerMap[tabName]);
    const endpoint = endpointMap[tabName];
    
    if (!container || !endpoint) return;
    
    try {
        // Show loading state
        container.innerHTML = '<div class="loading-state">Loading...</div>';
        
        const response = await fetch(endpoint, {
            headers: { 'Authorization': adminToken }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const items = await response.json();
        
        if (items.length === 0) {
            container.innerHTML = getEmptyState(tabName);
        } else {
            container.innerHTML = items.map(item => createSubmissionCard(item, tabName)).join('');
        }
        
        console.log(`✅ Loaded ${items.length} items for ${tabName} tab`);
        
    } catch (error) {
        console.error(`❌ Error loading ${tabName} data:`, error);
        container.innerHTML = '<div class="loading-state">Error loading data</div>';
        showToast(`Failed to load ${tabName} data`, 'error');
    }
}

// ================================
// UI HELPER FUNCTIONS
// ================================
function getEmptyState(tabName) {
    const messages = {
        'manual': '🎉 No pending manual reviews! All submissions are handled.',
        'soft': '⏰ No items in soft validation queue.',
        'recent': '📊 No recent activity in the last 7 days.'
    };
    
    return `<div class="empty-state">${messages[tabName]}</div>`;
}

function createSubmissionCard(submission, type) {
    const isNewPub = !submission.pub_id || submission.pub_status === 'New Pub';
    const isNewBrewery = submission.brewery_status === 'New Brewery';
    
    // Determine card styling
    let cardClass = 'submission-card';
    if (isNewPub) cardClass += ' new-pub';
    else if (isNewBrewery) cardClass += ' new-brewery';
    else cardClass += ' existing';
    
    // Create status badges
    const badges = [];
    if (isNewPub) badges.push('<span class="badge new-pub">New Pub</span>');
    if (isNewBrewery) badges.push('<span class="badge new-brewery">New Brewery</span>');
    if (!isNewPub && !isNewBrewery) badges.push('<span class="badge existing">Known Entities</span>');
    
    // Format submission time
    const submissionTime = new Date(submission.submission_time).toLocaleString();
    
    // Build the card HTML
    return `
        <div class="${cardClass}">
            <div class="submission-header">
                <div class="submission-info">
                    <h3>${escapeHtml(submission.pub_name)}</h3>
                    <div class="submission-meta">
                        📅 Submitted: ${submissionTime}
                        ${submission.review_reasons ? `<br>🔍 Reasons: ${submission.review_reasons}` : ''}
                    </div>
                </div>
                <div class="status-badges">
                    ${badges.join('')}
                </div>
            </div>
            
            <div class="submission-details">
                <div class="detail-section">
                    <h4>📍 Pub Details</h4>
                    <div class="detail-item">
                        <span class="detail-label">Name:</span> ${escapeHtml(submission.pub_name)}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Address:</span> ${escapeHtml(submission.address) || 'Not provided'}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Postcode:</span> ${escapeHtml(submission.postcode) || 'Not provided'}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>🍺 Beer Details</h4>
                    <div class="detail-item">
                        <span class="detail-label">Brewery:</span> ${escapeHtml(submission.brewery)}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Beer:</span> ${escapeHtml(submission.beer_name)}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Format:</span> ${escapeHtml(submission.beer_format)}
                    </div>
                    ${submission.beer_style ? `
                    <div class="detail-item">
                        <span class="detail-label">Style:</span> ${escapeHtml(submission.beer_style)}
                    </div>
                    ` : ''}
                </div>
            </div>
            
            ${getActionButtons(submission, type)}
        </div>
    `;
}



function getActionButtons(submission, type) {
    if (type === 'manual') {
        return `
            <div class="notes-section">
                <textarea class="notes-input" placeholder="Add admin notes (optional)..." 
                          id="notes-${submission.submission_id}"></textarea>
            </div>
            
            <div class="admin-actions">
                <button class="btn btn-info" onclick="viewSubmissionDetails(${submission.submission_id})">
                    👁️ View Details
                </button>
                <button class="btn btn-reject" onclick="rejectSubmission(${submission.submission_id})">
                    ❌ Reject
                </button>
                <button class="btn btn-approve" onclick="approveSubmission(${submission.submission_id})">
                    ✅ Approve
                </button>
            </div>
        `;
    } else if (type === 'soft') {
        const scheduledTime = submission.scheduled_approval_time ? 
            new Date(submission.scheduled_approval_time).toLocaleString() : 'Unknown';
        
        return `
            <div class="submission-details">
                <div class="detail-section">
                    <h4>⏰ Auto-Approval Schedule</h4>
                    <div class="detail-item">
                        <span class="detail-label">Scheduled:</span> ${scheduledTime}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status:</span> ${submission.approval_status || 'Pending'}
                    </div>
                </div>
            </div>
            
            <div class="admin-actions">
                <button class="btn btn-info" onclick="viewSubmissionDetails(${submission.submission_id})">
                    👁️ View Details
                </button>
                <button class="btn btn-approve" onclick="approveSoftValidationEarly(${submission.submission_id})">
                    ⚡ Approve Now
                </button>
            </div>
        `;
    } else {
        // Recent activity - view only
        return `
            <div class="admin-actions">
                <button class="btn btn-info" onclick="viewSubmissionDetails(${submission.submission_id})">
                    👁️ View Details
                </button>
                <span class="detail-item">
                    <span class="detail-label">Status:</span> 
                    <strong>${submission.validation_status}</strong> 
                    (Tier ${submission.validation_tier})
                </span>
            </div>
        `;
    }
}

// ================================
// ACTION HANDLERS
// ================================
async function approveSubmission(submissionId) {
    const notes = document.getElementById(`notes-${submissionId}`)?.value || '';
    
    if (!confirm('Are you sure you want to approve this submission?\n\nThis will update the live database immediately!')) {
        return;
    }
    
    try {
        showToast('Approving submission...', 'info');
        
        const response = await fetch('/api/admin/approve-submission', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': adminToken
            },
            body: JSON.stringify({ 
                submission_id: submissionId, 
                admin_notes: notes 
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('✅ Submission approved successfully!', 'success');
            // Refresh data
            loadStats();
            loadTabData(currentTab);
        } else {
            throw new Error(result.error || 'Failed to approve submission');
        }
        
    } catch (error) {
        console.error('❌ Error approving submission:', error);
        showToast(`Failed to approve: ${error.message}`, 'error');
    }
}

async function rejectSubmission(submissionId) {
    const notes = document.getElementById(`notes-${submissionId}`)?.value || '';
    
    if (!notes.trim()) {
        showToast('Please add a note explaining why this submission is being rejected', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to reject this submission?')) {
        return;
    }
    
    try {
        showToast('Rejecting submission...', 'info');
        
        const response = await fetch('/api/admin/reject-submission', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': adminToken
            },
            body: JSON.stringify({ 
                submission_id: submissionId, 
                admin_notes: notes 
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('❌ Submission rejected', 'success');
            // Refresh data
            loadStats();
            loadTabData(currentTab);
        } else {
            throw new Error(result.error || 'Failed to reject submission');
        }
        
    } catch (error) {
        console.error('❌ Error rejecting submission:', error);
        showToast(`Failed to reject: ${error.message}`, 'error');
    }
}

async function approveSoftValidationEarly(submissionId) {
    if (!confirm('Approve this soft validation item early?\n\nThis will skip the 24-hour waiting period.')) {
        return;
    }
    
    try {
        showToast('Approving early...', 'info');
        
        const response = await fetch('/api/admin/approve-soft-validation', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': adminToken
            },
            body: JSON.stringify({ submission_id: submissionId })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('⚡ Approved early!', 'success');
            // Refresh data
            loadStats();
            loadTabData(currentTab);
        } else {
            throw new Error(result.error || 'Failed to approve early');
        }
        
    } catch (error) {
        console.error('❌ Error approving early:', error);
        showToast(`Failed to approve early: ${error.message}`, 'error');
    }
}

function viewSubmissionDetails(submissionId) {
    // TODO: Implement detailed view modal
    showToast(`Detailed view for submission ${submissionId} - coming soon!`, 'info');
}

// ================================
// UTILITY FUNCTIONS
// ================================
function showToast(message, type = 'success') {
    const toast = document.getElementById('adminToast');
    const icon = document.getElementById('toastIcon');
    const messageEl = document.getElementById('toastMessage');
    
    // Set content
    messageEl.textContent = message;
    
    // Set type and icon
    toast.className = `admin-toast ${type}`;
    
    const icons = {
        'success': '✅',
        'error': '❌', 
        'info': 'ℹ️'
    };
    icon.textContent = icons[type] || '✅';
    
    // Show toast
    toast.style.display = 'block';
    
    // Auto hide after 4 seconds
    setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}

function animateNumber(elementId, targetNumber) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startNumber = parseInt(element.textContent) || 0;
    const duration = 1000; // 1 second
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out animation
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentNumber = Math.floor(startNumber + (targetNumber - startNumber) * easeOut);
        
        element.textContent = currentNumber;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = targetNumber;
        }
    }
    
    requestAnimationFrame(updateNumber);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// UPDATE: Add to static/admin.js - Add modal functions and clickable cards

// ================================
// MODAL MANAGEMENT
// ================================

function trackEvent(action, category = 'Admin', label = '') {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            event_category: category,
            event_label: label
        });
    }
    // Fallback - just log if gtag not available
    console.log(`📊 Track: ${action} | ${category} | ${label}`);
}

function getEmptyStateModal(modalType) {
    const messages = {
        'manual': '🎉 No pending manual reviews! All submissions are handled.',
        'soft': '⏰ No items in soft validation queue.',
        'recent': '📊 No recent activity in the last 7 days.'
    };
    
    return `<div class="empty-state">${messages[modalType]}</div>`;
}

// ================================
// 🔧 ADD: Helper functions for modal content
// Add these new functions to static/admin.js
// ================================

function showEmptyState(modalType, emptyState) {
    emptyState.style.display = 'flex';
    
    const emptyIcon = emptyState.querySelector('.empty-icon');
    const emptyTitle = emptyState.querySelector('.empty-title');
    const emptyMessage = emptyState.querySelector('.empty-message');
    
    if (modalType === 'manual') {
        emptyIcon.textContent = '🎉';
        emptyTitle.textContent = 'All caught up!';
        emptyMessage.textContent = 'No submissions need manual review right now.';
    } else if (modalType === 'soft') {
        emptyIcon.textContent = '⏰';
        emptyTitle.textContent = 'Queue is empty';
        emptyMessage.textContent = 'No items in soft validation queue.';
    } else if (modalType === 'recent') {
        emptyIcon.textContent = '📊';
        emptyTitle.textContent = 'No recent activity';
        emptyMessage.textContent = 'No submissions in the last 7 days.';
    }
}

function showErrorState(error, emptyState) {
    emptyState.style.display = 'flex';
    
    const emptyIcon = emptyState.querySelector('.empty-icon');
    const emptyTitle = emptyState.querySelector('.empty-title');
    const emptyMessage = emptyState.querySelector('.empty-message');
    
    emptyIcon.textContent = '❌';
    emptyTitle.textContent = 'Error loading data';
    emptyMessage.textContent = `${error.message}. Please try refreshing or check your connection.`;
}

function showModalItems(items, modalType, submissionsContainer) {
    submissionsContainer.style.display = 'block';
    submissionsContainer.innerHTML = items.map(item => createSubmissionCard(item, modalType)).join('');
    console.log(`✅ Displayed ${items.length} ${modalType} items in modal`);
}

// ================================
// UPDATE: Make stat cards clickable
// ================================

// ADD: Update the loadStats function to make cards clickable
async function loadStats() {
    try {
        const response = await fetch('/api/admin/validation-stats', {
            headers: { 'Authorization': adminToken }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const stats = await response.json();
        
        // Update dashboard numbers with animation
        animateNumber('pendingManualCount', stats.pending_manual || 0);
        animateNumber('pendingSoftCount', stats.pending_soft || 0);
        animateNumber('todaySubmissions', stats.today_submissions || 0);
        animateNumber('autoApprovedToday', stats.auto_approved_today || 0);
        
        // Update tab badges
        document.getElementById('manual-count').textContent = stats.pending_manual || 0;
        document.getElementById('soft-count').textContent = stats.pending_soft || 0;
        
        // ADD: Make stat cards clickable
        setupClickableCards(stats);
        
        console.log('✅ Stats updated:', stats);
        
    } catch (error) {
        console.error('❌ Error loading stats:', error);
        showToast('Failed to load statistics', 'error');
    }
}

// ADD: Setup click handlers for stat cards
function setupClickableCards(stats) {
    // Manual review card
    const manualCard = document.querySelector('.stat-card-danger');
    if (manualCard && stats.pending_manual > 0) {
        manualCard.style.cursor = 'pointer';
        manualCard.onclick = () => openAdminModal('manual');
        manualCard.title = 'Click to view manual reviews';
    }
    
    // Soft validation card
    const softCard = document.querySelector('.stat-card-warning');
    if (softCard && stats.pending_soft > 0) {
        softCard.style.cursor = 'pointer';
        softCard.onclick = () => openAdminModal('soft');
        softCard.title = 'Click to view soft validation queue';
    }
    
    // Recent activity card
    const recentCard = document.querySelector('.stat-card-primary');
    if (recentCard && stats.today_submissions > 0) {
        recentCard.style.cursor = 'pointer';
        recentCard.onclick = () => openAdminModal('recent');
        recentCard.title = 'Click to view recent activity';
    }
}

// ADD: Add these functions to static/admin.js

// ================================
// ADMIN MODAL MANAGEMENT
// ================================

function openAdminModal(modalType) {
    console.log(`🔍 Opening ${modalType} modal`);
    
    currentModalType = modalType;
    
    const modal = document.getElementById('adminReviewModal');
    const title = document.getElementById('adminModalTitle');
    
    // Set title based on modal type
    const titles = {
        'manual': '⚠️ Manual Review Required',
        'soft': '⏰ Soft Validation Queue', 
        'recent': '📊 Recent Activity'
    };
    
    title.textContent = titles[modalType] || 'Admin Review';
    
    // 🔧 FIX: Use the same pattern as your working modals
    modal.style.display = 'block';  // NOT classList.add('active')
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
    
    // Load content for the modal
    loadModalContent(modalType);
    
    // Track the action
    if (typeof trackEvent === 'function') {
        trackEvent('admin_modal_open', 'Admin', modalType);
    }
    
    console.log(`✅ ${modalType} modal opened with display: block`);
}

// ================================
// 🔧 REPLACE: Fix your closeAdminModal function too
// ================================

function closeAdminModal() {
    console.log('🔒 Closing admin modal');
    
    const modal = document.getElementById('adminReviewModal');
    
    // 🔧 FIX: Use the same pattern as your working modals
    modal.style.display = 'none';  // NOT classList.remove('active')
    
    // Restore background scrolling
    document.body.style.overflow = '';
    
    currentModalType = null;
    
    if (typeof trackEvent === 'function') {
        trackEvent('admin_modal_close', 'Admin');
    }
}

function refreshModalData() {
    console.log('🔄 Refreshing modal data');
    
    if (currentModalType) {
        loadModalContent(currentModalType);
        showToast('Data refreshed!', 'info');
    }
}

function refreshModalData() {
    if (currentModalType) {
        loadModalContent(currentModalType);
        showToast('Data refreshed!', 'info');
    }
}

// ================================
// 🔧 REPLACE: Fix the loadModalContent function - it's targeting wrong elements
// ================================

async function loadModalContent(modalType) {
    const loadingDiv = document.getElementById('adminModalLoading');
    const contentDiv = document.getElementById('adminModalContent'); 
    const emptyDiv = document.getElementById('adminModalEmpty');
    
    console.log('🔍 Loading modal content for:', modalType);
    console.log('🔍 Found elements:', {
        loading: !!loadingDiv,
        content: !!contentDiv, 
        empty: !!emptyDiv
    });
    
    // Show loading, hide others
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (contentDiv) contentDiv.style.display = 'none';
    if (emptyDiv) emptyDiv.style.display = 'none';
    
    try {
        // Determine API endpoint
        let endpoint;
        if (modalType === 'manual') {
            endpoint = '/api/admin/pending-manual-reviews';
        } else if (modalType === 'soft') {
            endpoint = '/api/admin/soft-validation-queue';
        } else if (modalType === 'recent') {
            endpoint = '/api/admin/recent-submissions';
        } else {
            throw new Error(`Unknown modal type: ${modalType}`);
        }
        
        console.log(`📡 Fetching from: ${endpoint}`);
        
        const response = await fetch(endpoint, {
            headers: { 'Authorization': adminToken }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const items = await response.json();
        console.log(`✅ Received ${items.length} items`);
        
        // Hide loading
        if (loadingDiv) loadingDiv.style.display = 'none';
        
        if (items.length === 0) {
            // Show empty state
            if (emptyDiv) emptyDiv.style.display = 'block';
        } else {
            // Show content
            if (contentDiv) {
                contentDiv.style.display = 'block';
                contentDiv.innerHTML = items.map(item => createSubmissionCard(item, modalType)).join('');
            }
        }
        
        console.log(`✅ Successfully loaded ${modalType} modal content`);
        
    } catch (error) {
        console.error(`❌ Error loading ${modalType} data:`, error);
        
        // Hide loading, show error
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (contentDiv) {
            contentDiv.style.display = 'block';
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: var(--space-4xl); color: var(--error-color);">
                    <div style="font-size: 2rem; margin-bottom: var(--space-lg);">❌</div>
                    <div style="font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-sm);">Error loading data</div>
                    <div style="color: var(--text-secondary);">${error.message}</div>
                    <button onclick="loadModalContent('${modalType}')" class="btn btn-primary" style="margin-top: var(--space-lg);">Try Again</button>
                </div>
            `;
        }
    }
}

// ================================
// 🔧 ADD: Quick debug function to check what's in your API
// ================================

async function debugAdminAPI() {
    console.log('🧪 Testing admin API endpoints...');
    
    const endpoints = [
        '/api/admin/validation-stats',
        '/api/admin/pending-manual-reviews', 
        '/api/admin/soft-validation-queue',
        '/api/admin/recent-submissions'
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`Testing: ${endpoint}`);
            const response = await fetch(endpoint, {
                headers: { 'Authorization': adminToken }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ ${endpoint}:`, data);
            } else {
                console.log(`❌ ${endpoint}: HTTP ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ ${endpoint}: ${error.message}`);
        }
    }
}

// ================================
// UPDATE: Make stat cards clickable too
// ================================

// Update the setupClickableCards function
function setupClickableCards(stats) {
    // Manual review card - make clickable if there are pending items
    const manualCard = document.querySelector('.stat-card-danger');
    if (manualCard) {
        if (stats.pending_manual > 0) {
            manualCard.style.cursor = 'pointer';
            manualCard.onclick = () => openAdminModal('manual');
            manualCard.title = 'Click to view manual reviews';
        } else {
            manualCard.style.cursor = 'default';
            manualCard.onclick = null;
            manualCard.title = '';
        }
    }
    
    // Soft validation card
    const softCard = document.querySelector('.stat-card-warning');
    if (softCard) {
        if (stats.pending_soft > 0) {
            softCard.style.cursor = 'pointer';
            softCard.onclick = () => openAdminModal('soft');
            softCard.title = 'Click to view soft validation queue';
        } else {
            softCard.style.cursor = 'default';
            softCard.onclick = null;
            softCard.title = '';
        }
    }
    
    // Recent activity card
    const recentCard = document.querySelector('.stat-card-primary');
    if (recentCard) {
        if (stats.today_submissions > 0) {
            recentCard.style.cursor = 'pointer';
            recentCard.onclick = () => openAdminModal('recent');
            recentCard.title = 'Click to view recent activity';
        } else {
            recentCard.style.cursor = 'default';
            recentCard.onclick = null;
            recentCard.title = '';
        }
    }
}

// ================================
// UPDATE: Enhanced keyboard shortcuts
// ================================

document.addEventListener('keydown', function(e) {
    // Escape key closes modal
    if (e.key === 'Escape') {
        const modal = document.getElementById('adminReviewModal');
        if (modal && modal.classList.contains('active')) {
            closeAdminModal();
        }
    }
    
    // Your existing keyboard shortcuts...
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === '1') {
            e.preventDefault();
            openAdminModal('manual');
        } else if (e.key === '2') {
            e.preventDefault();
            openAdminModal('soft');
        } else if (e.key === '3') {
            e.preventDefault();
            openAdminModal('recent');
        }
    }
    
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        loadStats();
        loadTabData(currentTab);
        showToast('Data refreshed!', 'info');
    }
});

// ================================
// CLEANUP
// ================================
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

console.log('🍺 Admin dashboard JavaScript loaded successfully!');
