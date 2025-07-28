// ================================================================================
// SEARCH.JS - Cleaned and Optimized Version
// Handles: Location search, name search, area search, beer search, pub details
// ================================================================================

export const SearchModule = (function() {
    'use strict';
    console.log('🔍 SearchModule initializing...');
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        lastSearchState: null,
        currentSearchPubs: [],
        userLocation: null
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const getAPI = () => window.App?.getModule('api');
    const getMap = () => window.App?.getModule('map');
    const getModal = () => window.App?.getModule('modal');
    const getTracking = () => window.App?.getModule('tracking');
    const getUI = () => window.App?.getModule('ui');
    
    // ================================
    // LOCATION SEARCH
    // ================================
    const startLocationSearch = () => {
        console.log('🎯 Starting location search...');
        
        const tracking = getTracking();
        if (tracking) {
            tracking.trackEvent('location_search_start', 'Search', 'distance_modal');
        }
        
        const modal = getModal();
        if (modal) {
            console.log('✅ Opening distance modal via modal module');
            modal.open('distanceModal');
        } else {
            // Fallback
            console.log('⚠️ Using fallback modal opening');
            const distanceModal = document.getElementById('distanceModal');
            if (distanceModal) {
                distanceModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        }
    };
    
    const searchNearbyWithDistance = async (radiusKm) => {
        console.log(`🎯 Searching within ${radiusKm}km...`);
        
        try {
            // Close modal
            const modal = getModal();
            if (modal) modal.close('distanceModal');
            
            showResultsOverlay(`Pubs within ${radiusKm}km`);
            showResultsLoading('📍 Getting precise location...');
            
            // Get user location
            if (!window.App.state.userLocation) {
                try {
                    window.App.state.userLocation = await getUserLocation();
                    
                    // Show accuracy feedback
                    if (window.App.state.userLocation.accuracy) {
                        const accuracy = window.App.state.userLocation.accuracy;
                        let message = '📍 Location found - finding nearby GF beer...';
                        
                        if (accuracy <= 100) {
                            message = '🎯 Excellent location accuracy - finding nearby GF beer...';
                        } else if (accuracy <= 500) {
                            message = '📍 Good location accuracy - finding nearby GF beer...';
                        } else if (accuracy <= 1000) {
                            message = '📍 Reasonable location accuracy - finding nearby GF beer...';
                        } else {
                            message = '📍 Location found (low accuracy) - finding nearby GF beer...';
                            if (window.showSuccessToast) {
                                window.showSuccessToast(`⚠️ Location accuracy: ±${Math.round(accuracy)}m`);
                            }
                        }
                        showResultsLoading(message);
                    }
                    
                    const mapModule = getMap();
                    if (mapModule?.setUserLocation) {
                        mapModule.setUserLocation(window.App.state.userLocation);
                    }
                    
                } catch (locationError) {
                    console.error('❌ Location error:', locationError);
                    showNoResults(`${locationError.message} Please try again or search by area instead.`);
                    return;
                }
            }
            
            // Save search state
            state.lastSearchState = {
                type: 'nearby',
                radius: radiusKm,
                userLocation: window.App.state.userLocation,
                timestamp: Date.now()
            };
            
            // Perform search
            showResultsLoading('🔍 Searching for GF beer options...');
            const api = getAPI();
            const pubs = await api.findNearbyPubs(
                window.App.state.userLocation.lat, 
                window.App.state.userLocation.lng, 
                radiusKm, 
                false
            );
            
            console.log(`✅ Found ${pubs.length} pubs`);
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found within ${radiusKm}km of your location`);
                return;
            }
            
            state.currentSearchPubs = pubs;
            
            const accuracyText = window.App.state.userLocation.accuracy && window.App.state.userLocation.accuracy > 500 ? 
                ` (±${Math.round(window.App.state.userLocation.accuracy)}m accuracy)` : '';
            
            displayResultsInOverlay(pubs, `${pubs.length} pubs within ${radiusKm}km${accuracyText}`);
            
            const tracking = getTracking();
            if (tracking) {
                tracking.trackSearch(`nearby_${radiusKm}km`, 'location', pubs.length);
            }
            
        } catch (error) {
            console.error('❌ Error in nearby search:', error);
            showNoResults('Could not complete search. Please try again.');
        }
    };
    
    // ================================
    // NAME SEARCH
    // ================================
    const searchByName = async () => {
        const query = document.getElementById('nameInput')?.value.trim();
        
        if (!query) {
            if (window.showSuccessToast) {
                window.showSuccessToast('Please enter a pub name to search');
            }
            return;
        }
        
        console.log('🏠 Searching for pub name:', query);
        
        const modal = getModal();
        if (modal) {
            modal.close('nameModal');
        } else {
            // Fallback
            const nameModal = document.getElementById('nameModal');
            if (nameModal) {
                nameModal.style.display = 'none';
                nameModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
        
        showResultsOverlay(`Pub name: "${query}"`);
        showResultsLoading('Searching for pubs...');
        
        await performNameSearch(query);
        
        const tracking = getTracking();
        if (tracking) {
            tracking.trackEvent('search_by_name', 'Search', query);
        }
    };
    
    // ================================
    // AREA SEARCH
    // ================================
    const searchByArea = async () => {
        const query = document.getElementById('areaInput')?.value.trim();
        const searchType = document.getElementById('areaSearchType')?.value;
        
        if (!query) {
            if (window.showSuccessToast) {
                window.showSuccessToast('Please enter a location to search');
            }
            return;
        }
        
        console.log(`🗺️ Searching by ${searchType}:`, query);
        
        const modal = getModal();
        if (modal) {
            modal.close('areaModal');
        } else {
            // Fallback
            const areaModal = document.getElementById('areaModal');
            if (areaModal) {
                areaModal.style.display = 'none';
                areaModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
        
        const searchTypeText = searchType === 'postcode' ? 'postcode' : 'area';
        showResultsOverlay(`${searchTypeText}: "${query}"`);
        showResultsLoading('Finding pubs in this area...');
        
        if (searchType === 'postcode') {
            await performPostcodeSearch(query);
        } else {
            await performCitySearch(query);
        }
        
        const tracking = getTracking();
        if (tracking) {
            tracking.trackEvent('search_by_area', 'Search', `${searchType}:${query}`);
        }
    };
    
    // ================================
    // BEER SEARCH
    // ================================
    const searchByBeer = async () => {
        const query = document.getElementById('beerInput')?.value.trim();
        const searchType = document.getElementById('beerSearchType')?.value;
        
        if (!query) {
            if (window.showSuccessToast) {
                window.showSuccessToast('Please enter something to search for');
            }
            return;
        }
        
        console.log(`🍺 Searching by ${searchType}:`, query);
        
        const modal = getModal();
        if (modal) {
            modal.close('beerModal');
        } else {
            // Fallback
            const beerModal = document.getElementById('beerModal');
            if (beerModal) {
                beerModal.style.display = 'none';
                beerModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
        
        const searchTypeText = searchType === 'brewery' ? 'brewery' : 
                             searchType === 'beer' ? 'beer' : 'style';
        showResultsOverlay(`${searchTypeText}: "${query}"`);
        showResultsLoading('Finding pubs with this beer...');
        
        await performBeerSearch(query, searchType);
        
        const tracking = getTracking();
        if (tracking) {
            tracking.trackEvent('search_by_beer', 'Search', `${searchType}:${query}`);
        }
    };
    
    // ================================
    // SEARCH IMPLEMENTATIONS
    // ================================
    const performNameSearch = async (query) => {
        try {
            if (!window.App.state.userLocation) {
                window.App.state.userLocation = await tryGetUserLocation();
            }
            
            const api = getAPI();
            const results = await api.searchPubs({
                query: query,
                searchType: 'name',
                page: 1
            });
            
            let pubs = Array.isArray(results) ? results : results.pubs;
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found matching "${query}"`);
                return;
            }
            
            if (window.App.state.userLocation) {
                pubs = sortPubsByDistance(pubs, window.App.state.userLocation);
            }
            
            state.lastSearchState = {
                type: 'name',
                query: query,
                results: pubs,
                timestamp: Date.now()
            };
            
            state.currentSearchPubs = pubs;
            
            const title = window.App.state.userLocation ? 
                `${pubs.length} pubs matching "${query}" (nearest first)` :
                `${pubs.length} pubs matching "${query}"`;
                
            displayResultsInOverlay(pubs, title);
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Found ${pubs.length} pubs matching "${query}"`);
            }
            
            const tracking = getTracking();
            if (tracking) {
                tracking.trackSearch(query, 'name', pubs.length);
            }
            
        } catch (error) {
            console.error('❌ Error searching by name:', error);
            showNoResults(`Error searching for "${query}". Please try again.`);
        }
    };
    
    const performPostcodeSearch = async (postcode) => {
        try {
            showResultsLoading('Finding postcode location...');
            const api = getAPI();
            const location = await api.geocodePostcode(postcode);
            
            console.log(`✅ Postcode geocoded to: ${location.lat}, ${location.lng}`);
            
            showResultsLoading('Finding pubs near this postcode...');
            const radius = 5;
            const pubs = await api.findNearbyPubs(location.lat, location.lng, radius);
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found within ${radius}km of ${postcode}`);
                return;
            }
            
            state.lastSearchState = {
                type: 'area',
                query: `${postcode} (postcode)`,
                results: pubs,
                timestamp: Date.now()
            };
            
            state.currentSearchPubs = pubs;
            
            displayResultsInOverlay(pubs, `${pubs.length} pubs near ${postcode} (${radius}km radius)`);
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Found ${pubs.length} pubs near ${postcode}`);
            }
            
            const tracking = getTracking();
            if (tracking) {
                tracking.trackSearch(postcode, 'postcode', pubs.length);
            }
            
        } catch (error) {
            console.error('❌ Error searching by postcode:', error);
            showNoResults(`Could not find location for "${postcode}"`);
        }
    };
    
    const performCitySearch = async (city) => {
        try {
            if (!window.App.state.userLocation) {
                window.App.state.userLocation = await tryGetUserLocation();
            }
            
            const api = getAPI();
            const results = await api.searchPubs({
                query: city,
                searchType: 'area',
                page: 1
            });
            
            let pubs = Array.isArray(results) ? results : results.pubs;
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found in "${city}"`);
                return;
            }
            
            if (window.App.state.userLocation) {
                pubs = sortPubsByDistance(pubs, window.App.state.userLocation);
            }
            
            state.lastSearchState = {
                type: 'area',
                query: `${city} (city)`,
                results: pubs,
                timestamp: Date.now()
            };
            
            state.currentSearchPubs = pubs;
            
            const title = window.App.state.userLocation ? 
                `${pubs.length} pubs in ${city} (nearest first)` :
                `${pubs.length} pubs in ${city}`;
                
            displayResultsInOverlay(pubs, title);
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Found ${pubs.length} pubs in ${city}`);
            }
            
            const tracking = getTracking();
            if (tracking) {
                tracking.trackSearch(city, 'city', pubs.length);
            }
            
        } catch (error) {
            console.error('❌ Error searching by city:', error);
            showNoResults(`Error searching for "${city}"`);
        }
    };
    
    const performBeerSearch = async (query, searchType) => {
        try {
            console.log(`🍺 Performing beer search: "${query}" (${searchType})`);
            
            if (!window.App.state.userLocation) {
                window.App.state.userLocation = await tryGetUserLocation();
            }
            
            const api = getAPI();
            let results;
            
            if (api.searchPubsByBeer) {
                console.log('🍺 Using enhanced beer search API');
                results = await api.searchPubsByBeer(query, searchType);
            } else {
                console.log('🍺 Using fallback search method');
                results = await api.searchPubs({
                    query: query,
                    searchType: 'all',
                    page: 1
                });
            }
            
            let allPubs = Array.isArray(results) ? results : results.pubs || [];
            console.log(`📊 Got ${allPubs.length} pubs from API`);
            
            // Filter based on beer search criteria
            const searchQuery = query.toLowerCase().trim();
            let filteredPubs = [];
            
            if (searchType === 'brewery') {
                filteredPubs = allPubs.filter(pub => {
                    if (!pub.beer_details) return false;
                    const beerDetails = pub.beer_details.toLowerCase();
                    return beerDetails.includes(` ${searchQuery} `) || 
                           beerDetails.startsWith(searchQuery) ||
                           beerDetails.includes(`${searchQuery} `) ||
                           beerDetails.includes(` ${searchQuery}`);
                });
            } else if (searchType === 'beer') {
                filteredPubs = allPubs.filter(pub => {
                    if (!pub.beer_details) return false;
                    return pub.beer_details.toLowerCase().includes(searchQuery);
                });
            } else if (searchType === 'style') {
                filteredPubs = allPubs.filter(pub => {
                    if (!pub.beer_details) return false;
                    const beerDetails = pub.beer_details.toLowerCase();
                    return beerDetails.includes(searchQuery) ||
                           beerDetails.includes(`(${searchQuery})`) ||
                           beerDetails.includes(`${searchQuery} `) ||
                           beerDetails.includes(` ${searchQuery}`);
                });
            }
            
            console.log(`🔍 Filtered to ${filteredPubs.length} pubs`);
            
            // Try looser matching if no results
            if (filteredPubs.length === 0 && searchQuery.length > 3) {
                console.log('🔍 Trying looser matching...');
                filteredPubs = allPubs.filter(pub => {
                    if (!pub.beer_details) return false;
                    return pub.beer_details.toLowerCase().includes(searchQuery.substring(0, 4));
                });
            }
            
            if (filteredPubs.length === 0) {
                showNoResults(`No pubs found serving "${query}". Try searching for a brewery name or beer style.`);
                return;
            }
            
            if (window.App.state.userLocation) {
                filteredPubs = sortPubsByDistance(filteredPubs, window.App.state.userLocation);
            }
            
            state.lastSearchState = {
                type: 'beer',
                query: `${query} (${searchType})`,
                results: filteredPubs,
                timestamp: Date.now()
            };
            
            state.currentSearchPubs = filteredPubs;
            
            const title = window.App.state.userLocation ? 
                `${filteredPubs.length} pubs serving "${query}" (nearest first)` :
                `${filteredPubs.length} pubs serving "${query}"`;
                
            displayResultsInOverlay(filteredPubs, title);
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Found ${filteredPubs.length} pubs serving "${query}"`);
            }
            
            const tracking = getTracking();
            if (tracking) {
                tracking.trackSearch(query, `beer_${searchType}`, filteredPubs.length);
            }
            
        } catch (error) {
            console.error('❌ Error in beer search:', error);
            showNoResults(`Error searching for "${query}". Please try again.`);
        }
    };
    
    // ================================
    // PUB DETAILS
    // ================================
    const showPubDetails = (pubId) => {
        console.log('🏠 Showing pub details:', pubId);
        searchSpecificPub(pubId);
    };
    
    const searchSpecificPub = async (pubId) => {
        console.log('🔍 Searching for specific pub:', pubId);
        
        try {
            if (window.showLoadingToast) {
                window.showLoadingToast('Loading pub details...');
            }
            
            const api = getAPI();
            const results = await api.searchPubs({ pubId: pubId });
            const pubs = Array.isArray(results) ? results : results.pubs;
            
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
            
            if (pubs && pubs.length > 0) {
                const pub = pubs[0];
                
                // Store pub data globally
                window.currentPubData = pub;
                console.log('💾 Stored pub data globally:', pub.name);
                
                // Reset split-view state
                resetPubDetailsView();
                
                // Set up map button handler
                setupMapButtonHandler(pub);
                
                // Display pub details
                const ui = getUI();
                if (ui?.displayPubDetailsOverlay) {
                    console.log('✅ Using UI module to display pub details');
                    ui.displayPubDetailsOverlay(pub);
                } else {
                    console.log('🔧 Using fallback display');
                    displayPubDetailsFallback(pub);
                }
                
                return pub;
            } else {
                if (window.showSuccessToast) {
                    window.showSuccessToast('Pub not found.');
                }
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error loading pub:', error);
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
            if (window.showSuccessToast) {
                window.showSuccessToast('Error loading pub details.');
            }
            return null;
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
    
    const setupMapButtonHandler = (pub) => {
        const mapBtn = document.getElementById('pubToggleMap');
        if (!mapBtn) return;
        
        mapBtn.onclick = () => {
            console.log('🗺️ Map button clicked');
            
            const mapContainer = document.getElementById('pubMapContainer');
            const btnText = document.getElementById('pubMapBtnText');
            const pubContainer = document.getElementById('pubContainer');
            
            if (!mapContainer || !btnText) return;
            
            if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
                // Show map
                mapContainer.style.display = 'block';
                btnText.textContent = 'Hide Map';
                if (pubContainer) pubContainer.classList.add('split-view');
                
                if (pub.latitude && pub.longitude) {
                    const mapModule = getMap();
                    if (mapModule?.initPubDetailMap) {
                        mapModule.initPubDetailMap(pub);
                    }
                }
            } else {
                // Hide map
                mapContainer.style.display = 'none';
                btnText.textContent = 'Show on Map';
                if (pubContainer) pubContainer.classList.remove('split-view');
            }
        };
    };
    
    const displayPubDetailsFallback = (pub) => {
        console.log('🔧 Using fallback pub details display');
        
        window.currentPubData = pub;
        resetPubDetailsView();
        
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay) {
            resultsOverlay.style.display = 'none';
            resultsOverlay.classList.remove('active');
        }
        
        const overlay = document.getElementById('pubDetailsOverlay');
        if (!overlay) return;
        
        overlay.style.display = 'flex';
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Populate content
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
        setupPubButtons(pub);
    };
    
    const setupBeerDetails = (pub, beerEl) => {
        const beerSection = document.getElementById('beerSection');
        if (!beerSection || !beerEl) return;
        
        const hasGFOptions = pub.bottle || pub.tap || pub.cask || pub.can;
        
        if (hasGFOptions) {
            beerSection.style.display = 'block';
            
            let formats = [];
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
    
    const setupPubButtons = (pub) => {
        const buttons = {
            findOnline: document.getElementById('pubFindOnline'),
            directions: document.getElementById('pubGetDirections'),
            map: document.getElementById('pubToggleMap'),
            report: document.querySelector('[data-action="report-beer"]'),
            back: document.querySelector('[data-action="back-to-results"]'),
            home: document.querySelector('[data-action="close-pub-details"]')
        };
        
        if (buttons.findOnline) {
            buttons.findOnline.onclick = () => {
                const searchQuery = encodeURIComponent(`${pub.name} ${pub.postcode} pub`);
                window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
            };
        }
        
        if (buttons.directions) {
            buttons.directions.onclick = () => {
                const destination = encodeURIComponent(`${pub.name}, ${pub.address}, ${pub.postcode}`);
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
            };
        }
    };
    
    // ================================
    // BACK TO RESULTS
    // ================================
    const goBackToResults = () => {
        console.log('🔙 Going back to results...');
        
        if (!state.lastSearchState) {
            console.log('❌ No previous search state');
            return false;
        }
        
        const thirtyMinutes = 30 * 60 * 1000;
        if (Date.now() - state.lastSearchState.timestamp > thirtyMinutes) {
            console.log('⏰ Search state too old');
            return false;
        }
        
        console.log('✅ Restoring search state:', state.lastSearchState);
        
        // Close pub details
        const helpers = getUI();
        if (helpers?.closePubDetails) {
            helpers.closePubDetails();
        }
        
        // Restore search
        switch (state.lastSearchState.type) {
            case 'nearby':
                restoreNearbySearch(state.lastSearchState);
                break;
            case 'name':
            case 'area':
            case 'beer':
                restoreTextSearch(state.lastSearchState);
                break;
            default:
                console.log('❌ Unknown search type');
                return false;
        }
        
        const tracking = getTracking();
        if (tracking) {
            tracking.trackEvent('back_to_results', 'Navigation', state.lastSearchState.type);
        }
        
        return true;
    };
    
    const restoreNearbySearch = async (searchState) => {
        console.log('🔄 Restoring nearby search...');
        
        if (searchState.userLocation) {
            window.App.state.userLocation = searchState.userLocation;
            const mapModule = getMap();
            if (mapModule?.setUserLocation) {
                mapModule.setUserLocation(searchState.userLocation);
            }
        }
        
        showResultsOverlay(`Pubs within ${searchState.radius}km`);
        showResultsLoading('Restoring your search...');
        
        try {
            await searchNearbyWithDistance(searchState.radius);
            if (window.showSuccessToast) {
                window.showSuccessToast('📍 Restored your search results!');
            }
        } catch (error) {
            console.error('❌ Error restoring search:', error);
            showNoResults('Could not restore search. Please try again.');
        }
    };
    
    const restoreTextSearch = (searchState) => {
        showResultsOverlay(searchState.query);
        
        if (searchState.results && searchState.results.length > 0) {
            state.currentSearchPubs = searchState.results;
            displayResultsInOverlay(searchState.results, `${searchState.results.length} results for "${searchState.query}"`);
        } else {
            showNoResults('Previous results not available');
        }
    };
    
    // ================================
    // LOCATION UTILITIES
    // ================================
    const getUserLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('📍 Geolocation not supported by this browser'));
                return;
            }
            
            console.log('📍 Requesting high-accuracy location...');
            
            // First attempt: High accuracy GPS
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
    
    const tryGetUserLocation = async () => {
        if (window.App.state.userLocation) {
            if (window.App.state.userLocation.timestamp && 
                Date.now() - window.App.state.userLocation.timestamp < 300000) {
                console.log('📍 Using cached location');
                return window.App.state.userLocation;
            }
        }
        
        try {
            const location = await getUserLocation();
            location.timestamp = Date.now();
            window.App.state.userLocation = location;
            
            const mapModule = getMap();
            if (mapModule?.setUserLocation) {
                mapModule.setUserLocation(location);
            }
            
            return location;
        } catch (error) {
            console.log('📍 Could not get location:', error.message);
            return null;
        }
    };
    
    const sortPubsByDistance = (pubs, location) => {
        const mapModule = getMap();
        
        return pubs.map(pub => {
            if (pub.latitude && pub.longitude && mapModule?.calculateDistance) {
                pub.distance = mapModule.calculateDistance(
                    location.lat, location.lng,
                    parseFloat(pub.latitude), parseFloat(pub.longitude)
                );
            } else {
                pub.distance = 999;
            }
            return pub;
        }).sort((a, b) => a.distance - b.distance);
    };
    
    // ================================
    // UI HELPERS
    // ================================
    const showResultsOverlay = (title) => {
        console.log('🔍 showResultsOverlay called with:', title);
        console.trace(); // This will show you what called it
        // ... rest of function
        console.log('📋 Showing results overlay:', title);
        
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay) {
            resultsOverlay.classList.add('active');
            resultsOverlay.style.display = 'flex';
        }
        
        const resultsTitle = document.getElementById('resultsTitle');
        if (resultsTitle) {
            resultsTitle.textContent = title;
        }
        
        const searchSection = document.querySelector('.search-section');
        if (searchSection) searchSection.style.display = 'none';
        
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) heroSection.style.display = 'none';
        
        document.body.style.overflow = 'hidden';
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
    
    const displayResultsInOverlay = (pubs, title) => {
        state.currentSearchPubs = pubs;
        window.currentSearchResults = pubs;
        
        console.log('💾 Stored search results:', pubs.length, 'pubs');
        
        // Reset map toggle state
        resetResultsMapState();
        
        // Hide loading and show results
        const elements = {
            loading: document.getElementById('resultsLoading'),
            noResults: document.getElementById('noResultsFound'),
            list: document.getElementById('resultsList')
        };
        
        if (elements.loading) elements.loading.style.display = 'none';
        if (elements.noResults) elements.noResults.style.display = 'none';
        
        // Populate results
        if (elements.list) {
            elements.list.style.display = 'block';
            elements.list.innerHTML = '';
            
            pubs.forEach(pub => {
                const resultItem = createResultItemForOverlay(pub);
                elements.list.appendChild(resultItem);
            });
        }
        
        // Update title
        const titleEl = document.getElementById('resultsTitle');
        if (titleEl) titleEl.textContent = title;
        
        // Setup navigation handlers
        setupResultsNavigationHandlers();
        
        console.log(`✅ Displayed ${pubs.length} results`);
    };
    
    const resetResultsMapState = () => {
        const elements = {
            list: document.getElementById('resultsListContainer'),
            map: document.getElementById('resultsMapContainer'),
            btnText: document.getElementById('resultsMapBtnText'),
            overlay: document.getElementById('resultsOverlay')
        };
        
        if (elements.list) {
            elements.list.style.display = 'block';
            elements.list.style.flex = '1';
        }
        if (elements.map) {
            elements.map.style.display = 'none';
            elements.map.classList.remove('split-view');
        }
        if (elements.btnText) {
            elements.btnText.textContent = 'Map';
        }
        if (elements.overlay) {
            elements.overlay.classList.remove('split-view');
        }
    };
    
    const createResultItemForOverlay = (pub) => {
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
        if (pub.bottle || pub.tap || pub.cask || pub.can) {
            gfIndicator.textContent = '✅ GF Available';
            gfIndicator.className = 'gf-indicator';
        } else {
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
    
    const setupResultsNavigationHandlers = () => {
        console.log('🔧 Setting up results navigation handlers...');
        
        // Home button
        const homeBtn = document.querySelector('[data-action="close-results"]');
        if (homeBtn) {
            homeBtn.onclick = null;
            homeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const ui = getUI();
                if (ui?.closeResults) {
                    ui.closeResults();
                } else {
                    window.HelpersModule?.closeAllOverlaysAndGoHome?.();
                }
                
                const tracking = getTracking();
                if (tracking) {
                    tracking.trackEvent('close_results', 'Navigation', 'home_button');
                }
            });
        }
        
        // Map toggle button
        const mapBtn = document.querySelector('[data-action="toggle-results-map"]');
        if (mapBtn) {
            mapBtn.onclick = null;
            mapBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                handleResultsMapToggle();
            });
        }
    };
    
    const handleResultsMapToggle = () => {
        console.log('🗺️ Toggling results map...');
        
        const elements = {
            list: document.getElementById('resultsListContainer'),
            map: document.getElementById('resultsMapContainer'),
            btnText: document.getElementById('resultsMapBtnText')
        };
        
        if (!elements.list || !elements.map || !elements.btnText) return;
        
        const mapModule = getMap();
        
        if (elements.map.style.display === 'none' || !elements.map.style.display) {
            // Show map
            console.log('🗺️ Showing map view...');
            
            if (mapModule?.cleanupResultsMap) {
                mapModule.cleanupResultsMap();
            }
            
            elements.list.style.display = 'none';
            elements.map.style.display = 'block';
            elements.map.style.flex = '1';
            elements.map.style.height = '100%';
            elements.btnText.textContent = 'List';
            
            setTimeout(() => {
                if (mapModule?.initResultsMap) {
                    const map = mapModule.initResultsMap(state.currentSearchPubs);
                    if (map) {
                        setTimeout(() => map.invalidateSize(), 200);
                        setTimeout(() => map.invalidateSize(), 500);
                    }
                }
            }, 100);
        } else {
            // Show list
            console.log('📋 Showing list view...');
            
            if (mapModule?.cleanupResultsMap) {
                mapModule.cleanupResultsMap();
            }
            
            elements.list.style.display = 'block';
            elements.list.style.flex = '1';
            elements.map.style.display = 'none';
            elements.btnText.textContent = 'Map';
        }
        
        const tracking = getTracking();
        if (tracking) {
            tracking.trackEvent('results_map_toggle', 'Map Interaction', 
                elements.map.style.display === 'block' ? 'show_fullscreen' : 'hide');
        }
    };
    
    // ================================
    // PLACES SEARCH MODULE
    // ================================
    // LOCATION: search.js - PlacesSearchModule
    
    const PlacesSearchModule = {
        selectedPlace: null,
        searchTimeout: null,
        isInitialized: false,
        
        init() {
            if (this.isInitialized) return;
            console.log('🔧 Initializing PlacesSearchModule...');
            this.setupEventListeners();
            this.isInitialized = true;
            console.log('✅ PlacesSearchModule initialized');
        },
        
        setupEventListeners() {
            // Use event delegation for the search input since modal might not exist yet
            document.addEventListener('input', (e) => {
                if (e.target.id === 'placesSearchInput') {
                    this.handleSearch(e.target.value);
                }
            });
            
            // Also handle when modal opens
            document.addEventListener('click', (e) => {
                if (e.target.matches('[data-action="search-google-places"]')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openPlacesSearch();
                }
                
                if (e.target.matches('[data-action="use-selected-place"]')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.useSelectedPlace();
                }
            });
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
                    // Force focus after modal animation
                    setTimeout(() => {
                        input.focus();
                        console.log('✅ Places search input focused');
                    }, 100);
                    
                    if (initialQuery) {
                        this.handleSearch(initialQuery);
                    }
                }
            }
        },
        
        // LOCATION: search.js - PlacesSearchModule
        // ACTION: REPLACE the handleSearch method (around line 1515)
        
        handleSearch(query) {
            console.log('🔍 PlacesSearchModule.handleSearch called with:', query);
            
            // Clear any existing timeout
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }
            
            const resultsDiv = document.getElementById('placesResults');
            if (!resultsDiv) {
                console.error('❌ placesResults div not found');
                return;
            }
            
            // Hide results if query too short
            if (!query || query.length < 3) {
                console.log('📝 Query too short, hiding results');
                resultsDiv.style.display = 'none';
                return;
            }
            
            // Show loading state immediately
            console.log('⏳ Showing loading state');
            resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Searching...</div>';
            resultsDiv.style.display = 'block';
            
            // Debounce the actual search
            this.searchTimeout = setTimeout(() => {
                console.log('🚀 Executing OSM search');
                this.searchOSM(query);
            }, 300);
        },
        
        // Rest of the methods stay the same...
        async searchOSM(query) {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?` +
                    `q=${encodeURIComponent(query + ' UK')}` +
                    `&format=json` +
                    `&countrycodes=gb` +
                    `&limit=10` +
                    `&extratags=1` +
                    `&namedetails=1`
                );
                
                const places = await response.json();
                
                const relevantPlaces = places.filter(place => {
                    const type = place.type?.toLowerCase() || '';
                    const category = place.category?.toLowerCase() || '';
                    const name = place.display_name?.toLowerCase() || '';
                    
                    return (
                        category.includes('pub') ||
                        category.includes('bar') ||
                        category.includes('restaurant') ||
                        category.includes('cafe') ||
                        type.includes('pub') ||
                        type.includes('bar') ||
                        type.includes('restaurant') ||
                        name.includes('pub') ||
                        name.includes('bar') ||
                        name.includes('club')
                    );
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
            
            resultsDiv.innerHTML = places.map(place => {
                const name = place.namedetails?.name || place.display_name.split(',')[0];
                const address = this.formatAddress(place);
                const type = this.getPlaceType(place);
                
                return `
                    <div class="place-result" data-place='${JSON.stringify({
                        name: name,
                        address: address,
                        lat: place.lat,
                        lon: place.lon,
                        type: type,
                        osm_id: place.osm_id
                    }).replace(/'/g, '&apos;')}'>
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
            
            // Add click handlers to results
            resultsDiv.querySelectorAll('.place-result').forEach(el => {
                el.addEventListener('click', () => {
                    const placeData = JSON.parse(el.dataset.place);
                    this.selectPlace(placeData);
                });
            });
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
        
        selectPlace(placeData) {
            this.selectedPlace = placeData;
            
            document.getElementById('selectedPlaceName').textContent = placeData.name;
            document.getElementById('selectedPlaceAddress').textContent = placeData.address;
            document.getElementById('selectedPlaceType').textContent = placeData.type;
            document.getElementById('selectedPlacePreview').style.display = 'block';
            
            this.hideResults();
        },
        
        // LOCATION: Add to your existing PlacesSearch object
        // ACTION: REPLACE the useSelectedPlace method
        
        useSelectedPlace() {
            if (!this.selectedPlace) return;
            
            console.log('📝 Using selected place to add new pub');
            
            const place = this.selectedPlace;
            const name = place.namedetails?.name || place.display_name.split(',')[0];
            const parts = place.display_name.split(',');
            
            // Extract address components
            let address = '';
            let postcode = place.extratags?.postcode || '';
            
            // Try to build a clean address
            if (parts.length > 1) {
                // Remove postcode from parts if it exists
                const cleanParts = parts.slice(1, 4).filter(part => {
                    const trimmed = part.trim();
                    return trimmed && !trimmed.match(/^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i);
                });
                address = cleanParts.join(', ').trim();
            }
            
            // If no postcode in extratags, try to extract from display_name
            if (!postcode) {
                const postcodeMatch = place.display_name.match(/[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}/i);
                if (postcodeMatch) {
                    postcode = postcodeMatch[0];
                }
            }
            
            // Store the pub data with coordinates
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
            
            // Close places modal
            document.getElementById('placesSearchModal').style.display = 'none';
            document.body.style.overflow = '';
            
            // Show loading
            if (window.showLoadingToast) {
                window.showLoadingToast('Adding new pub to database...');
            }
            
            // Submit the new pub
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
                        submitted_by: 'anonymous' // Could track user if logged in
                    })
                });
                
                if (window.hideLoadingToast) {
                    window.hideLoadingToast();
                }
                
                if (!response.ok) {
                    throw new Error('Failed to add pub');
                }
                
                const result = await response.json();
                console.log('✅ Pub added:', result);
                
                // Store the new pub data
                window.newlyAddedPub = {
                    pub_id: result.pub_id,
                    name: pubData.name,
                    address: pubData.address,
                    postcode: pubData.postcode,
                    latitude: pubData.latitude,
                    longitude: pubData.longitude
                };
                
                // Show success and prompt for next action
                this.showPubAddedPrompt(result);
                
            } catch (error) {
                console.error('❌ Error adding pub:', error);
                if (window.showSuccessToast) {
                    window.showSuccessToast('❌ Failed to add pub. Please try again.');
                }
            }
        },
        
        showPubAddedPrompt(result) {
            // Create or show a modal asking what to do next
            const promptModal = document.getElementById('pubAddedPromptModal');
            if (promptModal) {
                document.getElementById('addedPubName').textContent = window.newlyAddedPub.name;
                promptModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } else {
                // Fallback - just show success
                if (window.showSuccessToast) {
                    window.showSuccessToast(`✅ ${window.newlyAddedPub.name} added successfully!`);
                }
            }
        },
        
        preWorks() {
            // Pre-fill the form fields after a short delay
            setTimeout(() => {
                const pubNameInput = document.getElementById('reportPubName');
                if (pubNameInput) {
                    pubNameInput.value = this.selectedPlace.name;
                }
                
                // Extract postcode if available
                const postcodeMatch = this.selectedPlace.address.match(/[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}/i);
                if (postcodeMatch) {
                    const postcodeInput = document.getElementById('reportPostcode');
                    if (postcodeInput) {
                        postcodeInput.value = postcodeMatch[0];
                    }
                    
                    const cleanAddress = this.selectedPlace.address.replace(postcodeMatch[0], '').trim();
                    const addressInput = document.getElementById('reportAddress');
                    if (addressInput) {
                        addressInput.value = cleanAddress.replace(/,$/, '');
                    }
                } else {
                    const addressInput = document.getElementById('reportAddress');
                    if (addressInput) {
                        addressInput.value = this.selectedPlace.address;
                    }
                }
                
                // Show new pub fields and hide search
                document.getElementById('newPubFields').style.display = 'block';
                document.getElementById('pubSearchGroup').style.display = 'none';
            }, 100);
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
    // GF STATUS MODULE
    // ================================
    const GFStatusModule = {
        currentPubId: null,
        currentStatus: 'unknown',
        
        init() {
            this.setupEventListeners();
        },
        
        setupEventListeners() {
            document.addEventListener('click', (e) => {
                const statusBtn = e.target.closest('.status-toggle-btn');
                if (statusBtn) {
                    this.handleStatusToggle(statusBtn);
                }
            });
        },
        
        async handleStatusToggle(button) {
            const newStatus = button.dataset.status;
            const pubId = window.currentPubData?.pub_id;
            
            if (!pubId) {
                console.error('No pub selected');
                return;
            }
            
            document.querySelectorAll('.status-toggle-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            const detailsForm = document.getElementById('gfDetailsForm');
            if (detailsForm) {
                detailsForm.style.display = 
                    (newStatus === 'always' || newStatus === 'currently') ? 'block' : 'none';
            }
            
            try {
                const response = await fetch('/api/update-gf-status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        pub_id: pubId,
                        status: newStatus,
                        timestamp: new Date().toISOString()
                    })
                });
                
                if (response.ok) {
                    if (window.showSuccessToast) {
                        window.showSuccessToast(`✅ Status updated to: ${this.getStatusLabel(newStatus)}`);
                    }
                    this.currentStatus = newStatus;
                    
                    const tracking = getTracking();
                    if (tracking) {
                        tracking.trackEvent('gf_status_update', 'User Action', newStatus);
                    }
                } else {
                    if (window.showSuccessToast) {
                        window.showSuccessToast('❌ Failed to update status');
                    }
                }
            } catch (error) {
                console.error('Error updating status:', error);
                if (window.showSuccessToast) {
                    window.showSuccessToast('❌ Network error');
                }
            }
        },
        
        getStatusLabel(status) {
            const labels = {
                'always': 'Always has GF beer',
                'currently': 'Currently has GF beer',
                'not_currently': 'No GF beer currently',
                'unknown': 'Unknown status'
            };
            return labels[status] || status;
        },
        
        setCurrentPub(pubId, status) {
            this.currentPubId = pubId;
            this.currentStatus = status || 'unknown';
            
            document.querySelectorAll('.status-toggle-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.status === this.currentStatus);
            });
        }
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    document.addEventListener('DOMContentLoaded', () => {
        PlacesSearchModule.init();
        GFStatusModule.init();
    });
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        // Location search
        startLocationSearch,
        searchNearbyWithDistance,
        
        // Search methods
        searchByName,
        searchByArea,
        searchByBeer,
        
        // Pub details
        showPubDetails,
        searchSpecificPub,
        
        // Navigation
        goBackToResults,
        
        // UI helpers
        displayResultsInOverlay,
        createResultItemForOverlay,
        
        // Sub-modules
        PlacesSearchModule,
        GFStatusModule,
        
        // State getters
        getCurrentResults: () => state.currentSearchPubs || window.currentSearchResults || [],
        getLastSearchState: () => state.lastSearchState
    };
})();

// Make it globally available
window.SearchModule = SearchModule;
