// ================================================================================
// BREWERIES.JS - Enhanced Showcase Version
// ================================================================================

export default (function() {
    'use strict';
    
    // Private state
    let modules = {};
    let breweries = [];
    
    // Featured breweries for showcase (these are your email targets!)
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
    
    // Setup event listeners
    const setupEventListeners = () => {
        const overlay = document.getElementById('breweriesOverlay');
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeBreweries();
            }
        });
    };
    
    // Enhanced display with featured section
    const displayBreweries = (filterPurchasable = false) => {
        const container = document.getElementById('breweriesContent');
        if (!container) return;
        
        // Check if we came from "Buy GF Beer" button
        const showOnlyPurchasable = filterPurchasable || window.App.getState('showPurchasableOnly');
        
        container.innerHTML = `
            <!-- Hero Section -->
            <div class="breweries-hero">
                <h1>${showOnlyPurchasable ? '🛍️ Buy GF Beer Online' : '🍺 GF Breweries'}</h1>
                <p>${showOnlyPurchasable ? 
                    'Order directly from our partner breweries' : 
                    'Discover all gluten-free breweries in our database'}</p>
            </div>
            
            <!-- Filter Toggle -->
            <div class="brewery-filters">
                <div class="filter-toggle">
                    <label class="toggle-switch">
                        <input type="checkbox" id="purchasableToggle" 
                               ${showOnlyPurchasable ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">Show only breweries with online shop</span>
                    </label>
                </div>
                ${showOnlyPurchasable ? `
                    <div class="community-message">
                        <span class="message-icon">💙</span>
                        <span>These affiliate links help keep this site free for everyone!</span>
                    </div>
                ` : ''}
            </div>
            
            <!-- Featured Partners (only show if filtered) -->
            ${showOnlyPurchasable ? `
                <div class="featured-section">
                    <h2>🤝 Our Partner Breweries</h2>
                    <div class="featured-grid">
                        ${FEATURED_BREWERIES.map(brewery => `
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
                        `).join('')}
                    </div>
                    
                    <div class="more-coming">
                        <h3>🚀 More Coming Soon!</h3>
                        <p>We're actively partnering with more GF breweries. Check back regularly!</p>
                    </div>
                </div>
            ` : ''}
            
            <!-- All Breweries Section -->
            <div class="all-breweries-section" ${showOnlyPurchasable ? 'style="display:none"' : ''}>
                <h2>📚 All Breweries in Database</h2>
                <input type="text" 
                       id="brewerySearchInput" 
                       class="brewery-search-input"
                       placeholder="Search ${breweries.length || 'all'} breweries...">
                
                <div id="breweriesGrid" class="breweries-grid">
                    ${breweries.length > 0 ? 
                        breweries.map(brewery => `
                            <div class="brewery-card" data-action="search-brewery" data-brewery="${brewery}">
                                <div class="brewery-icon">🍺</div>
                                <h4>${brewery}</h4>
                            </div>
                        `).join('') : 
                        '<p>Loading breweries...</p>'
                    }
                </div>
            </div>
        `;
        
        // Add toggle listener
        const toggle = document.getElementById('purchasableToggle');
        toggle?.addEventListener('change', (e) => {
            window.App.setState('showPurchasableOnly', e.target.checked);
            displayBreweries(e.target.checked);
        });
        
        // Add search functionality
        const searchInput = document.getElementById('brewerySearchInput');
        searchInput?.addEventListener('input', (e) => filterBreweries(e.target.value));

        container.querySelectorAll('[data-action="search-brewery"]').forEach(card => {
            card.addEventListener('click', (e) => {
                const breweryName = card.dataset.brewery;
                if (breweryName) {
                    searchBreweryBeers(breweryName);
                }
            });
        });
    };
    
    // Load breweries from API
    const loadBreweries = async () => {
        try {
            console.log('📦 Loading breweries...');
            
            // Get the current filter state
            const currentFilter = window.App.getState('showPurchasableOnly') || false;
            
            // Show featured immediately - WITH FILTER STATE
            displayBreweries(currentFilter);
            
            // Then load all breweries
            const response = await fetch('/api/breweries');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            breweries = await response.json();
            console.log(`✅ Loaded ${breweries.length} breweries`);
            
            // Re-render with all data - WITH FILTER STATE
            displayBreweries(currentFilter);
            
        } catch (error) {
            console.error('❌ Error loading breweries:', error);
            // Featured breweries still show even if API fails
        }
    };
    
    // Track clicks for analytics
    window.trackBreweryClick = (breweryName) => {
        console.log(`🔗 Brewery clicked: ${breweryName}`);
        modules.tracking?.trackEvent('brewery_website_click', 'External', breweryName);
        
        // Store this for showing success later
        localStorage.setItem('lastBreweryClicked', breweryName);
    };
    
    const openBreweries = (fromBuyButton = false) => {
        console.log('🏭 Opening breweries showcase');
        
        // Set filter state if coming from Buy button
        if (fromBuyButton) {
            window.App.setState('showPurchasableOnly', true);
        }
        
        if (modules.modalManager) {
            modules.modalManager.open('breweriesOverlay', {
                onOpen: () => {
                    displayBreweries(fromBuyButton);
                    if (breweries.length === 0) {
                        loadBreweries();
                    }
                }
            });
        }
        
        modules.nav?.setPageContext('breweries');
        modules.tracking?.trackEvent('breweries_opened', 'Navigation', fromBuyButton ? 'buy_button' : 'nav');
    };
    
    const closeBreweries = () => {
        console.log('🏭 Closing breweries overlay');
        modules.modalManager?.close('breweriesOverlay');
        modules.nav?.goToHome();
    };
    
    const filterBreweries = (query) => {
        const cards = document.querySelectorAll('.brewery-card');
        const normalizedQuery = query.toLowerCase().trim();
        
        cards.forEach(card => {
            const breweryName = card.dataset.brewery?.toLowerCase() || '';
            card.style.display = breweryName.includes(normalizedQuery) ? 'flex' : 'none';
        });
    };
    
    // Existing functions stay the same...
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

            console.log('Beers data received:', beers);
            
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
                    <strong>${beer.beer_name}</strong>
                    <div class="beer-meta">
                        ${beer.style ? `<span class="beer-style">${beer.style}</span>` : ''}
                        ${beer.abv ? `<span class="beer-abv">${beer.abv}% ABV</span>` : ''}
                        ${beer.gluten_status ? `<span class="beer-gf-status">${beer.gluten_status.replace('_', ' ')}</span>` : ''}
                    </div>
                </div>
                <button class="btn btn-sm" data-action="find-venues-with-beer" 
                        data-beer="${beer.beer_name}" data-brewery="${brewery}">
                    Find Venues
                </button>
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
