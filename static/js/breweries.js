// ================================================================================
// BREWERIES.JS - Enhanced Showcase Version
// ================================================================================

export default (function() {
    'use strict';
    
    // Private state
    let modules = {};
    let breweries = [];
    
    // Featured breweries for showcase
    const FEATURED_BREWERIES = [
        {
            name: 'Bellfield Brewery',
            location: 'Edinburgh',
            description: '100% dedicated gluten-free brewery',
            website: 'https://www.bellfieldbrewery.com',
            featured: true,
            beers: ['Lawless IPA', 'Session IPA', 'Bohemian Pilsner'],
            rating: 4.8
        },
        {
            name: 'Abbeydale Brewery',
            location: 'Sheffield',
            description: 'Craft brewery with excellent GF range',
            website: 'https://abbeydalebrewery.co.uk',
            featured: true,
            beers: ['Voyager IPA', 'Deception', 'Moonshine'],
            rating: 4.6
        },
        {
            name: 'Jump Ship Brewing',
            location: 'Edinburgh',
            description: 'Award-winning AF & GF beers',
            website: 'https://www.jumpshipbrewing.co.uk',
            featured: true,
            beers: ['Yardarm Lager', 'Flying Colours', 'Shore Leave'],
            rating: 4.7
        },
        {
            name: "Green's Beer",
            location: 'Belgium',
            description: 'GF brewing pioneers since 2004',
            website: 'https://www.glutenfreebeers.co.uk',
            featured: true,
            beers: ['Discovery Amber', 'IPA', 'Tripel Blonde'],
            rating: 4.9
        }
    ];
    
    // Initialize module
    const init = (appModules) => {
        console.log('🏭 Initializing Breweries Module');
        modules = appModules;
        setupEventListeners();
        console.log('✅ Breweries Module initialized');
    };
    
    // Setup all event listeners (run once)
    const setupEventListeners = () => {
        // Overlay click to close
        const overlay = document.getElementById('breweriesOverlay');
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeBreweries();
            }
        });
        
        // Toggle listener
        const toggle = document.getElementById('purchasableToggle');
        toggle?.addEventListener('change', (e) => {
            window.App.setState('showPurchasableOnly', e.target.checked);
            updateDisplay(e.target.checked);
        });
        
        // Search input
        const searchInput = document.getElementById('brewerySearchInput');
        searchInput?.addEventListener('input', (e) => filterBreweries(e.target.value));
        
        // Event delegation for brewery cards
        const grid = document.getElementById('breweriesGrid');
        grid?.addEventListener('click', (e) => {
            const card = e.target.closest('[data-action="search-brewery"]');
            if (card) {
                const breweryName = card.dataset.brewery;
                if (breweryName) {
                    searchBreweryBeers(breweryName);
                }
            }
        });
    };
    
    // Update display based on filter state (no innerHTML rebuilding)
    const updateDisplay = (showOnlyPurchasable) => {
        // Update hero text
        const title = document.getElementById('breweriesTitle');
        const subtitle = document.getElementById('breweriesSubtitle');
        
        if (title) {
            title.textContent = showOnlyPurchasable ? '🛍️ Buy GF Beer Online' : '🍺 GF Breweries';
        }
        if (subtitle) {
            subtitle.textContent = showOnlyPurchasable ? 
                'Order directly from our partner breweries' : 
                'Discover all gluten-free breweries in our database';
        }
        
        // Show/hide sections
        const affiliateMsg = document.getElementById('affiliateMessage');
        const featuredSection = document.getElementById('featuredSection');
        const allBreweriesSection = document.getElementById('allBreweriesSection');
        
        if (affiliateMsg) affiliateMsg.style.display = showOnlyPurchasable ? 'flex' : 'none';
        if (featuredSection) featuredSection.style.display = showOnlyPurchasable ? 'block' : 'none';
        if (allBreweriesSection) allBreweriesSection.style.display = showOnlyPurchasable ? 'none' : 'block';
        
        // Update toggle state
        const toggle = document.getElementById('purchasableToggle');
        if (toggle) toggle.checked = showOnlyPurchasable;
    };
    
    // Populate featured breweries grid
    const populateFeaturedBreweries = () => {
        const grid = document.getElementById('featuredGrid');
        if (!grid) return;
        
        grid.innerHTML = FEATURED_BREWERIES.map(brewery => `
            <div class="featured-brewery-card purchasable">
                <div class="shop-badge">🛒 Shop Available</div>
                <div class="brewery-header">
                    <h3>${brewery.name}</h3>
                    <span class="location">📍 ${brewery.location}</span>
                </div>
                <p class="brewery-description">${brewery.description}</p>
                <div class="brewery-actions">
                    <a href="${brewery.website}" 
                       target="_blank" 
                       class="btn btn-primary shop-btn"
                       onclick="trackBreweryClick('${brewery.name}')">
                        Shop Now →
                    </a>
                </div>
            </div>
        `).join('');
    };
    
    // Populate all breweries grid
    const populateBreweriesGrid = () => {
        const grid = document.getElementById('breweriesGrid');
        if (!grid) return;
        
        if (breweries.length === 0) {
            grid.innerHTML = '<p>Loading breweries...</p>';
            return;
        }
        
        grid.innerHTML = breweries.map(brewery => `
            <div class="brewery-card" data-action="search-brewery" data-brewery="${brewery}">
                <div class="brewery-icon">🍺</div>
                <h4>${brewery}</h4>
            </div>
        `).join('');
        
        // Update search placeholder
        const searchInput = document.getElementById('brewerySearchInput');
        if (searchInput) {
            searchInput.placeholder = `Search ${breweries.length} breweries...`;
        }
    };
    
    // Load breweries from API
    const loadBreweries = async () => {
        try {
            console.log('📦 Loading breweries...');
            
            const response = await fetch('/api/breweries');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            breweries = await response.json();
            console.log(`✅ Loaded ${breweries.length} breweries`);
            
            // Populate the grid with loaded data
            populateBreweriesGrid();
            
        } catch (error) {
            console.error('❌ Error loading breweries:', error);
        }
    };
    
    // Track clicks for analytics
    window.trackBreweryClick = (breweryName) => {
        console.log(`🔗 Brewery clicked: ${breweryName}`);
        modules.tracking?.trackEvent('brewery_website_click', 'External', breweryName);
        localStorage.setItem('lastBreweryClicked', breweryName);
    };
    
    // Open breweries overlay
    const openBreweries = (fromBuyButton = false) => {
        console.log('🏭 Opening breweries showcase');
        
        // Set filter state if coming from Buy button
        if (fromBuyButton) {
            window.App.setState('showPurchasableOnly', true);
        }
        
        const showPurchasable = fromBuyButton || window.App.getState('showPurchasableOnly');
        
        if (modules.modalManager) {
            modules.modalManager.open('breweriesOverlay', {
                onOpen: () => {
                    // Set initial display state
                    updateDisplay(showPurchasable);
                    
                    // Populate grids
                    populateFeaturedBreweries();
                    
                    // Load all breweries if not already loaded
                    if (breweries.length === 0) {
                        loadBreweries();
                    } else {
                        populateBreweriesGrid();
                    }
                }
            });
        }
        
        modules.nav?.setPageContext('breweries');
        modules.tracking?.trackEvent('breweries_opened', 'Navigation', fromBuyButton ? 'buy_button' : 'nav');
    };
    
    // Close breweries overlay
    const closeBreweries = () => {
        console.log('🏭 Closing breweries overlay');
        modules.modalManager?.close('breweriesOverlay');
        modules.nav?.goToHome();
    };
    
    // Filter breweries by search query
    const filterBreweries = (query) => {
        const cards = document.querySelectorAll('.brewery-card');
        const normalizedQuery = query.toLowerCase().trim();
        
        cards.forEach(card => {
            const breweryName = card.dataset.brewery?.toLowerCase() || '';
            card.style.display = breweryName.includes(normalizedQuery) ? 'flex' : 'none';
        });
    };
    
    // Search brewery beers
    const searchBreweryBeers = async (brewery) => {
        console.log(`🔍 Loading beers for: ${brewery}`);
        
        if (modules.modalManager) {
            modules.modalManager.open('breweryBeersModal');
        }
        
        const breweryNameEl = document.getElementById('breweryName');
        if (breweryNameEl) breweryNameEl.textContent = brewery;
        
        // Show loading state
        document.getElementById('breweryBeersLoading').style.display = 'block';
        document.getElementById('breweryBeersList').style.display = 'none';
        document.getElementById('breweryBeersEmpty').style.display = 'none';
        
        try {
            const response = await fetch(`/api/brewery/${encodeURIComponent(brewery)}/beers`);
            const beers = await response.json();
            console.log('Beers data received:', beers);
            displayBreweryBeers(beers, brewery);
        } catch (error) {
            console.error('Error loading brewery beers:', error);
            document.getElementById('breweryBeersLoading').style.display = 'none';
            document.getElementById('breweryBeersEmpty').style.display = 'block';
        }
    };
    
    // Display brewery beers
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
                    <strong>${beer.beer_name}</strong>
                    <div class="beer-meta">
                        ${beer.style ? `<span class="beer-style">${beer.style}</span>` : ''}
                        ${beer.abv ? `<span class="beer-abv">${beer.abv}% ABV</span>` : ''}
                        ${beer.gluten_status ? `<span class="beer-gf-status">${beer.gluten_status.replace('_', ' ')}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    };
    
    return {
        init,
        openBreweries,
        closeBreweries,
        searchBreweryBeers,
        displayBreweryBeers,
        loadBreweries
    };
})();
