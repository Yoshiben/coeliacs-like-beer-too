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
        pubMarkerRadius: 12,
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
    const initResultsMap = () => {
        console.log('🗺️ Initializing results map...');
        
        const mapElement = document.getElementById('resultsMap');
        if (!mapElement) {
            console.error('Results map element not found');
            return null;
        }
        
        // Clear any existing map
        mapElement.innerHTML = '';
        
        // Create new map
        resultsMap = L.map('resultsMap').setView(
            userLocation ? [userLocation.lat, userLocation.lng] : config.defaultCenter,
            userLocation ? 10 : config.defaultZoom
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
        
        // Ensure proper rendering
        setTimeout(() => {
            resultsMap.invalidateSize();
        }, 100);
        
        console.log('✅ Results map initialized');
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
            return;
        }
        
        console.log(`📍 Adding ${pubs.length} pub markers...`);
        
        // Clear existing pub markers if using main map
        if (!mapInstance) {
            clearPubMarkers();
        }
        
        const styles = getMapStyles();
        const bounds = [];
        let markersAdded = 0;
        
        pubs.forEach(pub => {
            if (pub.latitude && pub.longitude && 
                !isNaN(parseFloat(pub.latitude)) && 
                !isNaN(parseFloat(pub.longitude))) {
                
                const lat = parseFloat(pub.latitude);
                const lng = parseFloat(pub.longitude);
                
                const marker = L.circleMarker([lat, lng], {
                    radius: config.pubMarkerRadius,
                    fillColor: styles.pubFillColor,
                    color: styles.pubStrokeColor,
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                }).addTo(targetMap);
                
                const popupContent = createPubPopupContent(pub);
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
        
        console.log(`✅ Added ${markersAdded} pub markers to map`);
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
    
    // Create popup content for pub
    const createPubPopupContent = (pub) => {
        let content = `<div style="text-align: center; padding: 8px; min-width: 200px;">`;
        content += `<strong style="color: var(--text-primary); font-size: 14px;">${pub.name}</strong><br>`;
        content += `<small style="color: var(--text-secondary);">${pub.address || ''}</small><br>`;
        content += `<small style="color: var(--text-muted);">${pub.postcode}</small>`;
        
        // Add distance if available
        if (pub.distance !== undefined) {
            content += `<br><small style="color: var(--primary-color, #667eea); font-weight: 600;">${pub.distance.toFixed(1)}km away</small>`;
        }
        
        // Add GF status
        if (pub.bottle || pub.tap || pub.cask || pub.can) {
            let gfOptions = [];
            if (pub.bottle) gfOptions.push('🍺');
            if (pub.tap) gfOptions.push('🚰');
            if (pub.cask) gfOptions.push('🛢️');
            if (pub.can) gfOptions.push('🥫');
            content += `<div style="margin-top: 8px; color: var(--success-color, #10b981);"><strong>GF: ${gfOptions.join(' ')}</strong></div>`;
        }
        
        // Add view details button
        content += `<div style="margin-top: 8px;">`;
        content += `<button onclick="MapModule.showPubFromMap(${pub.pub_id})" `;
        content += `style="background: var(--primary-gradient); color: white; border: none; `;
        content += `padding: 4px 8px; border-radius: 12px; font-size: 12px; cursor: pointer;">`;
        content += `View Details</button></div>`;
        content += `</div>`;
        
        return content;
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
