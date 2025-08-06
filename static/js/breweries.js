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

    // Update the displayBreweries function:
    const displayBreweries = () => {
        const grid = document.getElementById('breweriesGrid');
        const header = document.querySelector('.breweries-header');
        
        if (!grid) return;
        
        // Add search bar if it doesn't exist
        let searchContainer = document.querySelector('.breweries-search');
        if (!searchContainer) {
            searchContainer = document.createElement('div');
            searchContainer.className = 'breweries-search';
            searchContainer.innerHTML = `
                <input type="text" 
                       class="brewery-search-input" 
                       id="brewerySearchInput"
                       placeholder="Search breweries..."
                       autocomplete="off">
            `;
            header.after(searchContainer);
            
            // Add search listener
            const searchInput = document.getElementById('brewerySearchInput');
            searchInput?.addEventListener('input', (e) => {
                filterBreweries(e.target.value);
            });
        }
        
        // Add stats bar
        let statsBar = document.querySelector('.brewery-stats');
        if (!statsBar) {
            statsBar = document.createElement('div');
            statsBar.className = 'brewery-stats';
            statsBar.innerHTML = `
                <span class="brewery-count">${breweries.length} breweries</span>
                <div class="view-toggle">
                    <button class="active" data-view="grid">Grid</button>
                    <button data-view="list">List</button>
                </div>
            `;
            searchContainer.after(statsBar);
        }
        
        if (breweries.length === 0) {
            grid.innerHTML = `
                <div class="breweries-empty">
                    <p>Loading breweries...</p>
                </div>
            `;
            return;
        }
        
        // Sort breweries alphabetically
        const sortedBreweries = [...breweries].sort((a, b) => a.localeCompare(b));
        
        grid.innerHTML = sortedBreweries.map(brewery => `
            <div class="brewery-card" data-action="search-brewery" data-brewery="${brewery}">
                <div class="brewery-icon">🍺</div>
                <h3 class="brewery-name">${brewery}</h3>
            </div>
        `).join('');
    };
    
    // Add filter function
    const filterBreweries = (query) => {
        const cards = document.querySelectorAll('.brewery-card');
        const normalizedQuery = query.toLowerCase().trim();
        
        cards.forEach(card => {
            const breweryName = card.dataset.brewery.toLowerCase();
            if (breweryName.includes(normalizedQuery)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
        
        // Update count
        const visibleCount = document.querySelectorAll('.brewery-card:not([style*="display: none"])').length;
        const countEl = document.querySelector('.brewery-count');
        if (countEl) {
            countEl.textContent = `${visibleCount} of ${breweries.length} breweries`;
        }
    };
    
    // Fix the searchBreweryBeers function to actually trigger beer search:
    const searchBreweryBeers = (brewery) => {
        console.log(`🔍 Searching for beers from: ${brewery}`);
        
        // Close breweries overlay
        closeBreweries();
        
        // Open search overlay first
        const searchOverlay = document.getElementById('searchOverlay');
        if (searchOverlay) {
            searchOverlay.style.display = 'flex';
            searchOverlay.classList.add('active');
        }
        
        // Then trigger beer search modal
        setTimeout(() => {
            // Trigger beer search option
            const beerSearchOption = document.querySelector('.search-option.beer');
            if (beerSearchOption) {
                beerSearchOption.click();
            }
            
            // After modal opens, set the brewery
            setTimeout(() => {
                const beerInput = document.getElementById('beerInput');
                const searchType = document.getElementById('beerSearchType');
                if (beerInput && searchType) {
                    searchType.value = 'brewery';
                    beerInput.value = brewery;
                    // Trigger search
                    const searchBtn = document.querySelector('[data-action="perform-beer-search"]');
                    if (searchBtn) searchBtn.click();
                }
            }, 300);
        }, 300);
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
    // Public API
    return {
        init,
        openBreweries,
        closeBreweries,
        searchBreweryBeers,
        loadBreweries
    };
})();
