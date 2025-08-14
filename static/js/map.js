// ================================================================================
// MAP.JS - Complete Refactor with STATE_KEYS and Arrow Functions
// Handles: Map initialization, markers, user location, venue locations
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const MapModule = (() => {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const maps = {
        main: null,
        results: null,
        venueDetail: null
    };
    
    const config = {
        defaultCenter: [54.5, -3], // UK center
        defaultZoom: 6,
        maxZoom: 19,
        venueMarkerRadius: 8,
        userMarkerRadius: 8,
        tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        clusterConfig: {
            maxClusterRadius: 40,
            disableClusteringAtZoom: 12,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false
        }
    };
    
    // Cache DOM queries
    let cachedStyles = null;
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get api() { return window.App?.getModule('api'); },
        get search() { return window.App?.getModule('search'); },
        get tracking() { return window.App?.getModule('tracking'); }
    };
    
    // ================================
    // UTILITIES
    // ================================
    const utils = {
        getUserLocation: () => window.App.getState(STATE_KEYS.USER_LOCATION),
        
        setUserLocation: (location) => {
            window.App.setState(STATE_KEYS.USER_LOCATION, location);
            window.App.setState(STATE_KEYS.LOCATION_TIMESTAMP, Date.now());
            
            // Update all active maps with user location
            Object.values(maps).forEach(map => {
                if (map) utils.addUserMarkerToMap(map, location);
            });
        },
        
        addUserMarkerToMap: (map, location) => {
            if (!map || !location) return;
            
            const styles = getMapStyles();
            L.circleMarker([location.lat, location.lng], {
                radius: config.userMarkerRadius,
                fillColor: styles.userFillColor,
                color: styles.userStrokeColor,
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8,
                zIndexOffset: 1000
            }).addTo(map).bindPopup('📍 You are here!');
        },
        
        calculateDistance: (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        },
        
        escapeHtml: (text) => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        cleanupMap: (mapInstance) => {
            if (mapInstance) {
                try {
                    mapInstance.remove();
                } catch (error) {
                    console.warn('Error cleaning up map:', error);
                }
            }
        }
    };
    
    // ================================
    // STYLE MANAGEMENT
    // ================================
    const getMapStyles = () => {
        if (!cachedStyles) {
            const rootStyles = getComputedStyle(document.documentElement);
            cachedStyles = {
                venueFillColor: rootStyles.getPropertyValue('--marker-venue-fill').trim() || '#4CAF50',
                venueStrokeColor: rootStyles.getPropertyValue('--marker-venue-stroke').trim() || '#ffffff',
                userFillColor: rootStyles.getPropertyValue('--marker-user-fill').trim() || '#667eea',
                userStrokeColor: rootStyles.getPropertyValue('--marker-user-stroke').trim() || '#ffffff',
                alwaysGfFill: rootStyles.getPropertyValue('--always-gf-fill').trim(),
                alwaysGfBorder: rootStyles.getPropertyValue('--always-gf-border').trim(),
                currentlyGfFill: rootStyles.getPropertyValue('--currently-gf-fill').trim(),
                currentlyGfBorder: rootStyles.getPropertyValue('--currently-gf-border').trim(),
                noGfFill: rootStyles.getPropertyValue('--no-gf-fill').trim(),
                noGfBorder: rootStyles.getPropertyValue('--no-gf-border').trim(),
                unknownGfFill: rootStyles.getPropertyValue('--unknown-gf-fill').trim(),
                unknownGfBorder: rootStyles.getPropertyValue('--unknown-gf-border').trim()
            };
        }
        return cachedStyles;
    };
    
    const getMarkerStyleForGFStatus = (gfStatus) => {
        const styles = getMapStyles();
        const baseStyle = {
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
            radius: config.venueMarkerRadius
        };
        
        const statusStyles = {
            'always_tap_cask': {
                fillColor: styles.alwaysTapCaskFill || '#FFD700',  // Gold fallback
                color: styles.alwaysTapCaskBorder || '#FDB904',    // Dark gold fallback
                radius: 12,
                weight: 4,
                className: 'always-tap-cask-marker',
                fillOpacity: 1
            },
            'always_bottle_can': {
                fillColor: styles.alwaysBottleCanFill || '#00F500',  // Green fallback
                color: styles.alwaysBottleCanBorder || '#00C400',    // Dark green fallback
                radius: 10,
                weight: 3,
                className: 'always-bottle-can-marker'
            },
            'currently': {
                fillColor: styles.currentlyFill || '#3B82F6',        // Blue fallback
                color: styles.currentlyBorder || '#2563EB'           // Dark blue fallback
            },
            'not_currently': {
                fillColor: styles.notCurrentlyFill || '#EF4444',     // Red fallback
                color: styles.notCurrentlyBorder || '#DC2626',       // Dark red fallback
                fillOpacity: 0.7
            },
            'unknown': {
                fillColor: styles.unknownFill || '#9CA3AF',          // Grey fallback
                color: styles.unknownBorder || '#6B7280',            // Dark grey fallback
                fillOpacity: 0.6
            }
        };
        
        return { ...baseStyle, ...(statusStyles[gfStatus] || statusStyles.unknown) };
    };
    
    // ================================
    // MAP INITIALIZATION
    // ================================
    const createMap = (containerId, options = {}) => {
        const mapElement = document.getElementById(containerId);
        if (!mapElement) {
            console.error(`Map container '${containerId}' not found`);
            return null;
        }
        
        const userLocation = utils.getUserLocation();
        const center = options.center || (userLocation ? [userLocation.lat, userLocation.lng] : config.defaultCenter);
        const zoom = options.zoom || (userLocation ? 12 : config.defaultZoom);
        
        const map = L.map(containerId, {
            zoomControl: true,
            attributionControl: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true,
            ...options.mapOptions
        }).setView(center, zoom);
        
        L.tileLayer(config.tileLayer, {
            maxZoom: config.maxZoom,
            attribution: config.attribution
        }).addTo(map);
        
        if (userLocation && options.showUserLocation !== false) {
            utils.addUserMarkerToMap(map, userLocation);
        }
        
        return map;
    };
    
    // ================================
    // MAIN MAP
    // ================================
    const initMainMap = (containerId = 'map') => {
        console.log('🗺️ Initializing main map...');
        
        utils.cleanupMap(maps.main);
        maps.main = createMap(containerId);
        
        if (maps.main) {
            console.log('✅ Main map initialized');
        }
        
        return maps.main;
    };
    
    // ================================
    // RESULTS MAP
    // ================================
    const initResultsMap = (searchVenues = null) => {
        console.log('🗺️ Initializing results map...');
        
        const mapElement = document.getElementById('resultsMap');
        if (!mapElement) {
            console.error('Results map element not found');
            return null;
        }
        
        // Clean up existing map
        utils.cleanupMap(maps.results);
        mapElement.innerHTML = '';
        
        setTimeout(() => {
            try {
                maps.results = createMap('resultsMap');
                
                if (!maps.results) {
                    throw new Error('Failed to create results map');
                }
                
                // Get search venues
                let venues = searchVenues;
                if (!venues) {
                    const searchModule = modules.search;
                    venues = searchModule?.getCurrentResults() || [];
                }
                
                if (venues.length > 0) {
                    // Add main search results with prominent markers
                    const bounds = [];
                    venues.forEach(venue => {
                        if (venue.latitude && venue.longitude) {
                            const lat = parseFloat(venue.latitude);
                            const lng = parseFloat(venue.longitude);
                            
                            const gfStatus = determineGFStatus(venue);
                            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
                            
                            // Make search results more prominent
                            markerStyle.radius = markerStyle.radius * 1.5;
                            markerStyle.weight = markerStyle.weight + 2;
                            
                            const marker = L.circleMarker([lat, lng], markerStyle).addTo(maps.results);
                            const popupContent = createVenuePopupContent(venue, gfStatus);
                            marker.bindPopup(popupContent);
                            
                            bounds.push([lat, lng]);
                        }
                    });
                    
                    // For name/beer searches, also show nearby venues in grey (for context)
                    const lastSearch = window.App.getState(STATE_KEYS.LAST_SEARCH.TYPE);
                    if (lastSearch === 'name' || lastSearch === 'beer') {
                        // Get the general area of results
                        if (bounds.length > 0) {
                            const centerLat = bounds.reduce((sum, b) => sum + b[0], 0) / bounds.length;
                            const centerLng = bounds.reduce((sum, b) => sum + b[1], 0) / bounds.length;
                            
                            // Add a subtle message
                            const contextControl = L.control({position: 'topright'});
                            contextControl.onAdd = function(map) {
                                const div = L.DomUtil.create('div', 'map-context-info');
                                div.innerHTML = `
                                    <div style="background: white; padding: 8px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                        <strong>${venues.length}</strong> matching venues (larger markers)<br>
                                        <small style="color: #666;">Grey markers show other nearby venues</small>
                                    </div>
                                `;
                                return div;
                            };
                            contextControl.addTo(maps.results);
                            
                            // You could load nearby venues here if you want
                            // But for now, let's just show the search results prominently
                        }
                    }
                    
                    // Fit bounds to show all results
                    if (bounds.length > 0) {
                        if (bounds.length === 1) {
                            maps.results.setView(bounds[0], 15);
                        } else {
                            maps.results.fitBounds(bounds, { padding: [20, 20] });
                        }
                    }
                    
                    console.log(`✅ Added ${venues.length} venue markers to map`);
                }
                
                // Add controls
                addLocationButton(maps.results);
                addMapLegend(maps.results);
                
                // Force render
                setTimeout(() => {
                    if (maps.results) {
                        maps.results.invalidateSize();
                    }
                }, 100);
                
                console.log('✅ Results map initialized');
                
            } catch (error) {
                console.error('❌ Error creating results map:', error);
                mapElement.innerHTML = '<div style="padding: 20px; text-align: center;">Error loading map. Please try again.</div>';
            }
        }, 50);
        
        return maps.results;
    };
    
    const cleanupResultsMap = () => {
        console.log('🧹 Cleaning up results map...');
        utils.cleanupMap(maps.results);
        maps.results = null;
        
        const mapElement = document.getElementById('resultsMap');
        if (mapElement) mapElement.innerHTML = '';
    };
    
    // ================================
    // VENUE DETAIL MAP
    // ================================
    const initVenueDetailMap = (venue) => {
        console.log('🗺️ Initializing venue detail map for:', venue.name);
        
        const mapContainer = document.querySelector('.venue-map-placeholder');
        if (!mapContainer) {
            console.error('❌ Venue map container not found');
            return null;
        }
        
        if (!venue.latitude || !venue.longitude) {
            showNoLocationMessage(mapContainer, venue.name);
            return null;
        }
        
        // Create map container
        mapContainer.innerHTML = '<div id="venueMapLeaflet" style="width: 100%; height: 100%;"></div>';
        
        try {
            utils.cleanupMap(maps.venueDetail);
            
            maps.venueDetail = createMap('venueMapLeaflet', {
                center: [parseFloat(venue.latitude), parseFloat(venue.longitude)],
                zoom: 16
            });
            
            if (!maps.venueDetail) {
                throw new Error('Failed to create venue detail map');
            }
            
            // Add venue marker
            const gfStatus = determineGFStatus(venue);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            const venueMarker = L.circleMarker(
                [parseFloat(venue.latitude), parseFloat(venue.longitude)], 
                { ...markerStyle, radius: 12 }
            ).addTo(maps.venueDetail);
            
            const popupContent = createVenuePopupContent(venue, gfStatus);
            venueMarker.bindPopup(popupContent).openPopup();
            
            // Force render
            setTimeout(() => {
                if (maps.venueDetail) {
                    maps.venueDetail.invalidateSize();
                }
            }, 150);
            
            console.log('✅ Venue detail map initialized');
            return maps.venueDetail;
            
        } catch (error) {
            console.error('❌ Error creating venue detail map:', error);
            showMapError(mapContainer, error.message);
            return null;
        }
    };
    
    const showNoLocationMessage = (container, venueName) => {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center; color: var(--text-secondary);">
                <div style="font-size: 2rem; margin-bottom: 10px;">📍</div>
                <div style="font-weight: 600; margin-bottom: 5px;">Location coordinates not available</div>
                <div style="font-size: 0.9rem; opacity: 0.7;">Help us by reporting the exact location!</div>
            </div>
        `;
    };
    
    const showMapError = (container, errorMessage) => {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center; color: var(--text-secondary);">
                <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
                <div style="font-weight: 600; margin-bottom: 5px;">Map Error</div>
                <div style="font-size: 0.9rem; opacity: 0.7;">${errorMessage}</div>
            </div>
        `;
    };
    
    // ================================
    // MARKER MANAGEMENT
    // ================================
    const addVenueMarkers = (venues, mapInstance) => {
        if (!mapInstance || !venues || venues.length === 0) return 0;
        
        console.log(`📍 Adding ${venues.length} venue markers...`);
        
        const bounds = [];
        let markersAdded = 0;
        
        venues.forEach(venue => {
            if (venue.latitude && venue.longitude && 
                !isNaN(parseFloat(venue.latitude)) && 
                !isNaN(parseFloat(venue.longitude))) {
                
                const lat = parseFloat(venue.latitude);
                const lng = parseFloat(venue.longitude);
                
                const gfStatus = determineGFStatus(venue);
                const markerStyle = getMarkerStyleForGFStatus(gfStatus);
                
                const marker = L.circleMarker([lat, lng], markerStyle).addTo(mapInstance);
                const popupContent = createVenuePopupContent(venue, gfStatus);
                marker.bindPopup(popupContent);
                
                bounds.push([lat, lng]);
                markersAdded++;
            }
        });
        
        // Auto-zoom to show all markers
        if (markersAdded > 0 && bounds.length > 0) {
            if (bounds.length === 1) {
                mapInstance.setView(bounds[0], 15);
            } else {
                mapInstance.fitBounds(bounds, { padding: [20, 20] });
            }
        }
        
        return markersAdded;
    };
    
    const determineGFStatus = (venue) => {
        if (venue.gf_status) return venue.gf_status;
        if (venue.bottle || venue.tap || venue.cask || venue.can) return 'currently';
        return 'unknown';
    };
    
    const createVenuePopupContent = (venue, gfStatus = null) => {
        if (!gfStatus) gfStatus = determineGFStatus(venue);
        
        let content = `<div class="popup-content">`;
        content += `<div class="popup-title">${utils.escapeHtml(venue.name)}</div>`;
        
        if (venue.address) {
            content += `<div class="popup-address">${utils.escapeHtml(venue.address)}</div>`;
        }
        content += `<div class="popup-postcode">${utils.escapeHtml(venue.postcode)}</div>`;
        
        if (venue.distance !== undefined) {
            content += `<div class="popup-distance">${venue.distance.toFixed(1)}km away</div>`;
        }
        
        // GF status
        const statusMessages = {
            'always': '✅ Always has GF beer',
            'currently': '✅ GF Available',
            'not_currently': '❌ No GF Options',
            'unknown': '❓ GF Status Unknown'
        };
        
        const statusClasses = {
            'always': 'always-gf',
            'currently': 'current-gf',
            'not_currently': 'no-gf',
            'unknown': 'unknown'
        };
        
        content += `<div class="popup-gf-status ${statusClasses[gfStatus]}">${statusMessages[gfStatus]}</div>`;
        
        if ((gfStatus === 'always' || gfStatus === 'currently') && (venue.bottle || venue.tap || venue.cask || venue.can)) {
            const formats = [];
            if (venue.bottle) formats.push('🍺');
            if (venue.tap) formats.push('🚰');
            if (venue.cask) formats.push('🛢️');
            if (venue.can) formats.push('🥫');
            content += `<div class="popup-formats">${formats.join(' ')}</div>`;
        }
        
        content += `<button class="popup-button" data-action="view-venue-from-map" data-venue-id="${venue.venue_id}">View Details</button>`;
        content += `</div>`;
        
        return content;
    };
    
    // ================================
    // FULL UK MAP
    // ================================
    const initFullUKMap = async () => {
        console.log('🗺️ Initializing full UK map...');
        
        const mapElement = document.getElementById('fullMap');
        if (!mapElement) {
            console.error('Full map element not found');
            return null;
        }
        
        // Clean up existing map
        const existingMap = window.App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
        if (existingMap) {
            utils.cleanupMap(existingMap);
            window.App.setState(STATE_KEYS.MAP_DATA.FULL_UK_MAP, null);
        }
        
        // Get or request user location
        let userLocation = utils.getUserLocation();
        if (!userLocation) {
            try {
                const searchModule = modules.search;
                if (searchModule?.requestLocationWithUI) {
                    userLocation = await searchModule.requestLocationWithUI();
                    utils.setUserLocation(userLocation);
                }
            } catch (error) {
                console.log('📍 Could not get user location:', error);
            }
        }
        
        // Create map
        const fullUKMap = createMap('fullMap', {
            center: userLocation ? [userLocation.lat, userLocation.lng] : config.defaultCenter,
            zoom: userLocation ? 12 : config.defaultZoom
        });
        
        if (!fullUKMap) {
            console.error('Failed to create full UK map');
            return null;
        }
        
        // Store map instance
        window.App.setState(STATE_KEYS.MAP_DATA.FULL_UK_MAP, fullUKMap);
        
        // Add user marker if location available
        if (userLocation) {
            const styles = getMapStyles();
            const userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
                radius: 10,
                fillColor: styles.userFillColor,
                color: styles.userStrokeColor,
                weight: 3,
                opacity: 1,
                fillOpacity: 0.9,
                zIndexOffset: 1000
            }).addTo(fullUKMap);
            
            userMarker.bindPopup('📍 You are here!').openPopup();
            window.App.setState(STATE_KEYS.MAP_DATA.USER_MARKER, userMarker);
        }
        
        // Add controls
        addLocationButton(fullUKMap);
        addMapLegend(fullUKMap);
        addZoomHint(fullUKMap);
        
        // Load venues
        await loadAllVenuesOnMap();
        
        // Force render
        setTimeout(() => {
            const map = window.App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
            if (map) map.invalidateSize();
        }, 150);
        
        console.log('✅ Full UK map initialized');
        return fullUKMap;
    };
    
    const loadAllVenuesOnMap = async () => {
        console.log('📍 Loading UK venues...');
        
        try {
            // Check cache first
            const cachedVenues = window.App.getState(STATE_KEYS.MAP_DATA.ALL_VENUES);
            if (cachedVenues && cachedVenues.length > 0) {
                console.log('✅ Using cached venue data');
                updateMapDisplay(true);
                return;
            }
            
            // Show loading message
            if (window.showLoadingToast) {
                window.showLoadingToast('Loading venues across the UK...');
            }
            
            // Fetch data with better error handling
            const response = await fetch('/api/all-venues', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.error(`❌ Server error: ${response.status} ${response.statusText}`);
                
                // Try to get error details
                let errorMessage = `Server error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // Response wasn't JSON
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            
            if (!data.success || !data.venues) {
                throw new Error(data.error || 'Invalid response format');
            }
            
            // Store in state
            window.App.setState(STATE_KEYS.MAP_DATA.ALL_VENUES, data.venues || []);
            
            const allVenues = window.App.getState(STATE_KEYS.MAP_DATA.ALL_VENUES);
            console.log(`📊 Loaded ${allVenues.length} venues`);
            
            // Update display
            updateMapDisplay(true);
            
            // Show success notification
            const gfCount = allVenues.filter(p => 
                p.gf_status === 'always_tap_cask' || 
                p.gf_status === 'always_bottle_can' || 
                p.gf_status === 'currently'
            ).length;
            
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Loaded ${allVenues.length} venues (${gfCount} with GF beer)`);
            }
            
        } catch (error) {
            console.error('❌ Error loading venues:', error);
            
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
            
            // Show user-friendly error with retry option
            const errorMessage = error.message.includes('500') ? 
                'Server temporarily unavailable. Please try again.' : 
                'Could not load venue data. Please check your connection.';
                
            if (window.showErrorToast) {
                window.showErrorToast(errorMessage);
            } else if (window.showSuccessToast) {
                window.showSuccessToast(`❌ ${errorMessage}`);
            }
            
            // Show retry button on map
            showMapRetryButton();
        }
    };

    const cleanupFullUKMap = () => {
        console.log('🧹 Cleaning up full UK map...');
        
        const fullUKMap = window.App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
        if (fullUKMap) {
            utils.cleanupMap(fullUKMap);
            window.App.setState(STATE_KEYS.MAP_DATA.FULL_UK_MAP, null);
        }
    };

    const showMapRetryButton = () => {
        const map = window.App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
        if (!map) return;
        
        // Create custom control for retry
        const RetryControl = L.Control.extend({
            options: {
                position: 'topright'
            },
            
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'map-retry-container');
                
                const content = L.DomUtil.create('div', 'map-retry-content', container);
                
                const icon = L.DomUtil.create('div', 'retry-icon', content);
                icon.textContent = '⚠️';
                
                const message = L.DomUtil.create('p', '', content);
                message.textContent = 'Could not load venue data';
                
                const button = L.DomUtil.create('button', 'btn btn-primary', content);
                button.textContent = '🔄 Try Again';
                button.addEventListener('click', () => {
                    window.App.getModule('map').retryLoadVenues();
                });
                
                // Prevent map interactions on this control
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                return container;
            }
        });
        
        // Add control to map
        try {
            const control = new RetryControl();
            map.addControl(control);
            
            // Store reference so we can remove it later
            window.App.setState('mapRetryControl', control);
        } catch (error) {
            console.error('Error adding retry control:', error);
        }
    };
    
    // Add retry function to venuelic API
    const retryLoadVenues = async () => {
        // Remove retry control properly
        const map = window.App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
        const retryControl = window.App.getState('mapRetryControl');
        
        if (map && retryControl) {
            try {
                map.removeControl(retryControl);
            } catch (e) {
                // Control might already be removed
            }
            window.App.setState('mapRetryControl', null);
        }
        
        // Try loading again
        await loadAllVenuesOnMap();
    };
    
    // ================================
    // MAP CONTROLS
    // ================================

    
    // ADD this function to your map.js file in the MAP CONTROLS section:
    
    const addLocationButton = (mapInstance) => {
        const LocationControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                
                const button = L.DomUtil.create('a', 'map-location-btn', container);
                button.href = '#';
                button.title = 'Go to my location';
                button.innerHTML = '📍';
                button.setAttribute('role', 'button');
                button.setAttribute('aria-label', 'Go to my location');
                
                L.DomEvent.disableClickPropagation(button);
                L.DomEvent.on(button, 'click', function(e) {
                    L.DomEvent.preventDefault(e);
                    goToUserLocation(map);
                });
                
                return container;
            }
        });
        
        mapInstance.addControl(new LocationControl());
    };
    
    const goToUserLocation = (map) => {
        const location = utils.getUserLocation();
        
        if (!location) {
            // Try to get location
            const searchModule = modules.search;
            if (searchModule?.requestLocationWithUI) {
                searchModule.requestLocationWithUI().then(newLocation => {
                    if (newLocation) {
                        utils.setUserLocation(newLocation);
                        map.setView([newLocation.lat, newLocation.lng], 14);
                        
                        // Flash the user marker
                        const userMarker = window.App.getState(STATE_KEYS.MAP_DATA.USER_MARKER);
                        if (userMarker) {
                            userMarker.openPopup();
                        }
                    }
                }).catch(error => {
                    if (window.showSuccessToast) {
                        window.showSuccessToast('📍 Location not available');
                    }
                });
            }
            return;
        }
        
        // Animate to user location
        map.setView([location.lat, location.lng], 14, {
            animate: true,
            duration: 0.5
        });
        
        // Flash the user marker if it exists
        const userMarker = window.App.getState(STATE_KEYS.MAP_DATA.USER_MARKER);
        if (userMarker) {
            userMarker.openPopup();
        }
        
        modules.tracking?.trackEvent('go_to_location', 'Map', 'button_click');
    };
    
    const addMapLegend = (mapInstance) => {
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = (map) => {
            // Use the existing template instead of creating from scratch
            const template = document.getElementById('map-legend-template');
            if (template) {
                const legendContent = template.content.cloneNode(true);
                const container = L.DomUtil.create('div', 'legend-container');
                container.appendChild(legendContent);
                return container;
            }
            
            // Fallback if template not found
            console.warn('Map legend template not found, using fallback');
            const container = L.DomUtil.create('div', 'legend-container');
            container.innerHTML = '<div class="map-legend"><div class="legend-title">🍺 GF Beer Status</div></div>';
            return container;
        };
        
        legend.addTo(mapInstance);
    };
    
    const addZoomHint = (mapInstance) => {
        const hintControl = L.Control.extend({
            options: { position: 'topright' },
            
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'zoom-hint-container');
                container.innerHTML = `
                    <div class="zoom-hint">
                        <span class="zoom-hint-icon">💡</span>
                        <span class="zoom-hint-text">Zoom in to discover more venues</span>
                    </div>
                `;
                
                const updateHintVisibility = () => {
                    container.style.display = map.getZoom() < 9 ? 'block' : 'none';
                };
                
                updateHintVisibility();
                map.on('zoomend', updateHintVisibility);
                
                return container;
            }
        });
        
        mapInstance.addControl(new hintControl());
    };
    
    // ================================
    // MAP TOGGLE FUNCTIONALITY
    // ================================
    const initMapToggle = () => {
        const container = document.getElementById('mapToggleContainer');
        if (!container) return;
        
        const options = container.querySelectorAll('.toggle-option');
        const thumb = document.getElementById('toggleThumb');
        let currentMode = 'gf';
        
        const updateThumb = () => {
            const activeOption = container.querySelector('.toggle-option.active');
            if (activeOption && thumb) {
                thumb.style.width = `${activeOption.offsetWidth}px`;
                thumb.style.transform = `translateX(${activeOption.offsetLeft}px)`;
            }
        };
        
        setTimeout(updateThumb, 100);
        
        options.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value;
                if (value === currentMode) return;
                
                options.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                currentMode = value;
                
                updateThumb();
                updateMapDisplay(value === 'gf');
                
                const trackingModule = modules.tracking;
                if (trackingModule) {
                    trackingModule.trackEvent('map_toggle', 'Map Interaction', value);
                }
            });
        });
        
        updateMapDisplay(true);
        setupZoomHandler();
    };
    
    const updateMapDisplay = (showGFOnly) => {
        const fullUKMap = window.App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
        const allVenues = window.App.getState(STATE_KEYS.MAP_DATA.ALL_VENUES);
        if (!fullUKMap || !allVenues) return;
        
        console.log(`🍺 Updating map: ${showGFOnly ? 'GF Venues Only' : 'All Venues'}`);
        
        // Clear existing layers
        clearMapLayers(fullUKMap);
        
        if (showGFOnly) {
            displayGFVenuesOnly(fullUKMap, allVenues);
        } else {
            displayAllVenuesClustered(fullUKMap, allVenues);
        }
    };
    
    const clearMapLayers = (map) => {
        const layers = {
            gf: window.App.getState(STATE_KEYS.MAP_DATA.GF_VENUES_LAYER),
            clustered: window.App.getState(STATE_KEYS.MAP_DATA.CLUSTERED_VENUES_LAYER)
        };
        
        Object.values(layers).forEach(layer => {
            if (layer && map) map.removeLayer(layer);
        });
    };
    
    const displayGFVenuesOnly = (map, allVenues) => {
        const gfVenuesLayer = L.layerGroup().addTo(map);
        window.App.setState(STATE_KEYS.MAP_DATA.GF_VENUES_LAYER, gfVenuesLayer);
        
        const gfVenues = allVenues.filter(venue => 
            venue.gf_status === 'always_tap_cask' || 
            venue.gf_status === 'always_bottle_can' || 
            venue.gf_status === 'currently'
        );
        
        console.log(`📍 Showing ${gfVenues.length} GF venues only`);
        
        gfVenues.forEach(venue => {
            if (!venue.latitude || !venue.longitude) return;
            
            const lat = parseFloat(venue.latitude);
            const lng = parseFloat(venue.longitude);
            const gfStatus = determineGFStatus(venue);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            const marker = L.circleMarker([lat, lng], markerStyle);
            const popupContent = createVenuePopupContent(venue, gfStatus);
            marker.bindPopup(popupContent);
            
            gfVenuesLayer.addLayer(marker);
        });
    };
    
    const displayAllVenuesClustered = (map, allVenues) => {
        // Clear previous layers
        const gfVenuesLayer = L.layerGroup().addTo(map);
        window.App.setState(STATE_KEYS.MAP_DATA.GF_VENUES_LAYER, gfVenuesLayer);
        
        const clusteredVenuesLayer = L.markerClusterGroup({
            ...config.clusterConfig,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                let size = 'small';
                
                if (count > 100) size = 'large';
                else if (count > 50) size = 'medium';
                
                return L.divIcon({
                    html: `<div><span>${count}</span></div>`,
                    className: `marker-cluster marker-cluster-${size}`,
                    iconSize: L.point(30, 30)
                });
            }
        }).addTo(map);
        
        window.App.setState(STATE_KEYS.MAP_DATA.CLUSTERED_VENUES_LAYER, clusteredVenuesLayer);
        
        // Add ALL venues to cluster layer
        allVenues.forEach(venue => {
            if (!venue.latitude || !venue.longitude) return;
            
            const lat = parseFloat(venue.latitude);
            const lng = parseFloat(venue.longitude);
            const gfStatus = determineGFStatus(venue);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            // Create marker
            const marker = L.circleMarker([lat, lng], markerStyle);
            marker.options.venueId = venue.venue_id;
            
            const popupContent = createVenuePopupContent(venue, gfStatus);
            marker.bindPopup(popupContent);
            
            // Add GF venues to their own layer, others to cluster
            if (gfStatus === 'always_tap_cask' || gfStatus === 'always_bottle_can' || gfStatus === 'currently') {
                gfVenuesLayer.addLayer(marker);
            } else {
                clusteredVenuesLayer.addLayer(marker);
            }
        });
        
        console.log(`📊 Displayed ${allVenues.length} total venues`);
    };
    
    const setupZoomHandler = () => {
        const fullUKMap = window.App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
        if (!fullUKMap) return;
        
        fullUKMap.off('zoomend');
        
        let zoomTimeout;
        fullUKMap.on('zoomend', () => {
            clearTimeout(zoomTimeout);
            zoomTimeout = setTimeout(() => {
                const zoom = fullUKMap.getZoom();
                console.log(`🔍 Zoom level: ${zoom}`);
                
                const activeOption = document.querySelector('.toggle-option.active');
                const currentMode = activeOption?.dataset.value || 'gf';
                
                updateMapDisplay(currentMode === 'gf');
            }, 300);
        });
    };
    
    // ================================
    // TOGGLE RESULTS MAP
    // ================================
    const toggleSearchResultsFullMap = () => {
        const elements = {
            list: document.getElementById('resultsListContainer'),
            map: document.getElementById('resultsMapContainer'),
            btnText: document.getElementById('resultsMapBtnText')
        };
        
        if (!elements.list || !elements.map || !elements.btnText) {
            console.error('❌ Required elements not found');
            return;
        }
        
        if (elements.map.style.display === 'none' || !elements.map.style.display) {
            // Show map
            console.log('🗺️ Showing results map');
            cleanupResultsMap();
            
            elements.list.style.display = 'none';
            elements.map.style.display = 'block';
            elements.map.style.flex = '1';
            elements.map.style.height = '100%';
            elements.map.style.minHeight = '400px';
            elements.map.style.width = '100%';
            elements.map.style.position = 'relative';
            
            elements.btnText.textContent = 'List';
            
            // Force layout
            elements.map.offsetHeight;
            
            // Initialize map with CURRENT SEARCH RESULTS, not all venues
            setTimeout(() => {
                const searchModule = modules.search;
                const venues = searchModule?.getCurrentResults() || window.App?.getState('searchResults') || [];
                console.log(`🗺️ Initializing results map with ${venues.length} venues from current search`);
                initResultsMap(venues);
            }, 50);
            
            // Track event
            const trackingModule = modules.tracking;
            if (trackingModule) {
                trackingModule.trackEvent('results_map_toggle', 'Map Interaction', 'show');
            }
        } else {
            // Show list
            console.log('📋 Showing results list');
            cleanupResultsMap();
            
            elements.list.style.display = 'block';
            elements.list.style.flex = '1';
            elements.map.style.display = 'none';
            elements.btnText.textContent = 'Map';
            
            // Track event
            const trackingModule = modules.tracking;
            if (trackingModule) {
                trackingModule.trackEvent('results_map_toggle', 'Map Interaction', 'hide');
            }
        }
    };
    
    // ================================
    // VENUELIC API
    // ================================
    return {
        // Main maps
        initMainMap,
        initResultsMap,
        initVenueDetailMap,
        initFullUKMap,
        updateMapDisplay,
        
        // Cleanup
        cleanupResultsMap,
        cleanupFullUKMap,
        
        // Markers
        addVenueMarkers,
        
        // Location
        setUserLocation: utils.setUserLocation,
        getUserLocation: utils.getUserLocation,
        
        // UI
        toggleSearchResultsFullMap,
        retryLoadVenues,
        
        // Utilities
        calculateDistance: utils.calculateDistance
    };
})();

// DO NOT add window.MapModule = MapModule here!
