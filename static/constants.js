// ================================================================================
// CONSTANTS.JS - App-wide Constants and Configuration
// Handles: API endpoints, search types, default values, feature flags
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
        PUB_MARKER_RADIUS: 12,
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
    
    // ================================
    // VALIDATION
    // ================================
    VALIDATION: {
        POSTCODE_REGEX: /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i,
        EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        MIN_PUB_NAME_LENGTH: 2,
        MAX_PUB_NAME_LENGTH: 100,
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
        
        SOFT_VALIDATION_DELAY: 24 // hours
    },
    
    // ================================
    // EXTERNAL SERVICES
    // ================================
    EXTERNAL: {
        GEOCODING_API: 'https://nominatim.openstreetmap.org/search',
        GOOGLE_MAPS_SEARCH: 'https://www.google.com/maps/search/?api=1&query=',
        GOOGLE_MAPS_DIRECTIONS: 'https://www.google.com/maps/dir/?api=1&destination=',
        GOOGLE_SEARCH: 'https://www.google.com/search?q=',

        // 🔧 ADD: Enhanced location settings
        LOCATION_SETTINGS: {
            HIGH_ACCURACY_TIMEOUT: 15000,        // 15 seconds for GPS
            FALLBACK_TIMEOUT: 5000,              // 5 seconds for network fallback  
            CACHE_DURATION: 300000,              // 5 minutes cache (was too long!)
            ACCURACY_THRESHOLD: 1000,            // Warn if accuracy > 1km
            MAX_ACCEPTABLE_ACCURACY: 5000        // Reject if accuracy > 5km
        }
    },
    
    // ================================
    // ANALYTICS
    // ================================
    ANALYTICS: {
        GA_ID: 'G-WSHR39KSXS',
        EVENTS: {
            SEARCH: 'search',
            PUB_VIEW: 'pub_view',
            BEER_REPORT: 'beer_report_submitted',
            LOCATION_SEARCH: 'location_search_start',
            MAP_TOGGLE: 'map_toggle',
            EXTERNAL_LINK: 'external_navigation'
        }
    },
    
    // ================================
    // DEFAULT VALUES
    // ================================
    DEFAULTS: {
        // Fallback stats
        TOTAL_PUBS: 49841,
        GF_PUBS: 1249,
        
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
        ENABLE_MAP_CLUSTERING: false, // Future feature
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
        LOCATION_DENIED: '📍 Location access denied. Please allow location access and try again.',
        LOCATION_UNAVAILABLE: '📍 Location unavailable. Please check your GPS settings.',
        LOCATION_TIMEOUT: '📍 Location request timed out. Please try again.',
        NO_RESULTS: 'No results found.',
        INVALID_POSTCODE: 'Please enter a valid UK postcode.',
        REQUIRED_FIELDS: 'Please fill in all required fields.',
        SUBMISSION_FAILED: 'Failed to submit report. Please try again.'
    },
    
    // ================================
    // SUCCESS MESSAGES
    // ================================
    SUCCESS: {
        BEER_REPORT: '🎉 Beer report submitted successfully! Thanks for contributing!',
        LOCATION_FOUND: '📍 Location found!',
        RESULTS_FOUND: '✅ Found {count} results',
        COPIED_TO_CLIPBOARD: '📋 Copied to clipboard!',
        PREFERENCES_SAVED: '✅ Preferences saved successfully'
    }
};

// Freeze the constants to prevent accidental modification
Object.freeze(Constants);

// Make it globally available
window.Constants = Constants;
