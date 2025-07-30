// ================================================================================
// TRACKING.JS - Complete Refactor with STATE_KEYS
// Handles: Google Analytics, custom events, user behavior tracking, consent
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const TrackingModule = (function() {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        initialized: false,
        consentGranted: false,
        pendingEvents: [],
        sessionStartTime: Date.now(),
        pageViewCount: 0
    };
    
    const config = {
        GA_ID: Constants.ANALYTICS.GA_ID,
        enabled: Constants.FEATURES.ENABLE_ANALYTICS,
        debug: false,
        batchDelay: 1000,
        maxPendingEvents: 50
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get helpers() { return window.App?.getModule('helpers'); }
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🔧 Initializing Tracking Module');
        
        // Check stored consent
        const storedConsent = modules.helpers?.Storage.get('analyticsConsent');
        
        if (storedConsent === true && isGtagAvailable()) {
            initializeAnalytics();
        } else {
            console.log('📊 Analytics not initialized - awaiting consent');
            setupConsentListener();
        }
        
        // Set up page visibility tracking
        setupVisibilityTracking();
        
        console.log('✅ Tracking Module initialized');
    };
    
    const initializeAnalytics = () => {
        if (state.initialized || !config.enabled) return;
        
        if (isGtagAvailable()) {
            gtag('consent', 'update', {
                'analytics_storage': 'granted'
            });
            
            gtag('config', config.GA_ID, {
                'anonymize_ip': true,
                'cookie_flags': 'SameSite=None;Secure',
                'custom_map.dimension1': 'user_type',
                'custom_map.dimension2': 'search_type'
            });
            
            state.initialized = true;
            state.consentGranted = true;
            
            // Process any pending events
            processPendingEvents();
            
            console.log('✅ Google Analytics initialized with consent');
        }
    };
    
    // ================================
    // CONSENT MANAGEMENT
    // ================================
    const updateConsent = (analyticsAllowed) => {
        const helpers = modules.helpers;
        if (!helpers) return;
        
        if (analyticsAllowed) {
            helpers.Storage.set('analyticsConsent', true);
            state.consentGranted = true;
            
            if (!state.initialized) {
                initializeAnalytics();
            }
            
            trackEvent('consent_granted', 'Privacy', 'analytics');
        } else {
            helpers.Storage.set('analyticsConsent', false);
            state.consentGranted = false;
            state.initialized = false;
            
            if (isGtagAvailable()) {
                gtag('consent', 'update', {
                    'analytics_storage': 'denied'
                });
                
                // Clear GA cookies
                clearAnalyticsCookies();
            }
            
            // Clear pending events
            state.pendingEvents = [];
        }
    };
    
    const setupConsentListener = () => {
        // Listen for consent changes via custom event
        document.addEventListener('analyticsConsentChanged', (e) => {
            updateConsent(e.detail.granted);
        });
    };
    
    // ================================
    // EVENT TRACKING
    // ================================
    const trackEvent = (action, category = 'User Interaction', label = '', value = null) => {
        if (!config.enabled) return;
        
        const eventData = {
            action,
            category,
            label,
            value,
            timestamp: Date.now()
        };
        
        if (config.debug) {
            console.log('📊 Track Event:', eventData);
        }
        
        if (state.initialized && isGtagAvailable()) {
            sendEvent(eventData);
        } else if (state.pendingEvents.length < config.maxPendingEvents) {
            // Queue event if not initialized
            state.pendingEvents.push(eventData);
        }
    };
    
    const sendEvent = (eventData) => {
        const eventParams = {
            event_category: eventData.category,
            event_label: eventData.label,
            transport: 'beacon'
        };
        
        if (eventData.value !== null) {
            eventParams.value = eventData.value;
        }
        
        // Add session context
        eventParams.session_duration = Math.round((Date.now() - state.sessionStartTime) / 1000);
        eventParams.page_views = state.pageViewCount;
        
        gtag('event', eventData.action, eventParams);
    };
    
    const processPendingEvents = () => {
        if (state.pendingEvents.length === 0) return;
        
        console.log(`📊 Processing ${state.pendingEvents.length} pending events`);
        
        const events = [...state.pendingEvents];
        state.pendingEvents = [];
        
        // Send in batches to avoid overwhelming GA
        events.forEach((event, index) => {
            setTimeout(() => sendEvent(event), index * 100);
        });
    };
    
    // ================================
    // SPECIALIZED TRACKING
    // ================================
    const trackSearch = (query, searchType, resultCount) => {
        // Store search data in state
        window.App.setState(STATE_KEYS.LAST_SEARCH.TYPE, searchType);
        window.App.setState(STATE_KEYS.LAST_SEARCH.QUERY, query);
        window.App.setState(STATE_KEYS.LAST_SEARCH.TIMESTAMP, Date.now());
        
        trackEvent('search', 'Search', `${searchType}: ${query}`, resultCount);
        
        // Track search performance
        if (resultCount === 0) {
            trackEvent('search_no_results', 'Search', `${searchType}: ${query}`);
        }
    };
    
    const trackPubView = (pubName, pubId) => {
        trackEvent('pub_view', 'Content', pubName);
        
        // Track engagement depth
        const searchType = window.App.getState(STATE_KEYS.LAST_SEARCH.TYPE);
        if (searchType) {
            trackEvent('search_to_pub_view', 'User Flow', searchType);
        }
    };
    
    const trackMapInteraction = (action, details) => {
        const mapMode = window.App.getState(STATE_KEYS.MAP_VIEW_MODE) || 'unknown';
        trackEvent(`map_${action}`, 'Map', `${mapMode}: ${details}`);
    };
    
    const trackFormSubmission = (formName, formData = {}) => {
        trackEvent('form_submit', 'Form', formName);
        
        // Track form completion rate
        if (formData.fields_completed && formData.total_fields) {
            const completionRate = Math.round((formData.fields_completed / formData.total_fields) * 100);
            trackEvent('form_completion_rate', 'Form', formName, completionRate);
        }
    };
    
    const trackError = (errorType, errorMessage, fatal = false) => {
        trackEvent('exception', 'Error', `${errorType}: ${errorMessage}`, fatal ? 1 : 0);
        
        if (fatal) {
            // Send immediately for fatal errors
            if (isGtagAvailable()) {
                gtag('event', 'exception', {
                    description: errorMessage,
                    fatal: true,
                    transport: 'beacon'
                });
            }
        }
    };
    
    const trackTiming = (category, variable, duration, label = '') => {
        const roundedDuration = Math.round(duration);
        
        trackEvent('timing_complete', 'Performance', `${category}: ${variable}`, roundedDuration);
        
        if (isGtagAvailable() && state.initialized) {
            gtag('event', 'timing_complete', {
                name: variable,
                value: roundedDuration,
                event_category: category,
                event_label: label
            });
        }
    };
    
    const trackExternalLink = (url, context) => {
        trackEvent('external_link', 'Outbound', `${context}: ${url}`);
    };
    
    // ================================
    // PAGE & SESSION TRACKING
    // ================================
    const trackPageView = (pageName, pageData = {}) => {
        state.pageViewCount++;
        
        const viewData = {
            page_title: pageData.title || pageName,
            page_location: window.location.href,
            page_path: window.location.pathname,
            page_referrer: document.referrer,
            ...pageData
        };
        
        if (isGtagAvailable() && state.initialized) {
            gtag('event', 'page_view', viewData);
        }
        
        // Track view in our event system
        trackEvent('page_view', 'Navigation', pageName);
    };
    
    const trackSessionStart = () => {
        state.sessionStartTime = Date.now();
        trackEvent('session_start', 'Session', getSessionContext());
    };
    
    const trackSessionEnd = () => {
        const duration = Math.round((Date.now() - state.sessionStartTime) / 1000);
        trackEvent('session_end', 'Session', getSessionContext(), duration);
    };
    
    const getSessionContext = () => {
        const viewport = modules.helpers?.getViewportSize() || {};
        return `${viewport.isMobile ? 'mobile' : 'desktop'}_${state.pageViewCount}pages`;
    };
    
    // ================================
    // VISIBILITY & ENGAGEMENT
    // ================================
    const setupVisibilityTracking = () => {
        let hiddenTime = 0;
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                hiddenTime = Date.now();
            } else if (hiddenTime) {
                const awayDuration = Math.round((Date.now() - hiddenTime) / 1000);
                if (awayDuration > 30) {
                    trackEvent('user_return', 'Engagement', `away_${awayDuration}s`);
                }
                hiddenTime = 0;
            }
        });
        
        // Track before unload
        window.addEventListener('beforeunload', () => {
            trackSessionEnd();
        });
    };
    
    // ================================
    // UTILITIES
    // ================================
    const isGtagAvailable = () => {
        return typeof gtag !== 'undefined';
    };
    
    const clearAnalyticsCookies = () => {
        // Clear GA cookies
        document.cookie.split(';').forEach(cookie => {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            if (name.startsWith('_ga') || name.startsWith('_gid')) {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            }
        });
    };
    
    // ================================
    // DEBUG HELPERS
    // ================================
    const enableDebug = () => {
        config.debug = true;
        console.log('📊 Tracking debug enabled');
        console.log('📊 Current state:', getDebugInfo());
    };
    
    const disableDebug = () => {
        config.debug = false;
        console.log('📊 Tracking debug disabled');
    };
    
    const getDebugInfo = () => {
        return {
            initialized: state.initialized,
            consentGranted: state.consentGranted,
            pendingEvents: state.pendingEvents.length,
            pageViews: state.pageViewCount,
            sessionDuration: Math.round((Date.now() - state.sessionStartTime) / 1000),
            gaAvailable: isGtagAvailable()
        };
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        
        // Core tracking
        trackEvent,
        trackPageView,
        trackTiming,
        trackError,
        
        // Specialized tracking
        trackSearch,
        trackPubView,
        trackMapInteraction,
        trackFormSubmission,
        trackExternalLink,
        
        // Session tracking
        trackSessionStart,
        trackSessionEnd,
        
        // Consent
        updateConsent,
        
        // Debug
        enableDebug,
        disableDebug,
        getDebugInfo,
        
        // State getters
        isInitialized: () => state.initialized,
        hasConsent: () => state.consentGranted
    };
})();

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', TrackingModule.init);
} else {
    TrackingModule.init();
}

// Do NOT add window.TrackingModule here - let main.js handle registration
