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
    // In the setPageContext function, add support for search-modal:
    const setPageContext = (context) => {
        console.log(`🧭 Setting nav context: ${context}`);
        
        // Store previous context BEFORE updating
        if (state.currentContext !== context) {
            state.previousContext = state.currentContext;
        }
        state.currentContext = context;
        
        // Remove all page classes
        document.body.classList.remove('page-home', 'page-results', 'page-map', 'page-venue', 'page-search', 'page-search-modal', 'page-contact', 'page-breweries', 'page-community');
        
        // Add the current page class
        document.body.classList.add(`page-${context}`);
        
        // Update back button functionality
        setupBackButton(context);
        
        // Handle toggle visibility
        if (context === 'results' || context === 'map') {
            setTimeout(() => {
                refreshToggleState();
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
            'venue': '/venue',
            'map': '/map',
            'contact': '/contact',
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
            case 'venue':
                // Check if we have a current venue
                const currentVenue = window.App?.getState('currentVenue');
                if (currentVenue) {
                    modules.modalManager?.open('venueDetailsOverlay');
                    setPageContext('venue');
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
                case 'contact':
                case 'breweries':
                case 'community':
                    goToHome();
                    break;
                case 'venue':
                    goBackFromVenue();
                    break;
                case 'search':
                    goToHome();
                    break;
                default:
                    goToHome();
            }
        });
    };
    
    // ================================
    // NAVIGATION METHODS
    // ================================
    // In nav.js - Update the goToHome function
    const goToHome = (shouldPushState = true) => {
        console.log('🏠 Navigating to home');
        
        // Close ALL overlays including search overlay
        const overlays = ['resultsOverlay', 'venueDetailsOverlay', 'fullMapOverlay', 'searchOverlay'];
        overlays.forEach(id => {
            const overlay = document.getElementById(id);
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.remove('active');
            }
        });
        
        // Also use modalManager to ensure proper cleanup
        const modalManager = window.App?.getModule('modalManager');
        if (modalManager) {
            modalManager.closeAllOverlays();
        }
        
        // Show community home
        const communityHome = document.querySelector('.community-home');
        if (communityHome) {
            communityHome.style.display = 'block';
        }
        
        // Update context AFTER closing overlays
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
    
    const goBackFromVenue = () => {
        console.log('🔙 Going back from venue details');
        
        // IMPORTANT: Use ModalManager to properly close venue details
        const modalManager = window.App?.getModule('modalManager');
        if (modalManager) {
            modalManager.close('venueDetailsOverlay');
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
            
            modules.tracking?.trackEvent('nav_back_to_results', 'Navigation', 'from_venue');
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
        
        // CRITICAL: Update the actual search toggle checkbox BEFORE re-running search!
        const searchToggle = document.getElementById('searchToggle');
        if (searchToggle) {
           searchToggle.checked = (mode === 'gf');
           console.log(`✅ Updated searchToggle checkbox to: ${searchToggle.checked}`);
        }
        
        // Get current context
        const currentContext = state.currentContext;
        
        // If we're on results page, re-run the search
        if (currentContext === 'results') {
           const searchModule = window.App?.getModule('search');
           const lastSearch = window.App?.getState('lastSearch');
           
           console.log('📱 Current context:', currentContext);
           console.log('🔍 Last search:', lastSearch);
           
           if (lastSearch && searchModule) {
               // Small delay to ensure DOM is fully updated
               setTimeout(() => {
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
                   } else if (lastSearch.type === 'beer') {
                       console.log('🔄 Re-running beer search');
                       // Need to set the input value first
                       const beerInput = document.getElementById('beerInput');
                       if (beerInput) beerInput.value = lastSearch.query;
                       searchModule.searchByBeer();
                   }
               }, 50); // 50ms delay to ensure DOM updates
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
    
    const showVenueDetailsWithContext = () => {
        setPageContext('venue');
        pushState('venue');
    };
    
    const showHomeWithContext = () => {
        setPageContext('home');
        pushState('home');
    };
    
    const showSearchWithContext = () => {
        // Remove all page classes first
        document.body.classList.remove('page-home', 'page-results', 'page-map', 'page-venue');
        
        // Add search class
        document.body.classList.add('page-search');
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

        // Ensure home page class is set on start
        document.body.className = 'page-home';
        
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
        showVenueDetailsWithContext,
        showHomeWithContext,
        showSearchWithContext,
        goToHome,
        goBackFromVenue,
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
