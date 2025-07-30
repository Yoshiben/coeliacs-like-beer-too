// ================================================================================
// MAP.JS - All map functionality in one place
// Handles: Map initialization, markers, user location, pub locations
// ================================================================================

export const MapModule = (function() {
    'use strict';
    
    // Private state - NO MORE GLOBALS!
    let map = null;
    let resultsMap = null;
    let pubDetailMap = null;
    let pubMarkers = [];
    let mapVisible = false;
    
    // Configuration
    const config = {
        defaultCenter: [54.5, -3], // UK center
        defaultZoom: 6,
        maxZoom: 19,
        pubMarkerRadius: 8,
        userMarkerRadius: 8,
        tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    };
    
    // Get CSS variables for consistent styling
    const getMapStyles = () => {
        const rootStyles = getComputedStyle(document.documentElement);
        return {
            pubFillColor: rootStyles.getPropertyValue('--marker-pub-fill').trim() || '#4CAF50',
            pubStrokeColor: rootStyles.getPropertyValue('--marker-pub-stroke').trim() || '#ffffff',
            userFillColor: rootStyles.getPropertyValue('--marker-user-fill').trim() || '#667eea',
            userStrokeColor: rootStyles.getPropertyValue('--marker-user-stroke').trim() || '#ffffff'
        };
    };
    
    // Initialize main map
    const initMainMap = (containerId = 'map') => {
        console.log('🗺️ Initializing main map...');
        
        const mapElement = document.getElementById(containerId);
        if (!mapElement) {
            console.error('Map container not found:', containerId);
            return null;
        }
        
        // Clear any existing map
        if (map) {
            map.remove();
            map = null;
        }
        
        // Create new map
        map = L.map(containerId).setView(config.defaultCenter, config.defaultZoom);
        
        // Add tile layer
        L.tileLayer(config.tileLayer, {
            maxZoom: config.maxZoom,
            attribution: config.attribution
        }).addTo(map);
        
        // Add user location if available
        const userLocation = window.App.getState('userLocation');
        if (userLocation) {
            addUserMarker(userLocation);
        }
        
        console.log('✅ Main map initialized');
        return map;
    };
    
    // Initialize results overlay map    
    const initResultsMap = (pubsData = null) => {
        console.log('🗺️ Initializing FULL-SCREEN results map...');
        
        const mapElement = document.getElementById('resultsMap');
        if (!mapElement) {
            console.error('Results map element not found');
            return null;
        }
        
        // Clean up existing map
        if (resultsMap) {
            console.log('🔄 Map already exists, cleaning up...');
            try {
                resultsMap.remove();
                resultsMap = null;
            } catch (error) {
                console.warn('Warning cleaning up existing map:', error);
                resultsMap = null;
            }
        }
        
        // Clear the container
        mapElement.innerHTML = '';
        mapElement.classList.remove('split-view');
        
        // Ensure parent containers are in full-screen mode
        const resultsMapContainer = document.getElementById('resultsMapContainer');
        if (resultsMapContainer) {
            resultsMapContainer.classList.remove('split-view');
            resultsMapContainer.style.height = '100%';
        }
        
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay) {
            resultsOverlay.classList.remove('split-view');
        }
        
        // Small delay to ensure DOM is clean
        setTimeout(() => {
            try {
                const userLocation = window.App.getState('userLocation');
                const centerPoint = userLocation ? 
                    [userLocation.lat, userLocation.lng] : 
                    config.defaultCenter;
                const zoomLevel = userLocation ? 12 : config.defaultZoom;
                
                // Create new map
                resultsMap = L.map('resultsMap', {
                    zoomControl: true,
                    attributionControl: true,
                    scrollWheelZoom: true,
                    doubleClickZoom: true,
                    touchZoom: true,
                    boxZoom: true,
                    keyboard: true
                }).setView(centerPoint, zoomLevel);
                
                // Add tile layer
                L.tileLayer(config.tileLayer, {
                    maxZoom: config.maxZoom,
                    attribution: config.attribution
                }).addTo(resultsMap);
                
                // Add user location if available
                if (userLocation) {
                    const styles = getMapStyles();
                    L.circleMarker([userLocation.lat, userLocation.lng], {
                        radius: config.userMarkerRadius,
                        fillColor: styles.userFillColor,
                        color: styles.userStrokeColor,
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(resultsMap).bindPopup('📍 Your location');
                }
                
                // Add pubs
                let pubs = pubsData;
                if (!pubs && window.App?.getModule('search')?.getCurrentResults) {
                    pubs = window.App.getModule('search').getCurrentResults();
                    console.log('🍺 Got pubs from search module:', pubs?.length || 0);
                }
                
                if (pubs && pubs.length > 0) {
                    const markersAdded = addPubMarkers(pubs, resultsMap);
                    console.log(`✅ Added ${markersAdded} pub markers to results map`);
                } else {
                    console.log('ℹ️ No pubs data available for results map');
                }
                
                // Add legend
                addMapLegend(resultsMap);
                
                // Force proper rendering
                setTimeout(() => {
                    if (resultsMap) {
                        resultsMap.invalidateSize();
                        console.log('🔄 Results map size invalidated');
                    }
                }, 100);
                
                console.log('✅ Results map initialized successfully');
                
            } catch (error) {
                console.error('❌ Error creating results map:', error);
                mapElement.innerHTML = '<div style="padding: 20px; text-align: center;">Error loading map. Please try again.</div>';
            }
        }, 50);
        
        return resultsMap;
    };
    
    // Initialize pub detail map (split view)
    const initPubDetailMap = (pub) => {
        console.log('🗺️ Initializing pub detail map for:', pub.name);
        
        const mapContainer = document.querySelector('.pub-map-placeholder');
        if (!mapContainer) {
            console.error('❌ Pub map container (.pub-map-placeholder) not found');
            return null;
        }
        
        if (!pub.latitude || !pub.longitude) {
            console.warn('⚠️ No coordinates available for pub:', pub.name);
            mapContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center; color: var(--text-secondary);">
                    <div style="font-size: 2rem; margin-bottom: 10px;">📍</div>
                    <div style="font-weight: 600; margin-bottom: 5px;">Location coordinates not available</div>
                    <div style="font-size: 0.9rem; opacity: 0.7;">Help us by reporting the exact location!</div>
                </div>
            `;
            return null;
        }
        
        console.log('🗺️ Creating map with coordinates:', pub.latitude, pub.longitude);
        
        // Clear and create map container
        mapContainer.innerHTML = '<div id="pubMapLeaflet" style="width: 100%; height: 100%; border-radius: 0 0 var(--radius-xl) var(--radius-xl);"></div>';
        
        try {
            // Clean up existing map
            if (pubDetailMap) {
                pubDetailMap.remove();
                pubDetailMap = null;
            }
            
            pubDetailMap = L.map('pubMapLeaflet', {
                zoomControl: true,
                attributionControl: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                touchZoom: true
            }).setView([parseFloat(pub.latitude), parseFloat(pub.longitude)], 16);
            
            // Add tile layer
            L.tileLayer(config.tileLayer, {
                maxZoom: config.maxZoom,
                attribution: config.attribution
            }).addTo(pubDetailMap);
            
            // Get styles
            const styles = getMapStyles();
            
            // Determine GF status
            const gfStatus = determineGFStatus(pub);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            // Add pub marker
            const pubMarker = L.circleMarker([parseFloat(pub.latitude), parseFloat(pub.longitude)], {
                ...markerStyle,
                radius: 12
            }).addTo(pubDetailMap);
            
            // Create popup content
            const popupContent = createPubPopupContent(pub, gfStatus);
            pubMarker.bindPopup(popupContent).openPopup();
            
            // Add user location if available
            const userLocation = window.App.getState('userLocation');
            if (userLocation) {
                L.circleMarker([userLocation.lat, userLocation.lng], {
                    radius: 8,
                    fillColor: styles.userFillColor || '#667eea',
                    color: styles.userStrokeColor || '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(pubDetailMap).bindPopup('📍 Your location');
            }
            
            // Ensure proper rendering
            setTimeout(() => {
                if (pubDetailMap) {
                    pubDetailMap.invalidateSize();
                    console.log('🔄 Map size invalidated');
                }
            }, 150);
            
            console.log('✅ Pub detail map initialized successfully');
            return pubDetailMap;
            
        } catch (error) {
            console.error('❌ Error creating pub detail map:', error);
            mapContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center; color: var(--text-secondary);">
                    <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
                    <div style="font-weight: 600; margin-bottom: 5px;">Map Error</div>
                    <div style="font-size: 0.9rem; opacity: 0.7;">${error.message}</div>
                </div>
            `;
            return null;
        }
    };
    
    // Add user location marker
    const addUserMarker = (location) => {
        const fullUKMap = window.App.getState('mapData.fullUKMapInstance');
        if (!fullUKMap) return;
        
        const styles = getMapStyles();
        
        // Remove existing user marker
        const existingMarker = window.App.getState('mapData.userMarker');
        if (existingMarker && fullUKMap) {
            fullUKMap.removeLayer(existingMarker);
        }
        
        // Add new user marker
        const userMarker = L.circleMarker([location.lat, location.lng], {
            radius: config.userMarkerRadius,
            fillColor: styles.userFillColor,
            color: styles.userStrokeColor,
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(fullUKMap);
        
        userMarker.bindPopup('📍 You are here!');
        window.App.setState('mapData.userMarker', userMarker);
        
        console.log('📍 User marker added to map');
    };
    
    // Add pub markers to map
    const addPubMarkers = (pubs, mapInstance = null) => {
        const targetMap = mapInstance || map;
        if (!targetMap) {
            console.error('No map instance available');
            return 0;
        }
        
        console.log(`📍 Adding ${pubs.length} pub markers with GF color coding...`);
        
        // Clear existing pub markers if using main map
        if (!mapInstance) {
            clearPubMarkers();
        }
        
        const bounds = [];
        let markersAdded = 0;
        
        pubs.forEach(pub => {
            if (pub.latitude && pub.longitude && 
                !isNaN(parseFloat(pub.latitude)) && 
                !isNaN(parseFloat(pub.longitude))) {
                
                const lat = parseFloat(pub.latitude);
                const lng = parseFloat(pub.longitude);
                
                // Determine marker color and size based on GF availability
                const gfStatus = determineGFStatus(pub);
                const markerStyle = getMarkerStyleForGFStatus(gfStatus);
                
                const marker = L.circleMarker([lat, lng], markerStyle).addTo(targetMap);
                
                const popupContent = createPubPopupContent(pub, gfStatus);
                marker.bindPopup(popupContent);
                
                if (!mapInstance) {
                    pubMarkers.push(marker);
                }
                
                bounds.push([lat, lng]);
                markersAdded++;
            }
        });
        
        // Auto-zoom to show all markers
        if (markersAdded > 0 && bounds.length > 0) {
            if (bounds.length === 1) {
                targetMap.setView(bounds[0], 15);
            } else {
                targetMap.fitBounds(bounds, { padding: [20, 20] });
            }
        }
        
        console.log(`✅ Added ${markersAdded} GF-color-coded pub markers to map`);
        return markersAdded;
    };

    // Add filtered pub markers (hybrid clustering)
    const addFilteredPubMarkers = (pubs, mapInstance) => {
        const targetMap = mapInstance || map;
        if (!targetMap) return 0;
        
        console.log(`🎯 Adding hybrid markers: GF individual, others clustered...`);
        
        // Clear existing layers
        const gfPubsLayer = window.App.getState('mapData.gfPubsLayer');
        if (gfPubsLayer && targetMap) {
            targetMap.removeLayer(gfPubsLayer);
        }
        
        const clusteredPubsLayer = window.App.getState('mapData.clusteredPubsLayer');
        if (clusteredPubsLayer && targetMap) {
            targetMap.removeLayer(clusteredPubsLayer);
        }
        
        // Create new layer groups
        const newGfPubsLayer = L.layerGroup().addTo(targetMap);
        window.App.setState('mapData.gfPubsLayer', newGfPubsLayer);
        
        const newClusteredPubsLayer = L.markerClusterGroup({
            maxClusterRadius: 40,
            disableClusteringAtZoom: 12,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: function(cluster) {
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
        }).addTo(targetMap);
        window.App.setState('mapData.clusteredPubsLayer', newClusteredPubsLayer);
        
        // Separate pubs by GF status
        let gfPubs = [];
        let otherPubs = [];
        
        pubs.forEach(pub => {
            if (!pub.latitude || !pub.longitude) return;
            
            const gfStatus = determineGFStatus(pub);
            
            if (gfStatus === 'always' || gfStatus === 'currently') {
                gfPubs.push(pub);
            } else {
                otherPubs.push(pub);
            }
        });
        
        console.log(`📊 GF Pubs (individual): ${gfPubs.length}, Others (clustered): ${otherPubs.length}`);
        
        // Add GF pubs as individual markers
        gfPubs.forEach(pub => {
            const lat = parseFloat(pub.latitude);
            const lng = parseFloat(pub.longitude);
            
            const gfStatus = determineGFStatus(pub);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            const marker = L.circleMarker([lat, lng], markerStyle);
            const popupContent = createPubPopupContent(pub, gfStatus);
            marker.bindPopup(popupContent);
            
            newGfPubsLayer.addLayer(marker);
        });
        
        // Add other pubs to cluster layer
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
            
            newClusteredPubsLayer.addLayer(marker);
        });
        
        return pubs.length;
    };
    
    // Clear all pub markers
    const clearPubMarkers = () => {
        pubMarkers.forEach(marker => {
            if (map) {
                map.removeLayer(marker);
            }
        });
        pubMarkers = [];
        console.log('🧹 Cleared all pub markers');
    };

    // Determine GF status
    const determineGFStatus = (pub) => {
        if (pub.gf_status) {
            return pub.gf_status;
        }
        
        // Fallback for older data
        if (pub.bottle || pub.tap || pub.cask || pub.can) {
            return 'currently';
        }
        
        return 'unknown';
    };
    
    // Get marker style for GF status
    const getMarkerStyleForGFStatus = (gfStatus) => {
        const rootStyles = getComputedStyle(document.documentElement);
        
        const baseStyle = {
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
            radius: 8
        };
        
        switch(gfStatus) {
            case 'always':
                return {
                    ...baseStyle,
                    fillColor: rootStyles.getPropertyValue('--always-gf-fill').trim(),
                    color: rootStyles.getPropertyValue('--always-gf-border').trim(),
                    radius: 10,
                    weight: 3,
                    className: 'always-gf-marker'
                };
                
            case 'currently':
                return {
                    ...baseStyle,
                    fillColor: rootStyles.getPropertyValue('--currently-gf-fill').trim(),
                    color: rootStyles.getPropertyValue('--currently-gf-border').trim()
                };
                
            case 'not_currently':
                return {
                    ...baseStyle,
                    fillColor: rootStyles.getPropertyValue('--no-gf-fill').trim(),
                    color: rootStyles.getPropertyValue('--no-gf-border').trim(),
                    fillOpacity: 0.7
                };
                
            case 'unknown':
            default:
                return {
                    ...baseStyle,
                    fillColor: rootStyles.getPropertyValue('--unknown-gf-fill').trim(),
                    color: rootStyles.getPropertyValue('--unknown-gf-border').trim(),
                    fillOpacity: 0.6
                };
        }
    };
    
    // Create pub popup content
    const createPubPopupContent = (pub, gfStatus = null) => {
        if (!gfStatus) {
            gfStatus = determineGFStatus(pub);
        }
        
        let content = `<div class="popup-content">`;
        content += `<div class="popup-title">${escapeHtml(pub.name)}</div>`;
        
        if (pub.address) {
            content += `<div class="popup-address">${escapeHtml(pub.address)}</div>`;
        }
        content += `<div class="popup-postcode">${escapeHtml(pub.postcode)}</div>`;
        
        if (pub.distance !== undefined) {
            content += `<div class="popup-distance">${pub.distance.toFixed(1)}km away</div>`;
        }
        
        // GF status
        if (gfStatus === 'always' || gfStatus === 'currently') {
            let gfOptions = [];
            if (pub.bottle) gfOptions.push('🍺');
            if (pub.tap) gfOptions.push('🚰');
            if (pub.cask) gfOptions.push('🛢️');
            if (pub.can) gfOptions.push('🥫');
            content += `<div class="popup-gf-status available">✅ GF Available: ${gfOptions.join(' ')}</div>`;
        } else if (gfStatus === 'not_currently') {
            content += `<div class="popup-gf-status not-available">❌ No GF Options Known</div>`;
        } else {
            content += `<div class="popup-gf-status unknown">❓ GF Status Unknown</div>`;
        }
        
        content += `<button class="popup-button" data-action="view-pub" data-pub-id="${pub.pub_id}">View Details</button>`;
        content += `</div>`;
        
        return content;
    };
    
    // Add map legend
    const addMapLegend = (mapInstance) => {
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'legend-container');
            
            div.innerHTML = `
                <div class="map-legend">
                    <div class="legend-title">🍺 GF Beer Status</div>
                    <div class="legend-item">
                        <div class="legend-marker always-gf"></div>
                        <span class="legend-text">Always Has GF Beer</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-marker current-gf"></div>
                        <span class="legend-text">Currently Has GF Beer</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-marker no-gf"></div>
                        <span class="legend-text">No GF Currently</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-marker unknown"></div>
                        <span class="legend-text">Unknown Status</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-marker user-location"></div>
                        <span class="legend-text">Your Location</span>
                    </div>
                </div>
            `;
            
            return div;
        };
        
        legend.addTo(mapInstance);
    };

    // Add zoom hint
    const addZoomHint = (mapInstance) => {
        const hintControl = L.Control.extend({
            options: {
                position: 'topright'
            },
            
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'zoom-hint-container');
                container.innerHTML = `
                    <div class="zoom-hint">
                        <span class="zoom-hint-icon">💡</span>
                        <span class="zoom-hint-text">Zoom in to discover more pubs</span>
                    </div>
                `;
                
                const updateHintVisibility = () => {
                    const zoom = map.getZoom();
                    if (zoom < 9) {
                        container.style.display = 'block';
                    } else {
                        container.style.display = 'none';
                    }
                };
                
                updateHintVisibility();
                map.on('zoomend', updateHintVisibility);
                
                return container;
            }
        });
        
        mapInstance.addControl(new hintControl());
    };
    
    // Initialize full UK map
    const initFullUKMap = async () => {
        console.log('🗺️ Initializing full UK map with all pubs...');
        
        const mapElement = document.getElementById('fullMap');
        if (!mapElement) {
            console.error('Full map element not found');
            return null;
        }
        
        // Clean up any existing map
        const existingMap = window.App.getState('mapData.fullUKMapInstance');
        if (existingMap) {
            existingMap.remove();
            window.App.setState('mapData.fullUKMapInstance', null);
        }
        
        // Try to get user location if not available
        let userLocation = window.App.getState('userLocation');
        if (!userLocation) {
            try {
                console.log('📍 No existing location, trying to get it...');
                
                if (window.SearchModule?.requestLocationWithUI) {
                    userLocation = await window.SearchModule.requestLocationWithUI();
                    window.App.setState('userLocation', userLocation);
                    console.log('✅ Got user location via UI:', userLocation);
                }
            } catch (error) {
                console.log('📍 Could not get user location:', error);
            }
        }
        
        // Determine initial view
        let initialCenter = config.defaultCenter;
        let initialZoom = config.defaultZoom;
        
        if (userLocation) {
            initialCenter = [userLocation.lat, userLocation.lng];
            initialZoom = 12;
            console.log('📍 Centering map on user location with zoom:', initialZoom);
        }
        
        // Create new map
        const fullUKMap = L.map('fullMap', {
            zoomControl: true,
            attributionControl: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true
        }).setView(initialCenter, initialZoom);
        
        window.App.setState('mapData.fullUKMapInstance', fullUKMap);
        
        // Add tile layer
        L.tileLayer(config.tileLayer, {
            maxZoom: config.maxZoom,
            attribution: config.attribution
        }).addTo(fullUKMap);
        
        // Add user location marker if available
        if (userLocation) {
            const styles = getMapStyles();
            const userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
                radius: 10,
                fillColor: styles.userFillColor || '#667eea',
                color: styles.userStrokeColor || '#ffffff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.9,
                zIndexOffset: 1000
            }).addTo(fullUKMap);
            
            userMarker.bindPopup('📍 You are here!').openPopup();
            window.App.setState('mapData.userMarker', userMarker);
        }
        
        addMapLegend(fullUKMap);
        addZoomHint(fullUKMap);
        
        // Load and display all pubs
        await loadAllPubsOnMap();
        
        // Ensure proper rendering
        setTimeout(() => {
            const map = window.App.getState('mapData.fullUKMapInstance');
            if (map) {
                map.invalidateSize();
            }
        }, 150);

        // Initialize toggle after map is ready
        setTimeout(() => {
            initMapToggle();
        }, 500);
        
        console.log('✅ Full UK map initialized');
        return fullUKMap;
    };
    
    // Load all pubs from API
    const loadAllPubsOnMap = async () => {
        console.log('📍 Loading UK pubs progressively...');
        
        try {
            // Check if we already have the data
            const cachedPubs = window.App.getState('mapData.allPubs');
            if (cachedPubs && cachedPubs.length > 0) {
                console.log('✅ Using cached pub data');
                setTimeout(() => {
                    initMapToggle();
                }, 100);
                return;
            }
            
            // Fetch all pubs
            fetch('/api/all-pubs')
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to load pubs');
                    }
                    
                    window.App.setState('mapData.allPubs', data.pubs || []);
                    
                    const allPubs = window.App.getState('mapData.allPubs');
                    console.log(`📊 Loaded ${allPubs.length} pubs in background`);
                    
                    // Initialize toggle functionality AFTER data is loaded
                    setTimeout(() => {
                        initMapToggle();
                    }, 100);
                    
                    // Show toast notification
                    const gfCount = allPubs.filter(p => 
                        p.gf_status === 'always' || p.gf_status === 'currently'
                    ).length;
                    
                    if (window.showSuccessToast) {
                        window.showSuccessToast(`✅ ${gfCount} pubs with GF beer ready!`);
                    }
                })
                .catch(error => {
                    console.error('❌ Error loading pubs:', error);
                    if (window.showSuccessToast) {
                        window.showSuccessToast('❌ Error loading pubs. Please try again.');
                    }
                });
            
        } catch (error) {
            console.error('❌ Error loading pubs for map:', error);
        }
    };

    // Initialize map toggle
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
            });
        });
        
        updateMapDisplay(true);
        setupZoomHandler(currentMode);
    };
    
    // Update map display based on mode
    const updateMapDisplay = (showGFOnly) => {
        const fullUKMap = window.App.getState('mapData.fullUKMapInstance');
        const allPubs = window.App.getState('mapData.allPubs');
        if (!fullUKMap || !allPubs) return;
        
        console.log(`🍺 Updating map: ${showGFOnly ? 'GF Pubs Only' : 'All Pubs'}`);
        
        // Clear existing layers
        const gfPubsLayer = window.App.getState('mapData.gfPubsLayer');
        if (gfPubsLayer && fullUKMap) {
            fullUKMap.removeLayer(gfPubsLayer);
        }
        
        const clusteredPubsLayer = window.App.getState('mapData.clusteredPubsLayer');
        if (clusteredPubsLayer && fullUKMap) {
            fullUKMap.removeLayer(clusteredPubsLayer);
        }
        
        if (showGFOnly) {
            // Show only GF pubs
            const gfPubsLayer = L.layerGroup().addTo(fullUKMap);
            window.App.setState('mapData.gfPubsLayer', gfPubsLayer);
            
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
            
        } else {
            // Show all pubs with clustering
            addFilteredPubMarkers(allPubs, fullUKMap);
        }
    };
    
    // Setup zoom handler
    const setupZoomHandler = (mode) => {
        const fullUKMap = window.App.getState('mapData.fullUKMapInstance');
        if (!fullUKMap) return;
        
        fullUKMap.off('zoomend');
        
        let zoomTimeout;
        fullUKMap.on('zoomend', function() {
            clearTimeout(zoomTimeout);
            zoomTimeout = setTimeout(() => {
                const zoom = fullUKMap.getZoom();
                console.log(`🔍 Zoom level: ${zoom}, refreshing markers`);
                
                const activeOption = document.querySelector('.toggle-option.active');
                const currentMode = activeOption?.dataset.value || 'gf';
                
                updateMapDisplay(currentMode === 'gf');
            }, 300);
        });
    };
    
    // Helper functions
    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };
    
    // Toggle map visibility
    const toggleMap = () => {
        mapVisible = !mapVisible;
        const mapContainer = document.getElementById('mapContainer');
        const toggleBtn = document.getElementById('toggleMapBtn');
        
        if (mapVisible) {
            mapContainer.style.display = 'block';
            toggleBtn.innerHTML = '🗺️ Hide Map';
            
            if (!map) {
                initMainMap();
            }
            
            setTimeout(() => {
                if (map) {
                    map.invalidateSize();
                }
            }, 100);
            
            setTimeout(() => {
                mapContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        } else {
            mapContainer.style.display = 'none';
            toggleBtn.innerHTML = '🗺️ Show Map';
        }
        
        return mapVisible;
    };
    
    // Set user location
    const setUserLocation = (location) => {
        window.App.setState('userLocation', location);
        window.App.setState('locationTimestamp', Date.now());
        if (map) {
            addUserMarker(location);
        }
    };
    
    // Get user location
    const getUserLocation = () => window.App.getState('userLocation');
    
    // Center map on location
    const centerOnLocation = (location = null) => {
        const targetLocation = location || window.App.getState('userLocation');
        if (targetLocation && map) {
            map.setView([targetLocation.lat, targetLocation.lng], 14);
            console.log('🎯 Map centered on location');
        }
    };

    // Toggle search results map
    const toggleSearchResultsFullMap = () => {
        const listContainer = document.getElementById('resultsListContainer');
        const mapContainer = document.getElementById('resultsMapContainer');
        const mapBtnText = document.getElementById('resultsMapBtnText');
        
        if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
            listContainer.style.display = 'none';
            mapContainer.style.display = 'block';
            mapBtnText.textContent = 'List';
            
            setTimeout(() => {
                initResultsMap();
            }, 100);
            
            if (window.TrackingModule) {
                window.TrackingModule.trackEvent('results_map_toggle', 'Map Interaction', 'show');
            }
        } else {
            listContainer.style.display = 'block';
            mapContainer.style.display = 'none';
            mapBtnText.textContent = 'Map';
            
            if (window.TrackingModule) {
                window.TrackingModule.trackEvent('results_map_toggle', 'Map Interaction', 'hide');
            }
        }
    };

    // Cleanup results map
    const cleanupResultsMap = () => {
        console.log('🧹 Cleaning up results map instance...');
        
        if (resultsMap) {
            try {
                resultsMap.remove();
                resultsMap = null;
                console.log('✅ Results map cleaned up successfully');
            } catch (error) {
                console.warn('Warning cleaning up results map:', error);
                resultsMap = null;
            }
        }
        
        const mapElement = document.getElementById('resultsMap');
        if (mapElement) {
            mapElement.innerHTML = '';
        }
        
        const resultsMapContainer = document.getElementById('resultsMapContainer');
        if (resultsMapContainer) {
            resultsMapContainer.classList.remove('split-view');
        }
    };
    
    // Cleanup full UK map
    const cleanupFullUKMap = () => {
        console.log('🧹 Cleaning up full UK map...');
        
        const fullUKMap = window.App.getState('mapData.fullUKMapInstance');
        if (fullUKMap) {
            try {
                fullUKMap.remove();
                window.App.setState('mapData.fullUKMapInstance', null);
            } catch (error) {
                console.warn('Warning cleaning up full UK map:', error);
                window.App.setState('mapData.fullUKMapInstance', null);
            }
        }
    };
    
    // Public API
    return {
        initMainMap,
        initResultsMap,
        initPubDetailMap,
        addPubMarkers,
        clearPubMarkers,
        toggleMap,
        setUserLocation,
        getUserLocation,
        centerOnLocation,
        initFullUKMap,
        loadAllPubsOnMap,
        cleanupFullUKMap,
        toggleSearchResultsFullMap,
        cleanupResultsMap,
        isMapVisible: () => mapVisible,
        calculateDistance
    };
})();

// Make it globally available
window.MapModule = MapModule;
