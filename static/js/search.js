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
    
    // ================================
    // 🔧 UPDATE: Enhanced searchNearbyWithDistance function in search.js
    // LOCATION: Find searchNearbyWithDistance function around line 50
    // ACTION: Update the location acquisition section with better feedback
    // ================================
    
    const searchNearbyWithDistance = async (radiusKm) => {
        console.log(`🎯 Searching within ${radiusKm}km with enhanced accuracy...`);
        
        try {
            // Close distance modal
            if (window.ModalModule) {
                window.ModalModule.close('distanceModal');
            }
            
            // Show results overlay
            showResultsOverlay(`Pubs within ${radiusKm}km`);
            
            // 🔧 ENHANCED: Better location feedback
            showResultsLoading('📍 Getting precise location...');
            
            // Get user location if we don't have it
            if (!userLocation) {
                try {
                    userLocation = await getUserLocation();
                    
                    // 🔧 ADD: Show accuracy feedback to user
                    if (userLocation.accuracy) {
                        if (userLocation.accuracy <= 100) {
                            showResultsLoading('🎯 Excellent location accuracy - finding nearby GF beer...');
                        } else if (userLocation.accuracy <= 500) {
                            showResultsLoading('📍 Good location accuracy - finding nearby GF beer...');
                        } else if (userLocation.accuracy <= 1000) {
                            showResultsLoading('📍 Reasonable location accuracy - finding nearby GF beer...');
                        } else {
                            showResultsLoading('📍 Location found (low accuracy) - finding nearby GF beer...');
                            if (window.showSuccessToast) {
                                window.showSuccessToast(`⚠️ Location accuracy: ±${Math.round(userLocation.accuracy)}m`);
                            }
                        }
                    }
                    
                    const mapModule = getMap();
                    if (mapModule && mapModule.setUserLocation) {
                        mapModule.setUserLocation(userLocation);
                    }
                    
                } catch (locationError) {
                    console.error('❌ Location error:', locationError);
                    showNoResults(`${locationError.message} Please try again or search by area instead.`);
                    return;
                }
            }
            
            // Save search state
            lastSearchState = {
                type: 'nearby',
                radius: radiusKm,
                userLocation: userLocation,
                timestamp: Date.now()
            };
            
            // Perform search
            showResultsLoading('🔍 Searching for GF beer options...');
            const pubs = await APIModule.findNearbyPubs(
                userLocation.lat, 
                userLocation.lng, 
                radiusKm, 
                false // Don't force GF-only
            );
            
            console.log(`✅ Found ${pubs.length} pubs`);
            
            if (pubs.length === 0) {
                showNoResults(`No pubs found within ${radiusKm}km of your location`);
                return;
            }
            
            // Store results
            currentSearchPubs = pubs;
            
            // Display results with location accuracy info
            const accuracyText = userLocation.accuracy && userLocation.accuracy > 500 ? 
                ` (±${Math.round(userLocation.accuracy)}m accuracy)` : '';
            
            displayResultsInOverlay(pubs, `${pubs.length} pubs within ${radiusKm}km${accuracyText}`);
            
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
        
        // 🔧 FIX: Close the modal properly
        const modalModule = getModal();
        if (modalModule) {
            modalModule.close('nameModal');
        } else {
            // Fallback close
            const modal = document.getElementById('nameModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
        
        showResultsOverlay(`Pub name: "${query}"`);
        showResultsLoading('Searching for pubs...');
        
        await performNameSearch(query);
        
        if (window.trackEvent) {
            window.trackEvent('search_by_name', 'Search', query);
        }
    };
    
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
        
        // 🔧 FIX: Close the modal properly
        const modalModule = getModal();
        if (modalModule) {
            modalModule.close('areaModal');
        } else {
            // Fallback close
            const modal = document.getElementById('areaModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
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
        
        if (window.trackEvent) {
            window.trackEvent('search_by_area', 'Search', `${searchType}:${query}`);
        }
    };
    
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
        
        // 🔧 FIX: Close the modal properly
        const modalModule = getModal();
        if (modalModule) {
            modalModule.close('beerModal');
        } else {
            // Fallback close
            const modal = document.getElementById('beerModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
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

    const debugBeerSearch = (pubs, query, searchType) => {
        console.log('🔍 DEBUG: Beer search details');
        console.log(`Query: "${query}" | Type: ${searchType}`);
        console.log(`Total pubs to search: ${pubs.length}`);
        
        // Check first few pubs to see their beer_details structure
        const samplePubs = pubs.slice(0, 5);
        samplePubs.forEach((pub, index) => {
            console.log(`Pub ${index + 1}: ${pub.name}`);
            console.log(`  Beer details: ${pub.beer_details || 'null'}`);
            console.log(`  GF flags: bottle=${pub.bottle}, tap=${pub.tap}, cask=${pub.cask}, can=${pub.can}`);
        });
        
        // Count how many pubs have beer details
        const pubsWithBeerDetails = pubs.filter(pub => pub.beer_details).length;
        console.log(`Pubs with beer_details: ${pubsWithBeerDetails}/${pubs.length}`);
        
        // Show example beer_details if any exist
        const examplePub = pubs.find(pub => pub.beer_details);
        if (examplePub) {
            console.log('Example beer_details structure:');
            console.log(examplePub.beer_details);
        }
    };

    const performBeerSearch = async (query, searchType) => {
        try {
            console.log(`🍺 Performing enhanced beer search: "${query}" (${searchType})`);
            
            // Try to get user location for sorting
            if (!userLocation) {
                userLocation = await tryGetUserLocation();
            }
            
            // Use enhanced beer search API
            const apiModule = getAPI();
            let results;
            
            if (apiModule.searchPubsByBeer) {
                console.log('🍺 Using enhanced beer search API');
                results = await apiModule.searchPubsByBeer(query, searchType);
            } else {
                console.log('🍺 Using fallback search method');
                results = await apiModule.searchPubs({
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
            
            // More sophisticated filtering
            if (searchType === 'brewery') {
                filteredPubs = allPubs.filter(pub => {
                    if (!pub.beer_details) return false;
                    const beerDetails = pub.beer_details.toLowerCase();
                    // Look for brewery name (more precise matching)
                    return beerDetails.includes(` ${searchQuery} `) || 
                           beerDetails.startsWith(searchQuery) ||
                           beerDetails.includes(`${searchQuery} `) ||
                           beerDetails.includes(` ${searchQuery}`);
                });
            } else if (searchType === 'beer') {
                filteredPubs = allPubs.filter(pub => {
                    if (!pub.beer_details) return false;
                    const beerDetails = pub.beer_details.toLowerCase();
                    // Look for beer name
                    return beerDetails.includes(searchQuery);
                });
            } else if (searchType === 'style') {
                filteredPubs = allPubs.filter(pub => {
                    if (!pub.beer_details) return false;
                    const beerDetails = pub.beer_details.toLowerCase();
                    // Look for style - check common beer style patterns
                    return beerDetails.includes(searchQuery) ||
                           beerDetails.includes(`(${searchQuery})`) ||
                           beerDetails.includes(`${searchQuery} `) ||
                           beerDetails.includes(` ${searchQuery}`);
                });
            }
            
            console.log(`🔍 Filtered to ${filteredPubs.length} pubs matching "${query}" (${searchType})`);
            
            // If no results with strict filtering, try looser matching
            if (filteredPubs.length === 0 && searchQuery.length > 3) {
                console.log('🔍 Trying looser beer search matching...');
                filteredPubs = allPubs.filter(pub => {
                    if (!pub.beer_details) return false;
                    const beerDetails = pub.beer_details.toLowerCase();
                    // Very loose matching for partial words
                    return beerDetails.includes(searchQuery.substring(0, 4));
                });
                console.log(`🔍 Loose matching found ${filteredPubs.length} pubs`);
            }
            
            if (filteredPubs.length === 0) {
                showNoResults(`No pubs found serving "${query}". Try searching for a brewery name or beer style.`);
                return;
            }
            
            // Sort by proximity if we have location
            if (userLocation) {
                filteredPubs = sortPubsByDistance(filteredPubs, userLocation);
                console.log('📍 Sorted by distance from user location');
            }
            
            // Save state for back button
            lastSearchState = {
                type: 'beer',
                query: `${query} (${searchType})`,
                results: filteredPubs,
                timestamp: Date.now()
            };
            
            currentSearchPubs = filteredPubs;
            
            // Display results
            const title = userLocation ? 
                `${filteredPubs.length} pubs serving "${query}" (nearest first)` :
                `${filteredPubs.length} pubs serving "${query}"`;
                
            displayResultsInOverlay(filteredPubs, title);
            
            // Show success message
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Found ${filteredPubs.length} pubs serving "${query}"`);
            }
            
            // Track the search
            if (window.trackSearch) {
                window.trackSearch(query, `beer_${searchType}`, filteredPubs.length);
            }
            
            console.log(`✅ Enhanced beer search completed: ${filteredPubs.length} results`);
            
        } catch (error) {
            console.error('❌ Error in enhanced beer search:', error);
            showNoResults(`Error searching for "${query}". Please try again.`);
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`❌ Search failed: ${error.message}`);
            }
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

                // 🔧 ADD: Store pub data globally BEFORE displaying
                window.currentPubData = pub;
                console.log('💾 Stored pub data globally:', pub.name);

                // 🔧 ADD: Reset any existing split-view state before showing new pub
                const pubContainer = document.getElementById('pubContainer');
                const pubMapContainer = document.getElementById('pubMapContainer');
                const mapBtnText = document.getElementById('pubMapBtnText');
                const mapBtn = document.getElementById('pubToggleMap');
                console.log('🔍 Map button element:', mapBtn ? 'found' : 'not found');
                
                if (pubContainer) {
                    pubContainer.classList.remove('split-view');
                    console.log('🔄 Reset: Removed split-view class');
                }
                
                if (pubMapContainer) {
                    pubMapContainer.style.display = 'none';
                    console.log('🔄 Reset: Hidden map container');
                }
                
                if (mapBtnText) {
                    mapBtnText.textContent = 'Show on Map';
                    console.log('🔄 Reset: Map button text');
                }

                if (mapBtn) {
                    mapBtn.onclick = () => {
                        console.log('🗺️ Map button clicked - toggling split view');
                        
                        // Toggle map visibility
                        const mapContainer = document.getElementById('pubMapContainer');
                        const btnText = document.getElementById('pubMapBtnText');
                        const pubContainer = document.getElementById('pubContainer');
                        
                        console.log('🔍 Current states:');
                        console.log('  Map container display:', mapContainer?.style.display || 'default');
                        console.log('  Split-view class:', pubContainer?.classList.contains('split-view'));
                        console.log('  Button text:', btnText?.textContent);
                        
                        if (mapContainer) {
                            if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
                                // Show map
                                console.log('🗺️ Activating split-screen mode');
                                mapContainer.style.display = 'block';
                                if (btnText) btnText.textContent = 'Hide Map';
                                if (pubContainer) pubContainer.classList.add('split-view');
                                
                                // Initialize map if we have coordinates
                                if (window.currentPubData && window.currentPubData.latitude && window.currentPubData.longitude) {
                                    console.log('🗺️ Initializing map with pub data:', window.currentPubData.name);
                                    
                                    const mapModule = window.App?.getModule('map');
                                    if (mapModule && mapModule.initPubDetailMap) {
                                        try {
                                            mapModule.initPubDetailMap(window.currentPubData);
                                            console.log('✅ Map initialized successfully');
                                        } catch (error) {
                                            console.error('❌ Map initialization failed:', error);
                                        }
                                    } else {
                                        console.error('❌ Map module or initPubDetailMap not available');
                                    }
                                } else {
                                    console.warn('⚠️ No pub coordinates available for map');
                                }
                                
                                console.log('✅ Split-screen activated');
                            } else {
                                // Hide map
                                console.log('🗺️ Deactivating split-screen mode');
                                mapContainer.style.display = 'none';
                                if (btnText) btnText.textContent = 'Show on Map';
                                if (pubContainer) pubContainer.classList.remove('split-view');
                                console.log('✅ Split-screen deactivated');
                            }
                        } else {
                            console.error('❌ Map container not found');
                        }
                    };
                    console.log('✅ Map button handler set up');
                } else {
                    console.warn('⚠️ Map button not found');
                }    
                
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

        // 🔧 ADD: Store pub data globally for map access
        window.currentPubData = pub;
        console.log('💾 Stored pub data globally (fallback):', pub.name);

        // 🔧 ADD: Reset any existing split-view state
        const pubContainer = document.getElementById('pubContainer');
        const pubMapContainer = document.getElementById('pubMapContainer');
        const mapBtnText = document.getElementById('pubMapBtnText');
        
        if (pubContainer) {
            pubContainer.classList.remove('split-view');
            console.log('🔄 Removed split-view class from pub container');
        }
        
        if (pubMapContainer) {
            pubMapContainer.style.display = 'none';
            console.log('🔄 Hidden map container');
        }
        
        if (mapBtnText) {
            mapBtnText.textContent = 'Show on Map';
            console.log('🔄 Reset map button text');
        }
        
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

            const setupBeerDetails = (pub) => {
                const beerSection = document.getElementById('beerSection');
                const beerEl = document.getElementById('pubDetailsBeer');
                
                if (!beerSection || !beerEl) return;
                
                // Check if pub has any GF options
                const hasGFOptions = pub.bottle || pub.tap || pub.cask || pub.can;
                
                if (hasGFOptions) {
                    // Show the section
                    beerSection.style.display = 'block';
                    
                    // Build the formats list
                    let formats = [];
                    if (pub.bottle) formats.push('🍺 Bottles');
                    if (pub.tap) formats.push('🚰 Tap');
                    if (pub.cask) formats.push('🛢️ Cask');
                    if (pub.can) formats.push('🥫 Cans');
                    
                    // Set the content
                    beerEl.innerHTML = `<strong>Available in: ${formats.join(', ')}</strong>`;
                    
                    // If we have specific beer details, show them
                    if (pub.beer_details) {
                        beerEl.innerHTML += `<br><small style="margin-top: var(--space-sm); display: block;">${pub.beer_details}</small>`;
                    }
                } else {
                    // Hide the section completely - no GF options
                    beerSection.style.display = 'none';
                    
                    // Clear any previous content
                    beerEl.innerHTML = '';
                }
            };

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
    
    // ================================
    // 🔧 REPLACE: Enhanced getUserLocation function in search.js
    // LOCATION: Find the getUserLocation function around line 800
    // ACTION: Replace the entire function with this enhanced version
    // ================================
    
    const getUserLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('📍 Geolocation not supported by this browser'));
                return;
            }
            
            console.log('📍 Requesting high-accuracy location with enhanced settings...');
            
            // First attempt: High accuracy GPS
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy // meters
                    };
                    
                    console.log(`✅ High-accuracy location found: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)} (±${location.accuracy}m)`);
                    
                    // Quality check - if accuracy is terrible, try again
                    if (location.accuracy > 5000) {
                        console.warn(`⚠️ Very poor accuracy: ±${location.accuracy}m - attempting fallback...`);
                        attemptFallbackLocation(resolve, reject, location);
                        return;
                    }
                    
                    // Warn if accuracy is poor but usable
                    if (location.accuracy > 1000) {
                        console.warn(`⚠️ Low accuracy: ±${location.accuracy}m - results may be imprecise`);
                        if (window.showSuccessToast) {
                            window.showSuccessToast(`📍 Location found (±${Math.round(location.accuracy)}m accuracy)`);
                        }
                    }
                    
                    resolve(location);
                },
                (error) => {
                    console.error('❌ High-accuracy location failed:', error);
                    // Try fallback with lower accuracy
                    attemptFallbackLocation(resolve, reject, null, error);
                },
                {
                    // 🔧 ENHANCED: Much more aggressive high-accuracy settings
                    enableHighAccuracy: true,        // Force GPS usage
                    timeout: 20000,                  // Allow 20 seconds for GPS
                    maximumAge: 30000                // Only use cached location if < 30 seconds old
                }
            );
        });
    };

    const attemptFallbackLocation = (resolve, reject, lowAccuracyLocation = null, originalError = null) => {
        console.log('🔄 Attempting fallback location with network positioning...');
        
        // Second attempt: Network-based positioning (usually more accurate than you'd think)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                
                console.log(`✅ Network location found: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)} (±${location.accuracy}m)`);
                
                // Use this if it's better than what we had before
                if (!lowAccuracyLocation || location.accuracy < lowAccuracyLocation.accuracy) {
                    if (location.accuracy > 2000) {
                        if (window.showSuccessToast) {
                            window.showSuccessToast(`📍 Approximate location found (±${Math.round(location.accuracy/1000)}km)`);
                        }
                    }
                    resolve(location);
                } else {
                    // Use the previous location if it was better
                    resolve(lowAccuracyLocation);
                }
            },
            (networkError) => {
                console.error('❌ Network location also failed:', networkError);
                
                // If we have a low-accuracy location from before, use it
                if (lowAccuracyLocation) {
                    console.log('📍 Using low-accuracy location as last resort');
                    if (window.showSuccessToast) {
                        window.showSuccessToast(`📍 Approximate location (±${Math.round(lowAccuracyLocation.accuracy/1000)}km)`);
                    }
                    resolve(lowAccuracyLocation);
                    return;
                }
                
                // Generate user-friendly error message
                let userMessage = 'Could not get your location. ';
                const errorCode = originalError?.code || networkError?.code;
                
                switch(errorCode) {
                    case 1: // PERMISSION_DENIED
                        userMessage += 'Please allow location access and try again.';
                        break;
                    case 2: // POSITION_UNAVAILABLE
                        userMessage += 'Location services unavailable. Try enabling GPS or WiFi.';
                        break;
                    case 3: // TIMEOUT
                        userMessage += 'Location request timed out. Try again or search by postcode.';
                        break;
                    default:
                        userMessage += 'Try searching by area instead.';
                        break;
                }
                
                reject(new Error(userMessage));
            },
            {
                // 🔧 FALLBACK: Lower accuracy but faster network-based positioning
                enableHighAccuracy: false,       // Use network/WiFi positioning
                timeout: 10000,                  // Shorter timeout for network
                maximumAge: 120000               // Accept cached location up to 2 minutes old
            }
        );
    };

    
    const tryGetUserLocation = async () => {
        if (userLocation) {
            // Check if cached location is still fresh (less than 5 minutes old)
            if (userLocation.timestamp && Date.now() - userLocation.timestamp < 300000) {
                console.log('📍 Using fresh cached location');
                return userLocation;
            }
            console.log('📍 Cached location expired, requesting fresh location...');
        }
        
        try {
            console.log('📍 Attempting to get high-accuracy user location...');
            
            const location = await getUserLocation();
            
            // Add timestamp for cache management
            location.timestamp = Date.now();
            
            userLocation = location;
            
            // Update map module with new location
            const mapModule = getMap();
            if (mapModule && mapModule.setUserLocation) {
                mapModule.setUserLocation(userLocation);
            }
            
            console.log(`✅ Fresh location acquired: accuracy ±${location.accuracy}m`);
            return userLocation;
            
        } catch (error) {
            console.log('📍 Could not get location for proximity sorting:', error.message);
            
            // Show user-friendly message for location errors
            if (window.showSuccessToast && error.message.includes('allow location')) {
                window.showSuccessToast('💡 Tip: Allow location access for distance-sorted results');
            }
            
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
        window.currentSearchResults = pubs;
        
        // 🔧 FIX: Force reset map toggle state to ensure we start with list view
        const listContainer = document.getElementById('resultsListContainer');
        const mapContainer = document.getElementById('resultsMapContainer');
        const mapBtnText = document.getElementById('resultsMapBtnText');
        
        // Force reset to list view state
        if (listContainer) {
            listContainer.style.display = 'block';
            listContainer.style.flex = '1';
        }
        if (mapContainer) {
            mapContainer.style.display = 'none';
            mapContainer.classList.remove('split-view');
        }
        if (mapBtnText) {
            mapBtnText.textContent = 'Map';
        }
        
        // 🔧 FIX: Also reset the results overlay container classes
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay) {
            resultsOverlay.classList.remove('split-view');
        }
        
        console.log('🔄 Reset map toggle state to list view');
        
        // Hide loading and no results states
        const loadingEl = document.getElementById('resultsLoading');
        const noResultsEl = document.getElementById('noResultsFound');
        if (loadingEl) loadingEl.style.display = 'none';
        if (noResultsEl) noResultsEl.style.display = 'none';
        
        // Show and populate the results list
        const resultsList = document.getElementById('resultsList');
        if (resultsList) {
            resultsList.style.display = 'block';
            resultsList.innerHTML = '';
            
            // Generate results HTML
            pubs.forEach(pub => {
                const resultItem = createResultItemForOverlay(pub);
                resultsList.appendChild(resultItem);
            });
        }
        
        // Update title
        const titleEl = document.getElementById('resultsTitle');
        if (titleEl) {
            titleEl.textContent = title;
        }
        
        // Set up navigation button handlers AFTER results are displayed
        setupResultsNavigationHandlers();
        
        console.log(`✅ Displayed ${pubs.length} results with proper map state reset`);
    };
    
    // ================================
    // 🔧 REPLACE: In search.js - Enhanced map toggle handler
    // LOCATION: Find the setupResultsNavigationHandlers function (around line 750)
    // ACTION: Replace the map toggle handler with this enhanced version
    // ================================
    
    const setupResultsNavigationHandlers = () => {
        console.log('🔧 Setting up enhanced results navigation handlers...');
        
        // Home button handler (keep existing)
        const homeBtn = document.querySelector('[data-action="close-results"]');
        if (homeBtn) {
            homeBtn.onclick = null;
            homeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🏠 Home button clicked');
                
                const uiModule = window.App?.getModule('ui');
                if (uiModule && uiModule.closeResults) {
                    uiModule.closeResults();
                } else {
                    window.UtilsModule?.closeAllOverlaysAndGoHome?.();
                }
                
                const tracking = window.App?.getModule('tracking');
                if (tracking) {
                    tracking.trackEvent('close_results', 'Navigation', 'home_button');
                }
            });
            console.log('✅ Home button handler attached');
        }
    
    // 🔧 FIX: Enhanced map toggle button handler with proper container management
    const mapBtn = document.querySelector('[data-action="toggle-results-map"]');
        if (mapBtn) {
            mapBtn.onclick = null;
            mapBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🗺️ ENHANCED Map toggle button clicked');
                
                const listContainer = document.getElementById('resultsListContainer');
                const mapContainer = document.getElementById('resultsMapContainer');
                const mapBtnText = document.getElementById('resultsMapBtnText');
                
                console.log('📋 Container states:', {
                    list: listContainer?.style.display || 'default',
                    map: mapContainer?.style.display || 'default'
                });
                
                if (mapContainer && listContainer && mapBtnText) {
                    if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
                        // 🔧 FIX: Show map with proper cleanup first
                        console.log('🗺️ Switching to FULL-SCREEN map view...');
                        
                        // Clean up any existing map instance first
                        const mapModule = window.App?.getModule('map');
                        if (mapModule && mapModule.cleanupResultsMap) {
                            mapModule.cleanupResultsMap();
                        }
                        
                        // Hide list completely
                        listContainer.style.display = 'none';
                        
                        // Show map container with full-screen styling
                        mapContainer.style.display = 'block';
                        mapContainer.style.flex = '1';
                        mapContainer.style.height = '100%';
                        
                        // Update button text
                        mapBtnText.textContent = 'List';
                        
                        // Ensure no split-view classes are applied
                        mapContainer.classList.remove('split-view');
                        const resultsOverlay = document.getElementById('resultsOverlay');
                        if (resultsOverlay) {
                            resultsOverlay.classList.remove('split-view');
                        }
                        
                        // Initialize the results map with current search results
                        setTimeout(() => {
                            if (mapModule && mapModule.initResultsMap) {
                                console.log('🗺️ Initializing FULL-SCREEN results map with', currentSearchPubs?.length || 0, 'pubs...');
                                const map = mapModule.initResultsMap(currentSearchPubs);
                                if (map) {
                                    console.log('✅ FULL-SCREEN results map initialized successfully');
                                    
                                    // Force multiple size invalidations to ensure proper rendering
                                    setTimeout(() => map.invalidateSize(), 200);
                                    setTimeout(() => map.invalidateSize(), 500);
                                    setTimeout(() => map.invalidateSize(), 1000);
                                } else {
                                    console.error('❌ Failed to initialize results map');
                                }
                            } else {
                                console.error('❌ Map module not available');
                            }
                        }, 100);
                        
                        console.log('✅ FULL-SCREEN Map view activated');
                    } else {
                        // 🔧 FIX: Show list view with cleanup
                        console.log('📋 Switching to list view...');
                        
                        // Clean up map instance
                        const mapModule = window.App?.getModule('map');
                        if (mapModule && mapModule.cleanupResultsMap) {
                            mapModule.cleanupResultsMap();
                        }
                        
                        // Show list
                        listContainer.style.display = 'block';
                        listContainer.style.flex = '1';
                        
                        // Hide map
                        mapContainer.style.display = 'none';
                        
                        // Update button text
                        mapBtnText.textContent = 'Map';
                        
                        console.log('✅ List view activated');
                    }
                    
                    // Track the action
                    const tracking = window.App?.getModule('tracking');
                    if (tracking) {
                        tracking.trackEvent('results_map_toggle', 'Map Interaction', 
                            mapContainer.style.display === 'block' ? 'show_fullscreen' : 'hide');
                    }
                    
                    console.log('📊 Final container states:', {
                        list: listContainer.style.display,
                        map: mapContainer.style.display,
                        buttonText: mapBtnText.textContent
                    });
                }
            });
            
            console.log('✅ Enhanced map toggle button handler attached');
        }
        
        console.log('✅ Enhanced results navigation handlers setup complete');
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
        searchByName,  // 🔧 ENSURE this is exported
        
        // Area search
        searchByArea,  // 🔧 ENSURE this is exported
        
        // Beer search
        searchByBeer,  // 🔧 ENSURE this is exported
        
        // Specific pub
        searchSpecificPub,
        
        // Navigation
        goBackToResults,
    
        // Modal helpers
        closeSearchModal,
        displayResultsInOverlay,
        createResultItemForOverlay,
    
        // Restore functions
        restoreNameSearch,
        restoreAreaSearch,
        restoreBeerSearch,
        showPubDetails,
        
        // Get current results
        getCurrentResults: () => {
            console.log('📊 getCurrentResults called, returning:', currentSearchPubs?.length || 0, 'pubs');
            return currentSearchPubs || window.currentSearchResults || [];
        },
        getLastSearchState: () => lastSearchState
    };
})();

// Make it globally available
window.SearchModule = SearchModule;
