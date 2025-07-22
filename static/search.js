// ================================================================================
// SEARCH.JS - All search functionality in one clean module
// Handles: Location search, name search, area search, beer search
// ================================================================================

export const SearchModule = (function() {
    'use strict';
    
    // Private state
    let lastSearchState = null;
    let currentSearchPubs = [];
    let userLocation = null;
    
// Get other modules through the app instead of imports
    const getAPI = () => window.App?.getModule('api');
    const getMap = () => window.App?.getModule('map');
    const getModal = () => window.App?.getModule('modal');
    const getTracking = () => window.App?.getModule('tracking');
    const getUI = () => window.App?.getModule('ui');
    
    // =============================================================================
    // LOCATION SEARCH (Pubs Near Me)
    // =============================================================================
    
    const startLocationSearch = () => {
        console.log('🎯 Starting location search...');
        
        // Track the action
        if (window.TrackingModule) {
            window.TrackingModule.trackEvent('location_search_start', 'Search', 'distance_modal');
        }
        
        // Debug: Check if ModalModule exists
        if (window.ModalModule) {
            console.log('✅ ModalModule found, opening distanceModal');
            window.ModalModule.open('distanceModal');
        } else if (window.App?.getModule('modal')) {
            console.log('✅ Modal module found via App, opening distanceModal');
            window.App.getModule('modal').open('distanceModal');
        } else {
            console.log('❌ No modal module found, trying direct DOM manipulation');
            // Fallback - direct modal opening
            const modal = document.getElementById('distanceModal');
            if (modal) {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                console.log('✅ Opened distanceModal via fallback');
            } else {
                console.error('❌ distanceModal element not found in DOM');
            }
        }
    };
    
    const searchNearbyWithDistance = async (radiusKm) => {
        console.log(`🎯 Searching within ${radiusKm}km...`);
        
        try {
            // Close distance modal
            if (window.ModalModule) {
                window.ModalModule.close('distanceModal');
            }
            
            // Show results overlay
            showResultsOverlay(`Pubs within ${radiusKm}km`);
            showResultsLoading('Getting your location...');
            
            // Get user location if we don't have it
            if (!userLocation) {
                userLocation = await getUserLocation();
                MapModule.setUserLocation(userLocation);
            }
            
            // Save search state
            lastSearchState = {
                type: 'nearby',
                radius: radiusKm,
                userLocation: userLocation,
                timestamp: Date.now()
            };
            
            // Perform search
            showResultsLoading('Finding nearby GF beer...');
            const pubs = await APIModule.findNearbyPubs(
                userLocation.lat, 
                userLocation.lng, 
                radiusKm, 
                false // Don't force GF-only
            );
            
            console.log(`✅ Found ${pubs.length} pubs`);
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found within ${radiusKm}km`);
                return;
            }
            
            // Store results
            currentSearchPubs = pubs;
            
            // Display results
            displayResultsInOverlay(pubs, `${pubs.length} pubs within ${radiusKm}km`);
            
            // Track success
            if (window.trackSearch) {
                window.trackSearch(`nearby_${radiusKm}km`, 'location', pubs.length);
            }
            
        } catch (error) {
            console.error('❌ Error in nearby search:', error);
            showNoResults('Could not complete search. Please try again.');
        }
    };
    
    // =============================================================================
    // NAME SEARCH (Search by Pub Name)
    // =============================================================================
    
    const searchByName = async () => {
        const query = document.getElementById('nameInput').value.trim();
        
        if (!query) {
            if (window.showSuccessToast) {
                window.showSuccessToast('Please enter a pub name to search');
            }
            return;
        }
        
        console.log('🏠 Searching for pub name:', query);
        
        if (window.closeSearchModal) {
            window.closeSearchModal();
        }
        
        showResultsOverlay(`Pub name: "${query}"`);
        showResultsLoading('Searching for pubs...');
        
        await performNameSearch(query);
        
        if (window.trackEvent) {
            window.trackEvent('search_by_name', 'Search', query);
        }
    };
    
    const performNameSearch = async (query) => {
        try {
            // Try to get user location for proximity sorting
            if (!userLocation) {
                userLocation = await tryGetUserLocation();
            }
            
            const results = await APIModule.searchPubs({
                query: query,
                searchType: 'name',
                page: 1
            });
            
            let pubs = Array.isArray(results) ? results : results.pubs;
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found matching "${query}"`);
                return;
            }
            
            // Sort by proximity if we have location
            if (userLocation) {
                pubs = sortPubsByDistance(pubs, userLocation);
            }
            
            // Save state
            lastSearchState = {
                type: 'name',
                query: query,
                results: pubs,
                timestamp: Date.now()
            };
            
            currentSearchPubs = pubs;
            
            // Display results
            const title = userLocation ? 
                `${pubs.length} pubs matching "${query}" (nearest first)` :
                `${pubs.length} pubs matching "${query}"`;
                
            displayResultsInOverlay(pubs, title);
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Found ${pubs.length} pubs matching "${query}"`);
            }
            
            if (window.trackSearch) {
                window.trackSearch(query, 'name', pubs.length);
            }
            
        } catch (error) {
            console.error('❌ Error searching by name:', error);
            showNoResults(`Error searching for "${query}". Please try again.`);
        }
    };
    
    // =============================================================================
    // AREA SEARCH (Postcode or City)
    // =============================================================================
    
    const searchByArea = async () => {
        const query = document.getElementById('areaInput').value.trim();
        const searchType = document.getElementById('areaSearchType').value;
        
        if (!query) {
            if (window.showSuccessToast) {
                window.showSuccessToast('Please enter a location to search');
            }
            return;
        }
        
        console.log(`🗺️ Searching by ${searchType}:`, query);
        
        if (window.closeSearchModal) {
            window.closeSearchModal();
        }
        
        const searchTypeText = searchType === 'postcode' ? 'postcode' : 'area';
        showResultsOverlay(`${searchTypeText}: "${query}"`);
        showResultsLoading('Finding pubs in this area...');
        
        if (searchType === 'postcode') {
            await performPostcodeSearch(query);
        } else {
            await performCitySearch(query);
        }
        
        if (window.trackEvent) {
            window.trackEvent('search_by_area', 'Search', `${searchType}:${query}`);
        }
    };
    
    const performPostcodeSearch = async (postcode) => {
        try {
            // Geocode the postcode
            showResultsLoading('Finding postcode location...');
            const location = await APIModule.geocodePostcode(postcode);
            
            console.log(`✅ Postcode geocoded to: ${location.lat}, ${location.lng}`);
            
            // Search nearby
            showResultsLoading('Finding pubs near this postcode...');
            const radius = 5; // km
            const pubs = await APIModule.findNearbyPubs(location.lat, location.lng, radius);
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found within ${radius}km of ${postcode}`);
                return;
            }
            
            // Save state
            lastSearchState = {
                type: 'area',
                query: `${postcode} (postcode)`,
                results: pubs,
                timestamp: Date.now()
            };
            
            currentSearchPubs = pubs;
            
            displayResultsInOverlay(pubs, `${pubs.length} pubs near ${postcode} (${radius}km radius)`);
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Found ${pubs.length} pubs near ${postcode}`);
            }
            
            if (window.trackSearch) {
                window.trackSearch(postcode, 'postcode', pubs.length);
            }
            
        } catch (error) {
            console.error('❌ Error searching by postcode:', error);
            showNoResults(`Could not find location for "${postcode}"`);
        }
    };
    
    const performCitySearch = async (city) => {
        try {
            // Try to get user location for sorting
            if (!userLocation) {
                userLocation = await tryGetUserLocation();
            }
            
            const results = await APIModule.searchPubs({
                query: city,
                searchType: 'area',
                page: 1
            });
            
            let pubs = Array.isArray(results) ? results : results.pubs;
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found in "${city}"`);
                return;
            }
            
            // Sort by proximity if we have location
            if (userLocation) {
                pubs = sortPubsByDistance(pubs, userLocation);
            }
            
            // Save state
            lastSearchState = {
                type: 'area',
                query: `${city} (city)`,
                results: pubs,
                timestamp: Date.now()
            };
            
            currentSearchPubs = pubs;
            
            const title = userLocation ? 
                `${pubs.length} pubs in ${city} (nearest first)` :
                `${pubs.length} pubs in ${city}`;
                
            displayResultsInOverlay(pubs, title);
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Found ${pubs.length} pubs in ${city}`);
            }
            
            if (window.trackSearch) {
                window.trackSearch(city, 'city', pubs.length);
            }
            
        } catch (error) {
            console.error('❌ Error searching by city:', error);
            showNoResults(`Error searching for "${city}"`);
        }
    };
    
    // =============================================================================
    // BEER SEARCH (Brewery, Beer Name, or Style)
    // =============================================================================
    
    const searchByBeer = async () => {
        const query = document.getElementById('beerInput').value.trim();
        const searchType = document.getElementById('beerSearchType').value;
        
        if (!query) {
            if (window.showSuccessToast) {
                window.showSuccessToast('Please enter something to search for');
            }
            return;
        }
        
        console.log(`🍺 Searching by ${searchType}:`, query);
        
        if (window.closeSearchModal) {
            window.closeSearchModal();
        }
        
        const searchTypeText = searchType === 'brewery' ? 'brewery' : 
                             searchType === 'beer' ? 'beer' : 'style';
        showResultsOverlay(`${searchTypeText}: "${query}"`);
        showResultsLoading('Finding pubs with this beer...');
        
        await performBeerSearch(query, searchType);
        
        if (window.trackEvent) {
            window.trackEvent('search_by_beer', 'Search', `${searchType}:${query}`);
        }
    };
    
    const performBeerSearch = async (query, searchType) => {
        try {
            // Try to get user location for sorting
            if (!userLocation) {
                userLocation = await tryGetUserLocation();
            }
            
            const results = await APIModule.searchPubs({
                query: query,
                searchType: 'all', // Beer search uses 'all' then filters
                page: 1
            });
            
            let pubs = Array.isArray(results) ? results : results.pubs;
            
            // Filter based on beer details
            pubs = pubs.filter(pub => {
                if (!pub.beer_details) return false;
                const beerDetails = pub.beer_details.toLowerCase();
                const searchQuery = query.toLowerCase();
                return beerDetails.includes(searchQuery);
            });
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found serving "${query}"`);
                return;
            }
            
            // Sort by proximity if we have location
            if (userLocation) {
                pubs = sortPubsByDistance(pubs, userLocation);
            }
            
            // Save state
            lastSearchState = {
                type: 'beer',
                query: `${query} (${searchType})`,
                results: pubs,
                timestamp: Date.now()
            };
            
            currentSearchPubs = pubs;
            
            const title = userLocation ? 
                `${pubs.length} pubs serving "${query}" (nearest first)` :
                `${pubs.length} pubs serving "${query}"`;
                
            displayResultsInOverlay(pubs, title);
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Found ${pubs.length} pubs serving "${query}"`);
            }
            
            if (window.trackSearch) {
                window.trackSearch(query, searchType, pubs.length);
            }
            
        } catch (error) {
            console.error('❌ Error searching by beer:', error);
            showNoResults(`Error searching for "${query}"`);
        }
    };
    
    // =============================================================================
    // SEARCH A SPECIFIC PUB (by ID)
    // =============================================================================
    
    // REPLACE your searchSpecificPub function in search.js
    const searchSpecificPub = async (pubId) => {
        console.log('🔍 Searching for specific pub:', pubId);
        
        try {
            if (window.showLoadingToast) {
                window.showLoadingToast('Loading pub details...');
            }
            
            const results = await getAPI().searchPubs({ pubId: pubId });
            const pubs = Array.isArray(results) ? results : results.pubs;
            
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
            
            if (pubs && pubs.length > 0) {
                const pub = pubs[0];
                
                // Use UI module to display pub details
                const uiModule = getUI();
                if (uiModule && uiModule.displayPubDetailsOverlay) {
                    console.log('✅ Using UI module to display pub details');
                    uiModule.displayPubDetailsOverlay(pub);
                } else {
                    console.log('🔧 UI module not ready, using direct DOM manipulation');
                    // Fallback - direct DOM manipulation
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
    
    // ADD this fallback function to search.js
    // REPLACE the displayPubDetailsFallback function in search.js
    const displayPubDetailsFallback = (pub) => {
        console.log('🔧 Using fallback pub details display for:', pub.name);
        
        // FORCE: Hide results overlay first
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay) {
            resultsOverlay.style.display = 'none';
            resultsOverlay.classList.remove('active');
            console.log('🔧 Hidden results overlay');
        }
        
        // FORCE: Show the pub details overlay with maximum priority
        const overlay = document.getElementById('pubDetailsOverlay');
        if (overlay) {
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100vh';
            overlay.style.zIndex = '9999';
            overlay.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            overlay.style.display = 'flex';
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            console.log('🔧 Forced overlay visibility with z-index 9999');
            
            // Populate the content
            const titleEl = document.getElementById('pubDetailsTitle');
            const addressEl = document.getElementById('pubDetailsAddress');
            const locationEl = document.getElementById('pubDetailsLocation');
            const beerEl = document.getElementById('pubDetailsBeer');
            
            if (titleEl) titleEl.textContent = pub.name;
            if (addressEl) addressEl.textContent = pub.address;
            if (locationEl) locationEl.textContent = `${pub.postcode} • ${pub.local_authority}`;
            
            // Set up beer details
            if (beerEl) {
                if (pub.bottle || pub.tap || pub.cask || pub.can) {
                    let formats = [];
                    if (pub.bottle) formats.push('🍺 Bottles');
                    if (pub.tap) formats.push('🚰 Tap');
                    if (pub.cask) formats.push('🛢️ Cask');
                    if (pub.can) formats.push('🥫 Cans');
                    beerEl.innerHTML = `<strong>Available in: ${formats.join(', ')}</strong>`;
                } else {
                    beerEl.innerHTML = '<em>No specific GF beer information available. Help us by reporting what you find!</em>';
                }
            }

            // SET UP BUTTON HANDLERS
            const findOnlineBtn = document.getElementById('pubFindOnline');
            const directionsBtn = document.getElementById('pubGetDirections');
            const mapBtn = document.getElementById('pubToggleMap');
            const reportBtn = document.querySelector('[data-action="report-beer"]');
            const backBtn = document.querySelector('[data-action="back-to-results"]');
            const homeBtn = document.querySelector('[data-action="close-pub-details"]');
            
            // Find Online button
            if (findOnlineBtn) {
                findOnlineBtn.onclick = () => {
                    const searchQuery = encodeURIComponent(`${pub.name} ${pub.postcode} pub`);
                    window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
                    console.log('🔍 Opened Google search for pub');
                };
            }
            
            // Get Directions button
            if (directionsBtn) {
                directionsBtn.onclick = () => {
                    const destination = encodeURIComponent(`${pub.name}, ${pub.address}, ${pub.postcode}`);
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
                    console.log('🧭 Opened Google Maps directions');
                };
            }
            
            // Show on Map button
            if (mapBtn) {
                mapBtn.onclick = () => {
                    // Toggle map visibility
                    const mapContainer = document.getElementById('pubMapContainer');
                    const btnText = document.getElementById('pubMapBtnText');
                    if (mapContainer) {
                        if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
                            mapContainer.style.display = 'block';
                            if (btnText) btnText.textContent = 'Hide Map';
                            console.log('🗺️ Showed pub map');
                        } else {
                            mapContainer.style.display = 'none';
                            if (btnText) btnText.textContent = 'Show on Map';
                            console.log('🗺️ Hid pub map');
                        }
                    }
                };
            }
            
            // Report Beer button
            if (reportBtn) {
                reportBtn.onclick = () => {
                    // Close pub details and open report modal
                    overlay.style.display = 'none';
                    overlay.classList.remove('active');
                    
                    // Open report modal with pub data
                    const modalModule = getModal();
                    if (modalModule) {
                        modalModule.openReportModal(pub);
                    } else {
                        // Fallback
                        const reportModal = document.getElementById('reportModal');
                        if (reportModal) {
                            reportModal.style.display = 'flex';
                            // Pre-populate with pub data
                            window.selectedPubData = pub;
                        }
                    }
                    console.log('📝 Opened report modal');
                };
            }
            
            // Back to Results button
            if (backBtn) {
                backBtn.onclick = () => {
                    overlay.style.display = 'none';
                    overlay.classList.remove('active');
                    
                    // Show results overlay again
                    if (resultsOverlay) {
                        resultsOverlay.style.display = 'flex';
                        resultsOverlay.classList.add('active');
                    }
                    console.log('🔙 Back to results');
                };
            }
            
            // Home button
            if (homeBtn) {
                homeBtn.onclick = () => {
                    // Close pub details overlay
                    overlay.style.display = 'none';
                    overlay.classList.remove('active');
                    
                    // ALSO close results overlay if it exists
                    if (resultsOverlay) {
                        resultsOverlay.style.display = 'none';
                        resultsOverlay.classList.remove('active');
                    }
                    
                    // Restore body scroll
                    document.body.style.overflow = '';
                    
                    // Show home sections
                    const heroSection = document.querySelector('.hero-section');
                    const searchSection = document.querySelector('.search-section');
                    if (heroSection) heroSection.style.display = 'block';
                    if (searchSection) searchSection.style.display = 'flex'; // Changed to flex
                    
                    console.log('🏠 Returned to home');
                };
            }
            
            console.log('✅ Button handlers set up successfully');
            
            console.log('✅ Pub details populated and forced visible');
        } else {
            console.error('❌ pubDetailsOverlay element not found in DOM');
        }
    };
    
    // =============================================================================
    // BACK BUTTON FUNCTIONALITY
    // =============================================================================
    
    const goBackToResults = () => {
        console.log('🔙 Going back to previous search results...');
        
        if (!lastSearchState) {
            console.log('❌ No previous search state');
            if (window.closePubDetails) {
                window.closePubDetails();
            }
            return false;
        }
        
        // Check if state is recent (within 30 minutes)
        const thirtyMinutes = 30 * 60 * 1000;
        if (Date.now() - lastSearchState.timestamp > thirtyMinutes) {
            console.log('⏰ Search state too old');
            if (window.closePubDetails) {
                window.closePubDetails();
            }
            return false;
        }
        
        console.log('✅ Restoring search state:', lastSearchState);
        
        // Close pub details
        if (window.closePubDetails) {
            window.closePubDetails();
        }
        
        // Restore the search based on type
        switch (lastSearchState.type) {
            case 'nearby':
                restoreNearbySearch(lastSearchState);
                break;
            case 'name':
            case 'area':
            case 'beer':
                restoreTextSearch(lastSearchState);
                break;
            default:
                console.log('❌ Unknown search type');
                if (window.closePubDetails) {
                    window.closePubDetails();
                }
        }
        
        if (window.trackEvent) {
            window.trackEvent('back_to_results', 'Navigation', lastSearchState.type);
        }
        
        return false;
    };
    
    const restoreNearbySearch = async (state) => {
        console.log('🔄 Restoring nearby search...', state);
        
        // Restore user location
        if (state.userLocation) {
            userLocation = state.userLocation;
            MapModule.setUserLocation(userLocation);
        }
        
        showResultsOverlay(`Pubs within ${state.radius}km`);
        showResultsLoading('Restoring your search...');
        
        try {
            await searchNearbyWithDistance(state.radius);
            if (window.showSuccessToast) {
                window.showSuccessToast('📍 Restored your search results!');
            }
        } catch (error) {
            console.error('❌ Error restoring search:', error);
            showNoResults('Could not restore search. Please try again.');
        }
    };

    const restoreNameSearch = (state) => {
        showResultsOverlay(`Pub name: "${state.query}"`);
        if (state.results && state.results.length > 0) {
            currentSearchPubs = state.results;
            displayResultsInOverlay(state.results, `${state.results.length} results for "${state.query}"`);
        } else {
            showResultsLoading('Restoring search...');
            // Re-run the name search
            performNameSearch(state.query);
        }
    };
    
    const restoreAreaSearch = (state) => {
        showResultsOverlay(`Area: "${state.query}"`);
        if (state.results && state.results.length > 0) {
            currentSearchPubs = state.results;
            displayResultsInOverlay(state.results, `${state.results.length} pubs in "${state.query}"`);
        } else {
            showResultsLoading('Restoring search...');
            // Determine if it was a postcode or city search
            const isPostcode = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i.test(state.query.replace(/\s/g, ''));
            if (isPostcode) {
                performPostcodeSearch(state.query);
            } else {
                performCitySearch(state.query);
            }
        }
    };
    
    const restoreBeerSearch = (state) => {
        showResultsOverlay(`Beer: "${state.query}"`);
        if (state.results && state.results.length > 0) {
            currentSearchPubs = state.results;
            displayResultsInOverlay(state.results, `${state.results.length} pubs serving "${state.query}"`);
        } else {
            showResultsLoading('Restoring search...');
            // Re-run the beer search
            performBeerSearch(state.query, 'beer');
        }
    };
    
    const restoreTextSearch = (state) => {
        showResultsOverlay(state.query);
        
        if (state.results && state.results.length > 0) {
            currentSearchPubs = state.results;
            displayResultsInOverlay(state.results, `${state.results.length} results for "${state.query}"`);
        } else {
            showNoResults('Previous results not available');
        }
    };
    
    // =============================================================================
    // HELPER FUNCTIONS
    // =============================================================================
    
    const getUserLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Location not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    resolve(location);
                },
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                }
            );
        });
    };
    
    const tryGetUserLocation = async () => {
        if (userLocation) return userLocation;
        
        try {
            console.log('📍 Attempting to get user location for proximity ordering...');
            userLocation = await getUserLocation();
            MapModule.setUserLocation(userLocation);
            return userLocation;
        } catch (error) {
            console.log('📍 Could not get location:', error.message);
            return null;
        }
    };
    
    const sortPubsByDistance = (pubs, location) => {
        return pubs.map(pub => {
            if (pub.latitude && pub.longitude) {
                pub.distance = MapModule.calculateDistance(
                    location.lat, location.lng,
                    parseFloat(pub.latitude), parseFloat(pub.longitude)
                );
            } else {
                pub.distance = 999; // Put pubs without coordinates at the end
            }
            return pub;
        }).sort((a, b) => a.distance - b.distance);
    };
    
    // =============================================================================
    // UI HELPERS (These will move to UIModule later)
    // =============================================================================
    
    const showResultsOverlay = (title) => {
        console.log('📋 Showing results overlay:', title);
        
        // These will be moved to UIModule later
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay) {
            resultsOverlay.classList.add('active');
            resultsOverlay.style.display = 'flex';
        }
        
        const resultsTitle = document.getElementById('resultsTitle');
        if (resultsTitle) {
            resultsTitle.textContent = title;
        }
        
        // Hide home sections
        const searchSection = document.querySelector('.search-section');
        if (searchSection) searchSection.style.display = 'none';
        
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) heroSection.style.display = 'none';
        
        document.body.style.overflow = 'hidden';
    };
    
    const showResultsLoading = (message) => {
        const loadingEl = document.getElementById('resultsLoading');
        const listEl = document.getElementById('resultsList');
        const noResultsEl = document.getElementById('noResultsFound');
        
        if (loadingEl) loadingEl.style.display = 'flex';
        if (listEl) listEl.style.display = 'none';
        if (noResultsEl) noResultsEl.style.display = 'none';
        
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = message;
    };
    
    const showNoResults = (message) => {
        const loadingEl = document.getElementById('resultsLoading');
        const listEl = document.getElementById('resultsList');
        const noResultsEl = document.getElementById('noResultsFound');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (listEl) listEl.style.display = 'none';
        if (noResultsEl) noResultsEl.style.display = 'flex';
        
        const noResultsText = document.querySelector('.no-results-text');
        if (noResultsText) noResultsText.textContent = message;
    };

    const closeSearchModal = () => {
        console.log('🔒 Closing search modals...');
        
        // Close any open search modals
        const searchModals = ['nameModal', 'areaModal', 'beerModal', 'distanceModal'];
        
        searchModals.forEach(modalId => {
            if (ModalModule && ModalModule.isOpen(modalId)) {
                ModalModule.close(modalId);
            }
        });
    };

    // ================================
    // 🔧 REPLACE: In search.js - Fix navigation button handlers
    // LOCATION: Replace the displayResultsInOverlay function
    // ================================
    
    const displayResultsInOverlay = (pubs, title) => {
        // Store pubs globally for map access
        currentSearchPubs = pubs;
        console.log('💾 Stored search results for map:', pubs.length, 'pubs');
        
        // Hide loading and no results
        document.getElementById('resultsLoading').style.display = 'none';
        document.getElementById('noResultsFound').style.display = 'none';
        
        // Get the results list container
        const resultsListContainer = document.getElementById('resultsListContainer');
        const resultsList = document.getElementById('resultsList');
        
        // IMPORTANT: Show the list container
        if (resultsListContainer) {
            resultsListContainer.style.display = 'block';
        }
        
        // Show and populate the results list
        resultsList.style.display = 'block';
        resultsList.innerHTML = '';
        
        // Update title
        document.getElementById('resultsTitle').textContent = title;
        
        // Generate results HTML
        pubs.forEach(pub => {
            const resultItem = createResultItemForOverlay(pub);
            resultsList.appendChild(resultItem);
        });
        
        // 🔧 FIX: Set up navigation button handlers AFTER results are displayed
        setupResultsNavigationHandlers();
        
        console.log(`✅ Displayed ${pubs.length} results with navigation handlers`);
    };
    
    // ================================
    // 🔧 ADD: New function to set up navigation handlers
    // LOCATION: Add to search.js after displayResultsInOverlay
    // ================================
    
    const setupResultsNavigationHandlers = () => {
        console.log('🔧 Setting up results navigation handlers...');
        
        // Home button handler
        const homeBtn = document.querySelector('[data-action="close-results"]');
        if (homeBtn) {
            // Remove any existing handlers
            homeBtn.onclick = null;
            
            // Add new handler
            homeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🏠 Home button clicked');
                
                // Use UI module to close results
                const uiModule = window.App?.getModule('ui');
                if (uiModule && uiModule.closeResults) {
                    uiModule.closeResults();
                } else {
                    // Fallback
                    const resultsOverlay = document.getElementById('resultsOverlay');
                    if (resultsOverlay) {
                        resultsOverlay.style.display = 'none';
                        resultsOverlay.classList.remove('active');
                    }
                    
                    // Show home sections
                    const heroSection = document.querySelector('.hero-section');
                    const searchSection = document.querySelector('.search-section');
                    if (heroSection) heroSection.style.display = 'block';
                    if (searchSection) searchSection.style.display = 'flex';
                    
                    // Restore body scroll
                    document.body.style.overflow = '';
                }
                
                // Track the action
                const tracking = window.App?.getModule('tracking');
                if (tracking) {
                    tracking.trackEvent('close_results', 'Navigation', 'home_button');
                }
            });
            
            console.log('✅ Home button handler attached');
        }
        
        // Map toggle button handler
        const mapBtn = document.querySelector('[data-action="toggle-results-map"]');
        if (mapBtn) {
            // Remove any existing handlers
            mapBtn.onclick = null;
            
            // Add new handler
            mapBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🗺️ Map toggle button clicked');
                
                const listContainer = document.getElementById('resultsListContainer');
                const mapContainer = document.getElementById('resultsMapContainer');
                const mapBtnText = document.getElementById('resultsMapBtnText');
                
                if (mapContainer && listContainer && mapBtnText) {
                    if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
                        // Show map
                        listContainer.style.display = 'none';
                        mapContainer.style.display = 'block';
                        mapBtnText.textContent = 'List';
                        
                        // Initialize the results map with current pubs
                        setTimeout(() => {
                            const mapModule = window.App?.getModule('map');
                            if (mapModule && mapModule.initResultsMap) {
                                const map = mapModule.initResultsMap();
                                if (map && currentSearchPubs.length > 0) {
                                    mapModule.addPubMarkers(currentSearchPubs, map);
                                }
                            }
                        }, 100);
                        
                        console.log('✅ Map view activated');
                    } else {
                        // Show list
                        listContainer.style.display = 'block';
                        mapContainer.style.display = 'none';
                        mapBtnText.textContent = 'Map';
                        
                        console.log('✅ List view activated');
                    }
                    
                    // Track the action
                    const tracking = window.App?.getModule('tracking');
                    if (tracking) {
                        tracking.trackEvent('results_map_toggle', 'Map Interaction', 
                            mapContainer.style.display === 'block' ? 'show' : 'hide');
                    }
                }
            });
            
            console.log('✅ Map toggle button handler attached');
        }
        
        console.log('✅ Results navigation handlers setup complete');
    };
    
    const createResultItemForOverlay = (pub) => {
        console.log('Pub object:', pub);  // ADD THIS
        console.log('Pub ID:', pub.pub_id, 'Type:', typeof pub.pub_id);  // AND THIS
        
        const template = document.getElementById('pub-result-template');
        const clone = template.content.cloneNode(true);
        
        // Set the content
        clone.querySelector('.result-title').textContent = pub.name;
        
        // Set distance if available
        const distanceEl = clone.querySelector('.result-distance');
        if (pub.distance !== undefined) {
            distanceEl.textContent = `${pub.distance.toFixed(1)}km away`;
        } else {
            distanceEl.style.display = 'none';
        }
        
        // Set GF indicator
        const gfIndicator = clone.querySelector('.gf-indicator');
        if (pub.bottle || pub.tap || pub.cask || pub.can) {
            gfIndicator.textContent = '✅ GF Available';
            gfIndicator.className = 'gf-indicator';
        } else {
            gfIndicator.textContent = '❓ GF Unknown';
            gfIndicator.className = 'gf-indicator unknown';
        }
        
        // Set location details
        clone.querySelector('.result-address').textContent = pub.address;
        clone.querySelector('.result-postcode').textContent = pub.postcode;
        clone.querySelector('.result-authority').textContent = pub.local_authority;
        
        // Set up the button with data attribute
        const viewButton = clone.querySelector('[data-action="view-pub"]');
        viewButton.dataset.pubId = pub.pub_id;
        
        return clone;
    };

    const showPubDetails = (pubId) => {
        console.log('🏠 Showing pub details:', pubId);
        
        // Just call searchSpecificPub directly
        searchSpecificPub(pubId);
    };
    
    // =============================================================================
    // PUBLIC API
    // =============================================================================
    
    return {
        // Location search
        startLocationSearch,
        searchNearbyWithDistance,
        
        // Name search
        searchByName,
        
        // Area search
        searchByArea,
        
        // Beer search
        searchByBeer,
        
        // Specific pub
        searchSpecificPub,
        
        // Navigation
        goBackToResults,

        // Modal helpers - ADD THIS
        closeSearchModal,
        displayResultsInOverlay,
        createResultItemForOverlay,

        restoreNameSearch,
        restoreAreaSearch,
        restoreBeerSearch,
        showPubDetails,
        
        // Get current results
        getCurrentResults: () => currentSearchPubs,
        getLastSearchState: () => lastSearchState
    };
})();

// Make it globally available
window.SearchModule = SearchModule;
