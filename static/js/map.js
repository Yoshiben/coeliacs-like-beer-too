// ================================================================================
// MAP.JS - All map functionality in one place
// Handles: Map initialization, markers, user location, pub locations
// ================================================================================

export const MapModule = (function() {
    'use strict';
    
    // Private variables
    let map = null;
    let userMarker = null;
    let pubMarkers = [];
    // let userLocation = null;
    let mapVisible = false;
    let resultsMap = null;
    let pubDetailMap = null;
    
    // Configuration
    const config = {
        defaultCenter: [54.5, -3], // UK center
        defaultZoom: 6,
        maxZoom: 19,
        pubMarkerRadius: 8,
        userMarkerRadius: 8,
        // markerPulseDuration: 1000, // ms
        // markerPulseCount: 4,
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
        if (window.App.state.userLocation) {
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
        
        // 🔧 FIX: Check if map already exists and clean it up properly
        if (resultsMap) {
            console.log('🔄 Map already exists, cleaning up...');
            try {
                resultsMap.remove(); // Properly destroy the existing map
                resultsMap = null;
            } catch (error) {
                console.warn('Warning cleaning up existing map:', error);
                resultsMap = null;
            }
        }
        
        // 🔧 FIX: Clear the container completely
        mapElement.innerHTML = '';
        mapElement.classList.remove('split-view'); // Remove split-screen mode
        
        // 🔧 FIX: Ensure parent containers are NOT in split-screen mode
        const resultsMapContainer = document.getElementById('resultsMapContainer');
        if (resultsMapContainer) {
            resultsMapContainer.classList.remove('split-view');
            resultsMapContainer.style.height = '100%'; // Force full height
        }
        
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay) {
            resultsOverlay.classList.remove('split-view');
        }
        
        // 🔧 FIX: Small delay to ensure DOM is clean before recreating
        setTimeout(() => {
            try {
                // Create new map with full-screen configuration
                resultsMap = L.map('resultsMap', {
                    zoomControl: true,
                    attributionControl: true,
                    scrollWheelZoom: true,
                    doubleClickZoom: true,
                    touchZoom: true,
                    boxZoom: true,
                    keyboard: true
                }).setView(
                    window.App.state.userLocation ? [window.App.state.userLocation.lat, window.App.state.userLocation.lng] : config.defaultCenter,
                    window.App.state.userLocation ? 12 : config.defaultZoom // Closer zoom for results
                );
                
                // Add tile layer
                L.tileLayer(config.tileLayer, {
                    maxZoom: config.maxZoom,
                    attribution: config.attribution
                }).addTo(resultsMap);
                
                // Add user location if available
                if (window.App.state.userLocation) {
                    const styles = getMapStyles();
                    L.circleMarker([window.App.state.userLocation.lat, window.App.state.userLocation.lng], {
                        radius: config.userMarkerRadius,
                        fillColor: styles.userFillColor,
                        color: styles.userStrokeColor,
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(resultsMap).bindPopup('📍 Your location');
                }
                
                // Add pubs if provided or get from search module
                let pubs = pubsData;
                if (!pubs && window.App?.getModule('search')?.getCurrentResults) {
                    pubs = window.App.getModule('search').getCurrentResults();
                    console.log('🍺 Got pubs from search module:', pubs?.length || 0);
                }
                
                if (pubs && pubs.length > 0) {
                    const markersAdded = addPubMarkers(pubs, resultsMap);
                    console.log(`✅ Added ${markersAdded} pub markers to FULL-SCREEN results map`);
                } else {
                    console.log('ℹ️ No pubs data available for results map');
                }
                
                // 🔧 FIX: Add legend for full-screen map
                addMapLegend(resultsMap);
                
                // 🔧 FIX: Force proper rendering with multiple invalidation calls
                setTimeout(() => {
                    if (resultsMap) {
                        resultsMap.invalidateSize();
                        console.log('🔄 Results map size invalidated (first)');
                    }
                }, 100);
                
                setTimeout(() => {
                    if (resultsMap) {
                        resultsMap.invalidateSize();
                        console.log('🔄 Results map size invalidated (second)');
                    }
                }, 300);
                
                console.log('✅ FULL-SCREEN results map initialized successfully');
                
            } catch (error) {
                console.error('❌ Error creating results map:', error);
                mapElement.innerHTML = '<div style="padding: 20px; text-align: center;">Error loading map. Please try again.</div>';
            }
        }, 50); // Small delay to ensure DOM cleanup
        
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
            // Create map
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
            
            // Add pub marker
            const pubMarker = L.circleMarker([parseFloat(pub.latitude), parseFloat(pub.longitude)], {
                radius: 12,
                fillColor: styles.pubFillColor || '#4CAF50',
                color: styles.pubStrokeColor || '#ffffff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(pubDetailMap);
            
            // Create popup content
            const popupContent = createPubPopupContent ? createPubPopupContent(pub) : `
                <div style="text-align: center;">
                    <div style="font-weight: 600; margin-bottom: 5px;">${pub.name}</div>
                    <div style="font-size: 0.9rem; color: #666;">${pub.address || ''}</div>
                    <div style="font-size: 0.9rem; color: #666;">${pub.postcode || ''}</div>
                </div>
            `;
            
            pubMarker.bindPopup(popupContent).openPopup();
            
            // Add user location if available
            if (window.App.state.userLocation) {
                L.circleMarker([window.App.state.userLocation.lat, window.App.state.userLocation.lng], {
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
        if (!map) return;
        
        window.App.state.userLocation = location;
        const styles = getMapStyles();
        
        // Remove existing user marker
        if (userMarker) {
            map.removeLayer(userMarker);
        }
        
        // Add new user marker
        userMarker = L.circleMarker([location.lat, location.lng], {
            radius: config.userMarkerRadius,
            fillColor: styles.userFillColor,
            color: styles.userStrokeColor,
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        
        userMarker.bindPopup('📍 You are here!');
        
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

    // Add hybrid clustering - GF pubs individual, others clustered
    const addFilteredPubMarkers = (pubs, mapInstance = null) => {
        const targetMap = mapInstance || map;
        if (!targetMap) return 0;
        
        console.log(`🎯 Adding hybrid markers: GF individual, others clustered...`);
        
        // Clear existing layers
        if (window.gfPubsLayer) {
            targetMap.removeLayer(window.gfPubsLayer);
        }
        if (window.clusteredPubsLayer) {
            targetMap.removeLayer(window.clusteredPubsLayer);
        }
        
        // Create layer groups
        window.gfPubsLayer = L.layerGroup().addTo(targetMap);
        window.clusteredPubsLayer = L.markerClusterGroup({
            maxClusterRadius: 40,  // Smaller radius for tighter clustering
            disableClusteringAtZoom: 12,  // Show individual markers when very close
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
        
        // Separate pubs by GF status
        let gfPubs = [];
        let otherPubs = [];
        let counts = { always: 0, currently: 0, unknown: 0, no_gf: 0 };
        
        pubs.forEach(pub => {
            if (!pub.latitude || !pub.longitude) return;
            
            const gfStatus = determineGFStatus(pub);
            counts[gfStatus]++;
            
            if (gfStatus === 'always' || gfStatus === 'currently') {
                gfPubs.push(pub);
            } else {
                otherPubs.push(pub);
            }
        });
        
        console.log(`📊 GF Pubs (individual): ${gfPubs.length}, Others (clustered): ${otherPubs.length}`);
        
        // Add GF pubs as individual markers (never clustered)
        gfPubs.forEach(pub => {
            const lat = parseFloat(pub.latitude);
            const lng = parseFloat(pub.longitude);
            
            const gfStatus = determineGFStatus(pub);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            const marker = L.circleMarker([lat, lng], markerStyle);
            const popupContent = createPubPopupContent(pub, gfStatus);
            marker.bindPopup(popupContent);
            
            window.gfPubsLayer.addLayer(marker);
        });
        
        // Add other pubs to cluster layer
        otherPubs.forEach(pub => {
            const lat = parseFloat(pub.latitude);
            const lng = parseFloat(pub.longitude);
            
            const gfStatus = determineGFStatus(pub);
            const markerStyle = getMarkerStyleForGFStatus(gfStatus);
            
            // Use regular markers for clustering (not circleMarkers)
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
            
            window.clusteredPubsLayer.addLayer(marker);
        });
        
        // Ensure GF pubs are on top
        // window.gfPubsLayer.bringToFront();
        
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

    const determineGFStatus = (pub) => {
        // If we have the explicit status field, use it
        if (pub.gf_status) {
            return pub.gf_status;
        }
        
        // Fallback for older data without the status field
        // This maintains backwards compatibility
        if (pub.bottle || pub.tap || pub.cask || pub.can) {
            return 'currently';
        }
        
        return 'unknown';
    };
    
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
                    radius: 10, // Slightly larger
                    weight: 3,  // Thicker border
                    className: 'always-gf-marker' // For special effects
                };
                
            case 'currently':
                return {
                    ...baseStyle,
                    fillColor: rootStyles.getPropertyValue('--current-gf-fill').trim(),
                    color: rootStyles.getPropertyValue('--current-gf-border').trim()
                };
                
            case 'not_currently':
                return {
                    ...baseStyle,
                    fillColor: rootStyles.getPropertyValue('--no-gf-fill').trim(),
                    color: rootStyles.getPropertyValue('--no-gf-border').trim(),
                    fillOpacity: 0.7 // Slightly faded
                };
                
            case 'unknown':
            default:
                return {
                    ...baseStyle,
                    fillColor: rootStyles.getPropertyValue('--unknown-gf-fill').trim(),
                    color: rootStyles.getPropertyValue('--unknown-gf-border').trim(),
                    fillOpacity: 0.6 // More faded
                };
        }
    };
    
    const createPubPopupContent = (pub, gfStatus = null) => {
        if (!gfStatus) {
            gfStatus = determineGFStatus(pub);
        }
        
        // Try to get the popup template first
        const template = document.getElementById('popup-content-template');
        if (template) {
            const clone = template.content.cloneNode(true);
            
            // Fill in the template data
            const nameEl = clone.querySelector('[data-field="name"]');
            if (nameEl) nameEl.textContent = pub.name;
            
            const addressEl = clone.querySelector('[data-field="address"]');
            if (addressEl) {
                if (pub.address) {
                    addressEl.textContent = pub.address;
                } else {
                    addressEl.style.display = 'none';
                }
            }
            
            const postcodeEl = clone.querySelector('[data-field="postcode"]');
            if (postcodeEl) postcodeEl.textContent = pub.postcode;
            
            // Add distance if available
            const distanceEl = clone.querySelector('[data-field="distance"]');
            if (distanceEl && pub.distance !== undefined) {
                distanceEl.textContent = `${pub.distance.toFixed(1)}km away`;
                distanceEl.style.display = 'block';
            }
            
            // Set enhanced GF status
            const gfStatusEl = clone.querySelector('[data-field="gf-status"]');
            if (gfStatusEl) {
                switch(gfStatus) {
                    case 'always_gf':
                        gfStatusEl.innerHTML = '🟢 <strong>Always Has GF Beer!</strong>';
                        gfStatusEl.className = 'popup-gf-status always-gf';
                        break;
                        
                    case 'current_gf':
                        let gfOptions = [];
                        if (pub.bottle) gfOptions.push('🍺');
                        if (pub.tap) gfOptions.push('🚰');
                        if (pub.cask) gfOptions.push('🛢️');
                        if (pub.can) gfOptions.push('🥫');
                        gfStatusEl.innerHTML = `✅ GF Available: ${gfOptions.join(' ')}`;
                        gfStatusEl.className = 'popup-gf-status current-gf';
                        break;
                        
                    case 'no_gf_currently':
                        gfStatusEl.innerHTML = '🔴 No GF Options Currently';
                        gfStatusEl.className = 'popup-gf-status no-gf';
                        break;
                        
                    default:
                        gfStatusEl.innerHTML = '⚪ GF Status Unknown';
                        gfStatusEl.className = 'popup-gf-status unknown';
                }
            }
            
            // Fix the button
            const button = clone.querySelector('[data-action="view-details"]');
            if (button) {
                button.setAttribute('data-action', 'view-pub');
                button.setAttribute('data-pub-id', pub.pub_id);
            }
            
            // Return the HTML string for Leaflet
            const div = document.createElement('div');
            div.appendChild(clone);
            return div.innerHTML;
        }
        
        // Fallback to basic content if template not found
        return createBasicPopupContent(pub, gfStatus);
    };
    
    const createBasicPopupContent = (pub, gfStatus) => {
        let content = `<div class="popup-content">`;
        content += `<div class="popup-title">${escapeHtml(pub.name)}</div>`;
        
        if (pub.address) {
            content += `<div class="popup-address">${escapeHtml(pub.address)}</div>`;
        }
        content += `<div class="popup-postcode">${escapeHtml(pub.postcode)}</div>`;
        
        if (pub.distance !== undefined) {
            content += `<div class="popup-distance">${pub.distance.toFixed(1)}km away</div>`;
        }
        
        // GF status with appropriate class
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
        
        // Fixed button with proper action and onclick handler
        content += `<button class="popup-button" data-action="view-pub" data-pub-id="${pub.pub_id}" onclick="window.App.handleAction('view-pub', this, event)">View Details</button>`;
        content += `</div>`;
        
        return content;
    };
    
    const addMapLegend = (mapInstance) => {
        // Create legend control
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'legend-container');
            
            // Get the legend template
            const template = document.getElementById('map-legend-template');
            if (template) {
                const clone = template.content.cloneNode(true);
                div.appendChild(clone);
            } else {
                // Fallback legend
                div.innerHTML = `
                    <div class="map-legend">
                        <div class="legend-title">🍺 GF Beer Status</div>
                        <div class="legend-item">
                            <div class="legend-marker gf-available"></div>
                            <span class="legend-text">GF Available</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-marker no-gf"></div>
                            <span class="legend-text">No GF Options</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-marker unknown"></div>
                            <span class="legend-text">Unknown</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-marker user-location"></div>
                            <span class="legend-text">Your Location</span>
                        </div>
                    </div>
                `;
            }
            
            return div;
        };
        
        legend.addTo(mapInstance);
    };

    // Add zoom hint to map
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
                
                // Update visibility based on zoom
                const updateHintVisibility = () => {
                    const zoom = map.getZoom();
                    if (zoom < 9) {
                        container.style.display = 'block';
                    } else {
                        container.style.display = 'none';
                    }
                };
                
                // Initial check
                updateHintVisibility();
                
                // Update on zoom
                map.on('zoomend', updateHintVisibility);
                
                return container;
            }
        });
        
        mapInstance.addControl(new hintControl());
    };
    
    const initPubDetailsSplitMap = (pub) => {
        console.log('🗺️ Initializing SPLIT-SCREEN pub details map for:', pub.name);
        
        const mapContainer = document.querySelector('.pub-map-placeholder');
        if (!mapContainer) {
            console.error('Pub map container not found');
            return null;
        }
        
        if (!pub.latitude || !pub.longitude) {
            // Use template for error state
            const template = document.getElementById('map-error-template');
            if (template) {
                const clone = template.content.cloneNode(true);
                mapContainer.innerHTML = '';
                mapContainer.appendChild(clone);
            } else {
                mapContainer.className = 'map-error-container';
                mapContainer.innerHTML = `
                    <div class="map-error-icon">📍</div>
                    <div class="map-error-title">Location coordinates not available</div>
                    <div class="map-error-text">Help us by reporting the exact location!</div>
                `;
            }
            return null;
        }
        
        // Create split-screen map container
        mapContainer.innerHTML = '<div id="pubMapLeaflet" style="width: 100%; height: 100%; border-radius: 0 0 var(--radius-xl) var(--radius-xl);"></div>';
        
        // Create map optimized for split-screen view
        pubDetailMap = L.map('pubMapLeaflet', {
            zoomControl: true,
            attributionControl: false,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true,
            boxZoom: false,
            keyboard: false
        }).setView([pub.latitude, pub.longitude], 16);
        
        // Add tile layer
        L.tileLayer(config.tileLayer, {
            maxZoom: config.maxZoom,
            attribution: config.attribution
        }).addTo(pubDetailMap);
        
        // Determine GF status and get appropriate marker style
        const gfStatus = determineGFStatus(pub);
        const markerStyle = getMarkerStyleForGFStatus(gfStatus);
        
        // Add pub marker with GF status color
        const pubMarker = L.circleMarker([pub.latitude, pub.longitude], {
            ...markerStyle,
            radius: 14
        }).addTo(pubDetailMap);
        
        // Create popup content using template
        const popupContent = createPubPopupContent(pub, gfStatus);
        pubMarker.bindPopup(popupContent).openPopup();
        
        // Add user location if available
        if (window.App.state.userLocation) {
            L.circleMarker([window.App.state.userLocation.lat, window.App.state.userLocation.lng], {
                radius: 8,
                fillColor: 'var(--marker-user-fill)',
                color: 'var(--marker-user-stroke)',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(pubDetailMap).bindPopup('Your location');
        }
        
        // Ensure proper rendering for split-screen
        setTimeout(() => {
            pubDetailMap.invalidateSize();
        }, 150);
        
        console.log('✅ Split-screen pub detail map initialized with GF status colors');
        return pubDetailMap;
    };
    
    // Helper function for HTML escaping
    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    // Calculate distance between two points
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in kilometers
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
            
            // Initialize map if not already done
            if (!map) {
                initMainMap();
            }
            
            // Ensure map renders properly
            setTimeout(() => {
                if (map) {
                    map.invalidateSize();
                }
            }, 100);
            
            // Scroll to map
            setTimeout(() => {
                mapContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        } else {
            mapContainer.style.display = 'none';
            toggleBtn.innerHTML = '🗺️ Show Map';
        }
        
        return mapVisible;
    };
    
    // Show pub from map popup
    const showPubFromMap = (pubId) => {
        console.log('🗺️ Showing pub from map:', pubId);
        // This will be wired up to the main app's showPubDetails function
        if (window.showPubDetails) {
            window.showPubDetails(pubId);
        }
    };
    
    // Set user location
    const setUserLocation = (location) => {
        window.App.state.userLocation = location;
        if (map) {
            addUserMarker(location);
        }
    };
    
    // Get user location
    const getUserLocation = () => window.App.state.userLocation;
    
    // Center map on location
    const centerOnLocation = (location = null) => {
        const targetLocation = location || window.App.state.userLocation;
        if (targetLocation && map) {
            map.setView([targetLocation.lat, targetLocation.lng], 14);
            console.log('🎯 Map centered on location');
        }
    };

    const toggleSearchResultsFullMap = () => {
        const listContainer = document.getElementById('resultsListContainer');
        const mapContainer = document.getElementById('resultsMapContainer');
        const mapBtnText = document.getElementById('resultsMapBtnText');
        
        if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
            // Show map
            listContainer.style.display = 'none';
            mapContainer.style.display = 'block';
            mapBtnText.textContent = 'List';
            
            // Initialize the results map
            setTimeout(() => {
                initResultsMap();
            }, 100);
            
            TrackingModule.trackEvent('results_map_toggle', 'Map Interaction', 'show');
        } else {
            // Show list
            listContainer.style.display = 'block';
            mapContainer.style.display = 'none';
            mapBtnText.textContent = 'Map';
            
            TrackingModule.trackEvent('results_map_toggle', 'Map Interaction', 'hide');
        }
    };

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
        
        // Clear the map container
        const mapElement = document.getElementById('resultsMap');
        if (mapElement) {
            mapElement.innerHTML = '';
        }
        
        // Reset container classes
        const resultsMapContainer = document.getElementById('resultsMapContainer');
        if (resultsMapContainer) {
            resultsMapContainer.classList.remove('split-view');
        }
    };

    // Initialize full UK map with all pubs
    const initFullUKMap = async () => {
        console.log('🗺️ Initializing full UK map with all pubs...');
        
        const mapElement = document.getElementById('fullMap');
        if (!mapElement) {
            console.error('Full map element not found');
            return null;
        }
        
        // Clean up any existing map
        if (window.fullUKMap) {
            window.fullUKMap.remove();
            window.fullUKMap = null;
        }
        
        if (!window.App.state.userLocation) {
            try {
                console.log('📍 No existing location, requesting from user...');
                
                // Request location using the browser API
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            window.App.state.userLocation = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                                accuracy: position.coords.accuracy
                            };
                            console.log('✅ Got user location:', window.App.state.userLocation);
                            resolve();
                        },
                        (error) => {
                            console.log('❌ Location error:', error);
                            reject(error);
                        },
                        {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 30000
                        }
                    );
                });
            } catch (error) {
                console.log('📍 Could not get user location:', error);
            }
        }
        
        // Determine initial view - CHANGED: zoom closer when we have location
        let initialCenter = config.defaultCenter;
        let initialZoom = config.defaultZoom;
        
        if (window.App.state.userLocation) {
            initialCenter = [window.App.state.userLocation.lat, window.App.state.userLocation.lng];
            initialZoom = 12; // CHANGED: Much closer zoom for local view
            console.log('📍 Centering map on user location with zoom:', initialZoom);
        } else {
            console.log('📍 No user location, using UK center');
        }
        
        // Create new map
        window.fullUKMap = L.map('fullMap', {
            zoomControl: true,
            attributionControl: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true
        }).setView(initialCenter, initialZoom);
        
        // Add tile layer
        L.tileLayer(config.tileLayer, {
            maxZoom: config.maxZoom,
            attribution: config.attribution
        }).addTo(window.fullUKMap);
        
        // Add user location marker if available - with emphasis
        if (window.App.state.userLocation) {
            const styles = getMapStyles();
            const userMarker = L.circleMarker([window.App.state.userLocation.lat, window.App.state.userLocation.lng], {
                radius: 10, // Larger for emphasis
                fillColor: styles.userFillColor || '#667eea',
                color: styles.userStrokeColor || '#ffffff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.9,
                // className: 'pulsing-marker',
                zIndexOffset: 1000 // Start with high z-index// For animation
            }).addTo(window.fullUKMap);
            
            userMarker.bindPopup('📍 You are here!').openPopup();
            window.fullUKMapUserMarker = userMarker;
            // Bring to front after animation completes (2 seconds for 2 pulses)
            // Remove pulsing class and bring to front after animation
            // setTimeout(() => {
            //    if (window.fullUKMapUserMarker && window.fullUKMapUserMarker._path) {
            //        L.DomUtil.removeClass(window.fullUKMapUserMarker._path, 'pulsing-marker');
            //        window.fullUKMapUserMarker.bringToFront();
            //    }
            // }, config.markerPulseDuration * config.markerPulseCount);
        }
        
        // Add legend (permanent, no toggle)
        addMapLegend(window.fullUKMap);

        // Add zoom hint
        addZoomHint(window.fullUKMap);
        
        // Load and display all pubs
        await loadAllPubsOnMap();
        
        // Ensure proper rendering
        setTimeout(() => {
            if (window.fullUKMap) {
                window.fullUKMap.invalidateSize();
            }
        }, 150);

        // Initialize toggle after map is ready
        setTimeout(() => {
            initMapToggle();
        }, 500);
        
        console.log('✅ Full UK map initialized');
        return window.fullUKMap;
    };
    
    // Load all pubs from the API
    const loadAllPubsOnMap = async () => {
        console.log('📍 Loading UK pubs progressively...');
        
        try {
            // Check if we already have the data
            if (window.allPubsData && window.allPubsData.length > 0) {
                console.log('✅ Using cached pub data');
                // Initialize toggle with cached data
                setTimeout(() => {
                    initMapToggle();
                }, 100);
                return;
            }
            
            // Fetch all pubs in background
            fetch('/api/all-pubs')
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        throw new Error(data.error || 'Failed to load pubs');
                    }
                    
                    window.allPubsData = data.pubs || [];
                    console.log(`📊 Loaded ${window.allPubsData.length} pubs in background`);
                    
                    // Initialize toggle functionality AFTER data is loaded
                    setTimeout(() => {
                        initMapToggle();
                    }, 100);
                    
                    // Show toast notification
                    const gfCount = window.allPubsData.filter(p => 
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

    // Initialize map toggle functionality
    const initMapToggle = () => {
        const container = document.getElementById('mapToggleContainer');
        if (!container) return;
        
        const options = container.querySelectorAll('.toggle-option');
        const thumb = document.getElementById('toggleThumb');
        let currentMode = 'gf'; // Start with GF pubs
        
        // Set initial thumb position
        const updateThumb = () => {
            const activeOption = container.querySelector('.toggle-option.active');
            if (activeOption && thumb) {
                thumb.style.width = `${activeOption.offsetWidth}px`;
                thumb.style.transform = `translateX(${activeOption.offsetLeft}px)`;
            }
        };
        
        // Initial position
        setTimeout(updateThumb, 100);
        
        // Handle clicks
        options.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value;
                if (value === currentMode) return;
                
                // Update active state
                options.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                currentMode = value;
                
                // Update thumb position
                updateThumb();
                
                // Update map
                updateMapDisplay(value === 'gf');
            });
        });
        
        // Show initial GF pubs
        updateMapDisplay(true);
        
        // Set up zoom handler for dynamic updates
        setupZoomHandler(currentMode);
    };
    
    // Update map display based on mode
    const updateMapDisplay = (showGFOnly) => {
        if (!window.fullUKMap || !window.allPubsData) return;
        
        console.log(`🍺 Updating map: ${showGFOnly ? 'GF Pubs Only' : 'All Pubs'}`);
        
        // Clear existing layers
        if (window.gfPubsLayer) {
            window.fullUKMap.removeLayer(window.gfPubsLayer);
        }
        if (window.clusteredPubsLayer) {
            window.fullUKMap.removeLayer(window.clusteredPubsLayer);
        }
        
        if (showGFOnly) {
            // Show only GF pubs
            window.gfPubsLayer = L.layerGroup().addTo(window.fullUKMap);
            
            const gfPubs = window.allPubsData.filter(pub => 
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
                
                window.gfPubsLayer.addLayer(marker);
            });
            
        } else {
            // Show all pubs with clustering
            addFilteredPubMarkers(window.allPubsData, window.fullUKMap);
        }
    };
    
    // Keep the zoom handler for performance
    const setupZoomHandler = (mode) => {
        if (!window.fullUKMap) return;
        
        // Clear existing handlers
        window.fullUKMap.off('zoomend');
        
        // Add zoom handler for refresh on zoom changes
        let zoomTimeout;
        window.fullUKMap.on('zoomend', function() {
            clearTimeout(zoomTimeout);
            zoomTimeout = setTimeout(() => {
                const zoom = window.fullUKMap.getZoom();
                console.log(`🔍 Zoom level: ${zoom}, refreshing markers`);
                
                // Get current mode from toggle
                const activeOption = document.querySelector('.toggle-option.active');
                const currentMode = activeOption?.dataset.value || 'gf';
                
                updateMapDisplay(currentMode === 'gf');
            }, 300);
        });
    };
    
    // Clean up full UK map
    const cleanupFullUKMap = () => {
        console.log('🧹 Cleaning up full UK map...');
        
        if (window.fullUKMap) {
            try {
                window.fullUKMap.remove();
                window.fullUKMap = null;
                console.log('✅ Full UK map cleaned up');
            } catch (error) {
                console.warn('Warning cleaning up full UK map:', error);
                window.fullUKMap = null;
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
        showPubFromMap,
        toggleSearchResultsFullMap,
        cleanupResultsMap, // 🔧 ADD this line
        isMapVisible: () => mapVisible,
        calculateDistance
    };
})();

// Make it globally available for onclick handlers
window.MapModule = MapModule;
