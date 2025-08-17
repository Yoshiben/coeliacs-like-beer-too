// ================================================================================
// HELPERS.JS - Cleaned Version (Toast functionality moved to toast.js)
// Handles: UI utilities, storage, animations, overlays, responsive helpers
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const HelpersModule = (function() {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        resizeTimeout: null,
        scrollPositions: new Map()
    };
    
    const config = {
        debounce: {
            resize: 250,
            scroll: 150
        }
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get tracking() { return window.App?.getModule('tracking'); },
        get toast() { return window.App?.getModule('toast'); }
    };
    
    // ================================
    // UTILITIES
    // ================================
    const debounce = (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    };
    
    const throttle = (func, limit) => {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };
    
    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };
    
    // ================================
    // OVERLAY MANAGEMENT
    // ================================
    const showOverlay = (overlayId, options = {}) => {
        const overlay = document.getElementById(overlayId);
        if (!overlay) {
            console.error(`Overlay not found: ${overlayId}`);
            return false;
        }
        
        // Store scroll position
        if (options.preserveScroll) {
            state.scrollPositions.set(overlayId, window.scrollY);
        }
        
        // Update state
        const activeOverlays = window.App.getState(STATE_KEYS.ACTIVE_OVERLAYS) || new Set();
        activeOverlays.add(overlayId);
        window.App.setState(STATE_KEYS.ACTIVE_OVERLAYS, activeOverlays);
        
        // Show overlay
        overlay.style.display = 'flex';
        overlay.classList.add('active');
        
        // Lock body scroll if needed
        if (options.lockScroll !== false) {
            document.body.style.overflow = 'hidden';
        }
        
        // Update current view if specified
        if (options.view) {
            window.App.setState(STATE_KEYS.CURRENT_VIEW, options.view);
        }
        
        // Track event
        modules.tracking?.trackEvent('overlay_show', 'UI', overlayId);
        
        return true;
    };
    
    const hideOverlay = (overlayId) => {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return false;
        
        // Update state
        const activeOverlays = window.App.getState(STATE_KEYS.ACTIVE_OVERLAYS) || new Set();
        activeOverlays.delete(overlayId);
        window.App.setState(STATE_KEYS.ACTIVE_OVERLAYS, activeOverlays);
        
        // Hide overlay
        overlay.style.display = 'none';
        overlay.classList.remove('active');
        
        // Restore scroll if needed
        const scrollPos = state.scrollPositions.get(overlayId);
        if (scrollPos !== undefined) {
            window.scrollTo(0, scrollPos);
            state.scrollPositions.delete(overlayId);
        }
        
        // Unlock body scroll if no overlays active
        if (activeOverlays.size === 0) {
            document.body.style.overflow = '';
        }
        
        return true;
    };
    
    const hideAllOverlays = () => {
        const activeOverlays = window.App.getState(STATE_KEYS.ACTIVE_OVERLAYS) || new Set();
        activeOverlays.forEach(overlayId => hideOverlay(overlayId));
        
        window.App.setState(STATE_KEYS.CURRENT_VIEW, 'home');
        document.body.style.overflow = '';
    };
    
    // ================================
    // VIEW MANAGEMENT
    // ================================
    const showHomeView = () => {
        console.log('🏠 Showing home view');
        
        hideAllOverlays();
        
        const elements = {
            hero: document.querySelector('.hero-section'),
            search: document.querySelector('.search-section'),
            community: document.querySelector('.community-home')
        };
        
        if (elements.hero) elements.hero.style.display = 'block';
        if (elements.search) elements.search.style.display = 'flex';
        if (elements.community) elements.community.style.display = 'block';
        
        window.App.setState(STATE_KEYS.CURRENT_VIEW, 'home');
        updateNavigationState();
        
        window.scrollTo(0, 0);
    };
    
    const closeAllOverlaysAndGoHome = () => {
        console.log('🏠 Closing all overlays and returning home');
        
        // Close specific overlays
        ['venueDetailsOverlay', 'resultsOverlay', 'fullMapOverlay'].forEach(id => {
            const overlay = document.getElementById(id);
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.remove('active');
            }
        });
        
        // Clean up any map instances
        const mapModule = window.App?.getModule('map');
        mapModule?.cleanupResultsMap?.();
        
        showHomeView();
        
        // Track navigation
        modules.tracking?.trackEvent('navigation_home', 'UI', 'overlay_close');
        
        return true;
    };
    
    const updateNavigationState = () => {
        const currentView = window.App.getState(STATE_KEYS.CURRENT_VIEW) || 'home';
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavMap = {
            'home': '[href="/"]',
            'map': '[data-action="show-full-map"]',
            'breweries': '[href="/breweries"]',
            'about': '[href="/about"]'
        };
        
        const selector = activeNavMap[currentView];
        if (selector) {
            const activeNav = document.querySelector(`.nav-item${selector}`);
            if (activeNav) activeNav.classList.add('active');
        }
    };
    
    // ================================
    // ANIMATIONS
    // ================================
    const animateNumber = (elementId, targetValue, duration = 1000) => {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`Element ${elementId} not found for animation`);
            return;
        }
        
        // Handle string values directly
        if (typeof targetValue === 'string') {
            element.textContent = targetValue;
            return;
        }
        
        const startNumber = parseInt(element.textContent.replace(/[^0-9]/g, '')) || 0;
        const startTime = performance.now();
        
        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentNumber = Math.floor(startNumber + (targetValue - startNumber) * easeOut);
            
            element.textContent = currentNumber.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                element.textContent = targetValue.toLocaleString();
            }
        };
        
        requestAnimationFrame(updateNumber);
    };
    
    // ================================
    // STORAGE HELPERS
    // ================================
    const Storage = {
        get: (key, defaultValue = null) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Storage read error:', e);
                return defaultValue;
            }
        },
        
        set: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage write error:', e);
                return false;
            }
        },
        
        remove: (key) => {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error('Storage remove error:', e);
                return false;
            }
        },
        
        clear: () => {
            try {
                localStorage.clear();
                return true;
            } catch (e) {
                console.error('Storage clear error:', e);
                return false;
            }
        },
        
        has: (key) => localStorage.getItem(key) !== null
    };
    
    // ================================
    // RESPONSIVE HELPERS
    // ================================
    const getViewportSize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        return {
            width,
            height,
            isMobile: width <= 768,
            isTablet: width > 768 && width <= 1024,
            isDesktop: width > 1024,
            orientation: width > height ? 'landscape' : 'portrait'
        };
    };
    
    // Shorthand methods
    const isMobile = () => window.innerWidth <= 768;
    const isTablet = () => window.innerWidth > 768 && window.innerWidth <= 1024;
    const isDesktop = () => window.innerWidth > 1024;
    
    // ================================
    // ELEMENT UTILITIES
    // ================================
    const updateElementText = (elementId, text) => {
        const element = document.getElementById(elementId);
        if (element) element.textContent = text;
    };
    
    const updateElementHTML = (elementId, html) => {
        const element = document.getElementById(elementId);
        if (element) element.innerHTML = html;
    };
    
    const toggleClass = (elementId, className) => {
        const element = document.getElementById(elementId);
        if (element) element.classList.toggle(className);
    };
    
    const setElementVisibility = (elementId, visible) => {
        const element = document.getElementById(elementId);
        if (element) element.style.display = visible ? 'block' : 'none';
    };
    
    const scrollToElement = (elementId, options = {}) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const defaultOptions = {
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        };
        
        element.scrollIntoView({ ...defaultOptions, ...options });
    };
    
    // ================================
    // VALIDATION HELPERS
    // ================================
    const isValidPostcode = (postcode) => {
        const regex = Constants.VALIDATION.POSTCODE_REGEX;
        return regex.test(postcode.replace(/\s/g, ''));
    };
    
    const isValidEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };
    
    // ================================
    // EVENT LISTENERS
    // ================================
    const setupEventListeners = () => {
        // Debounced resize handler
        const handleResize = debounce(() => {
            const viewport = getViewportSize();
            document.body.setAttribute('data-viewport', 
                viewport.isMobile ? 'mobile' : 
                viewport.isTablet ? 'tablet' : 'desktop'
            );
            
            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('viewportChange', { detail: viewport }));
        }, config.debounce.resize);
        
        window.addEventListener('resize', handleResize);
        
        // Handle back button
        window.addEventListener('popstate', (e) => {
            if (e.state?.view) {
                handleViewChange(e.state.view);
            }
        });
    };
    
    const handleViewChange = (view) => {
        switch(view) {
            case 'home':
                showHomeView();
                break;
            case 'results':
            case 'venue':
                // Let search module handle these
                break;
            default:
                console.warn(`Unknown view: ${view}`);
        }
    };
    
    const initializeViewport = () => {
        const viewport = getViewportSize();
        document.body.setAttribute('data-viewport', 
            viewport.isMobile ? 'mobile' : 
            viewport.isTablet ? 'tablet' : 'desktop'
        );
    };
    
    // ================================
    // TOAST LEGACY SUPPORT
    // These just redirect to the toast module for backwards compatibility
    // ================================
    const showToast = (message, type, duration) => {
        return modules.toast?.show(message, type, { duration });
    };
    
    const showSuccessToast = (message) => {
        return modules.toast?.success(message);
    };
    
    const showErrorToast = (message) => {
        return modules.toast?.error(message);
    };
    
    const showLoadingToast = (message) => {
        console.warn('⚠️ Loading toasts are deprecated. Use proper loading UI instead.');
        return { hide: () => {} };
    };
    
    const hideLoadingToast = () => {
        console.warn('⚠️ Loading toasts are deprecated.');
    };
    
    const clearAllToasts = () => {
        return modules.toast?.clear();
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🔧 Initializing Helpers Module');
        
        setupEventListeners();
        initializeViewport();
        
        console.log('✅ Helpers Module initialized');
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        
        // Toast legacy support (redirects to toast module)
        showToast,
        showSuccessToast,
        showErrorToast,
        showLoadingToast,
        hideLoadingToast,
        clearAllToasts,
        
        // Overlay management
        showOverlay,
        hideOverlay,
        hideAllOverlays,
        
        // View management
        showHomeView,
        closeAllOverlaysAndGoHome,
        updateNavigationState,
        
        // Animations
        animateNumber,
        
        // Storage
        Storage,
        
        // Utilities
        debounce,
        throttle,
        escapeHtml,
        calculateDistance,
        
        // Responsive
        getViewportSize,
        isMobile,
        isTablet,
        isDesktop,
        
        // Element utilities
        updateElementText,
        updateElementHTML,
        toggleClass,
        setElementVisibility,
        scrollToElement,
        
        // Validation
        isValidPostcode,
        isValidEmail,
        
        // Legacy support
        closeResults: closeAllOverlaysAndGoHome
    };
})();

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', HelpersModule.init);
} else {
    HelpersModule.init();
}

// Make it globally available for legacy code
window.HelpersModule = HelpersModule;
