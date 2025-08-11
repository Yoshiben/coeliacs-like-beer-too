// ================================================================================
// BREWERIES.JS - Simplified Version
// Handles: Brewery list display and beer search
// ================================================================================

export default (function() {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    let modules = {};
    let breweries = [];
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = (appModules) => {
        modules = appModules;
        setupEventListeners();
    };
    
    const setupEventListeners = () => {
        const overlay = document.getElementById('breweriesOverlay');
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) closeBreweries();
        });
    };
    
    // ================================
    // LOAD & DISPLAY BREWERIES
    // ================================
    const loadBreweries = async () => {
        try {
            const response = await fetch('/api/breweries');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            breweries = await response.json();
            displayBreweries();
        } catch (error) {
            console.error('❌ Error loading breweries:', error);
            showError();
        }
    };

    const displayBreweries = () => {
        const grid = document.getElementById('breweriesGrid');
        if (!grid) return;
        
        // Add search bar
        addSearchBar();
        
        if (breweries.length === 0) {
            grid.innerHTML = '<div class="breweries-empty"><p>Loading breweries...</p></div>';
            return;
        }
        
        const sortedBreweries = [...breweries].sort((a, b) => a.localeCompare(b));
        
        grid.innerHTML = sortedBreweries.map(brewery => `
            <div class="brewery-card" data-action="search-brewery" data-brewery="${brewery}">
                <div class="brewery-icon">🍺</div>
                <h3 class="brewery-name">${brewery}</h3>
            </div>
        `).join('');
    };
    
    const addSearchBar = () => {
        const header = document.querySelector('.breweries-header');
        if (!header || document.querySelector('.breweries-search')) return;
        
        const searchContainer = document.createElement('div');
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
        document.getElementById('brewerySearchInput')?.addEventListener('input', (e) => {
            filterBreweries(e.target.value);
        });
    };
    
    const filterBreweries = (query) => {
        const cards = document.querySelectorAll('.brewery-card');
        const normalizedQuery = query.toLowerCase().trim();
        
        cards.forEach(card => {
            const breweryName = card.dataset.brewery.toLowerCase();
            card.style.display = breweryName.includes(normalizedQuery) ? 'flex' : 'none';
        });
    };
    
    // ================================
    // BREWERY BEER SEARCH
    // ================================
    const searchBreweryBeers = async (brewery) => {
        if (modules.modalManager) {
            modules.modalManager.open('breweryBeersModal');
        }
        
        const breweryNameEl = document.getElementById('breweryName');
        if (breweryNameEl) breweryNameEl.textContent = brewery;
        
        showLoading();
        
        try {
            const response = await fetch(`/api/brewery/${encodeURIComponent(brewery)}/beers`);
            const beers = await response.json();
            displayBreweryBeers(beers);
        } catch (error) {
            console.error('Error loading brewery beers:', error);
            showEmpty();
        }
    };
    
    const displayBreweryBeers = (beers) => {
        hideLoading();
        
        if (beers.length === 0) {
            showEmpty();
            return;
        }
        
        const listEl = document.getElementById('breweryBeersList');
        if (!listEl) return;
        
        listEl.style.display = 'block';
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
    
    // ================================
    // UI HELPERS
    // ================================
    const showLoading = () => {
        document.getElementById('breweryBeersLoading').style.display = 'block';
        document.getElementById('breweryBeersList').style.display = 'none';
        document.getElementById('breweryBeersEmpty').style.display = 'none';
    };
    
    const hideLoading = () => {
        document.getElementById('breweryBeersLoading').style.display = 'none';
    };
    
    const showEmpty = () => {
        hideLoading();
        document.getElementById('breweryBeersEmpty').style.display = 'block';
        document.getElementById('breweryBeersList').style.display = 'none';
    };
    
    const showError = () => {
        const grid = document.getElementById('breweriesGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="error-state">
                    <p>Unable to load breweries</p>
                    <button data-action="retry-breweries" class="btn btn-primary">Try Again</button>
                </div>
            `;
        }
    };
    
    // ================================
    // NAVIGATION
    // ================================
    const openBreweries = () => {
        if (modules.modalManager) {
            modules.modalManager.open('breweriesOverlay');
        }
        
        modules.nav?.setPageContext('breweries');
        
        if (breweries.length === 0) {
            loadBreweries();
        }
        
        modules.tracking?.trackEvent('breweries_opened', 'Navigation');
    };
    
    const closeBreweries = () => {
        const overlay = document.getElementById('breweriesOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            modules.nav?.goToHome();
        }
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        openBreweries,
        closeBreweries,
        searchBreweryBeers,
        loadBreweries
    };
})();
