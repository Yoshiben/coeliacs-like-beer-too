// ================================================================================
// UI.JS - User Interface Module
// Handles: DOM manipulation, animations, UI state management
// ================================================================================

export const UIModule = (function() {
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
        console.log('🔧 Initializing UI Module');
        
        // Set up UI event listeners
        setupUIListeners();
        
        // Initialize UI state
        updateNavigationState();
        
        console.log('✅ UI Module initialized');
    }
    
    // ================================
    // OVERLAY MANAGEMENT
    // ================================
    
    function showOverlay(overlayId, options = {}) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return false;
        
        // Add to active overlays
        state.activeOverlays.add(overlayId);
        
        // Show overlay
        overlay.classList.add('active');
        overlay.style.display = 'flex';
        
        // Update body state if needed
        if (options.lockScroll !== false) {
            document.body.style.overflow = 'hidden';
        }
        
        // Update view state
        if (options.view) {
            state.currentView = options.view;
        }
        
        return true;
    }
    
    function hideOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return false;
        
        // Remove from active overlays
        state.activeOverlays.delete(overlayId);
        
        // Hide overlay
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        
        // Restore body scroll if no overlays active
        if (state.activeOverlays.size === 0) {
            document.body.style.overflow = '';
        }
        
        return true;
    }
    
    function hideAllOverlays() {
        state.activeOverlays.forEach(overlayId => {
            hideOverlay(overlayId);
        });
        
        // Reset view state
        state.currentView = 'home';
        updateNavigationState();
    }
    
    // ================================
    // SECTION VISIBILITY
    // ================================
    
    function showHomeView() {
        // Hide all overlays
        hideAllOverlays();
        
        // Show home sections
        const heroSection = document.querySelector('.hero-section');
        const searchSection = document.querySelector('.search-section');
        
        if (heroSection) heroSection.style.display = 'block';
        if (searchSection) searchSection.style.display = 'block';
        
        // Update state
        state.currentView = 'home';
        updateNavigationState();
        
        // Scroll to top
        window.scrollTo(0, 0);
    }
    
    function showResultsView() {
        // Hide home sections
        const heroSection = document.querySelector('.hero-section');
        const searchSection = document.querySelector('.search-section');
        
        if (heroSection) heroSection.style.display = 'none';
        if (searchSection) searchSection.style.display = 'none';
        
        // Update state
        state.currentView = 'results';
        updateNavigationState();
    }
    
    // ================================
    // NAVIGATION STATE
    // ================================
    
    function updateNavigationState() {
        // Update active nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Set active based on current view
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
    // LOADING STATES
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
        
        // Remove loading state
        const loadingEl = container.querySelector('.loading-state');
        if (loadingEl) {
            loadingEl.remove();
        }
        
        state.isLoading = false;
    }
    
    // ================================
    // ANIMATIONS
    // ================================
    
    function animateIn(element, animationClass = 'fadeIn') {
        element.classList.add('animated', animationClass);
        
        element.addEventListener('animationend', function handler() {
            element.classList.remove('animated', animationClass);
            element.removeEventListener('animationend', handler);
        });
    }
    
    function animateOut(element, animationClass = 'fadeOut', callback) {
        element.classList.add('animated', animationClass);
        
        element.addEventListener('animationend', function handler() {
            element.classList.remove('animated', animationClass);
            element.removeEventListener('animationend', handler);
            if (callback) callback();
        });
    }
    
    // ================================
    // SCROLL MANAGEMENT
    // ================================
    
    function scrollToTop(smooth = true) {
        window.scrollTo({
            top: 0,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }
    
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
    // EVENT LISTENERS
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
        
        // Mobile feedback for search options
        const searchOptions = document.querySelectorAll('.search-option');
        
        searchOptions.forEach(option => {
            // Touch start - immediate feedback
            option.addEventListener('touchstart', function(e) {
                this.style.transform = 'scale(0.97)';
                
                // Haptic feedback (if supported)
                if ('vibrate' in navigator) {
                    navigator.vibrate(8); // Very subtle
                }
            }, { passive: true });
            
            // Touch end - release
            option.addEventListener('touchend', function(e) {
                this.style.transform = '';
                
                // Add tapped state briefly
                this.classList.add('tapped');
                setTimeout(() => {
                    this.classList.remove('tapped');
                }, 200);
            }, { passive: true });
            
            // Click handler with loading state
            option.addEventListener('click', function(e) {
                // Add loading state
                this.classList.add('loading');
                
                // Remove after modal should open
                setTimeout(() => {
                    this.classList.remove('loading');
                }, 400);
                
                // Success feedback
                if ('vibrate' in navigator) {
                    navigator.vibrate([10, 50, 10]); // Success pattern
                }
            });
            
            // Cancel touch if user drags away
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
                // Results would be restored by search module
                break;
            case 'pub':
                // Pub details would be restored by search module
                break;
        }
    }
    
    // ================================
    // UTILITY FUNCTIONS
    // ================================
    
    function updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }
    
    function updateElementHTML(elementId, html) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = html;
        }
    }
    
    function toggleClass(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.toggle(className);
        }
    }
    
    function setElementVisibility(elementId, visible) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = visible ? 'block' : 'none';
        }
    }

    // ================================
    // DEBUG FUNCTIONS
    // ================================
    
    function showDebugInfo() {
        // Create debug panel
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            background: rgba(255, 255, 0, 0.9);
            color: black;
            padding: 10px;
            border-radius: 10px;
            z-index: 99999;
            font-size: 12px;
            max-height: 400px;
            overflow-y: auto;
        `;
        
        let debugInfo = '<strong>🔍 RESULTS VISIBILITY CHECK:</strong><br>';
        
        // Check results overlay
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay) {
            const styles = window.getComputedStyle(resultsOverlay);
            debugInfo += `📋 Results Overlay: display=${styles.display}, active=${resultsOverlay.classList.contains('active')}<br>`;
        }
        
        // Check results containers
        const resultsListContainer = document.getElementById('resultsListContainer');
        if (resultsListContainer) {
            const styles = window.getComputedStyle(resultsListContainer);
            debugInfo += `📦 List Container: display=${styles.display}<br>`;
        }
        
        const resultsList = document.getElementById('resultsList');
        if (resultsList) {
            const styles = window.getComputedStyle(resultsList);
            const resultsCount = resultsList.children.length;
            debugInfo += `📝 Results List: display=${styles.display}, items=${resultsCount}<br>`;
            
            if (resultsCount > 0) {
                debugInfo += `✅ First result: ${resultsList.firstChild.textContent.substring(0, 50)}...<br>`;
            } else {
                debugInfo += `❌ No results in list!<br>`;
            }
        }
        
        // Check what's visible
        debugInfo += '<br><strong>VISIBLE ELEMENTS:</strong><br>';
        
        const searchSection = document.querySelector('.search-section');
        if (searchSection) {
            const styles = window.getComputedStyle(searchSection);
            debugInfo += `🔍 Search Section: display=${styles.display}<br>`;
        }
        
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            const styles = window.getComputedStyle(heroSection);
            debugInfo += `🦸 Hero Section: display=${styles.display}<br>`;
        }
        
        // Check z-index issues
        debugInfo += '<br><strong>Z-INDEX CHECK:</strong><br>';
        const overlayZ = resultsOverlay ? window.getComputedStyle(resultsOverlay).zIndex : 'N/A';
        debugInfo += `📊 Results Overlay z-index: ${overlayZ}<br>`;
    
        const pubDetailsOverlay = document.getElementById('pubDetailsOverlay');
        if (pubDetailsOverlay) {
            const styles = window.getComputedStyle(pubDetailsOverlay);
            debugInfo += `🏠 Pub Details: display=${styles.display}, active=${pubDetailsOverlay.classList.contains('active')}<br>`;
        }
        
        const pubContainer = document.getElementById('pubContainer');
        if (pubContainer) {
            debugInfo += `📦 Pub Container: split-view=${pubContainer.classList.contains('split-view')}<br>`;
        }
    
        // check map containers
        const resultsMapContainer = document.getElementById('resultsMapContainer');
        if (resultsMapContainer) {
            const styles = window.getComputedStyle(resultsMapContainer);
            debugInfo += `🗺️ Results Map Container: display=${styles.display}<br>`;
        }
        
        const resultsMap = document.getElementById('resultsMap');
        if (resultsMap) {
            debugInfo += `🗺️ Results Map div exists: ${resultsMap.innerHTML ? 'has content' : 'empty'}<br>`;
        }
        
        debugPanel.innerHTML = debugInfo + '<br><button onclick="this.parentElement.remove()">Close Debug</button>';
        document.body.appendChild(debugPanel);
    }

    const closeResults = () => {
        console.log('🏠 UI closeResults called - delegating to centralized function');
        
        // Simply delegate to the working centralized function
        return window.UtilsModule?.closeAllOverlaysAndGoHome() || false;
    };
    
    // ================================
    // PUBLIC API
    // ================================
    
    return {
        init,
        
        // Overlay management
        showOverlay,
        hideOverlay,
        hideAllOverlays,
        
        // View management
        showHomeView,
        showResultsView,
        updateNavigationState,
        
        // Loading states
        showLoading,
        hideLoading,
        
        // Animations
        animateIn,
        animateOut,
        
        // Scroll management
        scrollToTop,
        scrollToElement,
        
        // Responsive helpers
        isMobile,
        isTablet,
        isDesktop,
        getViewportSize,
        
        // Utility functions
        updateElementText,
        updateElementHTML,
        toggleClass,
        setElementVisibility,

        // Debug functions
        showDebugInfo,

        closeResults,
        
        // State getters
        getCurrentView: () => state.currentView,
        isLoading: () => state.isLoading,
        getActiveOverlays: () => [...state.activeOverlays]
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UIModule.init);
} else {
    UIModule.init();
}

// Make it globally available
window.UIModule = UIModule;
window.closeResults = UIModule.closeResults;
