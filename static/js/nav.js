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
        
        // Listen for overlay changes
        document.addEventListener('overlayShown', (e) => {
            const overlayId = e.detail?.overlayId;
            if (overlayId === 'resultsOverlay') {
                setPageContext('results');
            } else if (overlayId === 'pubDetailsOverlay') {
                setPageContext('pub');
            } else if (overlayId === 'fullMapOverlay') {
                setPageContext('map');
            }
        });
        
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
