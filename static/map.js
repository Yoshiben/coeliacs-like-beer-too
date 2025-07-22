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
    let userLocation = null;
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
        if (userLocation) {
            addUserMarker(userLocation);
        }
        
        console.log('✅ Main map initialized');
        return map;
    };
    
    // Initialize results overlay map
    // ================================
    // 🔧 UPDATE: In map.js
    // LOCATION: Find the initResultsMap function (around line 60)
    // ACTION: Replace with this enhanced version that can accept pubs data
    // ================================
    
    // Initialize results overlay map
    // ================================
    // 🔧 REPLACE: In map.js - Fix initResultsMap function
    // LOCATION: Find the initResultsMap function (around line 60)
    // ACTION: Replace with this enhanced version that prevents split-screen mode
    // ================================
    
    const initResultsMap = (pubsData = null) => {
        console.log('🗺️ Initializing FULL-SCREEN results map...');
        
        const mapElement = document.getElementById('resultsMap');
        if (!mapElement) {
            console.error('Results map element not found');
            return null;
        }
        
        // 🔧 FIX: Clear any existing map AND remove split-screen classes
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
        
        // Create new map with full-screen configuration
        resultsMap = L.map('resultsMap', {
            // 🔧 FIX: Full-screen map options
            zoomControl: true,
            attributionControl: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true,
            boxZoom: true,
            keyboard: true
        }).setView(
            userLocation ? [userLocation.lat, userLocation.lng] : config.defaultCenter,
            userLocation ? 12 : config.defaultZoom // Closer zoom for results
        );
        
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
        return resultsMap;
    };
    
    // Initialize pub detail map (split view)
    const initPubDetailMap = (pub) => {
        console.log('🗺️ Initializing pub detail map for:', pub.name);
        
        const mapContainer = document.querySelector('.pub-map-placeholder');
        if (!mapContainer) {
            console.error('Pub map container not found');
            return null;
        }
        
        if (!pub.latitude || !pub.longitude) {
            mapContainer.innerHTML = '📍 Location coordinates not available<br><small style="opacity: 0.7;">Help us by reporting the exact location!</small>';
            return null;
        }
        
        // Clear and create map container
        mapContainer.innerHTML = '<div id="pubMapLeaflet" style="width: 100%; height: 100%; border-radius: 0 0 var(--radius-xl) var(--radius-xl);"></div>';
        
        // Create map
        pubDetailMap = L.map('pubMapLeaflet').setView([pub.latitude, pub.longitude], 16);
        
        // Add tile layer
        L.tileLayer(config.tileLayer, {
            maxZoom: config.maxZoom,
            attribution: config.attribution
        }).addTo(pubDetailMap);
        
        // Add pub marker
        const styles = getMapStyles();
        const pubMarker = L.circleMarker([pub.latitude, pub.longitude], {
            radius: config.pubMarkerRadius,
            fillColor: styles.pubFillColor,
            color: styles.pubStrokeColor,
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(pubDetailMap);
        
        // Create popup content
        let popupContent = createPubPopupContent(pub);
        pubMarker.bindPopup(popupContent).openPopup();
        
        // Add user location if available
        if (userLocation) {
            L.circleMarker([userLocation.lat, userLocation.lng], {
                radius: config.userMarkerRadius,
                fillColor: styles.userFillColor,
                color: styles.userStrokeColor,
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(pubDetailMap).bindPopup('Your location');
            
            // Update popup with distance
            const distance = calculateDistance(
                userLocation.lat, userLocation.lng,
                pub.latitude, pub.longitude
            );
            popupContent = popupContent.replace('</div>', 
                `<div style="color: var(--primary-color, #667eea); font-size: 12px; margin-top: 4px;">${distance.toFixed(2)} km away</div></div>`
            );
            pubMarker.bindPopup(popupContent).openPopup();
        }
        
        // Ensure proper rendering
        setTimeout(() => {
            pubDetailMap.invalidateSize();
        }, 100);
        
        console.log('✅ Pub detail map initialized');
        return pubDetailMap;
    };
    
    // Add user location marker
    const addUserMarker = (location) => {
        if (!map) return;
        
        userLocation = location;
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
        // Check if pub has any GF options
        if (pub.bottle || pub.tap || pub.cask || pub.can) {
            return 'gf_available';
        }
        
        // If we have the pub in database but no GF flags set
        if (pub.pub_id) {
            return 'no_gf';
        }
        
        // Unknown status
        return 'unknown';
    };
    
    const getMarkerStyleForGFStatus = (gfStatus) => {
    const rootStyles = getComputedStyle(document.documentElement);
    
    const baseStyle = {
        weight: parseInt(rootStyles.getPropertyValue('--marker-stroke-width')) || 2,
        opacity: 1,
        fillOpacity: 0.9,
        radius: parseInt(rootStyles.getPropertyValue('--marker-radius')) || 8
    };
    
    switch(gfStatus) {
        case 'gf_available':
            return {
                ...baseStyle,
                fillColor: rootStyles.getPropertyValue('--marker-gf-fill').trim() || '#10b981',
                color: rootStyles.getPropertyValue('--marker-gf-stroke').trim() || '#ffffff'
            };
            
        case 'no_gf':
            return {
                ...baseStyle,
                fillColor: rootStyles.getPropertyValue('--marker-no-gf-fill').trim() || '#ef4444',
                color: rootStyles.getPropertyValue('--marker-no-gf-stroke').trim() || '#ffffff'
            };
            
        case 'unknown':
        default:
            return {
                ...baseStyle,
                fillColor: rootStyles.getPropertyValue('--marker-unknown-fill').trim() || '#9ca3af',
                color: rootStyles.getPropertyValue('--marker-unknown-stroke').trim() || '#ffffff'
            };
    }
};
    
    const createPubPopupContent = (pub, gfStatus = null) => {
        if (!gfStatus) {
            gfStatus = determineGFStatus(pub);
        }
        
        // Get the popup template
        const template = document.getElementById('popup-content-template');
        if (!template) {
            // Fallback to basic content if template not found
            return createBasicPopupContent(pub, gfStatus);
        }
        
        const clone = template.content.cloneNode(true);
        
        // Fill in the template data
        clone.querySelector('[data-field="name"]').textContent = pub.name;
        
        const addressEl = clone.querySelector('[data-field="address"]');
        if (pub.address) {
            addressEl.textContent = pub.address;
        } else {
            addressEl.style.display = 'none';
        }
        
        clone.querySelector('[data-field="postcode"]').textContent = pub.postcode;
        
        // Add distance if available
        const distanceEl = clone.querySelector('[data-field="distance"]');
        if (pub.distance !== undefined) {
            distanceEl.textContent = `${pub.distance.toFixed(1)}km away`;
            distanceEl.style.display = 'block';
        }
        
        // Set GF status with appropriate class
        const gfStatusEl = clone.querySelector('[data-field="gf-status"]');
        if (gfStatus === 'gf_available') {
            let gfOptions = [];
            if (pub.bottle) gfOptions.push('🍺');
            if (pub.tap) gfOptions.push('🚰');
            if (pub.cask) gfOptions.push('🛢️');
            if (pub.can) gfOptions.push('🥫');
            gfStatusEl.textContent = `✅ GF Available: ${gfOptions.join(' ')}`;
            gfStatusEl.className = 'popup-gf-status available';
        } else if (gfStatus === 'no_gf') {
            gfStatusEl.textContent = '❌ No GF Options Known';
            gfStatusEl.className = 'popup-gf-status not-available';
        } else {
            gfStatusEl.textContent = '❓ GF Status Unknown';
            gfStatusEl.className = 'popup-gf-status unknown';
        }
        
        // Set up button click handler
        const button = clone.querySelector('[data-action="view-details"]');
        button.setAttribute('data-action', 'view-pub');  // Change from 'view-details' to 'view-pub'
        button.setAttribute('data-pub-id', pub.pub_id);
        button.onclick = null; // Remove the custom onclick, let the main handler deal with it
        
        // Return the HTML string for Leaflet
        const div = document.createElement('div');
        div.appendChild(clone);
        return div.innerHTML;
    };

    const createBasicPopupContent = (pub, gfStatus) => {
        // Fallback function using CSS classes instead of inline styles
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
        if (gfStatus === 'gf_available') {
            let gfOptions = [];
            if (pub.bottle) gfOptions.push('🍺');
            if (pub.tap) gfOptions.push('🚰');
            if (pub.cask) gfOptions.push('🛢️');
            if (pub.can) gfOptions.push('🥫');
            content += `<div class="popup-gf-status available">✅ GF Available: ${gfOptions.join(' ')}</div>`;
        } else if (gfStatus === 'no_gf') {
            content += `<div class="popup-gf-status not-available">❌ No GF Options Known</div>`;
        } else {
            content += `<div class="popup-gf-status unknown">❓ GF Status Unknown</div>`;
        }
        
        content += `<button class="popup-button" data-action="view-pub" data-pub-id="${pub.pub_id}">View Details</button>`;
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
        if (userLocation) {
            L.circleMarker([userLocation.lat, userLocation.lng], {
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
        userLocation = location;
        if (map) {
            addUserMarker(location);
        }
    };
    
    // Get user location
    const getUserLocation = () => userLocation;
    
    // Center map on location
    const centerOnLocation = (location = null) => {
        const targetLocation = location || userLocation;
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
        showPubFromMap,
        toggleSearchResultsFullMap,
        isMapVisible: () => mapVisible,
        calculateDistance
    };
})();

// Make it globally available for onclick handlers
window.MapModule = MapModule;
