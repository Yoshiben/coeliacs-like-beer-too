// ================================================================================
// HELPERS.JS - Consolidated UI and Utils Module
// Combines functionality from ui.js and utils.js, removing redundancy
// ================================================================================

export const HelpersModule = (function() {
    'use strict';
    
    // Private state
    const state = {
        activeOverlays: new Set(),
        isLoading: false,
        currentView: 'home'
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    
    function init() {
        console.log('🔧 Initializing Helpers Module');
        setupUIListeners();
        updateNavigationState();
        console.log('✅ Helpers Module initialized');
    }
    
    // ================================
    // TOAST NOTIFICATION SYSTEM
    // ================================
    
    const showLoadingToast = (message = 'Loading...') => {
        const toast = document.getElementById('loadingToast');
        if (!toast) {
            console.warn('Loading toast element not found');
            return;
        }
        
        const messageEl = document.getElementById('loadingMessage');
        if (messageEl) messageEl.textContent = message;
        
        toast.style.display = 'block';
        toast.style.animation = 'slideInUp 0.3s ease-out';
    };
    
    const hideLoadingToast = () => {
        const toast = document.getElementById('loadingToast');
        if (!toast) return;
        
        toast.style.animation = 'slideOutDown 0.3s ease-in';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    };
    
    const showSuccessToast = (message = 'Success!') => {
        const toast = document.getElementById('successToast');
        if (!toast) {
            console.warn('Success toast element not found');
            console.log('✅', message);
            return;
        }
        
        const messageEl = document.getElementById('successMessage');
        if (messageEl) messageEl.textContent = message;
        
        toast.style.display = 'block';
        toast.style.animation = 'slideInUp 0.3s ease-out';
        
        setTimeout(() => {
            toast.style.animation = 'slideOutDown 0.3s ease-in';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 300);
        }, 3000);
    };
    
    // ================================
    // OVERLAY MANAGEMENT (from ui.js)
    // ================================
    
    function showOverlay(overlayId, options = {}) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return false;
        
        state.activeOverlays.add(overlayId);
        overlay.classList.add('active');
        overlay.style.display = 'flex';
        
        if (options.lockScroll !== false) {
            document.body.style.overflow = 'hidden';
        }
        
        if (options.view) {
            state.currentView = options.view;
        }
        
        return true;
    }
    
    function hideOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return false;
        
        state.activeOverlays.delete(overlayId);
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        
        if (state.activeOverlays.size === 0) {
            document.body.style.overflow = '';
        }
        
        return true;
    }
    
    function hideAllOverlays() {
        state.activeOverlays.forEach(overlayId => {
            hideOverlay(overlayId);
        });
        
        state.currentView = 'home';
        updateNavigationState();
    }
    
    // ================================
    // CENTRALIZED OVERLAY MANAGEMENT (from utils.js)
    // ================================
    
    const closeAllOverlaysAndGoHome = () => {
        console.log('🏠 Closing all overlays and returning to home');
        
        const pubDetailsOverlay = document.getElementById('pubDetailsOverlay');
        if (pubDetailsOverlay && pubDetailsOverlay.classList.contains('active')) {
            pubDetailsOverlay.style.display = 'none';
            pubDetailsOverlay.classList.remove('active');
            console.log('✅ Pub details overlay closed');
        }
        
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay && resultsOverlay.classList.contains('active')) {
            resultsOverlay.style.display = 'none';
            resultsOverlay.classList.remove('active');
            console.log('✅ Results overlay closed');
        }
        
        const heroSection = document.querySelector('.hero-section');
        const searchSection = document.querySelector('.search-section');
        if (heroSection) {
            heroSection.style.display = 'block';
            heroSection.style.visibility = 'visible';
            console.log('✅ Hero section restored');
        }
        if (searchSection) {
            searchSection.style.display = 'flex';
            searchSection.style.visibility = 'visible';
            console.log('✅ Search section restored');
        }
        
        document.body.style.overflow = '';
        
        const resultsMapContainer = document.getElementById('resultsMapContainer');
        const resultsListContainer = document.getElementById('resultsListContainer');
        const mapBtnText = document.getElementById('resultsMapBtnText');
        
        if (resultsMapContainer) resultsMapContainer.style.display = 'none';
        if (resultsListContainer) resultsListContainer.style.display = 'block';
        if (mapBtnText) mapBtnText.textContent = 'Map';
        
        if (window.App?.getModule('tracking')) {
            window.App.getModule('tracking').trackEvent('close_overlays', 'Navigation', 'home');
        }
        
        console.log('✅ Successfully returned to home view');
        return true;
    };
    
    const closeResults = () => {
        console.log('🏠 closeResults called - delegating to centralized function');
        return closeAllOverlaysAndGoHome();
    };
    
    // ================================
    // VIEW MANAGEMENT (from ui.js)
    // ================================
    
    function showHomeView() {
        hideAllOverlays();
        
        const heroSection = document.querySelector('.hero-section');
        const searchSection = document.querySelector('.search-section');
        
        if (heroSection) heroSection.style.display = 'block';
        if (searchSection) searchSection.style.display = 'block';
        
        state.currentView = 'home';
        updateNavigationState();
        
        window.scrollTo(0, 0);
    }
    
    function showResultsView() {
        const heroSection = document.querySelector('.hero-section');
        const searchSection = document.querySelector('.search-section');
        
        if (heroSection) heroSection.style.display = 'none';
        if (searchSection) searchSection.style.display = 'none';
        
        state.currentView = 'results';
        updateNavigationState();
    }
    
    function updateNavigationState() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavMap = {
            'home': 'a[href="/"]',
            'map': 'a[href="#"][onclick*="Map"]',
            'breweries': 'a[href="/breweries"]',
            'about': 'a[href="/about"]'
        };
        
        const activeSelector = activeNavMap[state.currentView];
        if (activeSelector) {
            const activeNav = document.querySelector(`.nav-item${activeSelector}`);
            if (activeNav) activeNav.classList.add('active');
        }
    }
    
    // ================================
    // LOADING STATES (from ui.js)
    // ================================
    
    function showLoading(container, message = 'Loading...') {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        
        if (!container) return;
        
        const loadingHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        
        container.innerHTML = loadingHTML;
        state.isLoading = true;
    }
    
    function hideLoading(container) {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        
        if (!container) return;
        
        const loadingEl = container.querySelector('.loading-state');
        if (loadingEl) loadingEl.remove();
        
        state.isLoading = false;
    }
    
    // ================================
    // NUMBER ANIMATION (from utils.js)
    // ================================
    
    const animateNumber = (elementId, targetNumber, duration = 2000) => {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`Element ${elementId} not found for number animation`);
            return;
        }
        
        const startNumber = parseInt(element.textContent.replace(/,/g, '')) || 0;
        const startTime = performance.now();
        
        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentNumber = Math.floor(startNumber + (targetNumber - startNumber) * easeOut);
            
            element.textContent = currentNumber.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                element.textContent = targetNumber.toLocaleString();
            }
        };
        
        requestAnimationFrame(updateNumber);
    };
    
    // ================================
    // UTILITY FUNCTIONS (from utils.js)
    // ================================
    
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
    
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
    
    // ================================
    // STORAGE HELPERS (from utils.js)
    // ================================
    
    const Storage = {
        get: (key, defaultValue = null) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Error reading from localStorage:', e);
                return defaultValue;
            }
        },
        
        set: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Error writing to localStorage:', e);
                return false;
            }
        },
        
        remove: (key) => {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error('Error removing from localStorage:', e);
                return false;
            }
        },
        
        clear: () => {
            try {
                localStorage.clear();
                return true;
            } catch (e) {
                console.error('Error clearing localStorage:', e);
                return false;
            }
        }
    };
    
    // ================================
    // RESPONSIVE HELPERS
    // ================================
    
    function isMobile() {
        return window.innerWidth <= 768;
    }
    
    function isTablet() {
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    }
    
    function isDesktop() {
        return window.innerWidth > 1024;
    }
    
    function getViewportSize() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            isMobile: isMobile(),
            isTablet: isTablet(),
            isDesktop: isDesktop()
        };
    }
    
    // ================================
    // SCROLL MANAGEMENT
    // ================================
    
    function scrollToElement(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const defaultOptions = {
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        };
        
        element.scrollIntoView({ ...defaultOptions, ...options });
    }
    
    // ================================
    // ELEMENT UTILITIES (from ui.js)
    // ================================
    
    function updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = text;
    }
    
    function updateElementHTML(elementId, html) {
        const element = document.getElementById(elementId);
        if (element) element.innerHTML = html;
    }
    
    function toggleClass(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) element.classList.toggle(className);
    }
    
    function setElementVisibility(elementId, visible) {
        const element = document.getElementById(elementId);
        if (element) element.style.display = visible ? 'block' : 'none';
    }
    
    // ================================
    // VALIDATION HELPERS (from utils.js)
    // ================================
    
    const isValidPostcode = (postcode) => {
        const regex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
        return regex.test(postcode.replace(/\s/g, ''));
    };
    
    const isValidEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };
    
    // ================================
    // EVENT LISTENERS (from ui.js - simplified)
    // ================================
    
    function setupUIListeners() {
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                handleResize();
            }, 250);
        });
        
        // Handle back button
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.view) {
                handleViewChange(e.state.view);
            }
        });
        
        // Mobile touch feedback for search options
        const searchOptions = document.querySelectorAll('.search-option');
        searchOptions.forEach(option => {
            option.addEventListener('touchstart', function(e) {
                this.style.transform = 'scale(0.97)';
                if ('vibrate' in navigator) navigator.vibrate(8);
            }, { passive: true });
            
            option.addEventListener('touchend', function(e) {
                this.style.transform = '';
                this.classList.add('tapped');
                setTimeout(() => this.classList.remove('tapped'), 200);
            }, { passive: true });
            
            option.addEventListener('click', function(e) {
                this.classList.add('loading');
                setTimeout(() => this.classList.remove('loading'), 400);
                if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
            });
            
            option.addEventListener('touchcancel', function(e) {
                this.style.transform = '';
            }, { passive: true });
        });
    }
    
    function handleResize() {
        const viewport = getViewportSize();
        document.body.setAttribute('data-viewport', 
            viewport.isMobile ? 'mobile' : 
            viewport.isTablet ? 'tablet' : 'desktop'
        );
    }
    
    function handleViewChange(view) {
        switch(view) {
            case 'home':
                showHomeView();
                break;
            case 'results':
            case 'pub':
                // These would be restored by search module
                break;
        }
    }
    
    // ================================
    // PUBLIC API
    // ================================
    
    return {
        init,
        
        // Toast notifications
        showLoadingToast,
        hideLoadingToast,
        showSuccessToast,
        
        // Overlay management
        showOverlay,
        hideOverlay,
        hideAllOverlays,
        closeAllOverlaysAndGoHome,
        closeResults,
        
        // View management
        showHomeView,
        showResultsView,
        updateNavigationState,
        
        // Loading states
        showLoading,
        hideLoading,
        
        // Utilities
        animateNumber,
        debounce,
        escapeHtml,
        calculateDistance,
        
        // Storage
        Storage,
        
        // Responsive helpers
        isMobile,
        isTablet,
        isDesktop,
        getViewportSize,
        
        // Scroll management
        scrollToElement,
        
        // Element utilities
        updateElementText,
        updateElementHTML,
        toggleClass,
        setElementVisibility,
        
        // Validation
        isValidPostcode,
        isValidEmail,
        
        // State getters
        getCurrentView: () => state.currentView,
        isLoading: () => state.isLoading,
        getActiveOverlays: () => [...state.activeOverlays]
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', HelpersModule.init);
} else {
    HelpersModule.init();
}

// Make it globally available
window.HelpersModule = HelpersModule;

// Legacy support
window.UtilsModule = HelpersModule;
window.UIModule = HelpersModule;
window.closeResults = HelpersModule.closeResults;
