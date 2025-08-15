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
    const displayBreweries = () => {
        const container = document.getElementById('breweriesContent');
        if (!container) return;
        
        container.innerHTML = `
            <!-- Hero Section -->
            <div class="breweries-hero">
                <h1>🍺 GF Brewery Partners</h1>
                <p>Supporting 100% gluten-free & dedicated GF breweries</p>
            </div>
            
            <!-- Featured Partners -->
            <div class="featured-section">
                <h2>⭐ Featured Partners</h2>
                <p class="section-subtitle">We're partnering with these amazing breweries to bring you the best GF beer</p>
                
                <div class="featured-grid">
                    ${FEATURED_BREWERIES.map(brewery => `
                        <div class="featured-brewery-card">
                            <div class="brewery-badge">
                                ${brewery.rating ? `<span class="rating">⭐ ${brewery.rating}</span>` : ''}
                                ${brewery.featured ? '<span class="featured-tag">Featured</span>' : ''}
                            </div>
                            
                            <div class="brewery-header">
                                <h3>${brewery.name}</h3>
                                <span class="location">📍 ${brewery.location}</span>
                            </div>
                            
                            <p class="brewery-description">${brewery.description}</p>
                            
                            <div class="beer-preview">
                                <strong>Popular beers:</strong>
                                <div class="beer-pills">
                                    ${brewery.beers.slice(0, 3).map(beer => 
                                        `<span class="beer-pill">${beer}</span>`
                                    ).join('')}
                                </div>
                            </div>
                            
                            <div class="brewery-actions">
                                <a href="${brewery.website}" 
                                   target="_blank" 
                                   class="btn btn-primary"
                                   onclick="trackBreweryClick('${brewery.name}')">
                                    Visit Website →
                                </a>
                                <button class="btn btn-secondary" 
                                        data-action="search-brewery" 
                                        data-brewery="${brewery.name}">
                                    Find in Venues
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Coming Soon Section -->
            <div class="coming-soon-section">
                <div class="coming-soon-card">
                    <h3>🤝 More Partnerships Coming Soon!</h3>
                    <p>We're in talks with more fantastic GF breweries.</p>
                    <p class="cta-text">Are you a GF brewery? Get in touch!</p>
                    <a href="mailto:partners@coeliacslikebeer.co.uk" class="btn btn-outline">
                        Become a Partner
                    </a>
                </div>
            </div>
            
            <!-- All Breweries Section -->
            <div class="all-breweries-section">
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
        
        // Add search functionality
        const searchInput = document.getElementById('brewerySearchInput');
        searchInput?.addEventListener('input', (e) => filterBreweries(e.target.value));
    };
    
    // Load breweries from API
    const loadBreweries = async () => {
        try {
            console.log('📦 Loading breweries...');
            
            // Show featured immediately
            displayBreweries();
            
            // Then load all breweries
            const response = await fetch('/api/breweries');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            breweries = await response.json();
            console.log(`✅ Loaded ${breweries.length} breweries`);
            
            // Re-render with all data
            displayBreweries();
            
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
    
    const openBreweries = () => {
        console.log('🏭 Opening breweries showcase');
        
        if (modules.modalManager) {
            modules.modalManager.open('breweriesOverlay', {
                onOpen: () => {
                    displayBreweries();
                    if (breweries.length === 0) {
                        loadBreweries();
                    }
                }
            });
        }
        
        modules.nav?.setPageContext('breweries');
        modules.tracking?.trackEvent('breweries_opened', 'Navigation');
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
        // Your existing code...
    };
    
    return {
        init,
        openBreweries,
        closeBreweries,
        searchBreweryBeers,
        loadBreweries
    };
})();
