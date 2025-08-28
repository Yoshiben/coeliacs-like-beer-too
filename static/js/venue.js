// ================================================================================
// VENUE.JS - All venue-related functionality
// Handles venue details, beer lists, status updates, and venue management
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
        lastViewedVenueId: null
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
                utils.setCurrentVenue(venue);
                state.lastViewedVenueId = venueId;
                
                displayVenueDetails(venue);
                return venue;
            } else {
                modules.toast?.error('Venue not found.');
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error loading venue:', error);
            modules.toast?.error('Error loading venue details.');
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
                populateVenueInfo(venue);
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
        setupBeerSection(venue, elements.beer);
        
        // GF Status display
        setupGFStatusDisplay(venue);
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
    // BEER LIST MANAGEMENT
    // ================================
    
    /**
     * Load and display the beer list for a venue
     */
    const loadBeerList = (venue) => {
        console.log('🍺 Loading beer list for:', venue.venue_name);
        
        // Update modal header
        const venueNameEl = document.getElementById('beerListVenueName');
        if (venueNameEl) {
            venueNameEl.textContent = venue.venue_name || 'Unknown Venue';
        }
        
        const contentEl = document.getElementById('beerListContent');
        const emptyEl = document.getElementById('beerListEmpty');
        
        if (!contentEl || !emptyEl) {
            console.error('❌ Beer list elements not found');
            return;
        }
        
        if (venue.beer_details) {
            const beers = parseBeerDetails(venue.beer_details);
            console.log('📊 Parsed beers:', beers);
            
            if (beers.length > 0) {
                displayBeerList(beers);
            } else {
                showEmptyBeerList();
            }
        } else {
            console.log('ℹ️ No beer details found');
            showEmptyBeerList();
        }
    };
    
    /**
     * Display the beer list with new design
     */
    const displayBeerList = (beers) => {
        const contentEl = document.getElementById('beerListContent');
        const emptyEl = document.getElementById('beerListEmpty');
        
        contentEl.style.display = 'block';
        emptyEl.style.display = 'none';
        
        // Calculate stats
        const tapCount = beers.filter(b => 
            b.format.toLowerCase() === 'tap' || b.format.toLowerCase() === 'cask'
        ).length;
        const bottleCanCount = beers.filter(b => 
            b.format.toLowerCase() === 'bottle' || b.format.toLowerCase() === 'can'
        ).length;
        
        // Update stats bar
        updateBeerStats(tapCount, bottleCanCount, beers.length);
        
        // Generate beer cards
        contentEl.innerHTML = beers.map((beer, index) => createBeerCard(beer, index)).join('');
        
        // Initialize dropdown handlers
        initializeBeerDropdowns();
    };
    
    /**
     * Create a single beer card HTML
     */
    const createBeerCard = (beer, index) => {
        const isBottleCan = beer.format.toLowerCase() === 'bottle' || beer.format.toLowerCase() === 'can';
        const isCask = beer.format.toLowerCase() === 'cask';
        
        const formatIcon = isBottleCan ? '🍾' : '🍺';
        const formatClass = isBottleCan ? 'bottle' : '';
        const formatBadgeClass = isBottleCan ? 'badge-bottle' : 'badge-tap';
        
        const formatLabel = {
            'tap': 'On Tap',
            'cask': 'Cask',
            'bottle': 'Bottle',
            'can': 'Can'
        }[beer.format.toLowerCase()] || beer.format;
        
        // For now, all beers need verification (you can add timestamp logic later)
        const isVerified = false;
        
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
                        ${isVerified ? 
                            `<span class="badge badge-verified">
                                <span>✓</span> Verified today
                            </span>` : 
                            `<span class="badge badge-unverified">
                                <span>?</span> Needs verification
                            </span>`
                        }
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
     * Update the beer statistics bar
     */
    const updateBeerStats = (tapCount, bottleCount, verifiedCount) => {
        document.getElementById('tapCount').textContent = tapCount;
        document.getElementById('bottleCount').textContent = bottleCount;
        document.getElementById('verifiedCount').textContent = verifiedCount;
    };
    
    /**
     * Show empty beer list state
     */
    const showEmptyBeerList = () => {
        const contentEl = document.getElementById('beerListContent');
        const emptyEl = document.getElementById('beerListEmpty');
        
        contentEl.style.display = 'none';
        emptyEl.style.display = 'block';
        
        // Reset stats to 0
        updateBeerStats(0, 0, 0);
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
    
    /**
     * Parse beer details string into structured data
     */
    const parseBeerDetails = (beerDetailsString) => {
        const beers = [];
        const beerStrings = beerDetailsString.split(', ');
        
        beerStrings.forEach((beerString, index) => {
            // Extract format (tap, bottle, etc)
            const formatMatch = beerString.match(/^(.*?)\s*-\s*/);
            const format = formatMatch ? formatMatch[1] : 'Unknown';
            
            // Extract the rest after format
            const remainingString = formatMatch ? 
                beerString.substring(formatMatch[0].length) : 
                beerString;
            
            // Extract style if in parentheses
            const styleMatch = remainingString.match(/\((.*?)\)$/);
            const style = styleMatch ? styleMatch[1] : null;
            
            // Get name and brewery part
            const nameBreweryPart = styleMatch ? 
                remainingString.substring(0, remainingString.lastIndexOf('(')).trim() : 
                remainingString.trim();
            
            // Split brewery and name (assuming brewery comes first)
            const parts = nameBreweryPart.split(' ');
            const brewery = parts[0];
            const name = parts.slice(1).join(' ');
            
            beers.push({
                id: `beer_${index}`,
                format,
                brewery,
                name: name || nameBreweryPart,
                style
            });
        });
        
        return beers;
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
            modules.toast?.error('No venue selected');
            return;
        }
        
        try {
            // TODO: Implement API call to verify beer
            modules.toast?.success(`✅ ${beerName} verified!`);
            
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
            modules.toast?.error('Failed to verify beer');
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
            modules.toast?.error('No venue selected');
            return;
        }
        
        try {
            // TODO: Implement API call to delete beer
            modules.toast?.success(`Removed ${beerName}`);
            
            // Remove the card from DOM
            const card = document.querySelector(`[data-beer-id="${beerId}"]`);
            if (card) {
                card.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => card.remove(), 300);
            }
            
            // Update stats
            // TODO: Recalculate stats
            
        } catch (error) {
            console.error('Error deleting beer:', error);
            modules.toast?.error('Failed to remove beer');
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
        
        // Removes the split-screen class (if venue was showing half details, half map)
        if (venueContainer) venueContainer.classList.remove('split-view');
        
        // Hides the map container completely
        if (venueMapContainer) venueMapContainer.style.display = 'none';
        
        // Resets button text to "Show on Map" (not "Hide Map")
        if (mapBtnText) mapBtnText.textContent = 'Show on Map';
    };
    
    /**
     * Quick add beer to current venue
     */
    const quickAddBeer = () => {
        const venue = utils.getCurrentVenue();
        if (!venue) {
            modules.toast?.error('No venue selected');
            return;
        }
        
        // Close beer list modal
        modules.modalManager?.close('beerListModal');
        
        // Open add beer modal
        // TODO: Implement add beer modal opening
        console.log('Opening add beer modal for:', venue.venue_name);
    };
    
    // ================================
    // EVENT HANDLERS SETUP
    // ================================
    
    /**
     * Initialize all venue-related event handlers
     */
    const initializeEventHandlers = () => {
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
        console.log('🔧 Initializing VenueModule...');
        initializeEventHandlers();
    });
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        // Main functions
        showVenueDetails,
        loadBeerList,
        
        // Beer actions
        verifyBeer,
        deleteBeer,
        
        // Utilities
        parseBeerDetails,
        getCurrentVenue: utils.getCurrentVenue,
        setCurrentVenue: utils.setCurrentVenue,
        
        // For debugging
        getState: () => state
    };
})();
