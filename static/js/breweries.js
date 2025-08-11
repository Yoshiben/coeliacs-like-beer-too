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
    
    const searchBreweryBeers = async (brewery) => {
        console.log(`🔍 Loading beers for: ${brewery}`);
        
        // Open modal to show beers
        if (modules.modalManager) {
            modules.modalManager.open('breweryBeersModal');
        }
        
        // Update brewery name
        const breweryNameEl = document.getElementById('breweryName');
        if (breweryNameEl) breweryNameEl.textContent = brewery;
        
        // Show loading
        document.getElementById('breweryBeersLoading').style.display = 'block';
        document.getElementById('breweryBeersList').style.display = 'none';
        document.getElementById('breweryBeersEmpty').style.display = 'none';
        
        try {
            // Fetch beers for this brewery
            const response = await fetch(`/api/brewery/${encodeURIComponent(brewery)}/beers`);
            const beers = await response.json();
            
            displayBreweryBeers(beers, brewery);
            
        } catch (error) {
            console.error('Error loading brewery beers:', error);
            document.getElementById('breweryBeersLoading').style.display = 'none';
            document.getElementById('breweryBeersEmpty').style.display = 'block';
        }
    };
    
    const displayBreweryBeers = (beers, brewery) => {
        const loadingEl = document.getElementById('breweryBeersLoading');
        const listEl = document.getElementById('breweryBeersList');
        const emptyEl = document.getElementById('breweryBeersEmpty');
        
        loadingEl.style.display = 'none';
        
        if (beers.length === 0) {
            emptyEl.style.display = 'block';
            listEl.style.display = 'none';
            return;
        }
        
        listEl.style.display = 'block';
        emptyEl.style.display = 'none';
        
        listEl.innerHTML = beers.map(beer => `
            <div class="beer-item">
                <div class="beer-info">
                    <strong>${beer.name}</strong>
                    <div class="beer-meta">
                        ${beer.style ? `<span class="beer-style">${beer.style}</span>` : ''}
                        ${beer.abv ? `<span class="beer-abv">${beer.abv}% ABV</span>` : ''}
                        ${beer.gluten_status ? `<span class="beer-gf-status">${beer.gluten_status.replace('_', ' ')}</span>` : ''}
                    </div>
                </div>
                <button class="btn btn-sm" data-action="find-venues-with-beer" 
                        data-beer="${beer.name}" data-brewery="${brewery}">
                    Find Venues
                </button>
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
        
        // Update nav context - THIS IS THE KEY
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
    // Venuelic API
    return {
        init,
        openBreweries,
        closeBreweries,
        searchBreweryBeers,
        loadBreweries
    };
})();
