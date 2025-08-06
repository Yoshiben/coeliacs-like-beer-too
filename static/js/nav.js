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
        
        // IMPORTANT: Re-initialize toggle when it becomes visible
        if (context === 'results' || context === 'map') {
            // Give the DOM a moment to update visibility
            setTimeout(() => {
                refreshToggleState();
                // Force thumb visibility
                const thumb = document.querySelector('.nav-toggle .toggle-thumb');
                if (thumb) {
                    thumb.style.opacity = '1';
                    thumb.style.visibility = 'visible';
                    thumb.style.display = 'block';
                    thumb.style.background = 'white';
                }
            }, 10);
        }
        
        // Track navigation
        modules.tracking?.trackEvent('nav_context_change', 'Navigation', context);
    };

    // ================================
    // BROWSER HISTORY MANAGEMENT
    // ================================
    const pushState = (context, data = {}) => {
        const url = getUrlForContext(context);
        const stateData = {
            context,
            view: context,
            ...data
        };
        
        // Don't push duplicate states
        if (window.location.pathname !== url) {
            window.history.pushState(stateData, '', url);
        }
    };
    
    const getUrlForContext = (context) => {
        const urlMap = {
            'home': '/',
            'results': '/search',
            'search': '/search',
            'pub': '/pub',
            'map': '/map',
            'breweries': '/breweries'
        };
        return urlMap[context] || '/';
    };
    
    const handlePopState = (event) => {
        console.log('🔙 Browser back button pressed', event.state);
        
        if (event.state && event.state.context) {
            // Navigate based on the stored state
            navigateToContext(event.state.context, false); // false = don't push state again
        } else {
            // No state, go home
            goToHome(false);
        }
    };
    
    const navigateToContext = (context, shouldPushState = true) => {
        switch(context) {
            case 'home':
                goToHome(shouldPushState);
                break;
            case 'results':
                // Check if we have results to show
                const searchResults = window.App?.getState('searchResults');
                if (searchResults?.length > 0) {
                    modules.modalManager?.open('resultsOverlay');
                    setPageContext('results');
                } else {
                    goToHome(shouldPushState);
                }
                break;
            case 'pub':
                // Check if we have a current pub
                const currentPub = window.App?.getState('currentPub');
                if (currentPub) {
                    modules.modalManager?.open('pubDetailsOverlay');
                    setPageContext('pub');
                } else {
                    goToHome(shouldPushState);
                }
                break;
            case 'map':
                modules.modalManager?.open('fullMapOverlay');
                setPageContext('map');
                break;
            case 'breweries':
                modules.modalManager?.open('breweriesOverlay');
                setPageContext('breweries');
                break;
            case 'search':
                // Open search overlay
                const searchOverlay = document.getElementById('searchOverlay');
                if (searchOverlay) {
                    searchOverlay.style.display = 'flex';
                    searchOverlay.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
                setPageContext('search');
                break;
            default:
                goToHome(shouldPushState);
        }
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
    const goToHome = (shouldPushState = true) => {
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
        
        // Update browser history
        if (shouldPushState) {
            pushState('home');
        }
        
        // Reset body scroll
        document.body.style.overflow = '';
        
        // Track navigation
        modules.tracking?.trackEvent('nav_home', 'Navigation', `from_${state.previousContext}`);
    };
    
    const goBackFromPub = () => {
        console.log('🔙 Going back from pub details');
        
        // IMPORTANT: Use ModalManager to properly close pub details
        const modalManager = window.App?.getModule('modalManager');
        if (modalManager) {
            modalManager.close('pubDetailsOverlay');
        }
        
        // Check if we have previous results
        const searchResults = window.App?.getState('searchResults');
        
        if (searchResults?.length > 0) {
            // Show results using ModalManager
            if (modalManager) {
                modalManager.open('resultsOverlay');
            }
            
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
        
        // CRITICAL: Make thumb visible immediately
        thumb.style.opacity = '1';
        thumb.style.visibility = 'visible';
        
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
        
        // IMMEDIATE thumb update - no delay
        updateThumb();
        
        // Also update after a frame to ensure DOM is ready
        requestAnimationFrame(() => {
            updateThumb();
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
        console.log(`🔀 Toggle changed to: ${mode}`);
        
        // Update the filter state
        window.App.setState('gfOnlyFilter', mode === 'gf');
        
        // Get current context
        const currentContext = state.currentContext;
        
        // If we're on results page, re-run the search
        if (currentContext === 'results') {
            const searchModule = window.App?.getModule('search');
            const lastSearch = window.App?.getState('lastSearch');
            
            console.log('📱 Current context:', currentContext);
            console.log('🔍 Last search:', lastSearch);
            
            if (lastSearch && searchModule) {
                // Re-run based on search type
                if ((lastSearch.type === 'nearby' || lastSearch.type === 'location') && lastSearch.radius) {
                    console.log('🔄 Re-running nearby search with radius:', lastSearch.radius);
                    searchModule.searchNearbyWithDistance(lastSearch.radius);
                } else if (lastSearch.type === 'name' && lastSearch.query) {
                    console.log('🔄 Re-running name search');
                    // Need to set the input value first
                    const nameInput = document.getElementById('nameInput');
                    if (nameInput) nameInput.value = lastSearch.query;
                    searchModule.searchByName();
                } else if (lastSearch.type === 'area' && lastSearch.query) {
                    console.log('🔄 Re-running area search');
                    // Need to set the input value first
                    const areaInput = document.getElementById('areaInput');
                    if (areaInput) areaInput.value = lastSearch.query;
                    searchModule.searchByArea();
                }
            }
        } else if (currentContext === 'map') {
            // Update map display
            const mapModule = window.App?.getModule('map');
            mapModule?.updateMapDisplay?.(mode === 'gf');
        }
        
        // Track the change
        modules.tracking?.trackEvent('filter_toggle', 'UI', `${currentContext}_${mode}`);
    };
    
    // ================================
    // INTEGRATION HELPERS
    // ================================
    const showResultsWithContext = () => {
        setPageContext('results');
        pushState('results');
    };
    
    const showMapWithContext = () => {
        setPageContext('map');
        pushState('map');
    };
    
    const showPubDetailsWithContext = () => {
        setPageContext('pub');
        pushState('pub');
    };
    
    const showHomeWithContext = () => {
        setPageContext('home');
        pushState('home');
    };
    
    const showSearchWithContext = () => {
        // Store previous context
        state.previousContext = state.currentContext;
        state.currentContext = 'search';
        
        // Update body class for CSS targeting
        document.body.classList.add('page-search');
        
        // The nav elements will show based on CSS rules
        console.log('🔍 Search context activated');
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

        // ADD THIS: Listen for browser back/forward
        window.addEventListener('popstate', handlePopState);
        
        // ADD THIS: Set initial state
        window.history.replaceState({ context: 'home', view: 'home' }, '', '/');
        
        const observeOverlay = (overlayId, context) => {
            const overlay = document.getElementById(overlayId);
            if (!overlay) return;
            
            let lastVisibleState = false;
            
            // Create observer
            const observer = new MutationObserver((mutations) => {
                const isVisible = overlay.style.display !== 'none' && 
                                (overlay.classList.contains('active') || 
                                 overlay.style.display === 'flex');
                
                // Only trigger if visibility actually changed
                if (isVisible && !lastVisibleState) {
                    console.log(`📍 ${overlayId} became visible, setting context: ${context}`);
                    setPageContext(context);
                    lastVisibleState = true;
                } else if (!isVisible && lastVisibleState) {
                    lastVisibleState = false;
                }
            });
            
            // Start observing
            observer.observe(overlay, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        };
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
