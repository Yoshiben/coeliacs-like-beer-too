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
        // GF Status state
        selectedStatus: null,
        statusModalOpen: false
    };
    
    // ================================
    // MODULE GETTERS (for accessing other modules)
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
    const utils = {
        getCurrentVenue() {
            return state.currentVenue || window.App.getState(STATE_KEYS.CURRENT_VENUE);
        },
        
        setCurrentVenue(venue) {
            state.currentVenue = venue;
            window.App.setState(STATE_KEYS.CURRENT_VENUE, venue);
        },
        
        showToast(message, type = 'success') {
            if (modules.toast) {
                type === 'error' ? modules.toast.error(message) : modules.toast.success(message);
            } else if (window.showSuccessToast && window.showErrorToast) {
                type === 'error' ? window.showErrorToast(message) : window.showSuccessToast(message);
            } else {
                console.log(`${type === 'success' ? '✅' : '❌'} ${message}`);
            }
        },
        
        showLoadingToast(message) {
            if (window.showLoadingToast) {
                window.showLoadingToast(message);
            }
        },
        
        hideLoadingToast() {
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
        }
    };
    
    // ================================
    // VENUE DETAILS DISPLAY
    // ================================
    
    /**
     * Load and display venue details
     * @param {string|number} venueId - The venue ID to load
     * @returns {Promise<object>} The venue data
     */
    const showVenueDetails = async (venueId) => {
        console.log('🏠 Loading venue details:', venueId);
        
        try {
            // First try to load fresh data from API
            const results = await modules.api.searchVenues({ 
                venueId: venueId
            });
            const venues = Array.isArray(results) ? results : results.venues;
            
            if (venues && venues.length > 0) {
                const venue = venues[0];
                
                // ADD THIS DEBUG LOGGING HERE 👇
                console.log('🔍 VENUE STRUCTURE:', {
                    venue,
                    keys: Object.keys(venue),
                    id_field: venue.venue_id,
                    alt_id: venue.id,
                    has_venue_id: 'venue_id' in venue,
                    has_id: 'id' in venue
                });
                
                utils.setCurrentVenue(venue);
                state.lastViewedVenueId = venueId;
                
                displayVenueDetails(venue);
                return venue;
            } else {
                utils.showToast('Venue not found.', 'error');
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error loading venue:', error);
            utils.showToast('Error loading venue details.', 'error');
            return null;
        }
    };
    
    /**
     * Display the venue details in the UI
     * @param {object} venue - The venue data to display
     */
    const displayVenueDetails = (venue) => {
        modules.modalManager.open('venueDetailsOverlay', {
            onOpen: () => {
                // Reset view to details (not map)
                resetVenueDetailsView();
                
                // Update navigation title
                const navTitle = document.getElementById('venueNavTitle');
                if (navTitle) navTitle.textContent = venue.venue_name;
                
                // Populate all the venue information
                populateVenueDetails(venue);
                setupVenueButtons(venue);
                setupMapButton(venue);
                
                // Track the view
                modules.tracking?.trackVenueView(venue.venue_name);
                
                // Update navigation context
                modules.nav?.showVenueDetailsWithContext();
            }
        });
    };
    
    /**
     * Populate venue information into the UI elements
     */
    const populateVenueDetails = (venue) => {
        // Basic info
        const elements = {
            title: document.getElementById('venueDetailsTitle'),
            address: document.getElementById('venueDetailsAddress'),
            location: document.getElementById('venueDetailsLocation'),
            beer: document.getElementById('venueDetailsBeer')
        };
        
        if (elements.title) elements.title.textContent = venue.venue_name;
        if (elements.address) elements.address.textContent = venue.address;
        if (elements.location) elements.location.textContent = `${venue.postcode} • ${venue.city}`;
        
        // Beer details section
        setupBeerDetails(venue, elements.beer);
        
        // GF Status display
        setupGFStatusDisplay(venue);

        // Load and display status confirmations
        loadStatusConfirmations(venue.venue_id);
    };

    const loadStatusConfirmations = async (venueId) => {
        try {
            const response = await fetch(`/api/venue/${venueId}/status-confirmations`);
            if (response.ok) {
                const confirmData = await response.json();
                const confirmationEl = document.getElementById('statusConfirmation');
                if (confirmationEl) {
                    confirmationEl.textContent = confirmData.text;
                    // Optional: Add styling based on confirmation status
                    if (confirmData.has_confirmations) {
                        confirmationEl.classList.add('confirmed');
                    } else {
                        confirmationEl.classList.add('unconfirmed');
                    }
                }
            }
        } catch (error) {
            console.error('Error loading status confirmations:', error);
            // Fail silently - don't break the UI if this fails
        }
    };
    
    /**
     * Setup the beer details section
     */
    const setupBeerDetails = (venue, beerEl) => {
        const beerSection = document.getElementById('beerSection');
        if (!beerSection || !beerEl) return;
        
        const hasGFOptions = venue.bottle || venue.tap || venue.cask || venue.can || venue.beer_details;
        const hasGFStatus = venue.gf_status === 'currently' || 
                          venue.gf_status === 'always_tap_cask' || 
                          venue.gf_status === 'always_bottle_can';
        
        if (hasGFOptions || hasGFStatus) {
            beerSection.style.display = 'block';
            beerSection.style.cursor = 'pointer';
            beerSection.setAttribute('data-action', 'show-beer-list');
            
            const beerCount = venue.beer_details ? venue.beer_details.split(',').length : 0;
            
            beerEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        ${beerCount > 0 ? 
                            `<strong>${beerCount} GF beer${beerCount > 1 ? 's' : ''} reported</strong>` : 
                            '<strong>No beers listed yet</strong>'}
                        <br><small style="opacity: 0.8;">Click to view/manage list</small>
                    </div>
                    <div style="font-size: 1.5rem; opacity: 0.6;">›</div>
                </div>
            `;
        } else {
            beerSection.style.display = 'none';
            beerEl.innerHTML = '';
        }
    };
    
    /**
     * Setup GF status display with proper styling
     */
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
    };

    const setupVenueButtons = (venue) => {
        utils.setCurrentVenue(venue);
    };
    
    // ================================
    // GF STATUS UPDATES
    // ================================
    
    /**
     * Open the GF status selection modal
     */
    const openStatusModal = () => {
        const venue = utils.getCurrentVenue();
        
        if (!venue?.venue_id) {
            console.error('❌ No current venue data');
            utils.showToast('❌ No venue selected', 'error');
            return;
        }
        
        state.selectedStatus = null;
        state.statusModalOpen = true;
        
        // Set venue name in modal if element exists
        const venueNameEl = document.getElementById('statusPromptVenueName');
        if (venueNameEl) {
            venueNameEl.textContent = venue.venue_name || venue.name || 'this venue';
        }
        
        // Open the status selection modal
        if (modules.modalManager) {
            modules.modalManager.open('gfStatusModal');
        } else {
            const modal = document.getElementById('gfStatusModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }
    };
    
    /**
     * Handle status selection
     */
    const selectStatus = (status) => {
        state.selectedStatus = status;
        
        // Close selection modal
        if (modules.modalManager) {
            modules.modalManager.close('gfStatusModal');
        } else {
            const modal = document.getElementById('gfStatusModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
        }
        
        // Update confirmation modal with selected status
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
        
        // Open confirmation modal
        setTimeout(() => {
            if (modules.modalManager) {
                modules.modalManager.open('gfStatusConfirmModal');
            } else {
                const modal = document.getElementById('gfStatusConfirmModal');
                if (modal) {
                    modal.style.display = 'flex';
                    modal.classList.add('active');
                }
            }
        }, 100);
    };
    
    /**
     * Confirm and submit the status update
     */
    const confirmStatusUpdate = async () => {
        const venue = utils.getCurrentVenue();
        
        // More robust venue ID extraction
        const venueId = venue?.venue_id || venue?.id || window.App.getState('currentVenue')?.venue_id;
        
        if (!venueId || !state.selectedStatus) {
            console.error('❌ Missing data:', { venueId, status: state.selectedStatus, venue });
            utils.showToast('❌ Error: Missing venue or status', 'error');
            return;
        }
        
        // Close confirmation modal
        if (modules.modalManager) {
            modules.modalManager.closeGroup('status');
        } else {
            ['gfStatusConfirmModal', 'gfStatusModal'].forEach(id => {
                const modal = document.getElementById(id);
                if (modal) {
                    modal.style.display = 'none';
                    modal.classList.remove('active');
                }
            });
        }
        
        utils.showLoadingToast('Updating status...');
        
        try {
            const userId = parseInt(localStorage.getItem('user_id'));
            
            // Log what we're sending
            console.log('📤 Sending status update:', {
                venue_id: parseInt(venueId),
                status: state.selectedStatus,
                user_id: userId
            });
            
            const response = await fetch('/api/update-gf-status', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    venue_id: parseInt(venueId),  // Use the extracted venueId
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
                throw new Error(`Server error: ${response.status} - ${errorData.error || 'Unknown'}`);
            }
            
            const result = await response.json();
            console.log('✅ Status update response:', result);
            
            utils.hideLoadingToast();
            
            // Update the display immediately
            updateStatusDisplay(state.selectedStatus);
            
            // Update the venue state
            utils.setCurrentVenue({
                ...venue,
                gf_status: state.selectedStatus
            });
            
            utils.showToast('✅ Status updated successfully!');
            modules.tracking?.trackEvent('gf_status_updated', 'Venue', state.selectedStatus);
            
            // Check if we should show beer details prompt
            const cameFromBeerReport = window.App.getState('statusPromptVenue') !== null;
            
            if (!cameFromBeerReport && ['always_tap_cask', 'always_bottle_can', 'currently'].includes(state.selectedStatus)) {
                setTimeout(() => {
                    showBeerDetailsPrompt();
                }, 500);
            }
            
        } catch (error) {
            console.error('❌ Error updating status:', error);
            utils.hideLoadingToast();
            utils.showToast('❌ Failed to update status. Please try again.', 'error');
        }
    };
    
    /**
     * Update the status display in the UI
     */
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
    
    /**
     * Show prompt to add beer details after status update
     */
    const showBeerDetailsPrompt = () => {
        if (modules.modalManager) {
            modules.modalManager.open('beerDetailsPromptModal');
        } else {
            const modal = document.getElementById('beerDetailsPromptModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('active');
            }
        }
    };
    
    /**
     * Show status prompt after beer report (called from cascade-form)
     */
    const showStatusPromptAfterBeer = (venue, submittedBy, userId) => {
        console.log('🎯 Showing status prompt for venue:', venue);
        console.log('👤 Submitted by:', submittedBy, 'User ID:', userId);
        
        // Store venue data for the action handlers
        window.App.setState('statusPromptVenue', venue);
        window.App.setState('statusPromptSubmittedBy', submittedBy);
        window.App.setState('statusPromptUserId', userId);
        
        // Close venue details overlay first if it's open
        if (modules.modalManager?.isOpen('venueDetailsOverlay')) {
            modules.modalManager.close('venueDetailsOverlay');
        }
        
        // Small delay to ensure overlay is closed
        setTimeout(() => {
            // Set the venue name in the modal
            const venueNameEl = document.getElementById('statusPromptVenueName');
            if (venueNameEl && venue) {
                venueNameEl.textContent = venue.venue_name || venue.name || 'this venue';
            }
            
            // Set venue ID on all status buttons
            const statusButtons = document.querySelectorAll('.status-prompt-btn');
            statusButtons.forEach(btn => {
                btn.dataset.venueId = venue.venue_id;
            });
            
            // Open the status prompt modal
            modules.modalManager?.open('statusPromptAfterBeerModal');
        }, 300);
    };
    
    // ================================
    // BEER LIST MANAGEMENT
    // ================================
    
    /**
     * Load and display the beer list for a venue
     */
    const loadBeerList = async (venue) => {
        console.log('Loading beer list for:', venue.venue_name);
        
        // Update header
        const venueNameEl = document.getElementById('beerListVenueName');
        if (venueNameEl) {
            venueNameEl.textContent = venue.venue_name;
        }
        
        try {
            // Fetch structured beer data
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
    
    /**
     * Display the beer list with new design
     */
    const displayBeerList = (beers) => {
        const contentEl = document.getElementById('beerListContent');
        const emptyEl = document.getElementById('beerListEmpty');
        
        if (contentEl) contentEl.style.display = 'block';
        if (emptyEl) emptyEl.style.display = 'none';
        
        // Generate beer cards
        if (contentEl) {
            contentEl.innerHTML = beers.map((beer, index) => createBeerCard(beer, index)).join('');
        }
        
        // Initialize dropdown handlers
        initializeBeerDropdowns();
    };
    
    /**
     * Create a single beer card HTML
     */
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
    
    /**
     * Show empty beer list state
     */
    const showEmptyBeerList = () => {
        const contentEl = document.getElementById('beerListContent');
        const emptyEl = document.getElementById('beerListEmpty');
        
        if (contentEl) contentEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
    };
    
    /**
     * Initialize dropdown menu handlers for beer options
     */
    const initializeBeerDropdowns = () => {
        // Remove existing listeners to avoid duplicates
        document.querySelectorAll('[data-action="beer-options"]').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
        
        // Add fresh listeners
        document.querySelectorAll('[data-action="beer-options"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const beerId = btn.dataset.beerId;
                const dropdown = document.getElementById(`dropdown-${beerId}`);
                
                // Close all other dropdowns
                document.querySelectorAll('.beer-dropdown-menu').forEach(menu => {
                    if (menu !== dropdown) menu.classList.remove('active');
                });
                
                // Toggle this dropdown
                if (dropdown) {
                    dropdown.classList.toggle('active');
                }
            });
        });
    };

    // ================================
    // VENUE ACTIONS
    // ================================
    
    /**
     * Handle beer verification
     */
    const verifyBeer = async (beerId, beerName) => {
        console.log('✅ Verifying beer:', beerName);
        
        const venue = utils.getCurrentVenue();
        if (!venue) {
            utils.showToast('No venue selected', 'error');
            return;
        }
        
        try {
            // TODO: Implement API call to verify beer
            utils.showToast(`✅ ${beerName} verified!`);
            
            // Update the badge to show verified
            const card = document.querySelector(`[data-beer-id="${beerId}"]`);
            if (card) {
                const badge = card.querySelector('.badge-unverified');
                if (badge) {
                    badge.className = 'badge badge-verified';
                    badge.innerHTML = '<span>✓</span> Verified today';
                }
            }
            
            // Close dropdown
            document.querySelectorAll('.beer-dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });
            
        } catch (error) {
            console.error('Error verifying beer:', error);
            utils.showToast('Failed to verify beer', 'error');
        }
    };
    
    /**
     * Handle beer deletion
     */
    const deleteBeer = async (beerId, beerName) => {
        console.log('🗑️ Deleting beer:', beerName);
        
        if (!confirm(`Remove "${beerName}" from this venue?`)) {
            return;
        }
        
        const venue = utils.getCurrentVenue();
        if (!venue) {
            utils.showToast('No venue selected', 'error');
            return;
        }
        
        try {
            // TODO: Implement API call to delete beer
            utils.showToast(`Removed ${beerName}`);
            
            // Remove the card from DOM
            const card = document.querySelector(`[data-beer-id="${beerId}"]`);
            if (card) {
                card.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => card.remove(), 300);
            }
            
        } catch (error) {
            console.error('Error deleting beer:', error);
            utils.showToast('Failed to remove beer', 'error');
        }
    };
    
    /**
     * Setup map button handler
     */
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
    
    /**
     * Reset venue details view to default state
     */
    const resetVenueDetailsView = () => {
        const venueContainer = document.getElementById('venueContainer');
        const venueMapContainer = document.getElementById('venueMapContainer');
        const mapBtnText = document.getElementById('venueMapBtnText');
        
        // Removes the split-screen class
        if (venueContainer) venueContainer.classList.remove('split-view');
        
        // Hides the map container completely
        if (venueMapContainer) venueMapContainer.style.display = 'none';
        
        // Resets button text to "Show on Map"
        if (mapBtnText) mapBtnText.textContent = 'Show on Map';
    };
    
    /**
     * Quick add beer to current venue
     */
    const quickAddBeer = () => {
        const venue = utils.getCurrentVenue();
        if (!venue) {
            utils.showToast('No venue selected', 'error');
            return;
        }
        
        // Close beer list modal
        modules.modalManager?.close('beerListModal');
        
        // Open cascade form for beer reporting
        if (window.CascadeForm) {
            modules.modalManager?.open('reportModal');
            window.CascadeForm.setVenue(venue);
            window.CascadeForm.reset();
        } else {
            console.log('CascadeForm not available');
        }
    };
    
    // ================================
    // EVENT HANDLERS
    // ================================
    
    /**
     * Handle all venue-related actions
     */
    const handleVenueActions = (e) => {
        const action = e.target.closest('[data-action]');
        if (!action) return;
        
        // Only handle venue/status related actions
        const venueActions = [
            'change-gf-status',
            'select-status',
            'confirm-status',
            'cancel-status',
            'skip-details',
            'add-beer-details'
        ];
        
        if (!venueActions.includes(action.dataset.action)) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const actionHandlers = {
            'change-gf-status': () => openStatusModal(),
            'select-status': () => selectStatus(action.dataset.status),
            'confirm-status': () => confirmStatusUpdate(),
            'cancel-status': () => {
                modules.modalManager?.close('gfStatusConfirmModal');
            },
            'skip-details': () => {
                modules.modalManager?.close('beerDetailsPromptModal');
                utils.showToast('✅ Status updated successfully!');
            },
            'add-beer-details': () => {
                modules.modalManager?.close('beerDetailsPromptModal');
                window.App.setState('cameFromBeerDetailsPrompt', true);
                
                // Open cascade form
                if (window.CascadeForm) {
                    modules.modalManager?.open('reportModal');
                    const venue = utils.getCurrentVenue();
                    window.CascadeForm.setVenue(venue);
                    window.CascadeForm.reset();
                }
            }
        };
        
        const handler = actionHandlers[action.dataset.action];
        if (handler) handler();
    };
    
    /**
     * Initialize all venue-related event handlers
     */
    const initializeEventHandlers = () => {
        // Status action handlers
        document.addEventListener('click', handleVenueActions);
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.beer-dropdown-menu') && 
                !e.target.closest('[data-action="beer-options"]')) {
                document.querySelectorAll('.beer-dropdown-menu').forEach(menu => {
                    menu.classList.remove('active');
                });
            }
        });
        
        // Handle quick add beer button
        const quickAddBtn = document.querySelector('[data-action="quick-add-beer"]');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', quickAddBeer);
        }
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🔧 Initializing VenueModule with GF Status...');
        initializeEventHandlers();
    });
    
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
        confirmStatusUpdate,
        showStatusPromptAfterBeer,
        
        // Beer actions
        verifyBeer,
        deleteBeer,
        
        // Utilities
        getCurrentVenue: utils.getCurrentVenue,
        setCurrentVenue: utils.setCurrentVenue,
        
        // For debugging
        getState: () => state
    };
})();
