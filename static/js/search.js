// ================================================================================
// SEARCH.JS - CLEANED VERSION
// Removed redundant toasts, kept essential functionality intact
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
        locationRequestInProgress: false,
        currentPage: 1,
        totalPages: 1,
        totalResults: 0
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
        get ui() { return window.App?.getModule('ui'); },
        get helpers() { return window.App?.getModule('helpers'); }
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
        
        // Smart toast - only show when it adds value
        showToast(message, type = 'success') {
            // Only show error toasts and important notifications
            if (type === 'error' || message.includes('❌') || message.includes('⚠️')) {
                if (window.showSuccessToast && type === 'success') {
                    window.showSuccessToast(message);
                } else if (window.showErrorToast && type === 'error') {
                    window.showErrorToast(message);
                } else if (window.showToast) {
                    window.showToast(message, type);
                }
            }
            // Skip success messages that are obvious from UI
        },
        
        // Only show loading for operations that take time
        showLoadingToast(message, minDelay = 500) {
            // Check if mobile
            const isMobile = window.innerWidth <= 768;
            
            // On mobile, only show for longer operations
            if (isMobile && minDelay < 1000) {
                return { hide: () => {} }; // Return dummy object
            }
            
            if (window.showLoadingToast) {
                const id = window.showLoadingToast(message);
                return { hide: () => window.hideLoadingToast?.() };
            }
            return { hide: () => {} };
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
        
        if (modules.modalManager) {
            modules.modalManager.open('distanceModal');
        } else if (modules.modal) {
            modules.modal.open('distanceModal');
        } else {
            const distanceModal = document.getElementById('distanceModal');
            if (distanceModal) {
                distanceModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        }
    };
    
    const searchNearbyWithDistance = async (radiusKm) => {
        console.log(`🎯 Searching within ${radiusKm}km...`);
    
        const gfOnly = window.App.getState('gfOnlyFilter') !== false;
        console.log(`🍺 Current filter: ${gfOnly ? 'GF Only' : 'All Venues'}`);
    
        try {
            modules.modalManager?.close('distanceModal') || modules.modal?.close('distanceModal');
            
            showResultsOverlay(`Venues within ${radiusKm}km`);
            showResultsLoading('📍 Getting your location...');
            
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
                    utils.showToast('📍 Location needed for nearby search. Try searching by area instead!', 'error');
                    
                    setTimeout(() => {
                        modules.modal?.open('areaModal');
                    }, 1000);
                    return;
                }
            }
            
            // Only show accuracy warning for poor accuracy
            if (userLocation.accuracy > 1000) {
                utils.showToast(`⚠️ Location accuracy: ±${Math.round(userLocation.accuracy)}m`, 'warning');
            }
            
            // Save search state
            state.lastSearchState = {
                type: 'nearby',
                radius: radiusKm,
                userLocation: userLocation,
                timestamp: Date.now()
            };
            
            window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, 'nearby');
            window.App.setState(STATE_KEYS.LAST_SEARCH.RADIUS, radiusKm);
                    
            showResultsLoading('Searching for venues...');
            
            // Use the paginated nearby endpoint
            const searchParams = {
                lat: userLocation.lat,
                lng: userLocation.lng,
                radius: radiusKm,
                gf_only: gfOnly,
                page: 1
            };
    
            const response = await fetch(`${Constants.API.NEARBY}?${new URLSearchParams(searchParams)}`);
            if (!response.ok) throw new Error('Search failed');
    
            const data = await response.json();
    
            if (!data.venues || data.venues.length === 0) {
                showNoResults(`No venues found within ${radiusKm}km of your location`);
                return;
            }
    
            // Update state with pagination info
            state.currentSearchVenues = data.venues;
            state.currentPage = data.pagination.page;
            state.totalPages = data.pagination.pages;
            state.totalResults = data.pagination.total;
    
            const accuracyText = userLocation.accuracy > 500 ? 
                ` (±${Math.round(userLocation.accuracy)}m accuracy)` : '';
    
            // Display results
            displayResultsInOverlay(
                data.venues, 
                `${data.pagination.total} venues within ${radiusKm}km${accuracyText}`
            );
            updatePaginationUI(
                data.pagination.page, 
                data.pagination.pages, 
                data.pagination.total
            );
    
            // Only show toast for edge cases
            if (data.pagination.total > 100) {
                utils.showToast(`Wow! ${data.pagination.total} venues found!`, 'success');
            }
            
            modules.tracking?.trackSearch(`nearby_${radiusKm}km`, 'location', data.pagination.total);
            
        } catch (error) {
            console.error('❌ Error in nearby search:', error);
            showNoResults('Could not complete search. Please try again.');
        } finally {
            utils.hideLoadingToast();
        }
    };
    
    // ================================
    // TEXT SEARCHES - Consolidated
    // ================================
    const performTextSearch = async (type, query, searchConfig, page = 1) => {
        try {
            // Try to get user location for distance sorting
            let userLocation = utils.getUserLocation();
            if (!userLocation) {
                userLocation = await tryGetUserLocation();
            }
            
            // Perform search with page
            const searchParams = {
                query: query,
                searchType: searchConfig.searchType || 'all', 
                page: page,
                gfOnly: window.App.getState('gfOnlyFilter') !== false,
                user_lat: userLocation?.lat,
                user_lng: userLocation?.lng
            };
            
            const results = await modules.api.searchVenues(searchParams);
            
            // Handle paginated response structure
            let venues = [];
            let pagination = null;
            
            if (results.venues) {
                venues = results.venues;
                pagination = results.pagination;
            } else if (Array.isArray(results)) {
                venues = results;
            }
            
            if (venues.length === 0 && page === 1) {
                showNoResults(searchConfig.noResultsMessage);
                return;
            }
            
            // Sort by distance if we have location
            if (userLocation) {
                venues = sortVenuesByDistance(venues, userLocation);
            }
            
            // Update state with pagination info
            state.currentPage = page;
            state.totalPages = pagination?.pages || 1;
            state.totalResults = pagination?.total || venues.length;
            state.currentSearchVenues = venues;
            
            // Update last search state for re-running with different pages
            state.lastSearchState = {
                type: type,
                query: query,
                searchConfig: searchConfig,
                timestamp: Date.now()
            };
            
            // Display results with pagination
            const title = userLocation ? 
                searchConfig.titleWithLocation(state.totalResults) :
                searchConfig.titleWithoutLocation(state.totalResults);
                
            displayResultsInOverlay(venues, title);
            updatePaginationUI(page, state.totalPages, state.totalResults);
            
            modules.tracking?.trackSearch(query, type, state.totalResults);
            
        } catch (error) {
            console.error(`❌ Error in ${type} search:`, error);
            showNoResults(searchConfig.errorMessage);
        }
    };
    
    // ================================
    // SEARCH METHODS
    // ================================
    const searchByName = async () => {
        const query = document.getElementById('nameInput')?.value.trim();
        
        if (!query) {
            utils.showToast('Please enter a venue name to search', 'error');
            return;
        }
        
        console.log('🏠 Searching for venue name:', query);
        
        modules.modalManager?.close('nameModal') || modules.modal?.close('nameModal');
        
        showResultsOverlay(`Venue name: "${query}"`);
        showResultsLoading('Searching for venues...');
        
        window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, 'name');
        window.App.setState(STATE_KEYS.LAST_SEARCH.QUERY, query);
        window.App.setState(STATE_KEYS.LAST_SEARCH.TIMESTAMP, Date.now());
        
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
            utils.showToast('Please enter a location to search', 'error');
            return;
        }
        
        console.log(`🗺️ Searching by ${searchType}:`, query);
        
        modules.modalManager?.close('areaModal') || modules.modal?.close('areaModal');
        
        const searchTypeText = searchType === 'postcode' ? 'postcode' : 'area';
        showResultsOverlay(`${searchTypeText}: "${query}"`);
        showResultsLoading('Finding venues in this area...');
        
        window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, 'area');
        window.App.setState(STATE_KEYS.LAST_SEARCH.QUERY, query);
        window.App.setState(STATE_KEYS.LAST_SEARCH.TIMESTAMP, Date.now());
        
        state.lastSearchState = {
            type: 'area',
            query: query,
            searchType: searchType,
            timestamp: Date.now()
        };
        
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
            }, 1);
        }
        
        modules.tracking?.trackEvent('search_by_area', 'Search', `${searchType}:${query}`);
    };
    
    const searchByBeer = async () => {
        const query = document.getElementById('beerInput')?.value.trim();
        const searchType = document.getElementById('beerSearchType')?.value;
        
        if (!query) {
            utils.showToast('Please enter something to search for', 'error');
            return;
        }
        
        console.log(`🍺 Searching by ${searchType}:`, query);
        
        modules.modalManager?.close('beerModal') || modules.modal?.close('beerModal');
        
        const searchTypeText = searchType === 'brewery' ? 'brewery' : 
                             searchType === 'beer' ? 'beer' : 'style';
        showResultsOverlay(`${searchTypeText}: "${query}"`);
        showResultsLoading('Finding venues with this beer...');
        
        window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, 'beer');
        window.App.setState(STATE_KEYS.LAST_SEARCH.QUERY, query);
        window.App.setState(STATE_KEYS.LAST_SEARCH.TIMESTAMP, Date.now());
        
        await performBeerSearch(query, searchType, 1);
        
        modules.tracking?.trackEvent('search_by_beer', 'Search', `${searchType}:${query}`);
    };
    
    const performPostcodeSearch = async (postcode) => {
        try {
            const cleanPostcode = postcode.trim().toUpperCase();
            const postcodePattern = /^[A-Z]{1,2}[0-9]?[0-9A-Z]?(\s?[0-9]?[A-Z]{0,2})?$/;
            
            if (!postcodePattern.test(cleanPostcode)) {
                await performTextSearch('area', postcode, {
                    searchType: 'area',
                    noResultsMessage: `No venues found in "${postcode}"`,
                    titleWithLocation: (count) => `${count} venues in ${postcode} (nearest first)`,
                    titleWithoutLocation: (count) => `${count} venues in ${postcode}`,
                    successMessage: `venues in ${postcode}`,
                    errorMessage: `Error searching for "${postcode}"`
                }, 1);
                return;
            }
            
            showResultsLoading('Searching by postcode...');
            
            const searchParams = {
                query: cleanPostcode,
                searchType: 'postcode',
                page: 1,
                gfOnly: window.App.getState('gfOnlyFilter') !== false
            };
            
            let userLocation = utils.getUserLocation();
            if (!userLocation) {
                userLocation = await tryGetUserLocation();
            }
            if (userLocation) {
                searchParams.user_lat = userLocation.lat;
                searchParams.user_lng = userLocation.lng;
            }
            
            const results = await modules.api.searchVenues(searchParams);
            
            let venues = results.venues || results;
            let pagination = results.pagination;
            
            if (!venues || venues.length === 0) {
                if (cleanPostcode.length >= 5 && cleanPostcode.includes(' ')) {
                    console.log('📍 No direct matches, trying geocoding...');
                    try {
                        const location = await modules.api.geocodePostcode(cleanPostcode);
                        console.log(`✅ Postcode geocoded to: ${location.lat}, ${location.lng}`);
                        
                        const nearbyVenues = await modules.api.findNearbyVenues(
                            location.lat, 
                            location.lng, 
                            5,
                            window.App.getState('gfOnlyFilter') !== false
                        );
                        
                        if (nearbyVenues.length > 0) {
                            venues = nearbyVenues;
                            pagination = {
                                page: 1,
                                pages: 1,
                                total: nearbyVenues.length
                            };
                        } else {
                            showNoResults(`No venues found near ${cleanPostcode}`);
                            return;
                        }
                    } catch (geocodeError) {
                        console.error('Geocoding failed:', geocodeError);
                        showNoResults(`No venues found for postcode "${cleanPostcode}"`);
                        return;
                    }
                } else {
                    showNoResults(`No venues found for postcode "${cleanPostcode}"`);
                    return;
                }
            }
            
            if (userLocation) {
                venues = sortVenuesByDistance(venues, userLocation);
            }
            
            state.currentSearchVenues = venues;
            state.currentPage = pagination?.page || 1;
            state.totalPages = pagination?.pages || 1;
            state.totalResults = pagination?.total || venues.length;
            
            let title;
            if (cleanPostcode.length <= 4) {
                title = `${state.totalResults} venues in ${cleanPostcode} postcode area`;
            } else {
                title = `${state.totalResults} venues near ${cleanPostcode}`;
            }
            
            displayResultsInOverlay(venues, title);
            updatePaginationUI(state.currentPage, state.totalPages, state.totalResults);
            
            state.lastSearchState = {
                type: 'area',
                query: cleanPostcode,
                searchType: 'postcode',
                searchConfig: {
                    searchType: 'postcode',
                    noResultsMessage: `No venues found for "${cleanPostcode}"`,
                    titleWithLocation: (count) => `${count} venues in ${cleanPostcode}`,
                    titleWithoutLocation: (count) => `${count} venues in ${cleanPostcode}`,
                    successMessage: `venues in ${cleanPostcode}`,
                    errorMessage: `Error searching for "${cleanPostcode}"`
                },
                timestamp: Date.now()
            };
            
            window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, 'area');
            window.App.setState(STATE_KEYS.LAST_SEARCH.QUERY, cleanPostcode);
            
            modules.tracking?.trackSearch(cleanPostcode, 'postcode', state.totalResults);
            
        } catch (error) {
            console.error('❌ Error searching by postcode:', error);
            showNoResults(`Error searching for "${postcode}"`);
        }
    };
    
    const performBeerSearch = async (query, searchType, page = 1) => {
        try {
            console.log(`🍺 Performing beer search: "${query}" (${searchType}) - page ${page}`);
            
            let userLocation = utils.getUserLocation();
            if (!userLocation) {
                userLocation = await tryGetUserLocation();
            }
            
            const response = await fetch(`/api/search-by-beer?${new URLSearchParams({
                query: query,
                beer_type: searchType,
                page: page.toString(),
                gf_only: (window.App.getState('gfOnlyFilter') !== false).toString()
            })}`);
            
            if (!response.ok) throw new Error('Search failed');
            const results = await response.json();
            
            if (results.venues.length === 0 && page === 1) {
                showNoResults(`No venues found serving "${query}". Try searching for a brewery name or beer style.`);
                return;
            }
            
            let venues = results.venues;
            if (userLocation) {
                venues = sortVenuesByDistance(venues, userLocation);
            }
            
            state.currentSearchVenues = venues;
            state.currentPage = page;
            state.totalPages = results.pagination.pages;
            state.totalResults = results.pagination.total;
            
            state.lastSearchState = {
                type: 'beer',
                query: query,
                searchType: searchType,
                timestamp: Date.now()
            };
            
            const title = userLocation ? 
                `${state.totalResults} venues serving "${query}" (nearest first)` :
                `${state.totalResults} venues serving "${query}"`;
                
            displayResultsInOverlay(venues, title);
            updatePaginationUI(state.currentPage, state.totalPages, state.totalResults);
            
            modules.tracking?.trackSearch(query, `beer_${searchType}`, state.totalResults);
            
        } catch (error) {
            console.error('❌ Error in beer search:', error);
            showNoResults(`Error searching for "${query}". Please try again.`);
        }
    };
    
    // ================================
    // VENUE DETAILS
    // ================================
    const showVenueDetails = async (venueId) => {
        console.log('🏠 Showing venue details:', venueId);
        
        let loadingToast = null;
        
        try {
            // Only show loading for slow connections
            loadingToast = utils.showLoadingToast('Loading venue details...', 1000);
            
            const results = await modules.api.searchVenues({ 
                venueId: venueId
            });
            const venues = Array.isArray(results) ? results : results.venues;
            
            // ALWAYS hide the loading toast
            if (loadingToast && loadingToast.hide) {
                loadingToast.hide();
            }
            
            if (venues && venues.length > 0) {
                const venue = venues[0];
                utils.setCurrentVenue(venue);
                
                displayVenueDetails(venue);
                return venue;
            } else {
                utils.showToast('Venue not found.', 'error');
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error loading venue:', error);
            
            // ENSURE loading toast is hidden on error
            if (loadingToast && loadingToast.hide) {
                loadingToast.hide();
            }
            utils.hideLoadingToast(); // Belt and braces approach
            
            utils.showToast('Error loading venue details.', 'error');
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
        if (elements.location) elements.location.textContent = `${venue.postcode} • ${venue.city}`;
        
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
    
    const setupVenueButtons = (venue) => {
        utils.setCurrentVenue(venue);
    };
    
    const setupMapButtonHandler = (venue) => {
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
    
    const loadBeerList = (venue) => {
        console.log('🍺 Loading beer list for venue:', venue);
        
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
                contentEl.style.display = 'block';
                emptyEl.style.display = 'none';
                
                contentEl.innerHTML = beers.map((beer, index) => {
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
    // NAVIGATION
    // ================================
    const goBackToResults = () => {
        console.log('🔙 Going back to results...');
        
        hideOverlays(['venueDetailsOverlay']);
        
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay) {
            resultsOverlay.style.display = 'flex';
            resultsOverlay.classList.add('active');
        }
        
        const elements = {
            list: document.getElementById('resultsListContainer'),
            map: document.getElementById('resultsMapContainer'),
            btnText: document.getElementById('resultsMapBtnText')
        };
        
        if (elements.list && elements.map) {
            elements.list.style.display = 'block';
            elements.list.style.flex = '1';
            elements.map.style.display = 'none';
            elements.btnText.textContent = 'Map';
            
            const mapModule = modules.map;
            if (mapModule) {
                mapModule.cleanupResultsMap?.();
            }
        }

        const navModule = window.App?.getModule('nav');
        navModule?.showResultsWithContext();
        
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
    // PAGINATION
    // ================================
    const updatePaginationUI = (currentPage, totalPages, totalResults) => {
        const container = document.getElementById('paginationContainer');
        if (!container) return;
        
        container.style.display = 'block';
        
        if (totalPages <= 1) {
            container.innerHTML = `
                <div class="pagination-info">
                    Showing ${totalResults} result${totalResults !== 1 ? 's' : ''}
                </div>
            `;
            return;
        }
        
        const startResult = ((currentPage - 1) * 20) + 1;
        const endResult = Math.min(currentPage * 20, totalResults);
        
        container.innerHTML = `
            <div class="pagination-info">
                Showing ${startResult}-${endResult} of ${totalResults} results
            </div>
            <div class="pagination-controls">
                <button class="btn btn-secondary" data-action="prev-page" ${currentPage === 1 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <div class="page-numbers">
                    ${generatePageNumbers(currentPage, totalPages)}
                </div>
                <button class="btn btn-secondary" data-action="next-page" ${currentPage === totalPages ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
        `;
    };
    
    const generatePageNumbers = (current, total) => {
        let pages = [];
        const maxVisible = 5;
        
        if (total <= maxVisible) {
            for (let i = 1; i <= total; i++) {
                pages.push(i);
            }
        } else {
            if (current <= 3) {
                pages = [1, 2, 3, 4, '...', total];
            } else if (current >= total - 2) {
                pages = [1, '...', total - 3, total - 2, total - 1, total];
            } else {
                pages = [1, '...', current - 1, current, current + 1, '...', total];
            }
        }
        
        return pages.map(page => {
            if (page === '...') {
                return '<span class="page-ellipsis">...</span>';
            }
            return `<button class="page-number ${page === current ? 'active' : ''}" 
                    data-action="goto-page" data-page="${page}">${page}</button>`;
        }).join('');
    };
    
    const goToPage = async (pageNum) => {
        console.log(`📄 Going to page ${pageNum}`);
        
        if (!state.lastSearchState) return;
        
        showResultsLoading(`Loading page ${pageNum}...`);
        
        const searchState = state.lastSearchState;
        
        if (searchState.type === 'nearby') {
            try {
                const gfOnly = window.App.getState('gfOnlyFilter') !== false;
                const searchParams = {
                    lat: searchState.userLocation.lat,
                    lng: searchState.userLocation.lng,
                    radius: searchState.radius,
                    gf_only: gfOnly,
                    page: pageNum
                };
    
                const response = await fetch(`${Constants.API.NEARBY}?${new URLSearchParams(searchParams)}`);
                if (!response.ok) throw new Error('Search failed');
    
                const data = await response.json();
    
                state.currentSearchVenues = data.venues;
                state.currentPage = data.pagination.page;
                state.totalPages = data.pagination.pages;
                state.totalResults = data.pagination.total;
    
                const accuracyText = searchState.userLocation.accuracy > 500 ? 
                    ` (±${Math.round(searchState.userLocation.accuracy)}m accuracy)` : '';
    
                displayResultsInOverlay(
                    data.venues, 
                    `${data.pagination.total} venues within ${searchState.radius}km${accuracyText}`
                );
                updatePaginationUI(
                    data.pagination.page, 
                    data.pagination.pages, 
                    data.pagination.total
                );
            } catch (error) {
                console.error('❌ Error loading page:', error);
                utils.showToast('Error loading page. Please try again.', 'error');
            }
        } else if (searchState.type === 'name' || searchState.type === 'area' || searchState.type === 'beer') {
            await performTextSearch(
                searchState.type, 
                searchState.query, 
                searchState.searchConfig, 
                pageNum
            );
        } else {
            utils.showToast('Unable to load page for this search type', 'error');
        }
    };
    
    const goToPreviousPage = async () => {
        if (state.currentPage > 1) {
            await goToPage(state.currentPage - 1);
        }
    };
    
    const goToNextPage = async () => {
        if (state.currentPage < state.totalPages) {
            await goToPage(state.currentPage + 1);
        }
    };
    
    // ================================
    // LOCATION UTILITIES
    // ================================
    const requestLocationWithUI = () => {
        if (state.locationRequestInProgress) {
            console.log('📍 Location request already in progress');
            return Promise.reject(new Error('Location request already in progress'));
        }
        
        state.locationRequestInProgress = true;
        
        return new Promise((resolve, reject) => {
            if (navigator.permissions) {
                navigator.permissions.query({ name: 'geolocation' }).then(result => {
                    console.log('📍 Current permission state:', result.state);
                    
                    if (result.state === 'granted') {
                        getUserLocation().then(location => {
                            state.locationRequestInProgress = false;
                            resolve(location);
                        }).catch(error => {
                            state.locationRequestInProgress = false;
                            reject(error);
                        });
                    } else if (result.state === 'denied') {
                        state.locationRequestInProgress = false;
                        showLocationBlockedModal();
                        reject(new Error('Location permission denied in browser settings'));
                    } else {
                        showLocationPermissionUI((location) => {
                            state.locationRequestInProgress = false;
                            resolve(location);
                        }, (error) => {
                            state.locationRequestInProgress = false;
                            reject(error);
                        });
                    }
                }).catch(() => {
                    showLocationPermissionUI((location) => {
                        state.locationRequestInProgress = false;
                        resolve(location);
                    }, (error) => {
                        state.locationRequestInProgress = false;
                        reject(error);
                    });
                });
            } else {
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
    
    const showLocationPermissionUI = (resolve, reject) => {
        if (modules.modalManager) {
            modules.modalManager.closeAll();
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
            
            const loadingToast = utils.showLoadingToast('📍 Getting your location...', 1000);
            
            if (!navigator.geolocation) {
                loadingToast.hide();
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    loadingToast.hide();
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    resolve(location);
                },
                (error) => {
                    loadingToast.hide();
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
    };
    
    const showLocationBlockedModal = () => {
        if (modules.modalManager) {
            modules.modalManager.closeAll();
            modules.modalManager.open('locationBlockedModal');
        } else {
            const modal = document.getElementById('locationBlockedModal');
            if (!modal) {
                console.error('Location blocked modal not found');
                utils.showToast('📍 Location blocked. Enable in browser settings and refresh.', 'error');
                return;
            }
            
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
            
            const allInstructions = modal.querySelectorAll('.instruction-set');
            allInstructions.forEach(inst => inst.classList.remove('active'));
            
            const relevantInstruction = modal.querySelector(`[data-browser="${browser}"]`);
            if (relevantInstruction) {
                relevantInstruction.style.display = 'block';
            } else {
                const genericInstruction = modal.querySelector('[data-browser="generic"]');
                if (genericInstruction) {
                    genericInstruction.style.display = 'block';
                }
            }
            
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                }
            };
        }
    };
    
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
    
    // ================================
    // UI HELPERS
    // ================================
    const showResultsOverlay = (title) => {
        console.log('📋 Showing results overlay:', title);
    
        utils.hideLoadingToast();
        
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
        
        const resultsTitle = document.getElementById('resultsTitle');
        if (resultsTitle) {
            resultsTitle.textContent = title;
        }
        
        modules.modalManager.open('resultsOverlay', {
            onOpen: () => {
                console.log('✅ Results overlay opened via ModalManager');
                
                const navModule = window.App?.getModule('nav');
                navModule?.setPageContext('results');
                navModule?.showResultsWithContext();
    
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
        
        const toggle = document.getElementById('searchToggle');
        const isGfOnly = toggle ? toggle.checked : true;
        
        if (isGfOnly && elements.noResults) {
            elements.noResults.style.display = 'flex';
            elements.noResults.innerHTML = `
                <div class="no-results-content">
                    <h3>No venues with confirmed GF beer found</h3>
                    <p class="no-results-text">${message}</p>
                    
                    <div class="toggle-prompt" style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.1); border-radius: 10px;">
                        <p style="margin-bottom: 1rem;">💡 There might be venues that serve GF beer but haven't been confirmed yet!</p>
                        <button class="btn btn-primary" data-action="search-all-venues">
                            🔍 Search all venues instead
                        </button>
                    </div>
                    
                    <p style="margin-top: 1rem; opacity: 0.8;">💙 Found a venue with GF beer? Please report it!</p>
                </div>
            `;
        } else {
            if (elements.noResults) {
                elements.noResults.style.display = 'flex';
                const noResultsText = document.querySelector('.no-results-text');
                if (noResultsText) noResultsText.textContent = message;
            }
        }
    };
    
    const displayResultsInOverlay = (venues, title) => {
        state.currentSearchVenues = venues;
        
        console.log('💾 Stored search results:', venues.length, 'venues');

        const modalManager = modules.modalManager || window.App?.getModule('modalManager');
        const currentView = modalManager?.getInternalView?.('resultsOverlay') || 'list';
        console.log('📊 Preserving view state:', currentView);
        
        const elements = {
            loading: document.getElementById('resultsLoading'),
            noResults: document.getElementById('noResultsFound'),
            list: document.getElementById('resultsList'),
            listContainer: document.getElementById('resultsListContainer'),
            mapContainer: document.getElementById('resultsMapContainer'),
            btnText: document.getElementById('resultsMapBtnText'),
            paginationContainer: document.getElementById('paginationContainer')
        };
        
        if (elements.loading) elements.loading.style.display = 'none';
        if (elements.noResults) elements.noResults.style.display = 'none';
        
        if (elements.listContainer) {
            elements.listContainer.style.display = 'block';
            elements.listContainer.style.flex = '1';
        }
        
        if (elements.mapContainer) {
            elements.mapContainer.style.display = 'none';
        }
        
        if (elements.btnText) {
            elements.btnText.textContent = 'Map';
        }
        
        if (elements.list) {
            elements.list.style.display = 'block';
            elements.list.innerHTML = '';
            
            venues.forEach(venue => {
                const resultItem = createResultItem(venue);
                elements.list.appendChild(resultItem);
            });
        }
        
        const titleEl = document.getElementById('resultsTitle');
        if (titleEl) titleEl.textContent = title;
        
        console.log(`✅ Displayed ${venues.length} results`);
    };
    
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
        
        const gfStatus = venue.gf_status || 'unknown';
        
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
        clone.querySelector('.result-authority').textContent = venue.city;
        
        const viewButton = clone.querySelector('[data-action="view-venue"]');
        viewButton.dataset.venueId = venue.venue_id;
        
        return clone;
    };
    
    const hideResultsAndShowHome = () => {
        modules.modalManager.close('resultsOverlay');
        
        const communityHome = document.querySelector('.community-home');
        if (communityHome) {
            communityHome.style.display = 'block';
        }
        
        document.body.style.overflow = '';
        
        const navModule = window.App?.getModule('nav');
        navModule?.showHomeWithContext();
    };
    
    const hideOverlays = (overlayIds) => {
        overlayIds.forEach(id => {
            const overlay = document.getElementById(id);
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.remove('active');
            }
        });
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
    
    const getAllSearchResults = async () => {
        const lastSearch = state.lastSearchState;
        if (!lastSearch) return [];
        
        console.log('📍 Fetching all results for map view...');
        
        try {
            if (lastSearch.type === 'nearby') {
                const gfOnly = window.App.getState('gfOnlyFilter') !== false;
                const searchParams = {
                    lat: lastSearch.userLocation.lat,
                    lng: lastSearch.userLocation.lng,
                    radius: lastSearch.radius,
                    gf_only: gfOnly,
                    page: 1,
                    per_page: 50000
                };
                
                const response = await fetch(`${Constants.API.NEARBY}?${new URLSearchParams(searchParams)}`);
                if (!response.ok) throw new Error('Failed to fetch all venues');
                
                const data = await response.json();
                return data.venues || [];
                
            } else if (lastSearch.type === 'name' || lastSearch.type === 'area') {
                const searchParams = {
                    query: lastSearch.query,
                    searchType: lastSearch.searchConfig?.searchType || 'all',
                    page: 1,
                    per_page: 50000,
                    gfOnly: window.App.getState('gfOnlyFilter') !== false
                };
                
                const results = await modules.api.searchVenues(searchParams);
                return results.venues || results || [];
            }
            
            return state.currentSearchVenues;
        } catch (error) {
            console.error('❌ Error fetching all results:', error);
            return state.currentSearchVenues;
        }
    };
    
    // ================================
    // PLACES SEARCH MODULE (kept intact as it's complex)
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
           
           if (modules.modalManager) {
               modules.modalManager.open('placesSearchModal', {
                   onOpen: () => {
                       this.setupInputListener();
                       
                       const input = document.getElementById('placesSearchInput');
                       if (input) {
                           input.value = initialQuery;
                           setTimeout(() => input.focus(), 100);
                           
                           if (initialQuery) {
                               this.handleSearch(initialQuery);
                           }
                       }
                   }
               });
           } else {
               console.error('❌ ModalManager not available');
               utils.showToast('Error: Modal system not available', 'error');
           }
       },
       
       setupInputListener() {
           const input = document.getElementById('placesSearchInput');
           if (!input) return;
           
           input.removeEventListener('input', this.inputHandler);
           
           this.inputHandler = (e) => {
               console.log('🔍 Input changed:', e.target.value);
               this.handleSearch(e.target.value);
           };
           
           input.addEventListener('input', this.inputHandler);
           console.log('✅ Input listener setup complete');
       },
       
       handleSearch(query) {
           console.log('🔍 handleSearch called with:', query);
           
           clearTimeout(this.searchTimeout);
           
           const resultsDiv = document.getElementById('placesResults');
           if (!resultsDiv) {
               console.error('❌ placesResults div not found');
               return;
           }
           
           if (!query || query.length < 3) {
               resultsDiv.style.display = 'none';
               console.log('ℹ️ Query too short, hiding results');
               return;
           }
           
           console.log('⏳ Starting search timeout for:', query);
           resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Searching...</div>';
           resultsDiv.style.display = 'block';
           
           this.searchTimeout = setTimeout(() => {
               console.log('🚀 Executing search for:', query);
               this.searchGooglePlaces(query);
           }, 300);
       },
       
       async searchGooglePlaces(query) {
           console.log('🌍 searchGooglePlaces called with:', query);
           
           try {
               console.log('📡 Making API request to /api/search-places');
               
               const response = await fetch('/api/search-places', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ query: query })
               });
               
               console.log('📡 API response status:', response.status);
               
               if (!response.ok) {
                   const errorText = await response.text();
                   console.error('❌ API Error Response:', response.status, errorText);
                   throw new Error(`API Error: ${response.status} - ${errorText}`);
               }
               
               const data = await response.json();
               console.log('✅ API response data:', data);
               
               const places = data.results || [];
               console.log(`📍 Found ${places.length} places:`, places);
               
               this.displayResults(places);
               
           } catch (error) {
               console.error('❌ Google Places search error:', error);
               this.showError(`Search failed: ${error.message}. Please try again.`);
           }
       },
       
       displayResults(places) {
           const resultsDiv = document.getElementById('placesResults');
           if (!resultsDiv) return;
           
           const selectedPreview = document.getElementById('selectedPlacePreview');
           if (selectedPreview) {
               selectedPreview.style.display = 'none';
           }
           
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
               const name = place.name || place.display_name?.split(',')[0] || 'Unknown Venue';
               const address = place.formatted_address || this.formatAddress(place);
               const type = this.getPlaceTypeFromGoogle(place);
               
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
       
           resultsDiv.innerHTML += `
               <div style="padding: var(--space-lg); border-top: 1px solid var(--border-light); margin-top: var(--space-md);">
                   <button class="btn btn-secondary" data-action="manual-venue-entry" style="width: 100%;">
                       ✏️ Can't find it? Enter manually
                   </button>
               </div>
           `;
           
           resultsDiv.style.display = 'block';
       },
       
       getPlaceTypeFromGoogle(place) {
           if (!place.types) return 'Venue';
           
           const types = place.types;
           if (types.includes('bar')) return 'Bar';
           if (types.includes('restaurant')) return 'Restaurant';
           if (types.includes('cafe')) return 'Café';
           if (types.includes('night_club')) return 'Club';
           if (types.includes('meal_takeaway')) return 'Takeaway';
           if (types.includes('lodging')) return 'Hotel';
           
           return 'Venue';
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
           
           const placeName = place.name || 'Unknown Venue';
           const placeAddress = place.formatted_address || 'Address not available';
           const placeType = this.getPlaceTypeFromGoogle(place);
           
           const lat = place.geometry?.location?.lat;
           const lng = place.geometry?.location?.lng;
           
           if (!lat || !lng) {
               console.error('❌ No coordinates available for place:', place);
               utils.showToast('This venue has no location data available', 'error');
               return;
           }
           
           this.selectedPlace = {
               name: placeName,
               address: placeAddress,
               lat: lat,
               lon: lng,
               type: placeType,
               place_id: place.place_id,
               formatted_address: place.formatted_address,
               types: place.types || [],
               source: 'google_places'
           };
           
           document.getElementById('selectedPlaceName').textContent = this.selectedPlace.name;
           document.getElementById('selectedPlaceAddress').textContent = this.selectedPlace.address;
           document.getElementById('selectedPlaceType').textContent = this.selectedPlace.type;
           document.getElementById('selectedPlacePreview').style.display = 'block';
           
           this.hideResults();
       },
       
       useSelectedPlace() {
           if (!this.selectedPlace) {
               console.error('❌ No selected place');
               return;
           }
           
           console.log('📝 Using selected place to add new venue');
           
           const place = this.selectedPlace;
           
           let postcode = '';
           if (place.formatted_address) {
               const postcodeMatch = place.formatted_address.match(/[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}/i);
               if (postcodeMatch) {
                   postcode = postcodeMatch[0];
               }
           }
           
           let address = place.formatted_address || place.address || '';
           if (postcode) {
               address = address.replace(new RegExp(`,?\\s*${postcode.replace(/\s/g, '\\s*')}.*$`, 'i'), '').trim();
               const nameRegex = new RegExp(`^${place.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},?\\s*`, 'i');
               address = address.replace(nameRegex, '').trim();
           }
           
           const newVenueData = {
               name: place.name,
               address: address,
               postcode: postcode,
               latitude: place.lat,
               longitude: place.lon,
               place_id: place.place_id,
               source: 'google_places'
           };
           
           console.log('🏠 New venue data:', newVenueData);
           
           if (modules.modalManager) {
               modules.modalManager.close('placesSearchModal');
           } else {
               document.getElementById('placesSearchModal').style.display = 'none';
               document.body.style.overflow = '';
           }
           
           const loadingToast = utils.showLoadingToast('Adding new venue to database...', 1000);
           
           this.submitNewVenue(newVenueData);
       },
       
       async submitNewVenue(venueData) {
           try {
               let nickname = window.App.getState('userNickname');
               if (!nickname) {
                   nickname = localStorage.getItem('userNickname') || 'anonymous';
               }
               
               const payload = {
                   venue_name: venueData.name,
                   address: venueData.address,
                   postcode: venueData.postcode,
                   latitude: venueData.latitude,
                   longitude: venueData.longitude,
                   submitted_by: nickname,
                   types: venueData.types || [],
                   place_id: venueData.place_id || null
               };
               
               console.log('📡 Submitting venue data:', payload);
               
               const response = await fetch('/api/add-venue', {
                   method: 'POST',
                   headers: {
                       'Content-Type': 'application/json'
                   },
                   body: JSON.stringify(payload)
               });
               
               utils.hideLoadingToast();
               
               if (!response.ok) {
                   const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                   throw new Error(errorData.error || `Server error: ${response.status}`);
               }
               
               const result = await response.json();
               console.log('✅ Venue added:', result);
               
               window.newlyAddedVenue = {
                   venue_id: result.venue_id,
                   venue_name: venueData.name,
                   name: venueData.name,
                   address: venueData.address,
                   postcode: venueData.postcode,
                   latitude: venueData.latitude,
                   longitude: venueData.longitude,
                   venue_type: result.venue_type
               };
               
               this.showVenueAddedPrompt(result);
               
           } catch (error) {
               console.error('❌ Error adding venue:', error);
               utils.hideLoadingToast();
               utils.showToast(`❌ Failed to add venue: ${error.message}`, 'error');
           }
       },

       showVenueAddedPrompt(result) {
           console.log('🎉 Showing venue added prompt for:', result);
           
           window.App.setState('lastAddedVenueId', result.venue_id);
           window.App.setState('lastAddedVenueName', result.message.split(' added successfully!')[0]);
           
           const newVenue = {
               venue_id: result.venue_id,
               name: result.message.split(' added successfully!')[0],
               venue_name: result.message.split(' added successfully!')[0]
           };
           window.App.setState('currentVenue', newVenue);
           
           const venueNameEl = document.getElementById('addedVenueName');
           if (venueNameEl) {
               venueNameEl.textContent = newVenue.name;
           }
           
           if (modules.modalManager) {
               modules.modalManager.close('placesSearchModal');
           }
           
           utils.showToast(`🎉 ${result.message}`, 'success');
           
           setTimeout(() => {
               if (modules.modalManager) {
                   modules.modalManager.open('venueAddedPromptModal');
               }
           }, 500);
       },
       
       formatAddress(place) {
           if (place.formatted_address) {
               return place.formatted_address;
           }
           return place.address || 'Address not available';
       },
       
       getPlaceIcon(type) {
           const icons = {
               'Bar': '🍹',
               'Restaurant': '🍽️',
               'Café': '☕',
               'Club': '🎵',
               'Takeaway': '🥡',
               'Hotel': '🏨',
               'Venue': '🍺'
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
       }
   };
   
   // ================================
   // INITIALIZATION
   // ================================
   document.addEventListener('DOMContentLoaded', () => {
       PlacesSearchModule.init();
   });
   
   // ================================
   // PUBLIC API
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
       
       // Pagination
       goToPage,
       goToPreviousPage,
       goToNextPage,
       
       // Venue details
       showVenueDetails,
       loadBeerList,
       
       // Navigation
       goBackToResults,
       
       // Sub-modules
       PlacesSearchModule,
       
       // State getters
       getCurrentResults: () => state.currentSearchVenues,
       getLastSearchState: () => state.lastSearchState,
       getAllSearchResults
   };
})();
