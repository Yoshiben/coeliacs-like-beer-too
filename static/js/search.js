// ================================================================================
// SEARCH.JS - Complete Refactor with STATE_KEYS
// Handles: Location search, name search, area search, beer search, venue details
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const SearchModule = (function() {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        lastSearchState: null,
        currentSearchVenues: [],
        locationRequestInProgress: false
    };
    
    // ================================
    // MODULE GETTERS - Centralized
    // ================================
    const modules = {
        get api() { return window.App?.getModule('api'); },
        get map() { return window.App?.getModule('map'); },
        get modal() { return window.App?.getModule('modal'); },
        get modalManager() { return window.App?.getModule('modalManager'); },
        get tracking() { return window.App?.getModule('tracking'); },
        get ui() { return window.App?.getModule('ui'); }
    };
    
    // ================================
    // UTILITIES
    // ================================
    const utils = {
        getUserLocation() {
            return window.App.getState(STATE_KEYS.USER_LOCATION);
        },
        
        setUserLocation(location) {
            window.App.setState(STATE_KEYS.USER_LOCATION, location);
            window.App.setState(STATE_KEYS.LOCATION_TIMESTAMP, Date.now());
            window.App.setState(STATE_KEYS.LOCATION_ACCURACY, location.accuracy);
        },
        
        getCurrentVenue() {
            return window.App.getState(STATE_KEYS.CURRENT_VENUE);
        },
        
        setCurrentVenue(venue) {
            window.App.setState(STATE_KEYS.CURRENT_VENUE, venue);
        },
        
        showToast(message, type = 'success') {
            if (window.showSuccessToast) {
                window.showSuccessToast(message);
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
    // LOCATION SEARCH
    // ================================
    const startLocationSearch = () => {
        console.log('🎯 Starting location search...');
        
        modules.tracking?.trackEvent('location_search_start', 'Search', 'distance_modal');
        
        // Use modalManager instead of modal
        if (modules.modalManager) {
            modules.modalManager.open('distanceModal');
        } else if (modules.modal) {
            // Fallback to old method
            modules.modal.open('distanceModal');
        } else {
            // Ultimate fallback
            const distanceModal = document.getElementById('distanceModal');
            if (distanceModal) {
                distanceModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        }
    };
    
    const searchNearbyWithDistance = async (radiusKm) => {
        console.log(`🎯 Searching within ${radiusKm}km...`);
    
        // Get CURRENT filter preference
        const gfOnly = window.App.getState('gfOnlyFilter') !== false;
        console.log(`🍺 Current filter: ${gfOnly ? 'GF Only' : 'All Venues'}`);
    
        try {  // <-- ADD THIS
            // Close distance modal using modalManager
            modules.modalManager?.close('distanceModal') || modules.modal?.close('distanceModal');
            
            showResultsOverlay(`Venues within ${radiusKm}km`);
            showResultsLoading('📍 Getting precise location...');
            
            // Get user location
            let userLocation = utils.getUserLocation();
            if (!userLocation) {
                try {
                    userLocation = await requestLocationWithUI();
                    utils.setUserLocation(userLocation);
                    modules.map?.setUserLocation(userLocation);
                } catch (locationError) {
                    console.error('❌ Location error:', locationError);
                    hideResultsAndShowHome();
                    utils.showToast('📍 Location needed for nearby search. Try searching by area instead!');
                    
                    setTimeout(() => {
                        modules.modal?.open('areaModal');
                    }, 1000);
                    return;
                }
            }
            
            // Show accuracy feedback
            showLocationAccuracyFeedback(userLocation.accuracy);
            
            // Save search state
            state.lastSearchState = {
                type: 'nearby',
                radius: radiusKm,
                userLocation: userLocation,
                timestamp: Date.now()
            };
            
            // Also store in global state for filter module
            window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, 'nearby');
            window.App.setState(STATE_KEYS.LAST_SEARCH.RADIUS, radiusKm);
                    
            // Perform search
            showResultsLoading('🔍 Searching for GF beer options...');
            const venues = await modules.api.findNearbyVenues(
                userLocation.lat, 
                userLocation.lng, 
                radiusKm, 
                gfOnly
            );
            
            // Check if we got a valid response
            if (!venues || !Array.isArray(venues)) {
                console.error('❌ Invalid response from API:', venues);
                showNoResults('Error loading venues. Please try again.');
                return;
            }
            
            console.log(`✅ Found ${venues.length} venues`);
            
            if (venues.length === 0) {
                showNoResults(`No venues found within ${radiusKm}km of your location`);
                return;
            }
            
            state.currentSearchVenues = venues;
            
            const accuracyText = userLocation.accuracy > 500 ? 
                ` (±${Math.round(userLocation.accuracy)}m accuracy)` : '';
            
            displayResultsInOverlay(venues, `${venues.length} venues within ${radiusKm}km${accuracyText}`);
            
            modules.tracking?.trackSearch(`nearby_${radiusKm}km`, 'location', venues.length);
            
        } catch (error) {  // <-- ALREADY HERE
            console.error('❌ Error in nearby search:', error);
            showNoResults('Could not complete search. Please try again.');
        } finally {  // <-- ADD THIS
            // ALWAYS hide loading toast
            utils.hideLoadingToast();
        }
    };
    
    // ================================
    // TEXT SEARCHES - Consolidated
    // ================================
    const performTextSearch = async (type, query, searchConfig) => {
        try {
            // Try to get user location for distance sorting
            let userLocation = utils.getUserLocation();
            if (!userLocation) {
                userLocation = await tryGetUserLocation();
            }
            
            // Perform search
            const results = await modules.api.searchVenues({
                query: query,
                searchType: searchConfig.searchType || 'all',
                page: 1
            });
            
            // Fix: Handle the response structure properly
            let venues = [];
            if (Array.isArray(results)) {
                venues = results;
            } else if (results.pubs) {
                venues = results.pubs; // <-- The API returns 'pubs' not 'venues'
            } else if (results.venues) {
                venues = results.venues;
            }
            
            if (venues.length === 0) {
                showNoResults(searchConfig.noResultsMessage);
                return;
            }
            
            // Sort by distance if we have location
            if (userLocation) {
                venues = sortVenuesByDistance(venues, userLocation);
            }
            
            // Save state
            state.lastSearchState = {
                type: type,
                query: query,
                timestamp: Date.now()
            };
            
            // Store globally
            window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, type);
            window.App.setState(STATE_KEYS.LAST_SEARCH.QUERY, query);
            
            state.currentSearchVenues = venues;
            
            // Display results
            const title = userLocation ? 
                searchConfig.titleWithLocation(venues.length) :
                searchConfig.titleWithoutLocation(venues.length);
                
            displayResultsInOverlay(venues, title);
            
            utils.showToast(`✅ Found ${venues.length} ${searchConfig.successMessage}`);
            modules.tracking?.trackSearch(query, type, venues.length);
            
        } catch (error) {
            console.error(`❌ Error in ${type} search:`, error);
            showNoResults(searchConfig.errorMessage);
        }
    };
    
    const searchByName = async () => {
        const query = document.getElementById('nameInput')?.value.trim();
        
        if (!query) {
            utils.showToast('Please enter a venue name to search');
            return;
        }
        
        console.log('🏠 Searching for venue name:', query);
        
        // Close modal using modalManager
        modules.modalManager?.close('nameModal') || modules.modal?.close('nameModal');
        
        showResultsOverlay(`Venue name: "${query}"`);
        showResultsLoading('Searching for venues...');
        
        await performTextSearch('name', query, {
            searchType: 'name',
            noResultsMessage: `No venues found matching "${query}"`,
            stateQuery: query,
            titleWithLocation: (count) => `${count} venues matching "${query}" (nearest first)`,
            titleWithoutLocation: (count) => `${count} venues matching "${query}"`,
            successMessage: `venues matching "${query}"`,
            errorMessage: `Error searching for "${query}". Please try again.`
        });
        
        modules.tracking?.trackEvent('search_by_name', 'Search', query);
    };
    
    const searchByArea = async () => {
        const query = document.getElementById('areaInput')?.value.trim();
        const searchType = document.getElementById('areaSearchType')?.value;
        
        if (!query) {
            utils.showToast('Please enter a location to search');
            return;
        }
        
        console.log(`🗺️ Searching by ${searchType}:`, query);
        
        // Close modal using modalManager
        modules.modalManager?.close('areaModal') || modules.modal?.close('areaModal');
        
        const searchTypeText = searchType === 'postcode' ? 'postcode' : 'area';
        showResultsOverlay(`${searchTypeText}: "${query}"`);
        showResultsLoading('Finding venues in this area...');
        
        if (searchType === 'postcode') {
            await performPostcodeSearch(query);
        } else {
            await performTextSearch('area', query, {
                searchType: 'area',
                noResultsMessage: `No venues found in "${query}"`,
                stateQuery: `${query} (city)`,
                titleWithLocation: (count) => `${count} venues in ${query} (nearest first)`,
                titleWithoutLocation: (count) => `${count} venues in ${query}`,
                successMessage: `venues in ${query}`,
                errorMessage: `Error searching for "${query}"`
            });
        }
        
        modules.tracking?.trackEvent('search_by_area', 'Search', `${searchType}:${query}`);
    };
    
    const performPostcodeSearch = async (postcode) => {
        try {
            showResultsLoading('Finding postcode location...');
            const location = await modules.api.geocodePostcode(postcode);
            
            console.log(`✅ Postcode geocoded to: ${location.lat}, ${location.lng}`);
            
            showResultsLoading('Finding venues near this postcode...');
            const radius = 5;
            const venues = await modules.api.findNearbyVenues(location.lat, location.lng, radius);
            
            if (venues.length === 0) {
                showNoResults(`No venues found within ${radius}km of ${postcode}`);
                return;
            }
            
            // UPDATE: In searchByArea around line 260
            state.lastSearchState = {
                type: 'area',
                query: query,
                searchType: searchType,
                timestamp: Date.now()
            };

            // Store globally
            window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, 'area');
            window.App.setState(STATE_KEYS.LAST_SEARCH.QUERY, query);
            
            state.currentSearchVenues = venues;
            
            displayResultsInOverlay(venues, `${venues.length} venues near ${postcode} (${radius}km radius)`);
            utils.showToast(`✅ Found ${venues.length} venues near ${postcode}`);
            modules.tracking?.trackSearch(postcode, 'postcode', venues.length);
            
        } catch (error) {
            console.error('❌ Error searching by postcode:', error);
            showNoResults(`Could not find location for "${postcode}"`);
        }
    };
    
    const searchByBeer = async () => {
        const query = document.getElementById('beerInput')?.value.trim();
        const searchType = document.getElementById('beerSearchType')?.value;
        
        if (!query) {
            utils.showToast('Please enter something to search for');
            return;
        }
        
        console.log(`🍺 Searching by ${searchType}:`, query);
        
        // Close modal using modalManager
        modules.modalManager?.close('beerModal') || modules.modal?.close('beerModal');
        
        const searchTypeText = searchType === 'brewery' ? 'brewery' : 
                             searchType === 'beer' ? 'beer' : 'style';
        showResultsOverlay(`${searchTypeText}: "${query}"`);
        showResultsLoading('Finding venues with this beer...');
        
        await performBeerSearch(query, searchType);
        
        modules.tracking?.trackEvent('search_by_beer', 'Search', `${searchType}:${query}`);
    };
    
    const performBeerSearch = async (query, searchType) => {
        try {
            console.log(`🍺 Performing beer search: "${query}" (${searchType})`);
            
            let userLocation = utils.getUserLocation();
            if (!userLocation) {
                userLocation = await tryGetUserLocation();
            }
            
            // Get results
            let results;
            if (modules.api.searchVenuesByBeer) {
                results = await modules.api.searchVenuesByBeer(query, searchType);
            } else {
                results = await modules.api.searchVenues({
                    query: query,
                    searchType: 'all',
                    page: 1
                });
            }
            
            let allVenues = Array.isArray(results) ? results : results.venues || [];
            console.log(`📊 Got ${allVenues.length} venues from API`);
            
            // Filter based on beer search criteria
            const filteredVenues = filterVenuesByBeerCriteria(allVenues, query, searchType);
            
            if (filteredVenues.length === 0) {
                showNoResults(`No venues found serving "${query}". Try searching for a brewery name or beer style.`);
                return;
            }
            
            // Sort by distance if location available
            if (userLocation) {
                filteredVenues.sort((a, b) => {
                    const distA = calculateDistance(userLocation, a);
                    const distB = calculateDistance(userLocation, b);
                    return distA - distB;
                });
            }
            
            // Save state and display
            state.lastSearchState = {
                type: 'beer',
                query: query,
                searchType: searchType,
                timestamp: Date.now()
            };
            
            // Store globally
            window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, 'beer');
            window.App.setState(STATE_KEYS.LAST_SEARCH.QUERY, query);
            
            state.currentSearchVenues = filteredVenues;
            
            const title = userLocation ? 
                `${filteredVenues.length} venues serving "${query}" (nearest first)` :
                `${filteredVenues.length} venues serving "${query}"`;
                
            displayResultsInOverlay(filteredVenues, title);
            utils.showToast(`✅ Found ${filteredVenues.length} venues serving "${query}"`);
            modules.tracking?.trackSearch(query, `beer_${searchType}`, filteredVenues.length);
            
        } catch (error) {
            console.error('❌ Error in beer search:', error);
            showNoResults(`Error searching for "${query}". Please try again.`);
        }
    };
    
    const filterVenuesByBeerCriteria = (venues, query, searchType) => {
        const searchQuery = query.toLowerCase().trim();
        
        return venues.filter(venue => {
            if (!venue.beer_details) return false;
            const beerDetails = venue.beer_details.toLowerCase();
            
            switch (searchType) {
                case 'brewery':
                    return beerDetails.includes(` ${searchQuery} `) || 
                           beerDetails.startsWith(searchQuery) ||
                           beerDetails.includes(`${searchQuery} `) ||
                           beerDetails.includes(` ${searchQuery}`);
                           
                case 'beer':
                    return beerDetails.includes(searchQuery);
                    
                case 'style':
                    return beerDetails.includes(searchQuery) ||
                           beerDetails.includes(`(${searchQuery})`) ||
                           beerDetails.includes(`${searchQuery} `) ||
                           beerDetails.includes(` ${searchQuery}`);
                           
                default:
                    return false;
            }
        });
    };
    
    // ================================
    // VENUE DETAILS
    // ================================
    const showVenueDetails = async (venueId) => {
        console.log('🏠 Showing venue details:', venueId);
        
        try {
            utils.showLoadingToast('Loading venue details...');
            
            // Fix: Don't use the general searchVenues for getting a specific venue
            // Use the venueId parameter directly
            const results = await modules.api.searchVenues({ 
                venueId: venueId  // This should match what the API expects
            });
            const venues = Array.isArray(results) ? results : results.venues || results.pubs;
            
            utils.hideLoadingToast();
            
            if (venues && venues.length > 0) {
                const venue = venues[0];
                utils.setCurrentVenue(venue);
                
                displayVenueDetails(venue);
                return venue;
            } else {
                utils.showToast('Venue not found.');
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error loading venue:', error);
            utils.hideLoadingToast();
            utils.showToast('Error loading venue details.');
            return null;
        }
    };
    
    const displayVenueDetails = (venue) => {
        // Use ModalManager to handle the overlay
        modules.modalManager.open('venueDetailsOverlay', {
            onOpen: () => {
                // Reset split-view state
                resetVenueDetailsView();
                
                // Update navigation title
                const navTitle = document.getElementById('venueNavTitle');
                if (navTitle) navTitle.textContent = venue.venue_name;
                
                // Populate content
                populateVenueDetails(venue);
                setupVenueButtons(venue);
                setupMapButtonHandler(venue);
                
                modules.tracking?.trackVenueView(venue.venue_name);
                
                const navModule = window.App?.getModule('nav');
                navModule?.showVenueDetailsWithContext();
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
        if (elements.location) elements.location.textContent = `${venue.postcode} • ${venue.local_authority}`;
        
        setupBeerDetails(venue, elements.beer);
        setupGFStatusDisplay(venue);
    };
    
    const setupBeerDetails = (venue, beerEl) => {
        const beerSection = document.getElementById('beerSection');
        if (!beerSection || !beerEl) return;
        
        const hasGFOptions = venue.bottle || venue.tap || venue.cask || venue.can || venue.beer_details;
        
        if (hasGFOptions || venue.gf_status === 'currently' || venue.gf_status === 'always_tap_cask' || venue.gf_status === 'always_bottle_can') {
            beerSection.style.display = 'block';
            beerSection.style.cursor = 'pointer';
            beerSection.setAttribute('data-action', 'show-beer-list');
            
            // Parse beer details if available
            const beerCount = venue.beer_details ? venue.beer_details.split(',').length : 0;
            
            beerEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        ${beerCount > 0 ? `<strong>${beerCount} GF beer${beerCount > 1 ? 's' : ''} reported</strong>` : '<strong>No beers listed yet</strong>'}
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
    
    const setupGFStatusDisplay = (venue) => {
        const statusEl = document.getElementById('currentGFStatus');
        if (!statusEl) return;
        
        const displays = {
            'always_tap_cask': {
                icon: '⭐',
                text: 'Always Has Tap/Cask',
                meta: 'The holy grail of GF beer!'
            },
            'always_bottle_can': {
                icon: '✅',
                text: 'Always Has Bottles/Cans',
                meta: 'Reliable GF options'
            },
            'currently': {
                icon: '🔵',
                text: 'Available Now',
                meta: 'GF beer in stock'
            },
            'not_currently': {
                icon: '❌',
                text: 'Not Available',
                meta: 'No GF options currently'
            },
            'unknown': {
                icon: '❓',
                text: 'Not Sure',
                meta: 'Help us find out!'
            }
        };
        
        const status = venue.gf_status || 'unknown';
        const display = displays[status] || displays.unknown;
        
        statusEl.innerHTML = `
            <span class="status-icon">${display.icon}</span>
            <span class="status-text">${display.text}</span>
            <span class="status-meta">${display.meta}</span>
        `;
    };

    // REPLACE the loadBeerList function in search.js (around line 513)

    const loadBeerList = (venue) => {
        console.log('🍺 Loading beer list for venue:', venue);
        console.log('📦 Beer details:', venue.beer_details);
        console.log('📊 Venue object keys:', Object.keys(venue));
        
        const contentEl = document.getElementById('beerListContent');
        const emptyEl = document.getElementById('beerListEmpty');
        
        if (!contentEl || !emptyEl) {
            console.error('❌ Beer list elements not found');
            return;
        }
        
        // Parse beer details
        if (venue.beer_details) {
            const beers = parseBeerDetails(venue.beer_details);
            console.log('📊 Parsed beers:', beers);
            
            if (beers.length > 0) {
                contentEl.style.display = 'block';
                emptyEl.style.display = 'none';
                
                contentEl.innerHTML = beers.map((beer, index) => {
                    // Format icons
                    const formatIcons = {
                        'tap': '🚰',
                        'bottle': '🍺',
                        'can': '🥫',
                        'cask': '🛢️'
                    };
                    
                    const formatIcon = formatIcons[beer.format.toLowerCase()] || '🍺';
                    
                    return `
                        <div class="beer-list-item">
                            <div class="beer-info">
                                <strong>${beer.name}</strong>
                                <div class="beer-meta">
                                    <span class="beer-format">${formatIcon} ${beer.format}</span>
                                    <span class="beer-brewery">${beer.brewery}</span>
                                    ${beer.style ? `<span class="beer-style">${beer.style}</span>` : ''}
                                </div>
                            </div>
                            <button class="btn-delete-beer" data-action="delete-beer" 
                                data-beer-id="${beer.id || index}" 
                                data-beer-name="${beer.name}"
                                title="Remove this beer">
                                ❌
                            </button>
                        </div>
                    `;
                }).join('');
            } else {
                contentEl.style.display = 'none';
                emptyEl.style.display = 'block';
            }
        } else {
            console.log('ℹ️ No beer details found');
            contentEl.style.display = 'none';
            emptyEl.style.display = 'block';
        }
    };
    
    const parseBeerDetails = (beerDetailsString) => {
        // Parse the beer_details string format
        // Format: "format - brewery beer (style), format - brewery beer (style)"
        const beers = [];
        const beerStrings = beerDetailsString.split(', ');
        
        beerStrings.forEach((beerString, index) => {
            const formatMatch = beerString.match(/^(.*?)\s*-\s*/);
            const format = formatMatch ? formatMatch[1] : 'Unknown';
            
            const remainingString = formatMatch ? beerString.substring(formatMatch[0].length) : beerString;
            const styleMatch = remainingString.match(/\((.*?)\)$/);
            const style = styleMatch ? styleMatch[1] : null;
            
            const nameBreweryPart = styleMatch ? 
                remainingString.substring(0, remainingString.lastIndexOf('(')).trim() : 
                remainingString.trim();
            
            // Try to split brewery and beer name
            const parts = nameBreweryPart.split(' ');
            const brewery = parts[0];
            const name = parts.slice(1).join(' ');
            
            beers.push({
                id: `beer_${index}`, // We'll need real IDs from the database
                format,
                brewery,
                name: name || nameBreweryPart,
                style
            });
        });
        
        return beers;
    };
    
    const setupVenueButtons = (venue) => {
        utils.setCurrentVenue(venue);
    };
    
    const setupMapButtonHandler = (venue) => {
        // This is now handled by data-action="toggle-venue-map" in main.js
        // Just ensure venue has coordinates
        if (!venue.latitude || !venue.longitude) {
            const mapBtn = document.querySelector('[data-action="toggle-venue-map"]');
            if (mapBtn) {
                mapBtn.disabled = true;
                mapBtn.textContent = '🗺️ No Location';
            }
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
    
    // ================================
    // NAVIGATION
    // ================================
    // UPDATE: In search.js, replace the goBackToResults function (around line 608)

    const goBackToResults = () => {
        console.log('🔙 Going back to results...');
        
        // Close venue details
        hideOverlays(['venueDetailsOverlay']);
        
        // Show results overlay
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay) {
            resultsOverlay.style.display = 'flex';
            resultsOverlay.classList.add('active');
        }
        
        // IMPORTANT: Reset map/list view to show list
        const elements = {
            list: document.getElementById('resultsListContainer'),
            map: document.getElementById('resultsMapContainer'),
            btnText: document.getElementById('resultsMapBtnText')
        };
        
        if (elements.list && elements.map) {
            // Always show list when going back
            elements.list.style.display = 'block';
            elements.list.style.flex = '1';
            elements.map.style.display = 'none';
            elements.btnText.textContent = 'Map';
            
            // Clean up any existing map instance
            const mapModule = modules.map;
            if (mapModule) {
                mapModule.cleanupResultsMap?.();
            }
        }

        // ADD THIS: Update navigation context after showing results
        const navModule = window.App?.getModule('nav');
        navModule?.showResultsWithContext();
        
        // Restore cached results if available
        if (state.currentSearchVenues && state.currentSearchVenues.length > 0) {
            console.log('📋 Using cached results');
            const title = state.lastSearchState?.type === 'nearby' ? 
                `Venues within ${state.lastSearchState.radius}km` : 
                state.lastSearchState?.query || 'Search Results';
            displayResultsInOverlay(state.currentSearchVenues, title);
            
            modules.tracking?.trackEvent('back_to_results_cached', 'Navigation', state.lastSearchState?.type);
            return true;
        }
        
        return false;
    };
    
    // ================================
    // LOCATION UTILITIES
    // ================================
    // UPDATE the requestLocationWithUI function in search.js
    // Replace the existing function with this updated version:
    
    const requestLocationWithUI = () => {
        if (state.locationRequestInProgress) {
            console.log('📍 Location request already in progress');
            return Promise.reject(new Error('Location request already in progress'));
        }
        
        state.locationRequestInProgress = true;
        
        return new Promise((resolve, reject) => {
            // First check if we already have permission
            if (navigator.permissions) {
                navigator.permissions.query({ name: 'geolocation' }).then(result => {
                    console.log('📍 Current permission state:', result.state);
                    
                    if (result.state === 'granted') {
                        // We already have permission, just get location
                        getUserLocation().then(location => {
                            state.locationRequestInProgress = false;
                            resolve(location);
                        }).catch(error => {
                            state.locationRequestInProgress = false;
                            reject(error);
                        });
                    } else if (result.state === 'denied') {
                        // Permission was denied, show blocked modal
                        state.locationRequestInProgress = false;
                        showLocationBlockedModal();
                        reject(new Error('Location permission denied in browser settings'));
                    } else {
                        // Permission is prompt, show our UI
                        showLocationPermissionUI((location) => {
                            state.locationRequestInProgress = false;
                            resolve(location);
                        }, (error) => {
                            state.locationRequestInProgress = false;
                            reject(error);
                        });
                    }
                }).catch(() => {
                    // Permissions API not available, show our UI
                    showLocationPermissionUI((location) => {
                        state.locationRequestInProgress = false;
                        resolve(location);
                    }, (error) => {
                        state.locationRequestInProgress = false;
                        reject(error);
                    });
                });
            } else {
                // No permissions API, show our UI
                showLocationPermissionUI((location) => {
                    state.locationRequestInProgress = false;
                    resolve(location);
                }, (error) => {
                    state.locationRequestInProgress = false;
                    reject(error);
                });
            }
        });
    };

    const showLocationBlockedModal = () => {
        // Use modalManager to ensure proper modal management
        if (modules.modalManager) {
            modules.modalManager.closeAll(); // Close any open modals
            modules.modalManager.open('locationBlockedModal');
        } else {
            const modal = document.getElementById('locationBlockedModal');
            if (!modal) {
                console.error('Location blocked modal not found');
                utils.showToast('📍 Location blocked. Enable in browser settings and refresh.', 'error');
                return;
            }
            
            // Detect browser and show relevant instructions
            const userAgent = navigator.userAgent.toLowerCase();
            let browser = 'generic';
            
            if (userAgent.includes('chrome') && !userAgent.includes('edge')) {
                browser = 'chrome';
            } else if (userAgent.includes('firefox')) {
                browser = 'firefox';
            } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
                browser = 'safari';
            } else if (userAgent.includes('edge')) {
                browser = 'edge';
            }
            
            // Hide all instructions first
            const allInstructions = modal.querySelectorAll('.instruction-set');
            allInstructions.forEach(inst => inst.classList.remove('active'));
            
            // Show the relevant one
            const relevantInstruction = modal.querySelector(`[data-browser="${browser}"]`);
            if (relevantInstruction) {
                relevantInstruction.style.display = 'block';
            } else {
                // Fallback to generic
                const genericInstruction = modal.querySelector('[data-browser="generic"]');
                if (genericInstruction) {
                    genericInstruction.style.display = 'block';
                }
            }
            
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Close on background click
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                }
            };
        }
    };
    
    const getUserLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('📍 Geolocation not supported'));
                return;
            }
            
            console.log('📍 Requesting high-accuracy location...');
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    
                    console.log(`✅ Location found: ±${location.accuracy}m`);
                    
                    if (location.accuracy > 5000) {
                        console.warn(`⚠️ Poor accuracy: ±${location.accuracy}m`);
                        attemptFallbackLocation(resolve, reject, location);
                        return;
                    }
                    
                    resolve(location);
                },
                (error) => {
                    console.error('❌ High-accuracy location failed:', error);
                    attemptFallbackLocation(resolve, reject, null, error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 30000
                }
            );
        });
    };
    
    const attemptFallbackLocation = (resolve, reject, previousLocation = null, originalError = null) => {
        console.log('🔄 Attempting fallback location...');
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                
                console.log(`✅ Fallback location: ±${location.accuracy}m`);
                
                if (!previousLocation || location.accuracy < previousLocation.accuracy) {
                    resolve(location);
                } else {
                    resolve(previousLocation);
                }
            },
            (error) => {
                console.error('❌ Fallback location failed:', error);
                
                if (previousLocation) {
                    resolve(previousLocation);
                    return;
                }
                
                let userMessage = 'Could not get your location. ';
                const errorCode = originalError?.code || error?.code;
                
                switch(errorCode) {
                    case 1:
                        userMessage += 'Please allow location access and try again.';
                        break;
                    case 2:
                        userMessage += 'Location services unavailable. Try enabling GPS or WiFi.';
                        break;
                    case 3:
                        userMessage += 'Location request timed out. Try again or search by postcode.';
                        break;
                    default:
                        userMessage += 'Try searching by area instead.';
                }
                
                reject(new Error(userMessage));
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 120000
            }
        );
    };
    
    // REPLACE the showLocationPermissionUI function in search.js (around line 779)

    const showLocationPermissionUI = (resolve, reject) => {
        // Use modalManager to ensure no conflicts
        if (modules.modalManager) {
            modules.modalManager.closeAll(); // Close any open modals first
            modules.modalManager.open('locationPermissionModal');
        } else {
            const modal = document.getElementById('locationPermissionModal');
            if (!modal) {
                console.error('Location permission modal not found');
                reject(new Error('Permission UI not available'));
                return;
            }
            
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
        
        const cleanup = () => {
            if (modules.modalManager) {
                modules.modalManager.close('locationPermissionModal');
            } else {
                const modal = document.getElementById('locationPermissionModal');
                if (modal) {
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                }
            }
            document.removeEventListener('locationPermissionGranted', grantedHandler);
            document.removeEventListener('locationPermissionDenied', deniedHandler);
        };
        
        const grantedHandler = () => {
            console.log('📍 User clicked allow location');
            cleanup();
            
            // Actually request browser permission
            utils.showLoadingToast('📍 Requesting browser permission...');
            
            if (!navigator.geolocation) {
                utils.hideLoadingToast();
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            // This will trigger the actual browser permission dialog
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    utils.hideLoadingToast();
                    utils.showToast('📍 Location found!');
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    resolve(location);
                },
                (error) => {
                    utils.hideLoadingToast();
                    let message = 'Could not get location. ';
                    
                    switch(error.code) {
                        case 1:
                            message += 'Please allow location access in your browser settings.';
                            break;
                        case 2:
                            message += 'Location services unavailable.';
                            break;
                        case 3:
                            message += 'Location request timed out.';
                            break;
                    }
                    
                    reject(new Error(message));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0
                }
            );
        };
        
        const deniedHandler = () => {
            console.log('📍 User clicked deny location');
            cleanup();
            reject(new Error('Location permission denied by user'));
        };
        
        document.addEventListener('locationPermissionGranted', grantedHandler);
        document.addEventListener('locationPermissionDenied', deniedHandler);
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                deniedHandler();
            }
        };
    };
    
    // ALSO REPLACE the requestLocationWithUI function (around line 608)
    
    
    const tryGetUserLocation = async () => {
        const cachedLocation = utils.getUserLocation();
        const locationTimestamp = window.App.getState(STATE_KEYS.LOCATION_TIMESTAMP);
        
        if (cachedLocation && locationTimestamp && Date.now() - locationTimestamp < 300000) {
            console.log('📍 Using cached location');
            return cachedLocation;
        }
        
        try {
            const location = await getUserLocation();
            utils.setUserLocation(location);
            modules.map?.setUserLocation(location);
            return location;
        } catch (error) {
            console.log('📍 Could not get location:', error.message);
            return null;
        }
    };

    const ensureLoadingToastHidden = () => {
        // Force hide any stuck loading toasts
        const loadingToast = document.getElementById('loadingToast');
        if (loadingToast) {
            loadingToast.classList.remove('show');
            loadingToast.style.display = 'none';
        }
        // Also use the helper
        utils.hideLoadingToast();
    };
    
    // ================================
    // UI HELPERS
    // ================================

    const showResultsOverlay = (title) => {
        console.log('📋 Showing results overlay:', title);
    
        // Clean up any stuck loading toasts first
        ensureLoadingToastHidden();
        
        // Reset to list view (not map view)
        const elements = {
            list: document.getElementById('resultsListContainer'),
            map: document.getElementById('resultsMapContainer'),
            btnText: document.getElementById('resultsMapBtnText')
        };
        
        if (elements.list) {
            elements.list.style.display = 'block';
            elements.list.style.flex = '1';
        }
        if (elements.map) {
            elements.map.style.display = 'none';
        }
        if (elements.btnText) {
            elements.btnText.textContent = 'Map';
        }
        
        // Update title
        const resultsTitle = document.getElementById('resultsTitle');
        if (resultsTitle) {
            resultsTitle.textContent = title;
        }
        
        // Use ModalManager to open the overlay
        modules.modalManager.open('resultsOverlay', {
            onOpen: () => {
                console.log('✅ Results overlay opened via ModalManager');
                
                // Update navigation context - THIS IS THE KEY FIX
                const navModule = window.App?.getModule('nav');
                navModule?.setPageContext('results'); // ADD THIS LINE
                navModule?.showResultsWithContext();
    
                // ADD THE BUTTON TO THE ACTUAL STRUCTURE
                setTimeout(() => {
                    const resultsContainer = document.querySelector('.results-container');
                    if (resultsContainer && !resultsContainer.querySelector('.add-venue-btn')) {
                        const addVenueBtn = document.createElement('button');
                        addVenueBtn.className = 'btn btn-primary add-venue-btn';
                        addVenueBtn.textContent = '➕ Add New Venue';
                        addVenueBtn.dataset.action = 'add-new-venue-from-results';
                        addVenueBtn.style.cssText = 'position: fixed; bottom: 10vh; right: 2rem; z-index: 100; border-radius: 25px; padding: 12px 24px; box-shadow: var(--shadow-lg);';
                        resultsContainer.appendChild(addVenueBtn);
                    }
                }, 200);
            }
        });
    };
    
    const showResultsLoading = (message) => {
        const elements = {
            loading: document.getElementById('resultsLoading'),
            list: document.getElementById('resultsList'),
            noResults: document.getElementById('noResultsFound')
        };
        
        if (elements.loading) elements.loading.style.display = 'flex';
        if (elements.list) elements.list.style.display = 'none';
        if (elements.noResults) elements.noResults.style.display = 'none';
        
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = message;
    };
    
    const showNoResults = (message) => {
        const elements = {
            loading: document.getElementById('resultsLoading'),
            list: document.getElementById('resultsList'),
            noResults: document.getElementById('noResultsFound')
        };
        
        if (elements.loading) elements.loading.style.display = 'none';
        if (elements.list) elements.list.style.display = 'none';
        if (elements.noResults) elements.noResults.style.display = 'flex';
        
        const noResultsText = document.querySelector('.no-results-text');
        if (noResultsText) noResultsText.textContent = message;
    };
    
    // UPDATE: In search.js, replace the displayResultsInOverlay function (around line 1031)

    const displayResultsInOverlay = (venues, title) => {
        state.currentSearchVenues = venues;
        
        console.log('💾 Stored search results:', venues.length, 'venues');
        
        // IMPORTANT: Don't call resetResultsMapState here as it cleans up the map
        // Just ensure we're showing the list view
        const elements = {
            loading: document.getElementById('resultsLoading'),
            noResults: document.getElementById('noResultsFound'),
            list: document.getElementById('resultsList'),
            listContainer: document.getElementById('resultsListContainer'),
            mapContainer: document.getElementById('resultsMapContainer'),
            btnText: document.getElementById('resultsMapBtnText')
        };
        
        // Hide loading and no results
        if (elements.loading) elements.loading.style.display = 'none';
        if (elements.noResults) elements.noResults.style.display = 'none';
        
        // Ensure list container is visible
        if (elements.listContainer) {
            elements.listContainer.style.display = 'block';
            elements.listContainer.style.flex = '1';
        }
        
        // Hide map container if it's visible
        if (elements.mapContainer) {
            elements.mapContainer.style.display = 'none';
        }
        
        // Update button text
        if (elements.btnText) {
            elements.btnText.textContent = 'Map';
        }
        
        // Populate results
        if (elements.list) {
            elements.list.style.display = 'block';
            elements.list.innerHTML = '';
            
            venues.forEach(venue => {
                const resultItem = createResultItem(venue);
                elements.list.appendChild(resultItem);
            });
        }
        
        // Update title
        const titleEl = document.getElementById('resultsTitle');
        if (titleEl) titleEl.textContent = title;
        
        console.log(`✅ Displayed ${venues.length} results`);
    };
    
    // REPLACE the createResultItem function (around line 1076):

    const createResultItem = (venue) => {
        const template = document.getElementById('venue-result-template');
        const clone = template.content.cloneNode(true);
        
        clone.querySelector('.result-title').textContent = venue.venue_name;
        
        const distanceEl = clone.querySelector('.result-distance');
        if (venue.distance !== undefined) {
            distanceEl.textContent = `${venue.distance.toFixed(1)}km away`;
        } else {
            distanceEl.style.display = 'none';
        }
        
        const gfIndicator = clone.querySelector('.gf-indicator');
        
        // Determine GF status properly
        const gfStatus = venue.gf_status || 'unknown';
        
        // Set indicator based on status
        switch(gfStatus) {
            case 'always_tap_cask':
                gfIndicator.textContent = '⭐ Always (Tap/Cask)';
                gfIndicator.className = 'gf-indicator always-tap-cask';
                break;
            case 'always_bottle_can':
                gfIndicator.textContent = '✅ Always (Bottles/Cans)';
                gfIndicator.className = 'gf-indicator always-bottle-can';
                break;
            case 'currently':
                gfIndicator.textContent = '🔵 Currently Available';
                gfIndicator.className = 'gf-indicator currently';
                break;
            case 'not_currently':
                gfIndicator.textContent = '❌ Not Available';
                gfIndicator.className = 'gf-indicator not-currently';
                break;
            case 'unknown':
            case null:
            case undefined:
            case '':
                gfIndicator.textContent = '❓ GF Unknown';
                gfIndicator.className = 'gf-indicator unknown';
                break;
            default:
                gfIndicator.textContent = '❓ GF Unknown';
                gfIndicator.className = 'gf-indicator unknown';
        }
        
        clone.querySelector('.result-address').textContent = venue.address;
        clone.querySelector('.result-postcode').textContent = venue.postcode;
        clone.querySelector('.result-authority').textContent = venue.local_authority;
        
        const viewButton = clone.querySelector('[data-action="view-venue"]');
        viewButton.dataset.venueId = venue.venue_id;
        
        return clone;
    };
    
    // UPDATE: In search.js, update the resetResultsMapState function (around line 1094)

    const resetResultsMapState = () => {
        const elements = {
            list: document.getElementById('resultsListContainer'),
            map: document.getElementById('resultsMapContainer'),
            btnText: document.getElementById('resultsMapBtnText'),
            overlay: document.getElementById('resultsOverlay'),
            content: document.querySelector('.results-content')
        };
        
        // Always reset to list view
        if (elements.list) {
            elements.list.style.display = 'block';
            elements.list.style.flex = '1';
        }
        if (elements.map) {
            elements.map.style.display = 'none';
            elements.map.classList.remove('split-view');
            // Clean up any inline styles that might interfere
            elements.map.style.removeProperty('flex');
            elements.map.style.removeProperty('height');
            elements.map.style.removeProperty('minHeight');
        }
        if (elements.btnText) {
            elements.btnText.textContent = 'Map';
        }
        if (elements.overlay) {
            elements.overlay.classList.remove('split-view');
        }
        if (elements.content) {
            // Reset content container styles
            elements.content.style.removeProperty('display');
            elements.content.style.removeProperty('flexDirection');
            elements.content.style.removeProperty('height');
        }
        
        // Clean up any existing map instance
        const mapModule = modules.map;
        if (mapModule) {
            mapModule.cleanupResultsMap?.();
        }
    };
    
    const hideResultsAndShowHome = () => {
        modules.modalManager.close('resultsOverlay');
        
        // Show community home
        const communityHome = document.querySelector('.community-home');
        if (communityHome) {
            communityHome.style.display = 'block';
        }
        
        document.body.style.overflow = '';
        
        const navModule = window.App?.getModule('nav');
        navModule?.showHomeWithContext();
    };
    
    const showLocationAccuracyFeedback = (accuracy) => {
        let message = '📍 Location found - finding nearby GF beer...';
        
        if (accuracy <= 100) {
            message = '🎯 Excellent location accuracy - finding nearby GF beer...';
        } else if (accuracy <= 500) {
            message = '📍 Good location accuracy - finding nearby GF beer...';
        } else if (accuracy <= 1000) {
            message = '📍 Reasonable location accuracy - finding nearby GF beer...';
        } else {
            message = '📍 Location found (low accuracy) - finding nearby GF beer...';
            utils.showToast(`⚠️ Location accuracy: ±${Math.round(accuracy)}m`);
        }
        
        showResultsLoading(message);
    };
    
    // ================================
    // HELPERS
    // ================================
    const sortVenuesByDistance = (venues, location) => {
        return venues.map(venue => {
            if (venue.latitude && venue.longitude) {
                venue.distance = calculateDistance(location, venue);
            } else {
                venue.distance = 999;
            }
            return venue;
        }).sort((a, b) => a.distance - b.distance);
    };
    
    const calculateDistance = (location, venue) => {
        const lat1 = location.lat;
        const lon1 = location.lng;
        const lat2 = parseFloat(venue.latitude);
        const lon2 = parseFloat(venue.longitude);
        
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };
    
    // ================================
    // SUB-MODULES (Simplified)
    // ================================
    const PlacesSearchModule = {
        selectedPlace: null,
        searchTimeout: null,
        searchResults: [],
        
        init() {
            console.log('🔧 Initializing PlacesSearchModule...');
        },
        
        openPlacesSearch(initialQuery = '') {
            console.log('🔍 Opening places search modal...');
            const modal = document.getElementById('placesSearchModal');
            if (modal) {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                
                const input = document.getElementById('placesSearchInput');
                if (input) {
                    input.value = initialQuery;
                    setTimeout(() => input.focus(), 100);
                    
                    if (initialQuery) {
                        this.handleSearch(initialQuery);
                    }
                }
            }
        },
        
        handleSearch(query) {
            clearTimeout(this.searchTimeout);
            
            const resultsDiv = document.getElementById('placesResults');
            if (!resultsDiv) return;
            
            if (!query || query.length < 3) {
                resultsDiv.style.display = 'none';
                return;
            }
            
            resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Searching...</div>';
            resultsDiv.style.display = 'block';
            
            this.searchTimeout = setTimeout(() => {
                this.searchOSM(query);
            }, 300);
        },
        
        async searchOSM(query) {
            try {
                // Create query variations for fuzzy matching
                const queryVariations = [
                    query,                           // "scaredy cat"
                    query + 's',                     // "scaredy cats" 
                    query.replace(/s$/, ''),         // Remove trailing s
                    query + ' bar',                  // "scaredy cat bar"
                    query + ' pub'                   // "scaredy cat pub"
                ];
                
                let allPlaces = [];
                
                // Try each query variation
                for (const queryVar of queryVariations) {
                    const searches = [
                        // First try: specific venue search
                        {
                            q: `${queryVar} venue UK`,
                            tags: ['venue', 'bar', 'restaurant', 'cafe', 'club']
                        },
                        // Fallback: broader search
                        {
                            q: `${queryVar} UK`,
                            tags: ['amenity', 'building', 'leisure']
                        }
                    ];
                    
                    for (const search of searches) {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/search?` +
                            `q=${encodeURIComponent(search.q)}` +
                            `&format=json&countrycodes=gb&limit=20&extratags=1&namedetails=1`
                        );
                        
                        const places = await response.json();
                        
                        // Keep your existing filtering logic exactly as is
                        const relevantPlaces = places.filter(place => {
                            const type = place.type?.toLowerCase() || '';
                            const category = place.category?.toLowerCase() || '';
                            const name = place.display_name?.toLowerCase() || '';
                            const extraTags = place.extratags || {};
                            
                            // Check main categories
                            if (search.tags.some(tag => 
                                category.includes(tag) || 
                                type.includes(tag) || 
                                name.includes(tag)
                            )) return true;
                            
                            // Check extra tags
                            if (extraTags.amenity && ['venue', 'bar', 'restaurant', 'cafe', 'nightclub'].includes(extraTags.amenity)) {
                                return true;
                            }
                            
                            // Check if it's likely a venue based on name
                            const venueKeywords = ['venue', 'bar', 'inn', 'tavern', 'arms', 'club', 'brewery', 'tap', 'house'];
                            if (venueKeywords.some(keyword => name.includes(keyword))) {
                                return true;
                            }
                            
                            return false;
                        });
                        
                        allPlaces = [...allPlaces, ...relevantPlaces];
                        
                        // If we found good results, stop searching
                        if (relevantPlaces.length >= 3) break;
                    }
                    
                    // If we found enough results, stop trying query variations
                    if (allPlaces.length >= 5) break;
                }
                
                // Remove duplicates based on OSM ID
                const uniquePlaces = Array.from(
                    new Map(allPlaces.map(p => [p.osm_id, p])).values()
                );
                
                // Remove venues with similar names at similar locations
                const deduplicatedPlaces = this.deduplicateVenues(uniquePlaces);
                
                this.displayResults(deduplicatedPlaces);
                
            } catch (error) {
                console.error('OSM search error:', error);
                this.showError('Search failed. Please try again.');
            }
        },
        
        displayResults(places) {
            const resultsDiv = document.getElementById('placesResults');
            if (!resultsDiv) return;
            
            if (places.length === 0) {
                resultsDiv.innerHTML = `
                    <div class="no-places-found">
                        <p>No venues found. Try a different search.</p>
                        <small>Tip: Include the city name</small>
                    </div>
                `;
                resultsDiv.style.display = 'block';
                return;
            }
            
            this.searchResults = places;
            
            resultsDiv.innerHTML = places.map((place, index) => {
                const name = place.namedetails?.name || place.display_name.split(',')[0];
                const address = this.formatAddress(place);
                const type = this.getPlaceType(place);
                
                return `
                    <div class="place-result" data-action="select-place" data-place-index="${index}">
                        <div class="place-icon">${this.getPlaceIcon(type)}</div>
                        <div class="place-info">
                            <strong>${this.escapeHtml(name)}</strong>
                            <small>${this.escapeHtml(address)}</small>
                            <span class="place-type">${type}</span>
                        </div>
                    </div>
                `;
            }).join('');

            // ADD THIS right after the join(''):
            resultsDiv.innerHTML += `
                <div style="padding: var(--space-lg); border-top: 1px solid var(--border-light); margin-top: var(--space-md);">
                    <button class="btn btn-secondary" data-action="manual-venue-entry" style="width: 100%;">
                        ✏️ Can't find it? Enter manually
                    </button>
                </div>
            `;
            
            resultsDiv.style.display = 'block';
        },
        
        selectPlace(placeOrIndex) {
            console.log('🏠 Selecting place:', placeOrIndex);
            const place = typeof placeOrIndex === 'number' 
                ? this.searchResults[placeOrIndex]
                : placeOrIndex;
                
            if (!place) {
                console.error('❌ No place found to select');
                return;
            }
            
            console.log('✅ Place selected:', place);
            
            this.selectedPlace = {
                name: place.namedetails?.name || place.display_name.split(',')[0],
                address: this.formatAddress(place),
                lat: place.lat,
                lon: place.lon,
                type: this.getPlaceType(place),
                osm_id: place.osm_id,
                display_name: place.display_name,
                extratags: place.extratags,
                namedetails: place.namedetails,
                osm_type: place.osm_type
            };
            
            document.getElementById('selectedPlaceName').textContent = this.selectedPlace.name;
            document.getElementById('selectedPlaceAddress').textContent = this.selectedPlace.address;
            document.getElementById('selectedPlaceType').textContent = this.selectedPlace.type;
            document.getElementById('selectedPlacePreview').style.display = 'block';
            
            this.hideResults();
        },
        
        useSelectedPlace() {
            if (!this.selectedPlace) return;
            
            console.log('📝 Using selected place to add new venue');
            
            const place = this.selectedPlace;
            const name = place.namedetails?.name || place.display_name.split(',')[0];
            const parts = place.display_name.split(',');
            
            let address = '';
            let postcode = place.extratags?.postcode || '';
            
            if (parts.length > 1) {
                const cleanParts = parts.slice(1, 4).filter(part => {
                    const trimmed = part.trim();
                    return trimmed && !trimmed.match(/^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i);
                });
                address = cleanParts.join(', ').trim();
            }
            
            if (!postcode) {
                const postcodeMatch = place.display_name.match(/[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}/i);
                if (postcodeMatch) {
                    postcode = postcodeMatch[0];
                }
            }
            
            const newVenueData = {
                name: name,
                address: address,
                postcode: postcode,
                latitude: place.lat,
                longitude: place.lon,
                osm_id: place.osm_id,
                osm_type: place.osm_type
            };
            
            console.log('🏠 New venue data:', newVenueData);
            
            document.getElementById('placesSearchModal').style.display = 'none';
            document.body.style.overflow = '';
            
            utils.showLoadingToast('Adding new venue to database...');
            
            this.submitNewVenue(newVenueData);
        },
        
        async submitNewVenue(venueData) {
            try {
                // Get the user's nickname
                let nickname = window.App.getState('userNickname');
                if (!nickname) {
                    nickname = localStorage.getItem('userNickname') || 'anonymous';
                }
                
                const response = await fetch('/api/add-venue', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: venueData.name,
                        address: venueData.address,
                        postcode: venueData.postcode,
                        latitude: venueData.latitude,
                        longitude: venueData.longitude,
                        osm_id: venueData.osm_id,
                        source: 'user_submission',
                        submitted_by: nickname  // Include the nickname
                    })
                });
                
                utils.hideLoadingToast();
                
                if (!response.ok) {
                    throw new Error('Failed to add venue');
                }
                
                const result = await response.json();
                console.log('✅ Venue added:', result);
                
                window.newlyAddedVenue = {
                    venue_id: result.venue_id,
                    name: venueData.name,
                    address: venueData.address,
                    postcode: venueData.postcode,
                    latitude: venueData.latitude,
                    longitude: venueData.longitude
                };
                
                this.showVenueAddedPrompt(result);
                
            } catch (error) {
                console.error('❌ Error adding venue:', error);
                utils.showToast('❌ Failed to add venue. Please try again.');
            }
        },
        
        showVenueAddedPrompt(result) {
            const promptModal = document.getElementById('venueAddedPromptModal');
            if (promptModal) {
                document.getElementById('addedVenueName').textContent = window.newlyAddedvenue.venue_name;
                promptModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } else {
                utils.showToast(`✅ ${window.newlyAddedvenue.venue_name} added successfully!`);
            }
        },
        
        formatAddress(place) {
            const parts = place.display_name.split(',');
            const postcode = place.extratags?.postcode || '';
            
            let address = parts.slice(1, 3).join(',').trim();
            if (postcode && !address.includes(postcode)) {
                address += ', ' + postcode;
            }
            
            return address;
        },
        
        getPlaceType(place) {
            const category = place.category?.toLowerCase() || '';
            const type = place.type?.toLowerCase() || '';
            
            if (category.includes('venue') || type.includes('venue')) return 'Venue';
            if (category.includes('bar') || type.includes('bar')) return 'Bar';
            if (category.includes('restaurant')) return 'Restaurant';
            if (category.includes('cafe')) return 'Café';
            return 'Venue';
        },
        
        getPlaceIcon(type) {
            const icons = {
                'Venue': '🍺',
                'Bar': '🍹',
                'Restaurant': '🍽️',
                'Café': '☕',
                'Venue': '📍'
            };
            return icons[type] || '📍';
        },
        
        hideResults() {
            const resultsDiv = document.getElementById('placesResults');
            if (resultsDiv) {
                resultsDiv.style.display = 'none';
            }
        },
        
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        showError(message) {
            const resultsDiv = document.getElementById('placesResults');
            if (resultsDiv) {
                resultsDiv.innerHTML = `<div class="search-error">${message}</div>`;
                resultsDiv.style.display = 'block';
            }
        },

        deduplicateVenues(places) {
            const deduplicated = [];
            
            places.forEach(place => {
                const placeName = (place.namedetails?.name || place.display_name.split(',')[0]).toLowerCase().trim();
                const placeLat = parseFloat(place.lat);
                const placeLon = parseFloat(place.lon);
                
                // Check if we already have a venue with similar name nearby
                const isDuplicate = deduplicated.some(existing => {
                    const existingName = (existing.namedetails?.name || existing.display_name.split(',')[0]).toLowerCase().trim();
                    
                    // Calculate distance in meters
                    const distance = this.calculateDistance(
                        placeLat, placeLon,
                        parseFloat(existing.lat), parseFloat(existing.lon)
                    );
                    
                    // Similar name check (using simple comparison, could use Levenshtein distance for better matching)
                    const nameSimilarity = this.calculateNameSimilarity(placeName, existingName);
                    
                    // Consider duplicate if within 100m AND name is 80%+ similar
                    return distance < 100 && nameSimilarity > 0.8;
                });
                
                if (!isDuplicate) {
                    deduplicated.push(place);
                }
            });
            
            return deduplicated;
        },
        
        calculateDistance(lat1, lon1, lat2, lon2) {
            // Haversine formula for distance in meters
            const R = 6371000; // Earth's radius in meters
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        },
        
        calculateNameSimilarity(str1, str2) {
            // Simple similarity check - ratio of matching characters
            // You could use Levenshtein distance for better results
            const longer = str1.length > str2.length ? str1 : str2;
            const shorter = str1.length > str2.length ? str2 : str1;
            
            if (longer.includes(shorter)) {
                return shorter.length / longer.length;
            }
            
            // Check if they share significant words
            const words1 = str1.split(/\s+/);
            const words2 = str2.split(/\s+/);
            const significantWords1 = words1.filter(w => w.length > 3);
            const significantWords2 = words2.filter(w => w.length > 3);
            
            const matchingWords = significantWords1.filter(w => 
                significantWords2.some(w2 => w2.includes(w) || w.includes(w2))
            );
            
            return matchingWords.length / Math.max(significantWords1.length, significantWords2.length, 1);
        }
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    document.addEventListener('DOMContentLoaded', () => {
        PlacesSearchModule.init();
    });
    
    // ================================
    // VENUELIC API
    // ================================
    return {
        // Location search
        startLocationSearch,
        searchNearbyWithDistance,
        requestLocationWithUI,
        
        // Search methods
        searchByName,
        searchByArea,
        searchByBeer,
        
        // Venue details
        showVenueDetails,
        
        // Navigation
        goBackToResults,
        
        // Sub-modules
        PlacesSearchModule,
        
        // State getters
        getCurrentResults: () => state.currentSearchVenues,
        getLastSearchState: () => state.lastSearchState,

        loadBeerList
    };
})();
