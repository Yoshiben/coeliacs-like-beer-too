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

    // REPLACE: The entire handleToggleChange function in nav.js around line 280

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
                if (lastSearch.type === 'nearby' && lastSearch.radius) {
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
