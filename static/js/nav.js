// ================================================================================
// NAV.JS - Navigation State Management
// Handles: Dynamic nav bar updates based on current view
// ================================================================================

export const NavStateManager = (() => {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        currentContext: 'home',
        previousContext: null
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get helpers() { return window.App?.getModule('helpers'); },
        get tracking() { return window.App?.getModule('tracking'); }
    };
    
    // ================================
    // CORE FUNCTIONS
    // ================================
    const setPageContext = (context) => {
        console.log(`🧭 Setting nav context: ${context}`);
        
        // Store previous context
        state.previousContext = state.currentContext;
        state.currentContext = context;
        
        // Remove all page classes
        document.body.classList.remove('page-home', 'page-results', 'page-map', 'page-pub');
        
        // Add the current page class
        document.body.classList.add(`page-${context}`);
        
        // Update back button functionality
        setupBackButton(context);
        
        // Track navigation
        modules.tracking?.trackEvent('nav_context_change', 'Navigation', context);
    };
    
    const setupBackButton = (currentContext) => {
        const backBtn = document.querySelector('.nav-back-btn');
        if (!backBtn) return;
        
        // Remove old listeners by cloning
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        
        // Add appropriate listener based on context
        newBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            switch(currentContext) {
                case 'results':
                case 'map':
                    goToHome();
                    break;
                case 'pub':
                    goBackFromPub();
                    break;
                default:
                    goToHome();
            }
        });
    };
    
    // ================================
    // NAVIGATION METHODS
    // ================================
    const goToHome = () => {
        console.log('🏠 Navigating to home');
        
        // Use helpers module to close all overlays
        modules.helpers?.hideAllOverlays();
        
        // Show community home
        const communityHome = document.querySelector('.community-home');
        if (communityHome) {
            communityHome.style.display = 'block';
        }
        
        // Update context
        setPageContext('home');
        
        // Reset body scroll
        document.body.style.overflow = '';
        
        // Track navigation
        modules.tracking?.trackEvent('nav_home', 'Navigation', `from_${state.previousContext}`);
    };
    
    const goBackFromPub = () => {
        console.log('🔙 Going back from pub details');
        
        // Check if we have previous results
        const searchResults = window.App?.getState('searchResults');
        const resultsOverlay = document.getElementById('resultsOverlay');
        
        if (searchResults?.length > 0 && resultsOverlay) {
            // Hide pub details
            const pubOverlay = document.getElementById('pubDetailsOverlay');
            if (pubOverlay) {
                pubOverlay.style.display = 'none';
                pubOverlay.classList.remove('active');
            }
            
            // Show results
            resultsOverlay.style.display = 'flex';
            resultsOverlay.classList.add('active');
            
            // Update context
            setPageContext('results');
            
            modules.tracking?.trackEvent('nav_back_to_results', 'Navigation', 'from_pub');
        } else {
            // No results to go back to, go home
            goToHome();
        }
    };

    // ================================
    // TOGGLE MANAGEMENT
    // ================================
    const initToggle = () => {
        const container = document.querySelector('.top-nav .toggle-container');
        if (!container) return;
        
        const options = container.querySelectorAll('.toggle-option');
        const thumb = container.querySelector('.toggle-thumb');
        
        const updateThumb = () => {
            const activeOption = container.querySelector('.toggle-option.active');
            if (activeOption && thumb) {
                thumb.style.width = `${activeOption.offsetWidth}px`;
                thumb.style.transform = `translateX(${activeOption.offsetLeft}px)`;
            }
        };
        
        // Initial position
        setTimeout(updateThumb, 100);
        
        // Window resize
        window.addEventListener('resize', updateThumb);
        
        // Click handlers
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const value = option.dataset.value;
                const currentActive = container.querySelector('.toggle-option.active');
                
                if (currentActive === option) return;
                
                // Update UI
                options.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                updateThumb();
                handleToggleChange(value);
                
                modules.tracking?.trackEvent('toggle_changed', 'Navigation', `${state.currentContext}_${value}`);
            });
        });
    };
    
    const handleToggleChange = (mode) => {
        console.log(`🔀 Toggle changed to: ${mode} on ${state.currentContext} page`);
        
        const mapModule = modules.map || window.App?.getModule('map');
        const searchModule = modules.search || window.App?.getModule('search');
        
        switch (state.currentContext) {
            case 'map':
                if (mapModule?.updateMapDisplay) {
                    mapModule.updateMapDisplay(mode === 'gf');
                }
                break;
                
            case 'results':
                // TODO: Add results filtering when implemented
                if (searchModule?.filterResults) {
                    searchModule.filterResults(mode === 'gf');
                }
                break;
        }
    };
    
    // ================================
    // INTEGRATION HELPERS
    // ================================
    const showResultsWithContext = () => {
        setPageContext('results');
    };
    
    const showMapWithContext = () => {
        setPageContext('map');
    };
    
    const showPubDetailsWithContext = () => {
        setPageContext('pub');
    };
    
    const showHomeWithContext = () => {
        setPageContext('home');
    };
    
    // ================================
    // INITIALIZATION
    // ================================

    const init = () => {
        console.log('🔧 Initializing NavStateManager');
        
        // Set initial context
        setPageContext('home');
        
        // Initialize toggle
        initToggle();
        
        // Watch for overlay visibility changes
        const observeOverlay = (overlayId, context) => {
            const overlay = document.getElementById(overlayId);
            if (!overlay) return;
            
            // Create observer
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                        
                        const isVisible = overlay.style.display !== 'none' && 
                                        (overlay.classList.contains('active') || 
                                         overlay.style.display === 'flex');
                        
                        if (isVisible) {
                            console.log(`📍 ${overlayId} became visible, setting context: ${context}`);
                            setPageContext(context);
                        }
                    }
                });
            });
            
            // Start observing
            observer.observe(overlay, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        };
        
        // Observe all overlays
        observeOverlay('resultsOverlay', 'results');
        observeOverlay('pubDetailsOverlay', 'pub');
        observeOverlay('fullMapOverlay', 'map');
        
        console.log('✅ NavStateManager initialized');
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        setPageContext,
        showResultsWithContext,
        showMapWithContext,
        showPubDetailsWithContext,
        showHomeWithContext,
        goToHome,
        goBackFromPub,
        getCurrentContext: () => state.currentContext,
        getPreviousContext: () => state.previousContext
    };
})();

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', NavStateManager.init);
} else {
    NavStateManager.init();
}
