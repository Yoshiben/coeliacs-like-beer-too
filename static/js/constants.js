// ================================================================================
// CONSTANTS.JS - App-wide Constants and Configuration
// Handles: API endpoints, search types, default values, feature flags, STATE KEYS
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
        ADD_VENUE: '/api/add-venue',
        ADMIN: {
            VALIDATION_STATS: '/api/admin/validation-stats',
            PENDING_REVIEWS: '/api/admin/pending-manual-reviews',
            SOFT_VALIDATION: '/api/admin/soft-validation-queue',
            RECENT_SUBMISSIONS: '/api/admin/recent-submissions',
            APPROVE: '/api/admin/approve-submission',
            REJECT: '/api/admin/reject-submission',
            APPROVE_SOFT: '/api/admin/approve-soft-validation'
        }
    },
    
    // ================================
    // STATE KEYS - Centralized state paths
    // ================================
    STATE_KEYS: {
        // Navigation state
        CURRENT_VIEW: 'currentView',
        ACTIVE_OVERLAYS: 'activeOverlays',
        
        // Location state
        USER_LOCATION: 'userLocation',
        LOCATION_TIMESTAMP: 'locationTimestamp',
        LOCATION_ACCURACY: 'locationAccuracy',
        
        // Search state
        LAST_SEARCH: {
            ROOT: 'lastSearch',
            TYPE: 'lastSearch.type',
            QUERY: 'lastSearch.query',
            RADIUS: 'lastSearch.radius',
            TIMESTAMP: 'lastSearch.timestamp',
            COUNTRY: 'lastSearch.country'  // Add this if missing
        },
        SEARCH_RESULTS: 'searchResults',
        
        // Current selections
        CURRENT_VENUE: 'currentVenue',
        SELECTED_VENUE_FOR_REPORT: 'selectedVenueForReport',
        
        // Map state
        MAP_DATA: {
            ALL_VENUES: 'mapData.allVenues',
            FULL_UK_MAP: 'mapData.fullUKMapInstance',
            RESULTS_MAP: 'mapData.resultsMapInstance',
            VENUE_DETAIL_MAP: 'mapData.venueDetailMapInstance',
            USER_MARKER: 'mapData.userMarker',
            GF_VENUES_LAYER: 'mapData.gfVenuesLayer',
            CLUSTERED_VENUES_LAYER: 'mapData.clusteredVenuesLayer'
        },
        
        // Form state
        CURRENT_BREWERY: 'currentBrewery',
        REPORT_FORM_DATA: 'reportFormData',
        
        // UI state
        ACTIVE_MODALS: 'activeModals',
        TOAST_QUEUE: 'toastQueue',
        MAP_VIEW_MODE: 'mapViewMode'
    },
    
    // ================================
    // SEARCH CONFIGURATION
    // ================================
    SEARCH: {
        DEFAULT_RADIUS: 5, // km
        MAX_RADIUS: 50, // km
        DEFAULT_PAGE_SIZE: 20,
        MAX_SUGGESTIONS: 20,
        MIN_QUERY_LENGTH: 2,
        DEBOUNCE_DELAY: 300, // ms
        AUTOCOMPLETE_DELAY: 200, // ms
        
        // Search type mappings
        TYPES: {
            LOCATION: 'all',
            NAME: 'name',
            BEER: 'all',
            AREA: 'area',
            POSTCODE: 'postcode'
        },
        
        // Distance options for location search
        DISTANCE_OPTIONS: [
            { value: 1, label: 'Walking distance' },
            { value: 3, label: 'Short journey' },
            { value: 5, label: 'Most popular', popular: true },
            { value: 10, label: 'Longer trip' },
            { value: 20, label: 'Day out' }
        ]
    },
    
    // ================================
    // MAP CONFIGURATION
    // ================================
    MAP: {
        DEFAULT_CENTER: [54.5, -3], // UK center
        DEFAULT_ZOOM: 6,
        MAX_ZOOM: 19,
        VENUE_MARKER_RADIUS: 12,
        USER_MARKER_RADIUS: 8,
        TILE_LAYER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ATTRIBUTION: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    
    // ================================
    // UI CONFIGURATION
    // ================================
    UI: {
        TOAST_DURATION: 3000, // ms
        ANIMATION_DURATION: 300, // ms
        NUMBER_ANIMATION_DURATION: 2000, // ms
        MODAL_ANIMATION_DURATION: 300, // ms
        
        // Refresh intervals
        REFRESH_INTERVALS: {
            ADMIN_DASHBOARD: 30000, // 30 seconds
            LOCATION_CACHE: 300000, // 5 minutes
        },
        
        // Timeouts
        TIMEOUTS: {
            API_REQUEST: 10000, // 10 seconds
            LOCATION_REQUEST: 10000, // 10 seconds
            SEARCH_DEBOUNCE: 300, // ms
        }
    },
    
    // ================================
    // BEER FORMATS
    // ================================
    BEER_FORMATS: {
        BOTTLE: { value: 'bottle', icon: '🍺', label: 'Bottle' },
        TAP: { value: 'tap', icon: '🚰', label: 'Tap' },
        CASK: { value: 'cask', icon: '🛢️', label: 'Cask' },
        CAN: { value: 'can', icon: '🥫', label: 'Can' }
    },
    
    // ================================
    // BEER STYLES
    // ================================
    BEER_STYLES: [
        'IPA', 'Pale Ale', 'Lager', 'Pilsner', 'Stout', 'Porter',
        'Wheat Beer', 'Saison', 'Amber Ale', 'Brown Ale', 'Bitter',
        'Session IPA', 'Double IPA', 'Hazy IPA', 'Sour', 'Gose',
        'Belgian Ale', 'Blonde Ale', 'Red Ale', 'Mild', 'Best Bitter'
    ],
    
    // REPLACE the existing VALIDATION section with this updated version:

    // ================================
    // GF STATUS SYSTEM
    // ================================
    GF_STATUS: {
        ALWAYS_TAP_CASK: 'always_tap_cask',    // Gold - The holy grail!
        ALWAYS_BOTTLE_CAN: 'always_bottle_can', // Green - Reliable backup
        CURRENTLY: 'currently',                  // Blue - Available now
        NOT_CURRENTLY: 'not_currently',         // Red - None right now
        UNKNOWN: 'unknown'                       // Grey - Needs checking
    },
    
    // Status display configuration
    GF_STATUS_CONFIG: {
        always_tap_cask: {
            label: 'Always Has GF on Tap/Cask',
            shortLabel: 'Always (Tap/Cask)',
            icon: '⭐',
            color: 'gold',
            priority: 1,
            fillColor: '#FFD700',
            borderColor: '#FDB904'
        },
        always_bottle_can: {
            label: 'Always Has GF Bottles/Cans',
            shortLabel: 'Always (Bottles/Cans)',
            icon: '✅',
            color: 'green',
            priority: 2,
            fillColor: '#00F500',
            borderColor: '#00C400'
        },
        currently: {
            label: 'Currently Has GF Beer',
            shortLabel: 'Currently Available',
            icon: '🔵',
            color: 'blue',
            priority: 3,
            fillColor: '#3B82F6',
            borderColor: '#2563EB'
        },
        unknown: {
            label: 'GF Status Unknown',
            shortLabel: 'Unknown',
            icon: '❓',
            color: 'grey',
            priority: 4,
            fillColor: '#9CA3AF',
            borderColor: '#6B7280'
        },
        not_currently: {
            label: 'No GF Beer Currently',
            shortLabel: 'Not Available',
            icon: '❌',
            color: 'red',
            priority: 5,
            fillColor: '#EF4444',
            borderColor: '#DC2626'
        }
    },
    
    // REPLACE the VALIDATION section's validation tiers with:
    VALIDATION: {
        POSTCODE_REGEX: /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i,
        EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        MIN_VENUE_NAME_LENGTH: 2,
        MAX_VENUE_NAME_LENGTH: 100,
        MIN_BEER_NAME_LENGTH: 2,
        MAX_BEER_NAME_LENGTH: 100,
        MIN_ABV: 0,
        MAX_ABV: 20,
        
        // Validation tiers
        TIERS: {
            AUTO_APPROVED: 1,
            SOFT_VALIDATION: 2,
            MANUAL_REVIEW: 3
        },
        
        SOFT_VALIDATION_DELAY: 24, // hours
        
        // Valid status values for API
        VALID_STATUSES: ['always_tap_cask', 'always_bottle_can', 'currently', 'not_currently', 'unknown']
    },
    
    // ================================
    // EXTERNAL SERVICES
    // ================================
    EXTERNAL: {
        GEOCODING_API: 'https://nominatim.openstreetmap.org/search',
        GOOGLE_MAPS_SEARCH: 'https://www.google.com/maps/search/?api=1&query=',
        GOOGLE_MAPS_DIRECTIONS: 'https://www.google.com/maps/dir/?api=1&destination=',
        GOOGLE_SEARCH: 'https://www.google.com/search?q=',
        
        // Location settings for accuracy
        LOCATION_SETTINGS: {
            // High-accuracy GPS attempt
            HIGH_ACCURACY_TIMEOUT: 20000,        // 20 seconds for GPS
            HIGH_ACCURACY_MAX_AGE: 30000,        // 30 seconds cache
            
            // Network fallback attempt  
            FALLBACK_TIMEOUT: 10000,             // 10 seconds for network positioning
            FALLBACK_MAX_AGE: 120000,            // 2 minutes cache for network
            
            // Quality thresholds
            EXCELLENT_ACCURACY: 100,             // ±100m or better = excellent
            GOOD_ACCURACY: 500,                  // ±500m or better = good  
            POOR_ACCURACY: 1000,                 // ±1km = poor but usable
            TERRIBLE_ACCURACY: 5000,             // ±5km = try fallback
            MAX_ACCEPTABLE_ACCURACY: 10000,      // ±10km = reject completely
            
            // User feedback thresholds
            SHOW_ACCURACY_WARNING: 1000,        // Show accuracy warning if > 1km
            SHOW_DISTANCE_WARNING: 2000         // Show distance approximation if > 2km
        }
    },
    
    // ================================
    // ANALYTICS
    // ================================
    ANALYTICS: {
        GA_ID: 'G-WSHR39KSXS',
        EVENTS: {
            SEARCH: 'search',
            VENUE_VIEW: 'venue_view',
            BEER_REPORT: 'beer_report_submitted',
            LOCATION_SEARCH: 'location_search_start',
            MAP_TOGGLE: 'map_toggle',
            EXTERNAL_LINK: 'external_navigation',
            GF_STATUS_UPDATE: 'gf_status_update'
        }
    },
    
    // ================================
    // DEFAULT VALUES
    // ================================
    DEFAULTS: {
        // Fallback stats
        TOTAL_VENUES: 49841,
        GF_VENUES: 0,
        GF_VENUES_THIS_MONTH: 0,
        
        // Admin token (should be in env var)
        ADMIN_TOKEN: 'beer_admin_2025',
        
        // Search defaults
        SEARCH_TYPE: 'all',
        GF_ONLY: false,
        
        // Cookie consent
        COOKIE_CONSENT_DAYS: 365
    },
    
    // ================================
    // FEATURE FLAGS
    // ================================
    FEATURES: {
        ENABLE_ANALYTICS: true,
        ENABLE_HAPTIC_FEEDBACK: true,
        ENABLE_PHOTO_UPLOAD: true,
        ENABLE_ADMIN_DASHBOARD: true,
        ENABLE_BEER_AUTOCOMPLETE: true,
        ENABLE_MAP_CLUSTERING: true,
        ENABLE_SOCIAL_SHARING: false, // Future feature
        ENABLE_USER_ACCOUNTS: false, // Future feature
        ENABLE_REVIEWS: false // Future feature
    },
    
    // ================================
    // ERROR MESSAGES
    // ================================
    ERRORS: {
        GENERIC: 'An error occurred. Please try again.',
        NETWORK: 'Network error. Please check your connection.',
        LOCATION_ERROR: '📍 Location unavailable. Please enable GPS and try again.',
        NO_RESULTS: 'No results found.',
        INVALID_POSTCODE: 'Please enter a valid UK postcode.',
        REQUIRED_FIELDS: 'Please fill in all required fields.',
        SUBMISSION_FAILED: 'Failed to submit report. Please try again.',
        VENUE_NOT_FOUND: 'Venue not found.',
        MAP_LOAD_ERROR: 'Error loading map. Please try again.'
    },
    
    // ================================
    // SUCCESS MESSAGES
    // ================================
    SUCCESS: {
        BEER_REPORT: '🎉 Beer report submitted successfully! Thanks for contributing!',
        LOCATION_FOUND: '📍 Location found!',
        RESULTS_FOUND: '✅ Found {count} results',
        COPIED_TO_CLIPBOARD: '📋 Copied to clipboard!',
        PREFERENCES_SAVED: '✅ Preferences saved successfully',
        STATUS_UPDATED: '✅ Status updated successfully!',
        VENUE_ADDED: '✅ {name} added successfully!'
    }
};

// Freeze the constants to prevent accidental modification
Object.freeze(Constants);
Object.freeze(Constants.API);
Object.freeze(Constants.STATE_KEYS);
Object.freeze(Constants.SEARCH);
Object.freeze(Constants.MAP);
Object.freeze(Constants.UI);
Object.freeze(Constants.BEER_FORMATS);
Object.freeze(Constants.VALIDATION);
Object.freeze(Constants.EXTERNAL);
Object.freeze(Constants.ANALYTICS);
Object.freeze(Constants.DEFAULTS);
Object.freeze(Constants.FEATURES);
Object.freeze(Constants.ERRORS);
Object.freeze(Constants.SUCCESS);

// Deep freeze the nested STATE_KEYS objects
Object.freeze(Constants.STATE_KEYS.LAST_SEARCH);
Object.freeze(Constants.STATE_KEYS.MAP_DATA);

// Make it globally available
window.Constants = Constants;
