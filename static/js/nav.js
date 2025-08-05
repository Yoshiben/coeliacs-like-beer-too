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
        
        // Check stored preference or default to GF only
        const storedFilter = window.App.getState('gfOnlyFilter');
        const currentValue = storedFilter === false ? 'all' : 'gf'; // Default to 'gf' if not set
        
        // Set the correct option as active
        options.forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.value === currentValue) {
                opt.classList.add('active');
            }
        });
        
        // If no active option, default to GF
        if (!container.querySelector('.toggle-option.active')) {
            const gfOption = container.querySelector('.toggle-option[data-value="gf"]');
            if (gfOption) {
                gfOption.classList.add('active');
            }
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
    };
    
    // Add a refresh method to update toggle state when context changes
    const refreshToggleState = () => {
        const container = document.querySelector('.top-nav .toggle-container');
        if (!container) return;
        
        const storedFilter = window.App.getState('gfOnlyFilter');
        const currentValue = storedFilter === false ? 'all' : 'gf';
        
        const options = container.querySelectorAll('.toggle-option');
        const thumb = container.querySelector('.toggle-thumb');
        
        options.forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.value === currentValue) {
                opt.classList.add('active');
            }
        });
        
        // Update thumb position
        if (thumb) {
            const activeOption = container.querySelector('.toggle-option.active');
            if (activeOption) {
                const containerRect = container.getBoundingClientRect();
                const optionRect = activeOption.getBoundingClientRect();
                const offset = optionRect.left - containerRect.left;
                
                thumb.style.width = `${activeOption.offsetWidth}px`;
                thumb.style.transform = `translateX(${offset}px)`;
            }
        }
    };

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
                // Get the last search state properly
                const lastSearchState = searchModule?.getLastSearchState?.() || window.App.getState('lastSearch');
                
                if (!lastSearchState) {
                    console.warn('⚠️ No search state found to re-run');
                    return;
                }
                
                console.log('🔄 Re-running search with filter:', mode, lastSearchState);
                
                // Re-run search based on type
                if (lastSearchState.type === 'nearby') {
                    // For nearby searches, we need to make a new API call
                    const radius = lastSearchState.radius || 5;
                    searchModule.searchNearbyWithDistance(radius);
                } else {
                    // For other searches, filter existing results
                    const currentResults = searchModule?.getCurrentResults?.() || window.App.getState('searchResults') || [];
                    
                    if (currentResults.length === 0) {
                        console.warn('⚠️ No results to filter');
                        return;
                    }
                    
                    // Filter results based on mode
                    const filteredResults = mode === 'gf' ? 
                        currentResults.filter(pub => {
                            const status = pub.gf_status || 'unknown';
                            return status === 'always' || 
                                   status === 'currently' || 
                                   status === 'always_tap_cask' || 
                                   status === 'always_bottle_can';
                        }) : currentResults;
                    
                    console.log(`📊 Filtered: ${filteredResults.length} of ${currentResults.length} pubs`);
                    
                    // Update display title based on search type
                    let title = '';
                    if (lastSearchState.type === 'name') {
                        title = `${filteredResults.length} pubs matching "${lastSearchState.query}"`;
                    } else if (lastSearchState.type === 'area') {
                        title = `${filteredResults.length} pubs in ${lastSearchState.query}`;
                    } else if (lastSearchState.type === 'beer') {
                        title = `${filteredResults.length} pubs serving "${lastSearchState.query}"`;
                    } else {
                        title = `${filteredResults.length} pubs`;
                    }
                    
                    if (mode === 'gf') {
                        title += ' (GF only)';
                    }
                    
                    // Update display using the search module's method
                    if (searchModule.displayResultsInOverlay) {
                        searchModule.displayResultsInOverlay(filteredResults, title);
                    } else {
                        console.error('❌ displayResultsInOverlay not available');
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
