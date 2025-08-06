// Breweries Module
export default (function() {
    'use strict';
    
    // Private state
    let modules = {};
    let breweries = [];
    
    // Initialize module
    const init = (appModules) => {
        console.log('🏭 Initializing Breweries Module');
        modules = appModules;
        setupEventListeners();
        console.log('✅ Breweries Module initialized');
    };
    
    // Setup event listeners
    const setupEventListeners = () => {
        // Close on background click
        const overlay = document.getElementById('breweriesOverlay');
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeBreweries();
            }
        });
    };
    
    // Load breweries from API
    const loadBreweries = async () => {
        try {
            console.log('📦 Loading breweries...');
            const response = await fetch('/api/breweries');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            breweries = await response.json();
            console.log(`✅ Loaded ${breweries.length} breweries`);
            
            displayBreweries();
        } catch (error) {
            console.error('❌ Error loading breweries:', error);
            showError();
        }
    };
    
    // Display breweries in grid
    // UPDATE in breweries.js - displayBreweries function

    const displayBreweries = () => {
        const grid = document.getElementById('breweriesGrid');
        const header = document.querySelector('.breweries-header p');
        
        if (!grid) return;
        
        // Update header with count
        if (header) {
            header.innerHTML = `Discover amazing UK breweries making gluten free beer<br>
                               <span class="brewery-count">${breweries.length} breweries available</span>`;
        }
        
        if (breweries.length === 0) {
            grid.innerHTML = `
                <div class="breweries-empty">
                    <p>No breweries found</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = breweries.map(brewery => `
            <div class="brewery-card" data-action="search-brewery" data-brewery="${brewery}">
                <div class="brewery-icon">🍺</div>
                <h3 class="brewery-name">${brewery}</h3>
            </div>
        `).join('');
    };
    
    // Show error state
    const showError = () => {
        const grid = document.getElementById('breweriesGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="error-state">
                    <p>Unable to load breweries</p>
                    <button data-action="retry-breweries" class="btn btn-primary">
                        Try Again
                    </button>
                </div>
            `;
        }
    };
    
    // Open breweries overlay
    const openBreweries = () => {
        console.log('🏭 Opening breweries overlay');
        
        // Use ModalManager if available
        if (modules.modalManager) {
            modules.modalManager.open('breweriesOverlay');
        } else {
            // Fallback
            const overlay = document.getElementById('breweriesOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
                
                // Hide community home manually if modalManager not available
                const communityHome = document.querySelector('.community-home');
                if (communityHome) {
                    communityHome.style.display = 'none';
                }
            }
        }
        
        // Update nav context
        modules.nav?.setPageContext('breweries');
        
        // Load breweries if not already loaded
        if (breweries.length === 0) {
            loadBreweries();
        }
        
        // Track event
        modules.tracking?.trackEvent('breweries_opened', 'Navigation');
    };
    
    // Close breweries overlay
    const closeBreweries = () => {
        console.log('🏭 Closing breweries overlay');
        const overlay = document.getElementById('breweriesOverlay');
        
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            
            // Return to home context
            modules.nav?.goToHome();
        }
    };
    
    // Search for brewery beers
    const searchBreweryBeers = (brewery) => {
        console.log(`🔍 Searching for beers from: ${brewery}`);
        
        // Close breweries overlay
        closeBreweries();
        
        // Open beer search modal with brewery pre-filled
        setTimeout(() => {
            modules.modal?.open('beerModal');
            const searchInput = document.getElementById('beerSearchInput');
            if (searchInput) {
                searchInput.value = brewery;
                // Trigger search
                const event = new Event('input', { bubbles: true });
                searchInput.dispatchEvent(event);
            }
        }, 300);
    };
    
    // Public API
    return {
        init,
        openBreweries,
        closeBreweries,
        searchBreweryBeers,
        loadBreweries
    };
})();
