// ================================================================================
// TRACKING.JS - Analytics and Event Tracking Module
// Handles: Google Analytics, custom events, and user behavior tracking
// ================================================================================

export const TrackingModule = (function() {
    'use strict';
    
    // Configuration
    const config = {
        GA_ID: 'G-WSHR39KSXS',
        enabled: true,
        debug: false
    };
    
    // Track if analytics is initialized
    let isInitialized = false;
    
    // ================================
    // INITIALIZATION
    // ================================
    
    function init() {
        console.log('🔧 Initializing Tracking Module');
        
        // Check if user has consented to analytics
        const analyticsConsent = localStorage.getItem('analyticsConsent');
        
        if (analyticsConsent === 'true' && typeof gtag !== 'undefined') {
            initializeAnalytics();
        } else {
            console.log('📊 Analytics not initialized - no consent or gtag not loaded');
        }
        
        console.log('✅ Tracking Module initialized');
    }
    
    function initializeAnalytics() {
        if (isInitialized) return;
        
        if (typeof gtag !== 'undefined') {
            gtag('consent', 'update', {
                'analytics_storage': 'granted'
            });
            
            isInitialized = true;
            console.log('✅ Google Analytics initialized with user consent');
        }
    }
    
    // ================================
    // EVENT TRACKING
    // ================================
    
    function trackEvent(action, category = 'User Interaction', label = '', value = null) {
        if (!config.enabled) return;
        
        if (config.debug) {
            console.log('📊 Track Event:', { action, category, label, value });
        }
        
        if (typeof gtag !== 'undefined' && isInitialized) {
            const eventParams = {
                event_category: category,
                event_label: label
            };
            
            if (value !== null) {
                eventParams.value = value;
            }
            
            gtag('event', action, eventParams);
        }
    }
    
    // ================================
    // SPECIALIZED TRACKING FUNCTIONS
    // ================================
    
    function trackSearch(query, searchType, resultCount) {
        trackEvent('search', 'Search', `${searchType}: ${query} (${resultCount} results)`);
    }
    
    function trackPubView(pubName) {
        trackEvent('pub_view', 'Pub Interaction', pubName);
    }
    
    function trackMapInteraction(action, details) {
        trackEvent(`map_${action}`, 'Map Interaction', details);
    }
    
    function trackFormSubmission(formName, details) {
        trackEvent('form_submission', 'Form', `${formName}: ${details}`);
    }
    
    function trackExternalLink(url, context) {
        trackEvent('external_link', 'External Navigation', `${context}: ${url}`);
    }
    
    function trackError(errorType, errorMessage) {
        trackEvent('error', 'Error', `${errorType}: ${errorMessage}`);
    }
    
    function trackFeatureUsage(feature, action) {
        trackEvent(`feature_${action}`, 'Feature Usage', feature);
    }
    
    // ================================
    // PAGE VIEW TRACKING
    // ================================
    
    function trackPageView(pageName, pageTitle) {
        if (typeof gtag !== 'undefined' && isInitialized) {
            gtag('event', 'page_view', {
                page_title: pageTitle || pageName,
                page_location: window.location.href,
                page_path: window.location.pathname
            });
        }
    }
    
    // ================================
    // TIMING TRACKING
    // ================================
    
    function trackTiming(category, variable, value, label) {
        if (typeof gtag !== 'undefined' && isInitialized) {
            gtag('event', 'timing_complete', {
                name: variable,
                value: Math.round(value),
                event_category: category,
                event_label: label
            });
        }
    }
    
    // ================================
    // E-COMMERCE TRACKING (for future use)
    // ================================
    
    function trackDonation(amount, currency = 'GBP') {
        if (typeof gtag !== 'undefined' && isInitialized) {
            gtag('event', 'purchase', {
                transaction_id: Date.now().toString(),
                value: amount,
                currency: currency,
                items: [{
                    item_name: 'Donation',
                    price: amount,
                    quantity: 1
                }]
            });
        }
    }
    
    // ================================
    // CONSENT MANAGEMENT
    // ================================
    
    function updateConsent(analyticsAllowed) {
        if (analyticsAllowed) {
            localStorage.setItem('analyticsConsent', 'true');
            if (!isInitialized) {
                initializeAnalytics();
            }
        } else {
            localStorage.setItem('analyticsConsent', 'false');
            isInitialized = false;
            
            if (typeof gtag !== 'undefined') {
                gtag('consent', 'update', {
                    'analytics_storage': 'denied'
                });
            }
        }
    }
    
    // ================================
    // DEBUG HELPERS
    // ================================
    
    function enableDebug() {
        config.debug = true;
        console.log('📊 Tracking debug mode enabled');
    }
    
    function disableDebug() {
        config.debug = false;
        console.log('📊 Tracking debug mode disabled');
    }
    
    function getTrackingStatus() {
        return {
            enabled: config.enabled,
            initialized: isInitialized,
            consent: localStorage.getItem('analyticsConsent') === 'true',
            debug: config.debug
        };
    }
    
    // ================================
    // PUBLIC API
    // ================================
    
    return {
        init,
        trackEvent,
        trackSearch,
        trackPubView,
        trackMapInteraction,
        trackFormSubmission,
        trackExternalLink,
        trackError,
        trackFeatureUsage,
        trackPageView,
        trackTiming,
        trackDonation,
        updateConsent,
        enableDebug,
        disableDebug,
        getTrackingStatus
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', TrackingModule.init);
} else {
    TrackingModule.init();
}

// Make it globally available
window.TrackingModule = TrackingModule;
