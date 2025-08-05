// ================================================================================
// SEARCH.JS - Complete Refactor with STATE_KEYS
// Handles: Location search, name search, area search, beer search, pub details
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
        currentSearchPubs: [],
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
        
        getCurrentPub() {
            return window.App.getState(STATE_KEYS.CURRENT_PUB);
        },
        
        setCurrentPub(pub) {
            window.App.setState(STATE_KEYS.CURRENT_PUB, pub);
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

        // Get filter preference from centralized manager
        const filterGF = window.App?.getModule('filterGF');
        const gfOnly = filterGF ? filterGF.isGFOnly() : window.App.getState('gfOnlyFilter') !== false;
        
        try {
            // Close distance modal using modalManager
            modules.modalManager?.close('distanceModal') || modules.modal?.close('distanceModal');
            
            showResultsOverlay(`Pubs within ${radiusKm}km`);
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
            const pubs = await modules.api.findNearbyPubs(
                userLocation.lat, 
                userLocation.lng, 
                radiusKm, 
                gfOnly  // Pass the filter preference
            );
            
            console.log(`✅ Found ${pubs.length} pubs`);
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found within ${radiusKm}km of your location`);
                return;
            }
            
            state.currentSearchPubs = pubs;
            
            const accuracyText = userLocation.accuracy > 500 ? 
                ` (±${Math.round(userLocation.accuracy)}m accuracy)` : '';
            
            displayResultsInOverlay(pubs, `${pubs.length} pubs within ${radiusKm}km${accuracyText}`);
            
            modules.tracking?.trackSearch(`nearby_${radiusKm}km`, 'location', pubs.length);
            
        } catch (error) {
            console.error('❌ Error in nearby search:', error);
            showNoResults('Could not complete search. Please try again.');
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
            const results = await modules.api.searchPubs({
                query: query,
                searchType: searchConfig.searchType || 'all',
                page: 1
            });
            
            let pubs = Array.isArray(results) ? results : results.pubs;
            
            if (pubs.length === 0) {
                showNoResults(searchConfig.noResultsMessage);
                return;
            }
            
            // Sort by distance if we have location
            if (userLocation) {
                pubs = sortPubsByDistance(pubs, userLocation);
            }
            
            // Save state
            state.lastSearchState = {
                type: 'name',
                query: query,
                timestamp: Date.now()
            };
            
            // Store globally
            window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, 'name');
            window.App.setState(STATE_KEYS.LAST_SEARCH.QUERY, query);
            
            state.currentSearchPubs = pubs;
            
            // Display results
            const title = userLocation ? 
                searchConfig.titleWithLocation(pubs.length) :
                searchConfig.titleWithoutLocation(pubs.length);
                
            displayResultsInOverlay(pubs, title);
            
            utils.showToast(`✅ Found ${pubs.length} ${searchConfig.successMessage}`);
            modules.tracking?.trackSearch(query, type, pubs.length);
            
        } catch (error) {
            console.error(`❌ Error in ${type} search:`, error);
            showNoResults(searchConfig.errorMessage);
        }
    };
    
    const searchByName = async () => {
        const query = document.getElementById('nameInput')?.value.trim();
        
        if (!query) {
            utils.showToast('Please enter a pub name to search');
            return;
        }
        
        console.log('🏠 Searching for pub name:', query);
        
        // Close modal using modalManager
        modules.modalManager?.close('nameModal') || modules.modal?.close('nameModal');
        
        showResultsOverlay(`Pub name: "${query}"`);
        showResultsLoading('Searching for pubs...');
        
        await performTextSearch('name', query, {
            searchType: 'name',
            noResultsMessage: `No pubs found matching "${query}"`,
            stateQuery: query,
            titleWithLocation: (count) => `${count} pubs matching "${query}" (nearest first)`,
            titleWithoutLocation: (count) => `${count} pubs matching "${query}"`,
            successMessage: `pubs matching "${query}"`,
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
        showResultsLoading('Finding pubs in this area...');
        
        if (searchType === 'postcode') {
            await performPostcodeSearch(query);
        } else {
            await performTextSearch('area', query, {
                searchType: 'area',
                noResultsMessage: `No pubs found in "${query}"`,
                stateQuery: `${query} (city)`,
                titleWithLocation: (count) => `${count} pubs in ${query} (nearest first)`,
                titleWithoutLocation: (count) => `${count} pubs in ${query}`,
                successMessage: `pubs in ${query}`,
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
            
            showResultsLoading('Finding pubs near this postcode...');
            const radius = 5;
            const pubs = await modules.api.findNearbyPubs(location.lat, location.lng, radius);
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found within ${radius}km of ${postcode}`);
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
            
            state.currentSearchPubs = pubs;
            
            displayResultsInOverlay(pubs, `${pubs.length} pubs near ${postcode} (${radius}km radius)`);
            utils.showToast(`✅ Found ${pubs.length} pubs near ${postcode}`);
            modules.tracking?.trackSearch(postcode, 'postcode', pubs.length);
            
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
        showResultsLoading('Finding pubs with this beer...');
        
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
            if (modules.api.searchPubsByBeer) {
                results = await modules.api.searchPubsByBeer(query, searchType);
            } else {
                results = await modules.api.searchPubs({
                    query: query,
                    searchType: 'all',
                    page: 1
                });
            }
            
            let allPubs = Array.isArray(results) ? results : results.pubs || [];
            console.log(`📊 Got ${allPubs.length} pubs from API`);
            
            // Filter based on beer search criteria
            const filteredPubs = filterPubsByBeerCriteria(allPubs, query, searchType);
            
            if (filteredPubs.length === 0) {
                showNoResults(`No pubs found serving "${query}". Try searching for a brewery name or beer style.`);
                return;
            }
            
            // Sort by distance if location available
            if (userLocation) {
                filteredPubs.sort((a, b) => {
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
            
            state.currentSearchPubs = filteredPubs;
            
            const title = userLocation ? 
                `${filteredPubs.length} pubs serving "${query}" (nearest first)` :
                `${filteredPubs.length} pubs serving "${query}"`;
                
            displayResultsInOverlay(filteredPubs, title);
            utils.showToast(`✅ Found ${filteredPubs.length} pubs serving "${query}"`);
            modules.tracking?.trackSearch(query, `beer_${searchType}`, filteredPubs.length);
            
        } catch (error) {
            console.error('❌ Error in beer search:', error);
            showNoResults(`Error searching for "${query}". Please try again.`);
        }
    };
    
    const filterPubsByBeerCriteria = (pubs, query, searchType) => {
        const searchQuery = query.toLowerCase().trim();
        
        return pubs.filter(pub => {
            if (!pub.beer_details) return false;
            const beerDetails = pub.beer_details.toLowerCase();
            
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
    // PUB DETAILS
    // ================================
    const showPubDetails = async (pubId) => {
        console.log('🏠 Showing pub details:', pubId);
        
        try {
            utils.showLoadingToast('Loading pub details...');
            
            const results = await modules.api.searchPubs({ pubId: pubId });
            const pubs = Array.isArray(results) ? results : results.pubs;
            
            utils.hideLoadingToast();
            
            if (pubs && pubs.length > 0) {
                const pub = pubs[0];
                utils.setCurrentPub(pub);
                
                displayPubDetails(pub);
                return pub;
            } else {
                utils.showToast('Pub not found.');
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error loading pub:', error);
            utils.hideLoadingToast();
            utils.showToast('Error loading pub details.');
            return null;
        }
    };
    
    const displayPubDetails = (pub) => {
        // Use ModalManager to handle the overlay properly
        if (modules.modalManager) {
            modules.modalManager.open('pubDetailsOverlay', {
                onOpen: () => {
                    // Reset split-view state
                    resetPubDetailsView();
                    
                    // Update navigation title
                    const navTitle = document.getElementById('pubNavTitle');
                    if (navTitle) navTitle.textContent = pub.name;
                    
                    // Populate content
                    populatePubDetails(pub);
                    setupPubButtons(pub);
                    setupMapButtonHandler(pub);
                    
                    modules.tracking?.trackPubView(pub.name);
                    
                    const navModule = window.App?.getModule('nav');
                    navModule?.showPubDetailsWithContext();
                }
            });
        } else {
            // Fallback to old method if modalManager not available
            console.warn('⚠️ ModalManager not available, using direct DOM manipulation');
            // ... existing code ...
        }
    };
    
    const populatePubDetails = (pub) => {
        const elements = {
            title: document.getElementById('pubDetailsTitle'),
            address: document.getElementById('pubDetailsAddress'),
            location: document.getElementById('pubDetailsLocation'),
            beer: document.getElementById('pubDetailsBeer')
        };
        
        if (elements.title) elements.title.textContent = pub.name;
        if (elements.address) elements.address.textContent = pub.address;
        if (elements.location) elements.location.textContent = `${pub.postcode} • ${pub.local_authority}`;
        
        setupBeerDetails(pub, elements.beer);
        setupGFStatusDisplay(pub);
    };
    
    const setupBeerDetails = (pub, beerEl) => {
        const beerSection = document.getElementById('beerSection');
        if (!beerSection || !beerEl) return;
        
        const hasGFOptions = pub.bottle || pub.tap || pub.cask || pub.can;
        
        if (hasGFOptions) {
            beerSection.style.display = 'block';
            
            const formats = [];
            if (pub.bottle) formats.push('🍺 Bottles');
            if (pub.tap) formats.push('🚰 Tap');
            if (pub.cask) formats.push('🛢️ Cask');
            if (pub.can) formats.push('🥫 Cans');
            
            beerEl.innerHTML = `<strong>Available in: ${formats.join(', ')}</strong>`;
            
            if (pub.beer_details) {
                beerEl.innerHTML += `<br><small style="margin-top: var(--space-sm); display: block;">${pub.beer_details}</small>`;
            }
        } else {
            beerSection.style.display = 'none';
            beerEl.innerHTML = '';
        }
    };
    
    const setupGFStatusDisplay = (pub) => {
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
        
        const status = pub.gf_status || 'unknown';
        const display = displays[status] || displays.unknown;
        
        statusEl.innerHTML = `
            <span class="status-icon">${display.icon}</span>
            <span class="status-text">${display.text}</span>
            <span class="status-meta">${display.meta}</span>
        `;
    };
    
    const setupPubButtons = (pub) => {
        // Buttons are now handled by data-action in main.js
        // Just ensure the pub data is available globally
        utils.setCurrentPub(pub);
    };
    
    const setupMapButtonHandler = (pub) => {
        // This is now handled by data-action="toggle-pub-map" in main.js
        // Just ensure pub has coordinates
        if (!pub.latitude || !pub.longitude) {
            const mapBtn = document.querySelector('[data-action="toggle-pub-map"]');
            if (mapBtn) {
                mapBtn.disabled = true;
                mapBtn.textContent = '🗺️ No Location';
            }
        }
    };
    
    const resetPubDetailsView = () => {
        const pubContainer = document.getElementById('pubContainer');
        const pubMapContainer = document.getElementById('pubMapContainer');
        const mapBtnText = document.getElementById('pubMapBtnText');
        
        if (pubContainer) pubContainer.classList.remove('split-view');
        if (pubMapContainer) pubMapContainer.style.display = 'none';
        if (mapBtnText) mapBtnText.textContent = 'Show on Map';
    };
    
    // ================================
    // NAVIGATION
    // ================================
    // UPDATE: In search.js, replace the goBackToResults function (around line 608)

    const goBackToResults = () => {
        console.log('🔙 Going back to results...');
        
        // Close pub details
        hideOverlays(['pubDetailsOverlay']);
        
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
        if (state.currentSearchPubs && state.currentSearchPubs.length > 0) {
            console.log('📋 Using cached results');
            const title = state.lastSearchState?.type === 'nearby' ? 
                `Pubs within ${state.lastSearchState.radius}km` : 
                state.lastSearchState?.query || 'Search Results';
            displayResultsInOverlay(state.currentSearchPubs, title);
            
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
    
    // ================================
    // UI HELPERS
    // ================================

    // Replace the showResultsOverlay function to use ModalManager:
    const showResultsOverlay = (title) => {
        console.log('📋 Showing results overlay:', title);
        
        // Hide community home content
        const communityHome = document.querySelector('.community-home');
        if (communityHome) {
            communityHome.style.display = 'none';
        }
        
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
        
        // Use ModalManager to open the results overlay
        if (modules.modalManager) {
            modules.modalManager.open('resultsOverlay', {
                onOpen: () => {
                    document.body.style.overflow = 'hidden';
                    
                    // Update navigation context
                    const navModule = window.App?.getModule('nav');
                    navModule?.showResultsWithContext();
                }
            });
        } else {
            // Fallback if modalManager not available
            const resultsOverlay = document.getElementById('resultsOverlay');
            if (resultsOverlay) {
                resultsOverlay.classList.add('active');
                resultsOverlay.style.display = 'flex';
            }
            document.body.style.overflow = 'hidden';
        }
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

    const displayResultsInOverlay = (pubs, title) => {
        state.currentSearchPubs = pubs;
        
        console.log('💾 Stored search results:', pubs.length, 'pubs');
        
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
            
            pubs.forEach(pub => {
                const resultItem = createResultItem(pub);
                elements.list.appendChild(resultItem);
            });
        }
        
        // Update title
        const titleEl = document.getElementById('resultsTitle');
        if (titleEl) titleEl.textContent = title;
        
        console.log(`✅ Displayed ${pubs.length} results`);
    };
    
    // REPLACE the createResultItem function (around line 1076):

    const createResultItem = (pub) => {
        const template = document.getElementById('pub-result-template');
        const clone = template.content.cloneNode(true);
        
        clone.querySelector('.result-title').textContent = pub.name;
        
        const distanceEl = clone.querySelector('.result-distance');
        if (pub.distance !== undefined) {
            distanceEl.textContent = `${pub.distance.toFixed(1)}km away`;
        } else {
            distanceEl.style.display = 'none';
        }
        
        const gfIndicator = clone.querySelector('.gf-indicator');
        
        // Determine GF status properly
        const gfStatus = pub.gf_status || 'unknown';
        
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
            case 'always': // Legacy support
                gfIndicator.textContent = '✅ Always Available';
                gfIndicator.className = 'gf-indicator';
                break;
            case 'currently':
                gfIndicator.textContent = '🔵 Currently Available';
                gfIndicator.className = 'gf-indicator currently';
                break;
            case 'not_currently':
                gfIndicator.textContent = '❌ Not Available';
                gfIndicator.className = 'gf-indicator not-currently';
                break;
            default:
                gfIndicator.textContent = '❓ GF Unknown';
                gfIndicator.className = 'gf-indicator unknown';
        }
        
        clone.querySelector('.result-address').textContent = pub.address;
        clone.querySelector('.result-postcode').textContent = pub.postcode;
        clone.querySelector('.result-authority').textContent = pub.local_authority;
        
        const viewButton = clone.querySelector('[data-action="view-pub"]');
        viewButton.dataset.pubId = pub.pub_id;
        
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
    
    // Replace hideResultsAndShowHome function:
    const hideResultsAndShowHome = () => {
        // Use ModalManager to close results overlay
        if (modules.modalManager) {
            modules.modalManager.close('resultsOverlay');
        } else {
            const resultsOverlay = document.getElementById('resultsOverlay');
            if (resultsOverlay) {
                resultsOverlay.style.display = 'none';
                resultsOverlay.classList.remove('active');
            }
        }
        
        // Show community home
        const communityHome = document.querySelector('.community-home');
        if (communityHome) {
            communityHome.style.display = 'block';
        }
        
        document.body.style.overflow = '';
    
        const navModule = window.App?.getModule('nav');
        navModule?.showHomeWithContext();
    };
    
    const hideOverlays = (overlayIds, useQuerySelector = true) => {
        overlayIds.forEach(id => {
            const element = useQuerySelector ? 
                document.querySelector(`.${id}`) : 
                document.getElementById(id);
            if (element) {
                element.style.display = 'none';
                element.classList.remove('active');
            }
        });
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
    const sortPubsByDistance = (pubs, location) => {
        return pubs.map(pub => {
            if (pub.latitude && pub.longitude) {
                pub.distance = calculateDistance(location, pub);
            } else {
                pub.distance = 999;
            }
            return pub;
        }).sort((a, b) => a.distance - b.distance);
    };
    
    const calculateDistance = (location, pub) => {
        const lat1 = location.lat;
        const lon1 = location.lng;
        const lat2 = parseFloat(pub.latitude);
        const lon2 = parseFloat(pub.longitude);
        
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
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?` +
                    `q=${encodeURIComponent(query + ' UK')}` +
                    `&format=json&countrycodes=gb&limit=10&extratags=1&namedetails=1`
                );
                
                const places = await response.json();
                
                const relevantPlaces = places.filter(place => {
                    const type = place.type?.toLowerCase() || '';
                    const category = place.category?.toLowerCase() || '';
                    const name = place.display_name?.toLowerCase() || '';
                    
                    return category.includes('pub') || category.includes('bar') ||
                           category.includes('restaurant') || category.includes('cafe') ||
                           type.includes('pub') || type.includes('bar') ||
                           type.includes('restaurant') || name.includes('pub') ||
                           name.includes('bar') || name.includes('club');
                });
                
                this.displayResults(relevantPlaces);
                
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
            
            resultsDiv.style.display = 'block';
        },
        
        selectPlace(placeOrIndex) {
            const place = typeof placeOrIndex === 'number' 
                ? this.searchResults[placeOrIndex]
                : placeOrIndex;
                
            if (!place) return;
            
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
            
            console.log('📝 Using selected place to add new pub');
            
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
            
            const newPubData = {
                name: name,
                address: address,
                postcode: postcode,
                latitude: place.lat,
                longitude: place.lon,
                osm_id: place.osm_id,
                osm_type: place.osm_type
            };
            
            console.log('🏠 New pub data:', newPubData);
            
            document.getElementById('placesSearchModal').style.display = 'none';
            document.body.style.overflow = '';
            
            utils.showLoadingToast('Adding new pub to database...');
            
            this.submitNewPub(newPubData);
        },
        
        async submitNewPub(pubData) {
            try {
                const response = await fetch('/api/add-pub', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: pubData.name,
                        address: pubData.address,
                        postcode: pubData.postcode,
                        latitude: pubData.latitude,
                        longitude: pubData.longitude,
                        osm_id: pubData.osm_id,
                        source: 'user_submission',
                        submitted_by: 'anonymous'
                    })
                });
                
                utils.hideLoadingToast();
                
                if (!response.ok) {
                    throw new Error('Failed to add pub');
                }
                
                const result = await response.json();
                console.log('✅ Pub added:', result);
                
                window.newlyAddedPub = {
                    pub_id: result.pub_id,
                    name: pubData.name,
                    address: pubData.address,
                    postcode: pubData.postcode,
                    latitude: pubData.latitude,
                    longitude: pubData.longitude
                };
                
                this.showPubAddedPrompt(result);
                
            } catch (error) {
                console.error('❌ Error adding pub:', error);
                utils.showToast('❌ Failed to add pub. Please try again.');
            }
        },
        
        showPubAddedPrompt(result) {
            const promptModal = document.getElementById('pubAddedPromptModal');
            if (promptModal) {
                document.getElementById('addedPubName').textContent = window.newlyAddedPub.name;
                promptModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } else {
                utils.showToast(`✅ ${window.newlyAddedPub.name} added successfully!`);
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
            
            if (category.includes('pub') || type.includes('pub')) return 'Pub';
            if (category.includes('bar') || type.includes('bar')) return 'Bar';
            if (category.includes('restaurant')) return 'Restaurant';
            if (category.includes('cafe')) return 'Café';
            return 'Venue';
        },
        
        getPlaceIcon(type) {
            const icons = {
                'Pub': '🍺',
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
        
        // Pub details
        showPubDetails,
        
        // Navigation
        goBackToResults,
        
        // Sub-modules
        PlacesSearchModule,
        
        // State getters
        getCurrentResults: () => state.currentSearchPubs,
        getLastSearchState: () => state.lastSearchState
    };
})();
