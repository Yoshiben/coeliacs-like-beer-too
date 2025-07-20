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
        
        console.log('✅ Stats updated:', stats);
        
    } catch (error) {
        console.error('❌ Error loading stats:', error);
        showToast('Failed to load statistics', 'error');
    }
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

// ================================
// KEYBOARD SHORTCUTS
// ================================
document.addEventListener('keydown', function(e) {
    // Alt + 1, 2, 3 for tab switching
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === '1') {
            e.preventDefault();
            switchTab('manual');
        } else if (e.key === '2') {
            e.preventDefault();
            switchTab('soft');
        } else if (e.key === '3') {
            e.preventDefault();
            switchTab('recent');
        }
    }
    
    // Ctrl + R for refresh
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
