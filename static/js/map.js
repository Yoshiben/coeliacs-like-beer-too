// ================================================================================
// MAP.JS - Complete Refactor with STATE_KEYS and Arrow Functions
// Handles: Map initialization, markers, user location, pub locations
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
        pubDetail: null
    };
    
    const config = {
        defaultCenter: [54.5, -3], // UK center
        defaultZoom: 6,
        maxZoom: 19,
        pubMarkerRadius: 8,
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
                pubFillColor: rootStyles.getPropertyValue('--marker-pub-fill').trim() || '#4CAF50',
                pubStrokeColor: rootStyles.getPropertyValue('--marker-pub-stroke').trim() || '#ffffff',
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
            radius: config.pubMarkerRadius
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
    const initResultsMap = (pubsData = null) => {
        console.log('🗺️ Initializing results map...');
        
        const mapElement = document.getElementById('resultsMap');
        if (!mapElement) {
            console.error('Results map element not found');
            return null;
        }
        
        // Clean up existing map
        utils.cleanupMap(maps.results);
        mapElement.innerHTML = '';
        
        // Reset container classes
        const containers = {
            map: document.getElementById('resultsMapContainer'),
            overlay: document.getElementById('resultsOverlay')
        };
        
        Object.values(containers).forEach(container => {
            if (container) container.classList.remove('split-view');
        });
        
        // Create map with slight delay for DOM
        setTimeout(() => {
            try {
                maps.results = createMap('resultsMap');
                
                if (!maps.results) {
                    throw new Error('Failed to create results map');
                }
                
                // Add pubs
                let pubs = pubsData;
                if (!pubs) {
                    const searchModule = modules.search;
                    pubs = searchModule?.getCurrentResults() || [];
                }
                
                if (pubs.length > 0) {
                    addPubMarkers(pubs, maps.results);
                    console.log(`✅ Added ${pubs.length} pub markers`);
                }
                
                // Add legend
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
    // PUB DETAIL MAP
    // ================================
    const initPubDetailMap = (pub) => {
        console.log('🗺️ Initializing pub detail map for:', pub.name);
        
        const mapContainer = document.querySelector('.pub-map-placeholder');
        if (!mapContainer) {
            console.error('❌ Pub map container not found');
            return null;
        }
        
        if (!pub.latitude || !pub.longitude) {
            showNoLocationMessage(mapContainer, pub.name);
            return null;
        }
        
        // Create map container
        mapContainer.innerHTML = '<div id="pubMapLeaflet" style="width: 100%; height: 100%; border-radius: 0 0 var(--radius-xl) var(--radius-xl);"></div>';
        
        try {
            utils.cleanupMap(maps.pubDetail);
            
            maps.pubDetail = createMap('pubMapLeaflet', {
                center: [parseFloat(pub.latitude), parseFloat(pub.longitude)],
                zoom: 16
            });
            
            if (!maps.pubDetail) {
                throw new Error('Failed to create pub detail map');
            }
            
            // Add pub marker
            const gfStatus = determineGFStatus(pub);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            const pubMarker = L.circleMarker(
                [parseFloat(pub.latitude), parseFloat(pub.longitude)], 
                { ...markerStyle, radius: 12 }
            ).addTo(maps.pubDetail);
            
            const popupContent = createPubPopupContent(pub, gfStatus);
            pubMarker.bindPopup(popupContent).openPopup();
            
            // Force render
            setTimeout(() => {
                if (maps.pubDetail) {
                    maps.pubDetail.invalidateSize();
                }
            }, 150);
            
            console.log('✅ Pub detail map initialized');
            return maps.pubDetail;
            
        } catch (error) {
            console.error('❌ Error creating pub detail map:', error);
            showMapError(mapContainer, error.message);
            return null;
        }
    };
    
    const showNoLocationMessage = (container, pubName) => {
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
    const addPubMarkers = (pubs, mapInstance) => {
        if (!mapInstance || !pubs || pubs.length === 0) return 0;
        
        console.log(`📍 Adding ${pubs.length} pub markers...`);
        
        const bounds = [];
        let markersAdded = 0;
        
        pubs.forEach(pub => {
            if (pub.latitude && pub.longitude && 
                !isNaN(parseFloat(pub.latitude)) && 
                !isNaN(parseFloat(pub.longitude))) {
                
                const lat = parseFloat(pub.latitude);
                const lng = parseFloat(pub.longitude);
                
                const gfStatus = determineGFStatus(pub);
                const markerStyle = getMarkerStyleForGFStatus(gfStatus);
                
                const marker = L.circleMarker([lat, lng], markerStyle).addTo(mapInstance);
                const popupContent = createPubPopupContent(pub, gfStatus);
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
    
    const determineGFStatus = (pub) => {
        if (pub.gf_status) return pub.gf_status;
        if (pub.bottle || pub.tap || pub.cask || pub.can) return 'currently';
        return 'unknown';
    };
    
    const createPubPopupContent = (pub, gfStatus = null) => {
        if (!gfStatus) gfStatus = determineGFStatus(pub);
        
        let content = `<div class="popup-content">`;
        content += `<div class="popup-title">${utils.escapeHtml(pub.name)}</div>`;
        
        if (pub.address) {
            content += `<div class="popup-address">${utils.escapeHtml(pub.address)}</div>`;
        }
        content += `<div class="popup-postcode">${utils.escapeHtml(pub.postcode)}</div>`;
        
        if (pub.distance !== undefined) {
            content += `<div class="popup-distance">${pub.distance.toFixed(1)}km away</div>`;
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
        
        if ((gfStatus === 'always' || gfStatus === 'currently') && (pub.bottle || pub.tap || pub.cask || pub.can)) {
            const formats = [];
            if (pub.bottle) formats.push('🍺');
            if (pub.tap) formats.push('🚰');
            if (pub.cask) formats.push('🛢️');
            if (pub.can) formats.push('🥫');
            content += `<div class="popup-formats">${formats.join(' ')}</div>`;
        }
        
        content += `<button class="popup-button" data-action="view-pub-from-map" data-pub-id="${pub.pub_id}">View Details</button>`;
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
        
        // Load pubs
        await loadAllPubsOnMap();
        
        // Force render
        setTimeout(() => {
            const map = window.App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
            if (map) map.invalidateSize();
        }, 150);
        
        console.log('✅ Full UK map initialized');
        return fullUKMap;
    };
    
    const loadAllPubsOnMap = async () => {
        console.log('📍 Loading UK pubs...');
        
        try {
            // Check cache first
            const cachedPubs = window.App.getState(STATE_KEYS.MAP_DATA.ALL_PUBS);
            if (cachedPubs && cachedPubs.length > 0) {
                console.log('✅ Using cached pub data');
                updateMapDisplay(true);
                return;
            }
            
            // Show loading message
            if (window.showLoadingToast) {
                window.showLoadingToast('Loading pubs across the UK...');
            }
            
            // Fetch data with better error handling
            const response = await fetch('/api/all-pubs', {
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
            
            if (!data.success || !data.pubs) {
                throw new Error(data.error || 'Invalid response format');
            }
            
            // Store in state
            window.App.setState(STATE_KEYS.MAP_DATA.ALL_PUBS, data.pubs || []);
            
            const allPubs = window.App.getState(STATE_KEYS.MAP_DATA.ALL_PUBS);
            console.log(`📊 Loaded ${allPubs.length} pubs`);
            
            // Update display
            updateMapDisplay(true);
            
            // Show success notification
            const gfCount = allPubs.filter(p => 
                p.gf_status === 'always_tap_cask' || 
                p.gf_status === 'always_bottle_can' || 
                p.gf_status === 'currently'
            ).length;
            
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
            
            if (window.showSuccessToast) {
                window.showSuccessToast(`✅ Loaded ${allPubs.length} pubs (${gfCount} with GF beer)`);
            }
            
        } catch (error) {
            console.error('❌ Error loading pubs:', error);
            
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
            
            // Show user-friendly error with retry option
            const errorMessage = error.message.includes('500') ? 
                'Server temporarily unavailable. Please try again.' : 
                'Could not load pub data. Please check your connection.';
                
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
                message.textContent = 'Could not load pub data';
                
                const button = L.DomUtil.create('button', 'btn btn-primary', content);
                button.textContent = '🔄 Try Again';
                button.addEventListener('click', () => {
                    window.App.getModule('map').retryLoadPubs();
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
    
    // Add retry function to public API
    const retryLoadPubs = async () => {
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
        await loadAllPubsOnMap();
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
            // Create container
            const container = L.DomUtil.create('div', 'legend-container');
            const legendDiv = L.DomUtil.create('div', 'map-legend', container);
            
            // Title
            const title = L.DomUtil.create('div', 'legend-title', legendDiv);
            title.textContent = '🍺 GF Beer Status';
            
            // Legend items data
            const items = [
                { class: 'always-gf', text: 'Always Has GF Beer' },
                { class: 'current-gf', text: 'Currently Has GF Beer' },
                { class: 'no-gf', text: 'No GF Currently' },
                { class: 'unknown', text: 'Unknown Status' },
                { class: 'user-location', text: 'Your Location' }
            ];
            
            // Create legend items
            items.forEach(item => {
                const itemDiv = L.DomUtil.create('div', 'legend-item', legendDiv);
                
                const marker = L.DomUtil.create('div', `legend-marker ${item.class}`, itemDiv);
                
                const text = L.DomUtil.create('span', 'legend-text', itemDiv);
                text.textContent = item.text;
            });
            
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
                        <span class="zoom-hint-text">Zoom in to discover more pubs</span>
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
        const allPubs = window.App.getState(STATE_KEYS.MAP_DATA.ALL_PUBS);
        if (!fullUKMap || !allPubs) return;
        
        console.log(`🍺 Updating map: ${showGFOnly ? 'GF Pubs Only' : 'All Pubs'}`);
        
        // Clear existing layers
        clearMapLayers(fullUKMap);
        
        if (showGFOnly) {
            displayGFPubsOnly(fullUKMap, allPubs);
        } else {
            displayAllPubsClustered(fullUKMap, allPubs);
        }
    };
    
    const clearMapLayers = (map) => {
        const layers = {
            gf: window.App.getState(STATE_KEYS.MAP_DATA.GF_PUBS_LAYER),
            clustered: window.App.getState(STATE_KEYS.MAP_DATA.CLUSTERED_PUBS_LAYER)
        };
        
        Object.values(layers).forEach(layer => {
            if (layer && map) map.removeLayer(layer);
        });
    };
    
    const displayGFPubsOnly = (map, allPubs) => {
        const gfPubsLayer = L.layerGroup().addTo(map);
        window.App.setState(STATE_KEYS.MAP_DATA.GF_PUBS_LAYER, gfPubsLayer);
        
        const gfPubs = allPubs.filter(pub => 
            pub.gf_status === 'always' || pub.gf_status === 'currently'
        );
        
        console.log(`📍 Showing ${gfPubs.length} GF pubs only`);
        
        gfPubs.forEach(pub => {
            if (!pub.latitude || !pub.longitude) return;
            
            const lat = parseFloat(pub.latitude);
            const lng = parseFloat(pub.longitude);
            const gfStatus = determineGFStatus(pub);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            const marker = L.circleMarker([lat, lng], markerStyle);
            const popupContent = createPubPopupContent(pub, gfStatus);
            marker.bindPopup(popupContent);
            
            gfPubsLayer.addLayer(marker);
        });
    };
    
    const displayAllPubsClustered = (map, allPubs) => {
        const gfPubsLayer = L.layerGroup().addTo(map);
        window.App.setState(STATE_KEYS.MAP_DATA.GF_PUBS_LAYER, gfPubsLayer);
        
        const clusteredPubsLayer = L.markerClusterGroup({
            ...config.clusterConfig,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                let size = 'small';
                
                if (count > 1000) size = 'large';
                else if (count > 100) size = 'medium';
                
                return L.divIcon({
                    html: `<div><span>${count}</span></div>`,
                    className: `marker-cluster marker-cluster-${size}`,
                    iconSize: L.point(30, 30)
                });
            }
        }).addTo(map);
        
        window.App.setState(STATE_KEYS.MAP_DATA.CLUSTERED_PUBS_LAYER, clusteredPubsLayer);
        
        // Separate GF and other pubs
        const gfPubs = [];
        const otherPubs = [];
        
        allPubs.forEach(pub => {
            if (!pub.latitude || !pub.longitude) return;
            
            const gfStatus = determineGFStatus(pub);
            if (gfStatus === 'always' || gfStatus === 'currently') {
                gfPubs.push(pub);
            } else {
                otherPubs.push(pub);
            }
        });
        
        console.log(`📊 GF Pubs: ${gfPubs.length}, Others: ${otherPubs.length}`);
        
        // Add GF pubs as individual markers
        gfPubs.forEach(pub => {
            const lat = parseFloat(pub.latitude);
            const lng = parseFloat(pub.longitude);
            const gfStatus = determineGFStatus(pub);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            const marker = L.circleMarker([lat, lng], markerStyle);
            const popupContent = createPubPopupContent(pub, gfStatus);
            marker.bindPopup(popupContent);
            
            gfPubsLayer.addLayer(marker);
        });
        
        // Add other pubs to cluster
        otherPubs.forEach(pub => {
            const lat = parseFloat(pub.latitude);
            const lng = parseFloat(pub.longitude);
            const gfStatus = determineGFStatus(pub);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            const marker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'clusterable-marker',
                    html: `<div style="
                        width: ${markerStyle.radius * 2}px;
                        height: ${markerStyle.radius * 2}px;
                        background: ${markerStyle.fillColor};
                        border: ${markerStyle.weight}px solid ${markerStyle.color};
                        border-radius: 50%;
                        opacity: ${markerStyle.fillOpacity};
                    "></div>`,
                    iconSize: [markerStyle.radius * 2, markerStyle.radius * 2]
                })
            });
            
            const popupContent = createPubPopupContent(pub, gfStatus);
            marker.bindPopup(popupContent);
            
            clusteredPubsLayer.addLayer(marker);
        });
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
            
            // Initialize map
            setTimeout(() => {
                const searchModule = modules.search;
                const pubs = searchModule?.getCurrentResults() || [];
                initResultsMap(pubs);
            }, 50);
            
            // Track event
            const trackingModule = modules.tracking;
            if (trackingModule) {
                trackingModule.trackEvent('results_map_toggle', 'Map Interaction', 'show');
            }
        } else {
            // Show list
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
    // PUBLIC API
    // ================================
    return {
        // Main maps
        initMainMap,
        initResultsMap,
        initPubDetailMap,
        initFullUKMap,
        
        // Cleanup
        cleanupResultsMap,
        cleanupFullUKMap,
        
        // Markers
        addPubMarkers,
        
        // Location
        setUserLocation: utils.setUserLocation,
        getUserLocation: utils.getUserLocation,
        
        // UI
        toggleSearchResultsFullMap,
        retryLoadPubs,
        
        // Utilities
        calculateDistance: utils.calculateDistance
    };
})();

// DO NOT add window.MapModule = MapModule here!
