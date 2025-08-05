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
        
        // Hide all overlays
        const overlays = ['resultsOverlay', 'pubDetailsOverlay', 'fullMapOverlay'];
        overlays.forEach(id => {
            const overlay = document.getElementById(id);
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.remove('active');
            }
        });
        
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
        if (!container) {
            console.log('⚠️ Toggle container not found');
            return;
        }
        
        const options = container.querySelectorAll('.toggle-option');
        const thumb = container.querySelector('.toggle-thumb');
        
        if (!thumb) {
            console.error('❌ Toggle thumb not found');
            return;
        }
        
        const updateThumb = () => {
            const activeOption = container.querySelector('.toggle-option.active');
            if (activeOption) {
                const containerRect = container.getBoundingClientRect();
                const optionRect = activeOption.getBoundingClientRect();
                const offset = optionRect.left - containerRect.left;
                
                thumb.style.width = `${activeOption.offsetWidth}px`;
                thumb.style.transform = `translateX(${offset}px)`;
            }
        };
        
        // Ensure GF Only is active by default
        const gfOption = container.querySelector('.toggle-option[data-value="gf"]');
        if (gfOption && !container.querySelector('.toggle-option.active')) {
            gfOption.classList.add('active');
        }
        
        // Force initial thumb update after DOM settles
        requestAnimationFrame(() => {
            updateThumb();
            // Ensure thumb is visible
            if (thumb) {
                thumb.style.opacity = '1';
                thumb.style.visibility = 'visible';
            }
        });
        
        // Remove old event listeners by cloning
        options.forEach(option => {
            const newOption = option.cloneNode(true);
            option.parentNode.replaceChild(newOption, option);
        });
        
        // Re-query after cloning
        const newOptions = container.querySelectorAll('.toggle-option');
        
        // Add new event listeners
        newOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const value = option.dataset.value;
                
                // Don't do anything if already active
                if (option.classList.contains('active')) return;
                
                console.log(`🔀 Toggle clicked: ${value}`);
                
                // Update UI
                newOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                // Update thumb position
                updateThumb();
                
                // Handle the change
                handleToggleChange(value);
            });
        });
        
        // Update on resize
        window.addEventListener('resize', updateThumb);
    };
    
    // UPDATE the handleToggleChange function (around line 217):

    const handleToggleChange = (mode) => {
        console.log(`🔀 Toggle changed to: ${mode} on ${state.currentContext} page`);
        
        const mapModule = modules.map || window.App?.getModule('map');
        const searchModule = modules.search || window.App?.getModule('search');
        
        // Store the current filter preference
        window.App.setState('gfOnlyFilter', mode === 'gf');
        
        switch (state.currentContext) {
            case 'map':
                if (mapModule?.updateMapDisplay) {
                    mapModule.updateMapDisplay(mode === 'gf');
                }
                break;
                
            case 'results':
                // Re-run the last search with new filter
                const lastSearch = window.App.getState('lastSearch');
                if (lastSearch && searchModule) {
                    console.log('🔄 Re-running search with filter:', mode);
                    
                    // Show loading
                    const loadingEl = document.getElementById('resultsLoading');
                    if (loadingEl) loadingEl.style.display = 'flex';
                    
                    // Re-run search based on type
                    if (lastSearch.type === 'nearby' && lastSearch.userLocation) {
                        searchModule.searchNearbyWithDistance(lastSearch.radius, mode === 'gf');
                    } else if (lastSearch.query) {
                        // For text searches, we need to filter results client-side
                        const allResults = window.App.getState('searchResults') || [];
                        const filteredResults = mode === 'gf' ? 
                            allResults.filter(pub => pub.gf_status === 'always' || pub.gf_status === 'currently') :
                            allResults;
                        
                        // Update display
                        if (searchModule.displayResultsInOverlay) {
                            searchModule.displayResultsInOverlay(filteredResults, 
                                `${filteredResults.length} pubs ${mode === 'gf' ? 'with GF beer' : 'total'}`);
                        }
                    }
                }
                break;
                
            case 'home':
                // On home, just store preference for next search
                console.log('🏠 Filter preference saved for next search');
                break;
        }
        
        // Track the change
        modules.tracking?.trackEvent('filter_toggle', 'UI', `${state.currentContext}_${mode}`);
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

    const showSearchWithContext = () => {
        setPageContext('search');
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
        showSearchWithContext,
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
