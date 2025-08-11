// ================================================================================
// CONSTANTS.JS - Simplified Version
// Essential configuration only
// ================================================================================

export const Constants = {
    // ================================
    // API ENDPOINTS
    // ================================
    API: {
        STATS: '/api/stats',
        SEARCH: '/search',
        NEARBY: '/nearby',
        AUTOCOMPLETE: '/autocomplete',
        BREWERIES: '/api/breweries',
        BREWERY_BEERS: '/api/brewery/:brewery/beers',
        SUBMIT_BEER: '/api/submit_beer_update',
        UPDATE_GF_STATUS: '/api/update-gf-status',
        ALL_VENUES: '/api/all-venues',
        ADD_VENUE: '/api/add-venue'
    },
    
    // ================================
    // STATE KEYS
    // ================================
    STATE_KEYS: {
        // Navigation state
        CURRENT_VIEW: 'currentView',
        ACTIVE_OVERLAYS: 'activeOverlays',
        
        // Location state
        USER_LOCATION: 'userLocation',
        LOCATION_TIMESTAMP: 'locationTimestamp',
        
        // Search state
        LAST_SEARCH: {
            TYPE: 'lastSearch.type',
            QUERY: 'lastSearch.query',
            RADIUS: 'lastSearch.radius',
            TIMESTAMP: 'lastSearch.timestamp'
        },
        SEARCH_RESULTS: 'searchResults',
        
        // Current selections
        CURRENT_VENUE: 'currentVenue',
        SELECTED_VENUE_FOR_REPORT: 'selectedVenueForReport',
        
        // Map state
        MAP_DATA: {
            ALL_VENUES: 'mapData.allVenues',
            FULL_UK_MAP: 'mapData.fullUKMapInstance',
            USER_MARKER: 'mapData.userMarker'
        }
    },
    
    // ================================
    // SEARCH CONFIGURATION
    // ================================
    SEARCH: {
        DEFAULT_RADIUS: 5,
        MIN_QUERY_LENGTH: 2,
        DEBOUNCE_DELAY: 300,
        
        TYPES: {
            LOCATION: 'all',
            NAME: 'name',
            AREA: 'area',
            POSTCODE: 'postcode'
        },
        
        DISTANCE_OPTIONS: [
            { value: 1, label: 'Walking distance' },
            { value: 3, label: 'Short journey' },
            { value: 5, label: 'Most popular', popular: true },
            { value: 10, label: 'Longer trip' },
            { value: 20, label: 'Day out' }
        ]
    },
    
    // ================================
    // UI CONFIGURATION
    // ================================
    UI: {
        TOAST_DURATION: 3000,
        ANIMATION_DURATION: 300,
        TIMEOUTS: {
            API_REQUEST: 10000,
            LOCATION_REQUEST: 10000
        }
    },
    
    // ================================
    // GF STATUS SYSTEM
    // ================================
    GF_STATUS_CONFIG: {
        always_tap_cask: {
            label: 'Always Has GF on Tap/Cask',
            icon: '⭐',
            fillColor: '#FFD700',
            borderColor: '#FDB904',
            priority: 1
        },
        always_bottle_can: {
            label: 'Always Has GF Bottles/Cans',
            icon: '✅',
            fillColor: '#00F500',
            borderColor: '#00C400',
            priority: 2
        },
        currently: {
            label: 'Currently Has GF Beer',
            icon: '🔵',
            fillColor: '#3B82F6',
            borderColor: '#2563EB',
            priority: 3
        },
        not_currently: {
            label: 'No GF Beer Currently',
            icon: '❌',
            fillColor: '#EF4444',
            borderColor: '#DC2626',
            priority: 4
        },
        unknown: {
            label: 'GF Status Unknown',
            icon: '❓',
            fillColor: '#9CA3AF',
            borderColor: '#6B7280',
            priority: 5
        }
    },
    
    // ================================
    // VALIDATION
    // ================================
    VALIDATION: {
        POSTCODE_REGEX: /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i,
        VALID_STATUSES: ['always_tap_cask', 'always_bottle_can', 'currently', 'not_currently', 'unknown']
    },
    
    // ================================
    // EXTERNAL SERVICES
    // ================================
    EXTERNAL: {
        GEOCODING_API: 'https://nominatim.openstreetmap.org/search',
        GOOGLE_MAPS_DIRECTIONS: 'https://www.google.com/maps/dir/?api=1&destination=',
        GOOGLE_SEARCH: 'https://www.google.com/search?q='
    },
    
    // ================================
    // ANALYTICS
    // ================================
    ANALYTICS: {
        GA_ID: 'G-WSHR39KSXS'
    },
    
    // ================================
    // DEFAULTS
    // ================================
    DEFAULTS: {
        TOTAL_VENUES: 49841,
        GF_VENUES: 0,
        GF_VENUES_THIS_MONTH: 0
    },
    
    // ================================
    // ERROR MESSAGES
    // ================================
    ERRORS: {
        GENERIC: 'An error occurred. Please try again.',
        NETWORK: 'Network error. Please check your connection.',
        LOCATION_ERROR: '📍 Location unavailable. Please enable GPS and try again.',
        NO_RESULTS: 'No results found.',
        INVALID_POSTCODE: 'Please enter a valid UK postcode.'
    },
    
    // ================================
    // SUCCESS MESSAGES
    // ================================
    SUCCESS: {
        BEER_REPORT: '🎉 Beer report submitted successfully!',
        LOCATION_FOUND: '📍 Location found!',
        STATUS_UPDATED: '✅ Status updated successfully!'
    }
};

// Freeze to prevent modification
Object.freeze(Constants);
window.Constants = Constants;
