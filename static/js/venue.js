// ================================================================================
// VENUE.JS - All venue-related functionality
// Handles venue details, beer lists, GF status updates, and venue management
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const VenueModule = (function() {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        currentVenue: null,
        beerListCache: new Map(),
        lastViewedVenueId: null,
        selectedStatus: null,
        statusModalOpen: false
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get api() { return window.App?.getModule('api'); },
        get modal() { return window.App?.getModule('modal'); },
        get modalManager() { return window.App?.getModule('modalManager'); },
        get tracking() { return window.App?.getModule('tracking'); },
        get toast() { return window.App?.getModule('toast'); },
        get map() { return window.App?.getModule('map'); },
        get nav() { return window.App?.getModule('nav'); }
    };
    
    // ================================
    // UTILITIES
    // ================================
    const getCurrentVenue = () => {
        return state.currentVenue || window.App.getState(STATE_KEYS.CURRENT_VENUE);
    };
    
    const setCurrentVenue = (venue) => {
        state.currentVenue = venue;
        window.App.setState(STATE_KEYS.CURRENT_VENUE, venue);
    };
    
    const showToast = (message, type = 'success') => {
        if (modules.toast) {
            type === 'error' ? modules.toast.error(message) : modules.toast.success(message);
        } else if (window.showSuccessToast && window.showErrorToast) {
            type === 'error' ? window.showErrorToast(message) : window.showSuccessToast(message);
        } else {
            console.log(`${type === 'success' ? '✅' : '❌'} ${message}`);
        }
    };
    
    const showLoadingToast = (message) => {
        if (window.showLoadingToast) {
            window.showLoadingToast(message);
        }
    };
    
    const hideLoadingToast = () => {
        if (window.hideLoadingToast) {
            window.hideLoadingToast();
        }
    };
    
    // ================================
    // VENUE DETAILS DISPLAY
    // ================================
    const showVenueDetails = async (venueId) => {
        console.log('🏠 Loading venue details:', venueId);
        
        try {
            const results = await modules.api.searchVenues({ 
                venueId: venueId
            });
            const venues = Array.isArray(results) ? results : results.venues;
            
            if (venues && venues.length > 0) {
                const venue = venues[0];
                
                console.log('🔍 VENUE STRUCTURE:', {
                    venue,
                    keys: Object.keys(venue),
                    id_field: venue.venue_id,
                    alt_id: venue.id,
                    has_venue_id: 'venue_id' in venue,
                    has_id: 'id' in venue
                });
                
                setCurrentVenue(venue);
                state.lastViewedVenueId = venueId;
                
                displayVenueDetails(venue);
                return venue;
            } else {
                showToast('Venue not found.', 'error');
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error loading venue:', error);
            showToast('Error loading venue details.', 'error');
            return null;
        }
    };
    
    const displayVenueDetails = (venue) => {
        modules.modalManager.open('venueDetailsOverlay', {
            onOpen: () => {
                resetVenueDetailsView();
                
                const navTitle = document.getElementById('venueNavTitle');
                if (navTitle) navTitle.textContent = venue.venue_name;
                
                populateVenueDetails(venue);
                setupVenueButtons(venue);
                setupMapButton(venue);
                
                modules.tracking?.trackVenueView(venue.venue_name);
                modules.nav?.showVenueDetailsWithContext();
            }
        });
    };
    
    const populateVenueDetails = (venue) => {
        const elements = {
            title: document.getElementById('venueDetailsTitle'),
            address: document.getElementById('venueDetailsAddress'),
            location: document.getElementById('venueDetailsLocation'),
            beer: document.getElementById('venueDetailsBeer')
        };
        
        if (elements.title) elements.title.textContent = venue.venue_name;
        if (elements.address) elements.address.textContent = venue.address;
        if (elements.location) elements.location.textContent = `${venue.postcode} • ${venue.city}`;
        
        setupBeerDetails(venue, elements.beer);
        setupGFStatusDisplay(venue);
        loadStatusConfirmations(venue.venue_id);
    };

    const loadStatusConfirmations = async (venueId) => {
        try {
            const venue = window.App.getState('currentVenue'); // FIX: Changed from utils.getCurrentVenue()
            const confirmationEl = document.getElementById('statusConfirmation');
            
            if (!confirmationEl) return;
            
            // Hide if no status or unknown
            if (!venue?.gf_status || venue.gf_status === 'unknown') {
                confirmationEl.style.display = 'none';
                return;
            }
            
            // Show it for real statuses
            confirmationEl.style.display = 'block';
            
            // Load the confirmation data
            const response = await fetch(`/api/venue/${venueId}/status-confirmations`);
            if (response.ok) {
                const confirmData = await response.json();
                confirmationEl.textContent = confirmData.text;
                
                // Remove old classes and add new ones
                confirmationEl.classList.remove('confirmed', 'unconfirmed');
                if (confirmData.has_confirmations) {
                    confirmationEl.classList.add('confirmed');
                } else {
                    confirmationEl.classList.add('unconfirmed');
                }
            }
        } catch (error) {
            console.error('Error loading status confirmations:', error);
        }
    };

    const confirmGFStatus = () => {
        const venue = utils.getCurrentVenue();
        if (!venue) return;
        
        // Don't allow confirming "unknown" status - that's silly!
        if (!venue.gf_status || venue.gf_status === 'unknown') {
            modules.toast?.info('Update the status first - we need actual info!');
            return;
        }
        
        // Rest of the existing code...
        const venueNameEl = document.getElementById('confirmVenueName');
        const statusDisplayEl = document.getElementById('confirmStatusDisplay');
        
        if (venueNameEl) venueNameEl.textContent = venue.venue_name;
        
        const currentStatusEl = document.getElementById('currentGFStatus');
        if (statusDisplayEl && currentStatusEl) {
            statusDisplayEl.innerHTML = currentStatusEl.innerHTML;
        }
        
        modules.modalManager?.open('statusConfirmModal');
    };
    
    const doConfirmStatus = async () => {
        const venue = getCurrentVenue();
        const userId = parseInt(localStorage.getItem('user_id'));
        
        if (!venue || !userId) {
            showToast('Error: Missing data', 'error');
            return;
        }
        
        modules.modalManager?.close('statusConfirmModal');
        showLoadingToast('Confirming status...');
        
        try {
            const response = await fetch('/api/venue/confirm-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    venue_id: venue.venue_id,
                    status: venue.gf_status,
                    user_id: userId
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                hideLoadingToast();
                showToast(`✅ Status confirmed! +${result.points_earned} points`);
                loadStatusConfirmations(venue.venue_id);
            } else {
                throw new Error('Failed to confirm');
            }
        } catch (error) {
            console.error('Error confirming status:', error);
            hideLoadingToast();
            showToast('Failed to confirm status', 'error');
        }
    };
    
    const setupBeerDetails = (venue, beerEl) => {
        const beerSection = document.getElementById('beerSection');
        if (!beerSection || !beerEl) return;
        
        // ALWAYS show the beer section regardless of status
        beerSection.style.display = 'block';
        beerSection.style.cursor = 'pointer';
        beerSection.setAttribute('data-action', 'show-beer-list');
        
        const beerCount = venue.beer_details ? venue.beer_details.split(',').length : 0;
        
        // Always show the section with appropriate message
        beerEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    ${beerCount > 0 ? 
                        `<strong>${beerCount} GF beer${beerCount > 1 ? 's' : ''} reported</strong>` : 
                        '<strong>No beers listed yet</strong>'}
                    <br><small style="opacity: 0.8;">Click to view/add beers</small>
                </div>
                <div style="font-size: 1.5rem; opacity: 0.6;">›</div>
            </div>
        `;
    };
    
    const setupGFStatusDisplay = (venue) => {
        const statusEl = document.getElementById('currentGFStatus');
        if (!statusEl) return;
        
        const statusConfigs = {
            'always_tap_cask': {
                icon: '⭐',
                text: 'Always Has Tap/Cask',
                meta: 'The holy grail of GF beer!',
                className: 'status-gold'
            },
            'always_bottle_can': {
                icon: '✅',
                text: 'Always Has Bottles/Cans',
                meta: 'Reliable GF options',
                className: 'status-green'
            },
            'currently': {
                icon: '🔵',
                text: 'Available Now',
                meta: 'GF beer in stock',
                className: 'status-blue'
            },
            'not_currently': {
                icon: '❌',
                text: 'Not Available',
                meta: 'No GF options currently',
                className: 'status-red'
            },
            'unknown': {
                icon: '❓',
                text: 'Not Sure',
                meta: 'Help us find out!',
                className: 'status-grey'
            }
        };
        
        const status = venue.gf_status || 'unknown';
        const config = statusConfigs[status] || statusConfigs.unknown;
        
        statusEl.className = `status-display ${config.className}`;
        statusEl.innerHTML = `
            <span class="status-icon">${config.icon}</span>
            <span class="status-text">${config.text}</span>
            <span class="status-meta">${config.meta}</span>
        `;

            // ADD THIS BIT HERE - Hide/show confirm button based on status
        const confirmBtn = document.querySelector('[data-action="confirm-gf-status"]');
        if (confirmBtn) {
            if (status === 'unknown' || !venue.gf_status) {
                confirmBtn.style.display = 'none';
            } else {
                confirmBtn.style.display = 'block';
            }
        }
    };

    const setupVenueButtons = (venue) => {
        setCurrentVenue(venue);
    };
    
    // ================================
    // GF STATUS UPDATES
    // ================================
    const openStatusModal = () => {
        const venue = getCurrentVenue();
        
        if (!venue?.venue_id) {
            console.error('❌ No current venue data');
            showToast('❌ No venue selected', 'error');
            return;
        }
        
        state.selectedStatus = null;
        state.statusModalOpen = true;
        
        const venueNameEl = document.getElementById('statusPromptVenueName');
        if (venueNameEl) {
            venueNameEl.textContent = venue.venue_name || venue.name || 'this venue';
        }
        
        modules.modalManager?.open('gfStatusModal');
    };
    
    const selectStatus = (status) => {
        state.selectedStatus = status;
        
        modules.modalManager?.close('gfStatusModal');
        
        const statusLabels = {
            'always_tap_cask': '⭐ Always Has Tap/Cask',
            'always_bottle_can': '✅ Always Has Bottles/Cans',
            'currently': '🔵 Available Now',
            'not_currently': '❌ Not Available',
            'unknown': '❓ Not Sure'
        };
        
        const confirmStatusEl = document.getElementById('confirmStatus');
        if (confirmStatusEl) {
            confirmStatusEl.innerHTML = statusLabels[status] || status;
        }
        
        setTimeout(() => {
            modules.modalManager?.open('gfStatusConfirmModal');
        }, 100);
    };
    
    const confirmStatusUpdate = async () => {
        const venue = getCurrentVenue();
        const venueId = venue?.venue_id || venue?.id || window.App.getState('currentVenue')?.venue_id;
        
        if (!venueId || !state.selectedStatus) {
            console.error('❌ Missing data:', { venueId, status: state.selectedStatus, venue });
            showToast('❌ Error: Missing venue or status', 'error');
            return;
        }
        
        modules.modalManager?.closeGroup('status');
        showLoadingToast('Updating status...');
        
        try {
            const userId = parseInt(localStorage.getItem('user_id'));
            
            const response = await fetch('/api/update-gf-status', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    venue_id: parseInt(venueId),
                    status: state.selectedStatus,
                    user_id: userId,
                    submitted_by: window.App.getState('userNickname') || 
                                 localStorage.getItem('userNickname') || 
                                 'anonymous'
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Server error:', errorData);
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            hideLoadingToast();
            
            // Update the venue in state with new status
            const updatedVenue = {
                ...venue,
                gf_status: state.selectedStatus
            };
            setCurrentVenue(updatedVenue);
            
            // Update the status display immediately
            updateStatusDisplay(state.selectedStatus);
            setupGFStatusDisplay(updatedVenue);
            
            // Refresh the beer list if venue details are open
            if (modules.modalManager?.isOpen('venueDetailsOverlay')) {
                loadBeerList(updatedVenue);
                // Also refresh the beer count display
                const beerEl = document.getElementById('venueDetailsBeer');
                if (beerEl) {
                    setupBeerDetails(updatedVenue, beerEl);
                }
            }
            
            showToast('✅ Status updated successfully!');
            modules.tracking?.trackEvent('gf_status_updated', 'Venue', state.selectedStatus);
            
            const cameFromBeerReport = window.App.getState('statusPromptVenue') !== null;
            
            // Only show beer prompt if NOT from beer report and status is positive
            if (!cameFromBeerReport && ['always_tap_cask', 'always_bottle_can', 'currently'].includes(state.selectedStatus)) {
                setTimeout(() => {
                    showBeerDetailsPrompt();
                }, 500);
            }
            
            // Clear the status prompt state if we came from beer report
            if (cameFromBeerReport) {
                window.App.setState('statusPromptVenue', null);
                window.App.setState('statusPromptSubmittedBy', null);
                window.App.setState('statusPromptUserId', null);
            }
            
        } catch (error) {
            console.error('❌ Error updating status:', error);
            hideLoadingToast();
            showToast('❌ Failed to update status. Please try again.', 'error');
        }
    };
    
    const updateStatusDisplay = (status) => {
        const statusEl = document.getElementById('currentGFStatus');
        if (!statusEl) return;
        
        const displays = {
            'always_tap_cask': { icon: '⭐', text: 'Always Has Tap/Cask', meta: 'The holy grail of GF beer!' },
            'always_bottle_can': { icon: '✅', text: 'Always Has Bottles/Cans', meta: 'Reliable GF options' },
            'currently': { icon: '🔵', text: 'Available Now', meta: 'GF beer in stock' },
            'not_currently': { icon: '❌', text: 'Not Available', meta: 'No GF options currently' },
            'unknown': { icon: '❓', text: 'Not Sure', meta: 'Help us find out!' }
        };
        
        const display = displays[status] || displays.unknown;
        
        statusEl.className = `current-status ${status}`;
        statusEl.innerHTML = `
            <span class="status-icon">${display.icon}</span>
            <span class="status-text">${display.text}</span>
            <span class="status-meta">${display.meta}</span>
        `;
    };
    
    const showBeerDetailsPrompt = () => {
        modules.modalManager?.open('beerDetailsPromptModal');
    };
    
    const skipBeerDetails = () => {
        modules.modalManager?.close('beerDetailsPromptModal');
        // NO TOAST HERE - already shown in confirmStatusUpdate!
    };
    
    const addBeerDetailsFromPrompt = () => {
        modules.modalManager?.close('beerDetailsPromptModal');
        window.App.setState('cameFromBeerDetailsPrompt', true);
        
        if (window.ReportBeer || window.CascadeForm) {
            modules.modalManager?.open('reportModal');
            const venue = getCurrentVenue();
            const reportModule = window.ReportBeer || window.CascadeForm;
            reportModule.setVenue(venue);
            reportModule.reset();
        }
    };
    
    const showStatusPromptAfterBeer = (venue, submittedBy, userId) => {
        console.log('🎯 Showing status prompt for venue:', venue);
        
        window.App.setState('statusPromptVenue', venue);
        window.App.setState('statusPromptSubmittedBy', submittedBy);
        window.App.setState('statusPromptUserId', userId);
        
        // DON'T close venue details - keep it visible behind the status prompt
        // This way users can see their venue and the beer they just added
        
        setTimeout(() => {
            const venueNameEl = document.getElementById('statusPromptVenueName');
            if (venueNameEl && venue) {
                venueNameEl.textContent = venue.venue_name || venue.name || 'this venue';
            }
            
            const statusButtons = document.querySelectorAll('.status-prompt-btn');
            statusButtons.forEach(btn => {
                btn.dataset.venueId = venue.venue_id;
            });
            
            modules.modalManager?.open('statusPromptAfterBeerModal');
        }, 300);
    };
    
    // ================================
    // BEER LIST MANAGEMENT
    // ================================
    const loadBeerList = async (venue) => {
        console.log('Loading beer list for:', venue.venue_name);
        
        const venueNameEl = document.getElementById('beerListVenueName');
        if (venueNameEl) {
            venueNameEl.textContent = venue.venue_name;
        }
        
        try {
            const response = await fetch(`/api/venue/${venue.venue_id}/beers`);
            const data = await response.json();
            
            if (data.beers && data.beers.length > 0) {
                displayBeerList(data.beers);
            } else {
                showEmptyBeerList();
            }
        } catch (error) {
            console.error('Error loading beers:', error);
            showEmptyBeerList();
        }
    };
    
    const displayBeerList = (beers) => {
        const contentEl = document.getElementById('beerListContent');
        const emptyEl = document.getElementById('beerListEmpty');
        
        if (contentEl) contentEl.style.display = 'block';
        if (emptyEl) emptyEl.style.display = 'none';
        
        if (contentEl) {
            contentEl.innerHTML = beers.map((beer, index) => createBeerCard(beer, index)).join('');
        }
    };
    
    const createBeerCard = (beer, index) => {
        const isBottleCan = beer.format && (beer.format.toLowerCase() === 'bottle' || beer.format.toLowerCase() === 'can');
        const isCask = beer.format && beer.format.toLowerCase() === 'cask';
        
        const formatIcon = isBottleCan ? '🍾' : '🍺';
        const formatClass = isBottleCan ? 'bottle' : '';
        const formatBadgeClass = isBottleCan ? 'badge-bottle' : 'badge-tap';
        
        const formatLabel = beer.format ? {
            'tap': 'On Tap',
            'cask': 'Cask',
            'bottle': 'Bottle',
            'can': 'Can'
        }[beer.format.toLowerCase()] || beer.format : 'Unknown';
        
        return `
            <div class="beer-card" data-beer-id="${beer.id}">
                <div class="beer-card-header">
                    <div class="beer-icon-wrapper ${formatClass}">
                        <span class="beer-glass">${formatIcon}</span>
                    </div>
                    <div class="beer-main-info">
                        <h4 class="beer-name">${beer.name || 'Unknown Beer'}</h4>
                        <div class="brewery-tag">
                            <span class="brewery-icon">🏭</span>
                            <span class="brewery-name">${beer.brewery || 'Unknown Brewery'}</span>
                        </div>
                    </div>
                    <div class="beer-actions">
                        <button class="btn-more" data-action="beer-options" data-beer-id="${beer.id}">
                            <span></span><span></span><span></span>
                        </button>
                    </div>
                </div>
                
                <div class="beer-card-details">
                    <div class="beer-badges">
                        <span class="badge ${formatBadgeClass}">
                            <span>${isCask ? '🛢️' : (isBottleCan ? formatIcon : '🚰')}</span> ${formatLabel}
                        </span>
                        ${beer.style ? `<span class="badge badge-style">${beer.style}</span>` : ''}
                    </div>
                </div>
                
                <!-- Dropdown menu -->
                <div class="beer-dropdown-menu" id="dropdown-${beer.id}">
                    <button data-action="verify-beer" data-beer-id="${beer.id}" data-beer-name="${beer.name}">
                        ✅ Verify still here
                    </button>
                    <button data-action="edit-beer" data-beer-id="${beer.id}" data-beer-name="${beer.name}">
                        ✏️ Edit details
                    </button>
                    <button data-action="report-beer-issue" data-beer-id="${beer.id}" data-beer-name="${beer.name}">
                        ⚠️ Report issue
                    </button>
                    <button data-action="delete-beer" data-beer-id="${beer.id}" data-beer-name="${beer.name}" class="danger">
                        🗑️ Remove
                    </button>
                </div>
            </div>
        `;
    };
    
    const showEmptyBeerList = () => {
        const contentEl = document.getElementById('beerListContent');
        const emptyEl = document.getElementById('beerListEmpty');
        
        if (contentEl) contentEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
    };
    
    const toggleBeerDropdown = (beerId) => {
        const dropdown = document.getElementById(`dropdown-${beerId}`);
        
        // Close all other dropdowns
        document.querySelectorAll('.beer-dropdown-menu').forEach(menu => {
            if (menu !== dropdown) menu.classList.remove('active');
        });
        
        // Toggle this dropdown
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    };
    
    const closeAllBeerDropdowns = () => {
        document.querySelectorAll('.beer-dropdown-menu').forEach(menu => {
            menu.classList.remove('active');
        });
    };
    
    // ================================
    // BEER ACTIONS
    // ================================
    const verifyBeer = async (beerId, beerName) => {
        console.log('✅ Verifying beer:', beerName);
        
        const venue = getCurrentVenue();
        if (!venue) {
            showToast('No venue selected', 'error');
            return;
        }
        
        try {
            // TODO: Implement API call
            showToast(`✅ ${beerName} verified!`);
            
            const card = document.querySelector(`[data-beer-id="${beerId}"]`);
            if (card) {
                const badge = card.querySelector('.badge-unverified');
                if (badge) {
                    badge.className = 'badge badge-verified';
                    badge.innerHTML = '<span>✓</span> Verified today';
                }
            }
            
            closeAllBeerDropdowns();
            
        } catch (error) {
            console.error('Error verifying beer:', error);
            showToast('Failed to verify beer', 'error');
        }
    };
    
    const deleteBeer = async (beerId, beerName) => {
        console.log('🗑️ Deleting beer:', beerName);
        
        if (!confirm(`Remove "${beerName}" from this venue?`)) {
            return;
        }
        
        const venue = getCurrentVenue();
        if (!venue) {
            showToast('No venue selected', 'error');
            return;
        }
        
        try {
            // TODO: Implement API call
            showToast(`Removed ${beerName}`);
            
            const card = document.querySelector(`[data-beer-id="${beerId}"]`);
            if (card) {
                card.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => card.remove(), 300);
            }
            
        } catch (error) {
            console.error('Error deleting beer:', error);
            showToast('Failed to remove beer', 'error');
        }
    };
    
    const setupMapButton = (venue) => {
        const mapBtn = document.querySelector('[data-action="toggle-venue-map"]');
        if (!mapBtn) return;
        
        if (!venue.latitude || !venue.longitude) {
            mapBtn.disabled = true;
            mapBtn.textContent = '🗺️ No Location';
        } else {
            mapBtn.disabled = false;
            mapBtn.textContent = '🗺️ Show on Map';
        }
    };
    
    const resetVenueDetailsView = () => {
        const venueContainer = document.getElementById('venueContainer');
        const venueMapContainer = document.getElementById('venueMapContainer');
        const mapBtnText = document.getElementById('venueMapBtnText');
        
        if (venueContainer) venueContainer.classList.remove('split-view');
        if (venueMapContainer) venueMapContainer.style.display = 'none';
        if (mapBtnText) mapBtnText.textContent = 'Show on Map';
    };
    
    const quickAddBeer = () => {
        const venue = getCurrentVenue();
        if (!venue) {
            showToast('No venue selected', 'error');
            return;
        }
        
        modules.modalManager?.close('beerListModal');
        
        if (window.ReportBeer || window.CascadeForm) {
            modules.modalManager?.open('reportModal');
            const reportModule = window.ReportBeer || window.CascadeForm;
            reportModule.setVenue(venue);
            reportModule.reset();
        } else {
            console.log('Beer report module not available');
        }
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        // Venue functions
        showVenueDetails,
        loadBeerList,
        
        // Status functions
        openStatusModal,
        selectStatus,
        confirmGFStatus,
        doConfirmStatus,
        confirmStatusUpdate,
        showStatusPromptAfterBeer,
        
        // Beer details prompt
        skipBeerDetails,
        addBeerDetailsFromPrompt,
        
        // Beer actions
        verifyBeer,
        deleteBeer,
        toggleBeerDropdown,
        closeAllBeerDropdowns,
        
        // Utilities
        getCurrentVenue,
        setCurrentVenue,
        quickAddBeer,
        
        // For debugging
        getState: () => state
    };
})();
