// ================================================================================
// SEARCH.JS - Simplified with Integrated Filter
// Handles: All search types, venue details, GF filtering
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const SearchModule = (function() {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        currentSearchVenues: [],
        gfOnly: true,
        filterSubscribers: new Set()
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get api() { return window.App?.getModule('api'); },
        get map() { return window.App?.getModule('map'); },
        get modalManager() { return window.App?.getModule('modalManager'); },
        get tracking() { return window.App?.getModule('tracking'); },
        get nav() { return window.App?.getModule('nav'); }
    };
    
    // ================================
    // GF FILTER (absorbed from filter-gf.js)
    // ================================
    const setGFFilter = (gfOnly) => {
        state.gfOnly = gfOnly;
        window.App.setState('gfOnlyFilter', gfOnly);
        
        // Notify subscribers and re-run current search if needed
        state.filterSubscribers.forEach(callback => callback(gfOnly));
        rerunCurrentSearch();
    };
    
    const isGFOnly = () => state.gfOnly;
    
    const filterVenues = (venues) => {
        if (!state.gfOnly) return venues;
        return venues.filter(venue => {
            const status = venue.gf_status || 'unknown';
            return ['always_tap_cask', 'always_bottle_can', 'currently'].includes(status);
        });
    };
    
    const subscribeToFilter = (callback) => {
        state.filterSubscribers.add(callback);
        return () => state.filterSubscribers.delete(callback);
    };
    
    // ================================
    // LOCATION UTILITIES
    // ================================
    const requestLocationWithUI = async () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            showLocationPermissionModal(resolve, reject);
        });
    };
    
    const showLocationPermissionModal = (resolve, reject) => {
        modules.modalManager?.open('locationPermissionModal');
        
        const handleAllow = () => {
            cleanup();
            getUserLocation().then(resolve).catch(reject);
        };
        
        const handleDeny = () => {
            cleanup();
            reject(new Error('Location permission denied'));
        };
        
        const cleanup = () => {
            modules.modalManager?.close('locationPermissionModal');
            document.removeEventListener('locationPermissionGranted', handleAllow);
            document.removeEventListener('locationPermissionDenied', handleDeny);
        };
        
        document.addEventListener('locationPermissionGranted', handleAllow);
        document.addEventListener('locationPermissionDenied', handleDeny);
    };
    
    const getUserLocation = () => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    
                    window.App.setState(STATE_KEYS.USER_LOCATION, location);
                    window.App.setState(STATE_KEYS.LOCATION_TIMESTAMP, Date.now());
                    resolve(location);
                },
                (error) => reject(new Error('Could not get location')),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
            );
        });
    };

    const ensureLoadingToastHidden = () => {
        if (window.hideLoadingToast) {
            window.hideLoadingToast();
        }
    };
    
    // ================================
    // SEARCH METHODS
    // ================================
    const searchNearbyWithDistance = async (radiusKm) => {
        try {
            modules.modalManager?.close('distanceModal');
            showResultsOverlay(`Venues within ${radiusKm}km`);
            showLoading('Getting your location...');
            
            let userLocation = window.App.getState(STATE_KEYS.USER_LOCATION);
            if (!userLocation) {
                userLocation = await requestLocationWithUI();
            }
            
            showLoading('Searching for venues...');
            const venues = await modules.api.findNearbyVenues(
                userLocation.lat, userLocation.lng, radiusKm, state.gfOnly
            );
            
            if (venues.length === 0) {
                showNoResults(`No venues found within ${radiusKm}km`);
                return;
            }
            
            // Store search state
            window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, 'nearby');
            window.App.setState(STATE_KEYS.LAST_SEARCH.RADIUS, radiusKm);
            
            state.currentSearchVenues = venues;
            displayResults(venues, `${venues.length} venues within ${radiusKm}km`);
            
        } catch (error) {
            console.error('❌ Nearby search error:', error);
            showNoResults('Could not get location. Try searching by area instead.');
        }
    };
    
    const searchByName = async () => {
        const query = document.getElementById('nameInput')?.value.trim();
        if (!query) return;
        
        modules.modalManager?.close('nameModal');
        await performTextSearch('name', query, 'name');
    };
    
    const searchByArea = async () => {
        const query = document.getElementById('areaInput')?.value.trim();
        const searchType = document.getElementById('areaSearchType')?.value;
        
        if (!query) return;
        
        modules.modalManager?.close('areaModal');
        
        if (searchType === 'postcode') {
            await performPostcodeSearch(query);
        } else {
            await performTextSearch('area', query, 'area');
        }
    };
    
    const searchByBeer = async () => {
        const query = document.getElementById('beerInput')?.value.trim();
        if (!query) return;
        
        modules.modalManager?.close('beerModal');
        await performTextSearch('beer', query, 'all');
    };
    
    const performTextSearch = async (type, query, searchType) => {
        try {
            showResultsOverlay(`Search: "${query}"`);
            showLoading('Searching venues...');
            
            const results = await modules.api.searchVenues({
                query: query,
                searchType: searchType,
                gfOnly: state.gfOnly
            });
            
            let venues = Array.isArray(results) ? results : results.venues || results.pubs || [];
            
            if (venues.length === 0) {
                showNoResults(`No venues found for "${query}"`);
                return;
            }
            
            // Store search state
            window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, type);
            window.App.setState(STATE_KEYS.LAST_SEARCH.QUERY, query);
            
            state.currentSearchVenues = venues;
            displayResults(venues, `${venues.length} venues for "${query}"`);
            
        } catch (error) {
            console.error(`❌ ${type} search error:`, error);
            showNoResults(`Error searching for "${query}"`);
        }
    };
    
    const performPostcodeSearch = async (postcode) => {
        try {
            showLoading('Finding postcode location...');
            const location = await modules.api.geocodePostcode(postcode);
            
            showLoading('Finding venues near postcode...');
            const venues = await modules.api.findNearbyVenues(
                location.lat, location.lng, 5, state.gfOnly
            );
            
            if (venues.length === 0) {
                showNoResults(`No venues found near ${postcode}`);
                return;
            }
            
            state.currentSearchVenues = venues;
            displayResults(venues, `${venues.length} venues near ${postcode}`);
            
        } catch (error) {
            showNoResults(`Could not find location for "${postcode}"`);
        }
    };
    
    const rerunCurrentSearch = () => {
        const lastSearch = {
            type: window.App.getState(STATE_KEYS.LAST_SEARCH.TYPE),
            query: window.App.getState(STATE_KEYS.LAST_SEARCH.QUERY),
            radius: window.App.getState(STATE_KEYS.LAST_SEARCH.RADIUS)
        };
        
        if (!lastSearch.type) return;
        
        if (lastSearch.type === 'nearby' && lastSearch.radius) {
            searchNearbyWithDistance(lastSearch.radius);
        } else if (lastSearch.query) {
            const input = document.getElementById(`${lastSearch.type}Input`);
            if (input) input.value = lastSearch.query;
            
            if (lastSearch.type === 'name') searchByName();
            else if (lastSearch.type === 'area') searchByArea();
            else if (lastSearch.type === 'beer') searchByBeer();
        }
    };
    
    // ================================
    // VENUE DETAILS
    // ================================
    const showVenueDetails = async (venueId) => {
        try {
            window.showLoadingToast?.('Loading venue details...');
            
            const results = await modules.api.searchVenues({ venueId: venueId });
            const venues = Array.isArray(results) ? results : results.venues || results.pubs;
            
            window.hideLoadingToast?.();
            
            if (venues && venues.length > 0) {
                const venue = venues[0];
                window.App.setState(STATE_KEYS.CURRENT_VENUE, venue);
                displayVenueDetails(venue);
                return venue;
            }
        } catch (error) {
            console.error('❌ Error loading venue:', error);
            window.hideLoadingToast?.();
        }
    };
    
    const displayVenueDetails = (venue) => {
        modules.modalManager.open('venueDetailsOverlay', {
            onOpen: () => {
                populateVenueDetails(venue);
                modules.nav?.setPageContext('venue');
            }
        });
    };
    
    const populateVenueDetails = (venue) => {
        const elements = {
            title: document.getElementById('venueDetailsTitle'),
            address: document.getElementById('venueDetailsAddress'),
            location: document.getElementById('venueDetailsLocation'),
            beer: document.getElementById('venueDetailsBeer'),
            status: document.getElementById('currentGFStatus')
        };
        
        if (elements.title) elements.title.textContent = venue.name;
        if (elements.address) elements.address.textContent = venue.address;
        if (elements.location) elements.location.textContent = `${venue.postcode} • ${venue.local_authority}`;
        
        setupBeerSection(venue, elements.beer);
        setupGFStatus(venue, elements.status);
    };
    
    const setupBeerSection = (venue, beerEl) => {
        const beerSection = document.getElementById('beerSection');
        if (!beerSection || !beerEl) return;
        
        const hasGFBeers = venue.beer_details || ['always_tap_cask', 'always_bottle_can', 'currently'].includes(venue.gf_status);
        
        if (hasGFBeers) {
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
        }
    };
    
    const setupGFStatus = (venue, statusEl) => {
        if (!statusEl) return;
        
        const status = venue.gf_status || 'unknown';
        const config = Constants.GF_STATUS_CONFIG[status];
        
        if (config) {
            statusEl.innerHTML = `
                <span class="status-icon">${config.icon}</span>
                <span class="status-text">${config.label}</span>
                <span class="status-meta">Updated recently</span>
            `;
        }
    };
    
    // ================================
    // UI HELPERS
    // ================================
    const showResultsOverlay = (title) => {
        console.log('📋 Showing results overlay:', title);
    
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
    
        modules.modalManager.open('resultsOverlay', {
            onOpen: () => {
                console.log('✅ Results overlay opened via ModalManager');
                
                // Update title - with safety check
                const resultsTitle = document.getElementById('resultsTitle');
                if (resultsTitle) {
                    resultsTitle.textContent = title;
                } else {
                    console.warn('resultsTitle element not found');
                }
                
                // Update navigation context
                modules.nav?.setPageContext('results');
                modules.nav?.showResultsWithContext?.();
    
                // Add the venue button
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
    
    const showLoading = (message) => {
        ensureLoadingToastHidden(); // Clean up first
        
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
        document.getElementById('resultsLoading').style.display = 'none';
        document.getElementById('resultsList').style.display = 'none';
        document.getElementById('noResultsFound').style.display = 'flex';
        document.querySelector('.no-results-text').textContent = message;
    };
    
    const displayResults = (venues, title) => {
        state.currentSearchVenues = venues;
        
        document.getElementById('resultsLoading').style.display = 'none';
        document.getElementById('noResultsFound').style.display = 'none';
        document.getElementById('resultsList').style.display = 'block';
        document.getElementById('resultsTitle').textContent = title;
        
        const resultsList = document.getElementById('resultsList');
        resultsList.innerHTML = '';
        
        venues.forEach(venue => {
            const resultItem = createResultItem(venue);
            resultsList.appendChild(resultItem);
        });
    };
    
    const createResultItem = (venue) => {
        const template = document.getElementById('venue-result-template');
        const clone = template.content.cloneNode(true);
        
        clone.querySelector('.result-title').textContent = venue.name;
        clone.querySelector('.result-address').textContent = venue.address;
        clone.querySelector('.result-postcode').textContent = venue.postcode;
        clone.querySelector('.result-authority').textContent = venue.local_authority;
        
        const gfIndicator = clone.querySelector('.gf-indicator');
        const status = venue.gf_status || 'unknown';
        const config = Constants.GF_STATUS_CONFIG[status];
        
        if (config) {
            gfIndicator.textContent = `${config.icon} ${config.label}`;
            gfIndicator.className = `gf-indicator ${status}`;
        }
        
        const viewButton = clone.querySelector('[data-action="view-venue"]');
        viewButton.dataset.venueId = venue.venue_id;
        
        return clone;
    };
    
    // ================================
    // SIMPLIFIED PLACES SEARCH
    // ================================
    const PlacesSearchModule = {
        selectedPlace: null,
        
        async searchOSM(query) {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' venue UK')}&format=json&countrycodes=gb&limit=10`
                );
                const places = await response.json();
                this.displayResults(places);
            } catch (error) {
                console.error('OSM search error:', error);
            }
        },
        
        displayResults(places) {
            const resultsDiv = document.getElementById('placesResults');
            if (!places.length) {
                resultsDiv.innerHTML = '<div class="no-places-found"><p>No venues found</p></div>';
                return;
            }
            
            resultsDiv.innerHTML = places.map((place, index) => `
                <div class="place-result" data-action="select-place" data-place-index="${index}">
                    <strong>${place.display_name.split(',')[0]}</strong>
                    <small>${place.display_name}</small>
                </div>
            `).join('');
        },
        
        async submitNewVenue(venueData) {
            try {
                const response = await fetch('/api/add-venue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...venueData,
                        submitted_by: window.App.getState('userNickname') || 'Anonymous'
                    })
                });
                
                const result = await response.json();
                window.showSuccessToast?.(`✅ ${venueData.name} added successfully!`);
                return result;
            } catch (error) {
                console.error('❌ Error adding venue:', error);
                window.showSuccessToast?.('❌ Failed to add venue');
            }
        }
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        // Search methods
        searchNearbyWithDistance,
        searchByName,
        searchByArea,
        searchByBeer,
        
        // Venue details
        showVenueDetails,
        
        // Filter methods (absorbed from filter-gf.js)
        setGFFilter,
        isGFOnly,
        filterVenues,
        subscribeToFilter,
        
        // Location
        requestLocationWithUI,
        
        // Sub-modules
        PlacesSearchModule,
        
        // State getters
        getCurrentResults: () => state.currentSearchVenues
    };
})();
