// ================================================================================
// MAIN.JS - Complete Refactor with STATE_KEYS and Modern Patterns
// Central app initialization and coordination
// ================================================================================

import { Constants } from './constants.js';
import { OnboardingFlow } from './onboarding.js';
import { UserSession } from './user-session.js';
const STATE_KEYS = Constants.STATE_KEYS;

// ================================
// EVENT BUS
// ================================
class EventBus extends EventTarget {
    emit = (eventName, data) => {
        this.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    };
    
    on = (eventName, handler) => {
        this.addEventListener(eventName, handler);
    };
    
    off = (eventName, handler) => {
        this.removeEventListener(eventName, handler);
    };
}

// ================================
// APP NAMESPACE
// ================================
const App = {
    initialized: false,
    modules: {},
    events: new EventBus(),
    
    // ================================
    // STATE MANAGEMENT
    // ================================
    state: {
        currentView: 'home',
        activeOverlays: new Set(),
        userLocation: null,
        locationTimestamp: null,
        locationAccuracy: null,
        lastSearch: {
            type: null,
            query: null,
            radius: null,
            timestamp: null
        },
        searchResults: [],
        currentVenue: null,
        selectedVenueForReport: null,
        mapData: {
            allVenues: [],
            fullUKMapInstance: null,
            resultsMapInstance: null,
            venueDetailMapInstance: null,
            userMarker: null,
            gfVenuesLayer: null,
            clusteredVenuesLayer: null
        },
        currentBrewery: null,
        reportFormData: {},
        activeModals: [],
        toastQueue: [],
        mapViewMode: 'gf'
    },
    
    // State management methods
    setState: (path, value) => {
        const keys = path.split('.');
        let current = App.state;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        
        const oldValue = current[keys[keys.length - 1]];
        current[keys[keys.length - 1]] = value;
        
        // Emit state change event
        App.events.emit('stateChanged', { path, oldValue, newValue: value });
        
        console.log(`📊 State updated: ${path} =`, value);
    },
    
    getState: (path) => {
        // Add type checking
        if (!path || typeof path !== 'string') {
            console.warn('⚠️ Invalid state path:', path);
            return null;
        }
        
        const keys = path.split('.');
        let current = App.state;
        
        for (const key of keys) {
            current = current?.[key];
            if (current === undefined) return null;
        }
        
        return current;
    },
    
    // ================================
    // MODULE MANAGEMENT
    // ================================
    registerModule: (name, module) => {
        App.modules[name] = module;
        App.events.emit('moduleRegistered', { name, module });
        console.log(`📦 Module registered: ${name}`);
    },
    
    getModule: (name) => {
        return App.modules[name] || null;
    },
    
    // ================================
    // INITIALIZATION
    // ================================
    initialize: async () => {
        console.log('🚀 Initializing App...');
        
        try {
            // Check dependencies
            if (!window.L || !window.L.map) {
                throw new Error('Leaflet not loaded');
            }
            
            // Initialize in phases
            await App.initPhase1(); // Core utilities
            await App.initPhase2(); // Data layer
            await App.initPhase3(); // UI layer
            await App.initPhase4(); // Features
            await App.initPhase5(); // Final setup
            
            App.initialized = true;
            App.events.emit('appInitialized');
            
            console.log('✅ App initialization complete!');
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            App.showInitError(error);
        }
    },
    
    initPhase1: async () => {
        console.log('🔧 Phase 1: Core Utilities...');
        
        const { HelpersModule } = await import('./helpers.js');
        App.registerModule('helpers', HelpersModule);
        App.registerModule('ui', HelpersModule);     // Legacy alias
        App.registerModule('utils', HelpersModule);  // Legacy alias
        
        // Make critical functions globally available
        window.showLoadingToast = HelpersModule.showLoadingToast;
        window.hideLoadingToast = HelpersModule.hideLoadingToast;
        window.showSuccessToast = HelpersModule.showSuccessToast;
        window.animateNumber = HelpersModule.animateNumber;
        window.closeResults = HelpersModule.closeResults;
    },
    
    initPhase2: async () => {
        console.log('🔧 Phase 2: Data Layer...');
        
        const [{ APIModule }, { TrackingModule }, { FilterStateManager }] = await Promise.all([
            import('./api.js'),
            import('./tracking.js'),
            import('./filter-gf.js')
        ]);
        
        App.registerModule('api', APIModule);
        App.registerModule('tracking', TrackingModule);
        App.registerModule('filterGF', FilterStateManager);
        
        // Initialize filter state manager
        FilterStateManager.init();
        
        // Load initial stats
        await App.loadInitialStats();
    },
    
    initPhase3: async () => {
        console.log('🔧 Phase 3: UI Layer...');
        
        const [{ ModalModule }, { ModalManager }] = await Promise.all([
            import('./modals.js'),
            import('./modal-manager.js') // ADD THIS
        ]);
        
        App.registerModule('modal', ModalModule);
        App.registerModule('modalManager', ModalManager); // ADD THIS
        
        // Initialize both
        ModalModule.init();
        ModalManager.init(); // ADD THIS
    },
    
    initPhase4: async () => {
        console.log('🔧 Phase 4: Features...');
        
        const modules = await Promise.all([
            import('./map.js'),
            import('./search.js'),
            import('./forms.js'),
            import('./community.js'),
            import('./nav.js'),
            import('./breweries.js')
        ]);
        
        const [
            { MapModule },
            { SearchModule },
            { FormModule },
            { CommunityModule },
            { NavStateManager },
            breweriesImport
        ] = modules;
        
        App.registerModule('map', MapModule);
        App.registerModule('search', SearchModule);
        App.registerModule('form', FormModule);
        App.registerModule('community', CommunityModule);

        const { CommunityHubModule } = await import('./community-hub.js');
        App.registerModule('communityHub', CommunityHubModule);
        CommunityHubModule.init();
        
        // Handle BreweriesModule - check different possible exports
        const BreweriesModule = breweriesImport.BreweriesModule || 
                               breweriesImport.default || 
                               window.BreweriesModule ||
                               (() => {
                                   // Fallback implementation
                                   console.log('⚠️ Using fallback BreweriesModule');
                                   const module = (function() {
                                       'use strict';
                                       
                                       let modules = {};
                                       let breweries = [];
                                       
                                       const init = (appModules) => {
                                           console.log('🏭 Initializing Breweries Module (fallback)');
                                           modules = appModules || {};
                                           setupEventListeners();
                                           console.log('✅ Breweries Module initialized');
                                       };
                                       
                                       const setupEventListeners = () => {
                                           const overlay = document.getElementById('breweriesOverlay');
                                           overlay?.addEventListener('click', (e) => {
                                               if (e.target === overlay) {
                                                   closeBreweries();
                                               }
                                           });
                                       };
                                       
                                       const openBreweries = () => {
                                           console.log('🏭 Opening breweries overlay');
                                           const overlay = document.getElementById('breweriesOverlay');
                                           if (overlay) {
                                               overlay.style.display = 'flex';
                                               overlay.classList.add('active');
                                               document.body.style.overflow = 'hidden';
                                           }
                                       };
                                       
                                       const closeBreweries = () => {
                                           console.log('🏭 Closing breweries overlay');
                                           const overlay = document.getElementById('breweriesOverlay');
                                           if (overlay) {
                                               overlay.style.display = 'none';
                                               overlay.classList.remove('active');
                                               document.body.style.overflow = '';
                                           }
                                       };
                                       
                                       const loadBreweries = async () => {
                                           console.log('📦 Loading breweries...');
                                       };
                                       
                                       const searchBreweryBeers = (brewery) => {
                                           console.log(`🔍 Searching for beers from: ${brewery}`);
                                       };
                                       
                                       return {
                                           init,
                                           openBreweries,
                                           closeBreweries,
                                           loadBreweries,
                                           searchBreweryBeers
                                       };
                                   })();
                                   
                                   return module;
                               })();
        
        if (BreweriesModule) {
            App.registerModule('breweries', BreweriesModule);
            BreweriesModule.init(App.modules);
        } else {
            console.error('❌ BreweriesModule not found');
        }
        
        // Initialize forms
        FormModule.init();
        NavStateManager.init();
    },
    
    initPhase5: async () => {
        console.log('🔧 Phase 5: Final Setup...');
    
        // FIX: Ensure all overlays are hidden on start
        document.querySelectorAll('.overlay, .modal').forEach(el => {
            if (!el.classList.contains('community-home')) {
                el.style.display = 'none';
                el.classList.remove('active');
            }
        });
        
        // Ensure community home is visible
        const communityHome = document.querySelector('.community-home');
        if (communityHome) {
            communityHome.style.display = 'block';
        }
        
        // Set up event delegation
        App.setupEventDelegation();
        
        // Set up global functions
        App.setupGlobalFunctions();
        
        // Check cookie consent
        App.checkCookieConsent();

        // ADD THE ONBOARDING CODE HERE (after line 260):
        // Initialize user session and onboarding
        await OnboardingFlow.start();
        
        // Listen for onboarding completion
        window.addEventListener('onboardingComplete', () => {
            console.log('🎉 Onboarding complete!');
        });
        
        // Check if user is authenticated for contributions
        window.addEventListener('beforeContribution', async (event) => {
            const status = UserSession.getStatus();
            
            if (status.status !== 'authenticated') {
                event.preventDefault();
                
                if (confirm('Join the community to track your contributions! Choose a nickname?')) {
                    OnboardingFlow.showNicknameSelection();
                }
            }
        });
        
        // Award points for contributions
        window.addEventListener('contributionMade', async (event) => {
            const { type, data } = event.detail;
            
            const points = {
                'beer_report': 15,
                'status_update': 5,
                'venue_add': 20,
                'photo_upload': 10
            };
            
            if (UserSession.isAuthenticated) {
                await UserSession.awardPoints(points[type], data.message);
            }
        });
        // END OF ONBOARDING CODE
        
        // Track session start
        const tracking = App.getModule('tracking');
        if (tracking) {
            tracking.trackSessionStart();
        }

        const { NavStateManager } = await import('./nav.js');
        App.registerModule('nav', NavStateManager);
    },

    
    
    // ================================
    // DATA LOADING
    // ================================
    loadInitialStats: async () => {
        try {
            const api = App.getModule('api');
            if (!api) return;
            
            const stats = await api.getStats();
            const helpers = App.getModule('helpers');
            
            if (helpers && stats) {
                // Just use the numbers as they are
                if (stats.total_venues) {
                    helpers.animateNumber('totalVenues', stats.total_venues);
                }
                if (stats.gf_venues) {
                    helpers.animateNumber('gfVenues', stats.gf_venues);
                }
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
            // Leave blank on error - don't set fallback values
        }
    },
    
    // ================================
    // EVENT DELEGATION
    // ================================
    setupEventDelegation: () => {
        console.log('🔧 Setting up event delegation...');
        
        // Main click handler
        document.addEventListener('click', App.handleGlobalClick, true);
        
        // Form submission
        document.addEventListener('submit', App.handleFormSubmit, true);
        
        // Input events for search modals
        document.addEventListener('input', App.handleGlobalInput, true);
        
        // Change events for selects
        document.addEventListener('change', App.handleGlobalChange, true);
    },
    
    handleGlobalClick: (e) => {
        const target = e.target.closest('[data-action], [data-modal], [data-distance], [data-status]');
        if (!target) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Handle different click types
        if (target.dataset.action) {
            App.handleAction(target.dataset.action, target, e);
        }
        
        if (target.dataset.modal) {
            App.getModule('modal')?.open(target.dataset.modal);
        }
        
        if (target.dataset.distance) {
            App.handleDistanceSelection(parseInt(target.dataset.distance));
        }
        
        if (target.dataset.status) {
            App.getModule('form')?.GFStatusFlow?.selectStatus(target.dataset.status);
        }
    },
    
    handleFormSubmit: (e) => {
        if (e.target.id === 'reportForm') {
            e.preventDefault();
            e.stopPropagation(); // Add this
            const form = App.getModule('form');
            if (form?.handleReportSubmission) {
                form.handleReportSubmission(e);
            }
        }
    },
    
    handleGlobalInput: (e) => {
        // Delegate to appropriate handlers
        const inputHandlers = {
            'placesSearchInput': () => {
                const search = App.getModule('search');
                search?.PlacesSearchModule?.handleSearch(e.target.value);
            }
        };
        
        const handler = inputHandlers[e.target.id];
        if (handler) handler();
    },
    
    handleGlobalChange: (e) => {
        // Handle select changes
        const changeHandlers = {
            'areaSearchType': () => {
                const modal = App.getModule('modal');
                modal?.updateAreaPlaceholder?.();
            },
            'beerSearchType': () => {
                const modal = App.getModule('modal');
                modal?.updateBeerPlaceholder?.();
            }
        };
        
        const handler = changeHandlers[e.target.id];
        if (handler) handler();
    },
    
    // ================================
    // ACTION HANDLERS
    // ================================
    handleAction: (action, element, event) => {
        console.log(`🎬 Action: ${action}`);
        
        // Get all modules
        const modules = {
            search: App.getModule('search'),
            modal: App.getModule('modal'),
            modalManager: App.getModule('modalManager'), // ADD THIS
            helpers: App.getModule('helpers'),
            map: App.getModule('map'),
            form: App.getModule('form'),
            tracking: App.getModule('tracking'),
            nav: App.getModule('nav'),
            breweries: App.getModule('breweries'), // ADD THIS LINE
            community: App.getModule('community')  // AND THIS IF NEEDED
        };

        console.log('📦 Available modules:', Object.keys(modules).filter(key => modules[key] !== null));
        
        // Route to appropriate handler
        const handler = App.actionHandlers[action];
        if (handler) {
            handler(element, modules, event);
        } else {
            console.warn(`❓ Unhandled action: ${action}`);
        }
    },
    
    // Action handler map - split into logical groups
    actionHandlers: {
        // Search actions
        'location-search': (el, modules) => {
            modules.nav?.setPageContext('search-modal'); // Set context to search-modal
            modules.modalManager?.open('distanceModal');
        },
        'search-name': (el, modules) => {
            modules.nav?.setPageContext('search-modal'); // Set context to search-modal
            modules.modalManager?.open('nameModal');
        },
        'perform-name-search': (el, modules) => {
            modules.search?.searchByName();
        },
        'search-area': (el, modules) => {
            modules.nav?.setPageContext('search-modal'); // Set context to search-modal
            modules.modalManager?.open('areaModal');
        },
        'perform-area-search': (el, modules) => {
            modules.search?.searchByArea();
        },
        'search-beer': (el, modules) => {
            modules.nav?.setPageContext('search-modal'); // Set context to search-modal
            modules.modalManager?.open('beerModal');
        },
        'perform-beer-search': (el, modules) => {
            modules.search?.searchByBeer();
        },

         // Map actions
        'toggle-results-map': (el, modules) => {
            modules.map?.toggleSearchResultsFullMap?.();
        },
        'toggle-venue-map': (el, modules) => {
            App.toggleVenueDetailMap(modules);
        },
        'show-venue-on-map': (el, modules) => {
            const currentVenue = App.getState(STATE_KEYS.CURRENT_VENUE);
            if (!currentVenue || !currentVenue.latitude || !currentVenue.longitude) {
                modules.helpers?.showToast('📍 Location not available for this venue', 'error');
                return;
            }
            
            // Show full map
            App.showFullMap(modules);
            
            // After map loads, center on this venue
            setTimeout(() => {
                const map = App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
                if (map) {
                    map.setView([parseFloat(currentVenue.latitude), parseFloat(currentVenue.longitude)], 16);
                    
                    // Find and open the venue's popup
                    map.eachLayer(layer => {
                        if (layer.options && layer.options.venueId === currentVenue.venue_id) {
                            layer.openPopup();
                        }
                    });
                }
            }, 500);
        },
        
        // Navigation actions
        'close-results': (el, modules) => {
            modules.nav?.goToHome();
            modules.tracking?.trackEvent('close_results', 'Navigation', 'button');
        },
        'close-venue-details': (el, modules) => {
            modules.nav?.goToHome();
        },
        'back-to-results': (el, modules) => {
            modules.nav?.goBackFromVenue();
        },

        
        'nav-back': (el, modules) => {
            const currentContext = modules.nav?.getCurrentContext();
            console.log('🔙 Navigating back from:', currentContext);
            
            if (currentContext === 'search-modal') {
                // From search modal -> back to search overlay
                const searchModals = ['nameModal', 'areaModal', 'beerModal', 'distanceModal'];
                searchModals.forEach(modalId => modules.modalManager?.close(modalId));
                
                setTimeout(() => {
                    modules.modalManager?.open('searchOverlay');
                    modules.nav?.setPageContext('search');
                }, 100);

            } else if (currentContext === 'venue-details' || currentContext === 'venue') {  // Add this case
                // From venue details -> back to search results
                modules.modalManager?.close('venueDetailsOverlay');
                setTimeout(() => {
                    modules.modalManager?.open('resultsOverlay');
                    modules.nav?.setPageContext('results');
                }, 100);
                
            } else if (currentContext === 'results') {
                // From results -> back to search overlay (always)
                modules.modalManager?.close('resultsOverlay');
                setTimeout(() => {
                    modules.modalManager?.open('searchOverlay');
                    modules.nav?.setPageContext('search');
                }, 100);
                
            } else if (currentContext === 'search') {
                // From search overlay -> back to home
                modules.modalManager?.close('searchOverlay');
                modules.nav?.goToHome();
                
            } else {
                // Everything else -> home
                modules.nav?.goToHome();
            }
        },

        // Add these to your main.js action handlers:

        'quick-update-status': async (el, modules) => {
            const status = el.dataset.status;
            const venueId = el.dataset.venueId;
            
            console.log('🎯 Updating status:', status, 'for venue:', venueId);
            
            modules.modalManager?.close('beerDetailsPromptModal');
            modules.helpers?.showLoadingToast('Updating status...');
            
            try {
                const response = await fetch('/api/update-gf-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        venue_id: parseInt(venueId),
                        status: status,
                        submitted_by: window.App.getState('userNickname') || localStorage.getItem('userNickname') || 'anonymous'
                    })
                });
                
                if (response.ok) {
                    modules.helpers?.hideLoadingToast();
                    modules.helpers?.showSuccessToast('✅ Perfect! Status updated. Thanks!');
                    
                    // Update current venue state
                    const currentVenue = window.App.getState('currentVenue');
                    if (currentVenue) {
                        window.App.setState('currentVenue', {
                            ...currentVenue,
                            gf_status: status
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to update status:', error);
                modules.helpers?.hideLoadingToast();
                modules.helpers?.showErrorToast('Failed to update status');
            }
        },
        
        'skip-status-update': (el, modules) => {
            console.log('⏭️ Skipping status update');
            modules.modalManager?.close('beerDetailsPromptModal');
        },

        
        'close-modal': (el, modules) => {
            const modal = el.closest('.modal, .search-modal, .report-modal');
            if (modal?.id) {
                // Special handling for report modal
                if (modal.id === 'reportModal') {
                    const currentVenue = window.App.getState(STATE_KEYS.CURRENT_VENUE || STATE_KEYS.CURRENT_VENUE);
                    if (currentVenue) {
                        // We have a current venue, so we came from venue details
                        modules.modalManager?.close(modal.id);
                        // Don't need to do anything else - venue details should still be visible
                        return;
                    }
                }
                
                modules.modalManager?.close(modal.id) || modules.modal?.close(modal.id);
            }
        },

        'find-venues-with-beer': (el, modules) => {
            const beerName = el.dataset.beer;
            const breweryName = el.dataset.brewery;
            
            if (!beerName || !breweryName) {
                console.error('Missing beer or brewery data');
                return;
            }
            
            // Close the modals
            modules.modalManager?.close('breweryBeersModal');
            modules.modalManager?.close('breweriesOverlay');
            
            const searchQuery = `${breweryName} ${beerName}`;
            
            // Set the search input
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = searchQuery;
            }
            
            // Show we're searching
            modules.helpers?.showLoadingToast(`Searching for ${beerName}...`);
            
            // Use GET request like the normal search
            const params = new URLSearchParams({
                q: searchQuery,
                type: 'beer'
            });
            
            fetch(`/api/search?${params}`)
            .then(response => response.json())
            .then(data => {
                modules.helpers?.hideLoadingToast();
                
                const searchModule = modules.search || window.App?.getModule('search');
                if (searchModule && searchModule.displayResults) {
                    searchModule.displayResults(data);
                // } else if (data.venues && data.venues.length > 0) {
                //     modules.helpers?.showSuccessToast(`Found ${data.venues.length} venues!`);
                } else {
                    modules.helpers?.showErrorToast(`No venues found serving ${beerName}`);
                }
            })
            .catch(error => {
                console.error('Search error:', error);
                modules.helpers?.hideLoadingToast();
                modules.helpers?.showErrorToast('Search failed');
            });
        },

        
        // Venue actions
        'view-venue': (el, modules) => {
            const venueId = el.dataset.venueId || el.closest('[data-venue-id]')?.dataset.venueId;
            if (venueId) modules.search?.showVenueDetails?.(venueId);
        },
        'view-venue-from-map': (el, modules) => {
            const venueId = el.dataset.venueId;
            if (venueId) {
                // First close the map overlay
                const mapOverlay = document.getElementById('fullMapOverlay');
                if (mapOverlay) {
                    mapOverlay.style.display = 'none';
                    mapOverlay.classList.remove('active');
                }
                
                // Then show venue details
                modules.search?.showVenueDetails?.(venueId);
            }
        },
        'find-venue-online': (el, modules) => {
            App.openVenueExternalSearch(modules);
        },
        'get-venue-directions': (el, modules) => {
            App.openVenueDirections(modules);
        },

        'search-venues-with-brewery': (el, modules) => {
            const breweryName = document.getElementById('breweryName')?.textContent;
            
            if (!breweryName) {
                console.error('No brewery name found');
                return;
            }
            
            // Close the modals
            modules.modalManager?.close('breweryBeersModal');
            modules.modalManager?.close('breweriesOverlay');
            
            // Get search module
            const searchModule = modules.search || window.App?.getModule('search');
            
            if (searchModule && searchModule.searchByBeer) {
                // Set the beer search inputs
                const beerInput = document.getElementById('beerInput');
                if (beerInput) {
                    beerInput.value = breweryName;
                }
                
                const beerSearchType = document.getElementById('beerSearchType');
                if (beerSearchType) {
                    beerSearchType.value = 'brewery';
                }
                
                // Call searchByBeer directly - it should handle everything
                searchModule.searchByBeer();
            } else {
                console.error('searchByBeer not available');
            }
        },

        'search-all-venues': (el, modules) => {
            console.log('Search all venues clicked!');
            
            // Just click the "All venues" option in the top nav toggle!
            const allVenuesOption = document.querySelector('.toggle-option[data-value="all"]');
            if (allVenuesOption) {
                allVenuesOption.click();
            }
        },

        // Add these action handlers to main.js
        'update-gf-status-new-venue': (el, modules) => {
            // Close the prompt modal
            modules.modalManager?.close('venueAddedPromptModal');
            
            // Get the venue ID from state or element
            const venueId = window.App.getState('lastAddedVenueId');
            if (!venueId) {
                console.error('No venue ID found');
                return;
            }
            
            // Set as current venue for the status flow
            window.App.setState('currentVenue', {
                venue_id: venueId,
                name: window.App.getState('lastAddedVenueName')
            });
            
            // Open the GF status modal
            const formModule = modules.form || window.App?.getModule('form');
            if (formModule && formModule.GFStatusFlow) {
                formModule.GFStatusFlow.openStatusModal();
            }
        },
        
        'report-gf-beer-new-venue': (el, modules) => {
            // Close the prompt modal
            modules.modalManager?.close('venueAddedPromptModal');
            
            // Get the venue ID from state
            const venueId = window.App.getState('lastAddedVenueId');
            const venueName = window.App.getState('lastAddedVenueName');
            
            if (!venueId) {
                console.error('No venue ID found');
                return;
            }
            
            // Set as current venue
            window.App.setState('currentVenue', {
                venue_id: venueId,
                name: venueName
            });
            
            // Open the report modal
            const modalModule = modules.modal || window.App?.getModule('modal');
            if (modalModule && modalModule.openReportModal) {
                modalModule.openReportModal({
                    venue_id: venueId,
                    name: venueName
                });
            }
        },
        
        'close-venue-added-modal': (el, modules) => {
            modules.modalManager?.close('venueAddedPromptModal');
            modules.helpers?.showSuccessToast('Venue added successfully!');
        },
        
        // In main.js actionHandlers - update show-full-map
        'show-full-map': (el, modules) => {
            // Check current context
            const currentContext = modules.nav?.getCurrentContext();
            console.log('🗺️ Map button pressed from context:', currentContext);
            
            // If we're on results page, toggle the results map instead
            if (currentContext === 'results') {
                modules.map?.toggleSearchResultsFullMap?.();
                return;
            }
            
            // Otherwise, show the full UK map as normal
            if (currentContext === 'search') {
                modules.modalManager?.close('searchOverlay');
                // Small delay to let the close finish
                setTimeout(() => {
                    App.showFullMap(modules);
                }, 100);
            } else if (currentContext === 'venue') {
                modules.modalManager?.close('venueDetailsOverlay');
                setTimeout(() => {
                    App.showFullMap(modules);
                    const currentVenue = App.getState(STATE_KEYS.CURRENT_VENUE);
                    if (currentVenue && currentVenue.latitude && currentVenue.longitude) {
                        setTimeout(() => {
                            const map = App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
                            if (map) {
                                map.setView([parseFloat(currentVenue.latitude), parseFloat(currentVenue.longitude)], 16);
                                map.eachLayer(layer => {
                                    if (layer.options && layer.options.venueId === currentVenue.venue_id) {
                                        layer.openPopup();
                                    }
                                });
                            }
                        }, 500);
                    }
                }, 100);
            } else {
                App.showFullMap(modules);
            }
        },
        'close-full-map': (el, modules) => {
            App.closeFullMap(modules);
        },
        'go-to-my-location': (el, modules) => {
            App.goToUserLocation(modules);
        },
        
        // Form actions
        'report-beer': (el, modules) => {
            const venueData = window.App.getState('currentVenue');
            
            // DON'T close overlays - we want venue details to stay open!
            // modules.modalManager?.closeAllOverlays(); // <-- Remove this line
            
            // Open report modal on top of venue details
            if (modules.modalManager) {
                modules.modalManager.open('reportModal', {
                    onOpen: () => {
                        if (modules.modal?.initializeReportModal) {
                            modules.modal.initializeReportModal(venueData);
                        } else if (window.initializeReportModal) {
                            window.initializeReportModal(venueData);
                        }
                    }
                });
            }
            
            modules.tracking?.trackEvent('report_beer_click', 'User Action', venueData?.name || 'unknown');
        },

        'submit-report': (el, modules) => {
            const form = document.getElementById('reportForm');
            if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
        },
        'clear-selected-venue': (el, modules) => {
            modules.form?.clearSelectedVenue?.();
        },

        
        
        // Status actions
        'change-gf-status': (el, modules) => {
            console.trace('🔍 DEBUG: Opening GF status modal from main.js action handler');
            modules.modalManager?.open('gfStatusModal');
        },
        'confirm-status': (el, modules) => {
            modules.form?.GFStatusFlow?.confirmStatusUpdate?.();
        },
        'cancel-status': (el, modules) => {
            modules.modalManager?.close('gfStatusConfirmModal');
        },
        'skip-details': (el, modules) => {
            modules.modalManager?.close('beerDetailsPromptModal');
            modules.helpers?.showSuccessToast?.('✅ Status updated successfully!');
        },
        'add-beer-details': (el, modules) => {
            modules.modalManager?.close('beerDetailsPromptModal');
            
            // Get the current venue from state
            const currentVenue = window.App.getState('currentVenue');
            
            // Open report modal with current venue data
            if (modules.modalManager) {
                modules.modalManager.open('reportModal', {
                    onOpen: () => {
                        // Initialize with current venue
                        if (modules.modal?.initializeReportModal) {
                            modules.modal.initializeReportModal(currentVenue);
                        } else if (window.initializeReportModal) {
                            window.initializeReportModal(currentVenue);
                        }
                    }
                });
            }
        },

        
        
        'add-new-venue-from-results': (el, modules) => {
            // Close results overlay
            modules.modalManager?.close('resultsOverlay');
            
            // Open the places search modal with Google Places
            const searchModule = modules.search || window.App?.getModule('search');
            if (searchModule?.PlacesSearchModule) {
                searchModule.PlacesSearchModule.openPlacesSearch();
            }
        },

        'add-new-brewery': (el, modules) => {
            const breweryInput = document.getElementById('reportBrewery');
            if (breweryInput) {
                // Hide dropdown through forms module or directly
                const dropdown = document.getElementById('breweryDropdown');
                if (dropdown) dropdown.style.display = 'none';
                
                breweryInput.focus();
                modules.helpers?.showToast('💡 Type the new brewery name and continue', 'info');
            }
        },
        
        'add-new-beer': (el, modules) => {
            const beerNameInput = document.getElementById('reportBeerName');
            if (beerNameInput) {
                // Hide dropdown directly since it's not exposed from forms module
                const dropdown = document.getElementById('beerNameDropdown');
                if (dropdown) dropdown.style.display = 'none';
                
                beerNameInput.focus();
                modules.helpers?.showToast('💡 Type the new beer name and continue', 'info');
            }
        },

        'use-beer-name': (el, modules) => {
            // This action is triggered when user clicks "Add [beer name] as new beer"
            // Just hide the dropdown and let them continue with the name they typed
            const dropdown = document.getElementById('beerNameDropdown');
            if (dropdown) dropdown.style.display = 'none';
            
            // Focus next field (beer style)
            const beerStyleInput = document.getElementById('reportBeerStyle');
            if (beerStyleInput) {
                beerStyleInput.focus();
            }
            
            modules.helpers?.showToast('✅ Beer name accepted - continue with details', 'success');
        },

        'update-area-placeholder': (el, modules) => {
            modules.modal?.updateAreaPlaceholder?.();
        },
        
        'search-google-places': (el, modules) => {
            // This should also use the new Google Places search
            const searchModule = modules.search || window.App?.getModule('search');
            if (searchModule?.PlacesSearchModule) {
                searchModule.PlacesSearchModule.openPlacesSearch();
            }
        },
        'use-selected-place': (el, modules) => {
            // Check for nickname first
            let nickname = window.App.getState('userNickname');
            if (!nickname) {
                nickname = localStorage.getItem('userNickname');
                if (nickname) {
                    window.App.setState('userNickname', nickname);
                } else {
                    // Store the pending action
                    window.App.setState('pendingActionAfterNickname', () => {
                        const searchModule = modules.search || window.App?.getModule('search');
                        searchModule?.PlacesSearchModule?.useSelectedPlace?.();
                    });
                    
                    // Open nickname modal
                    modules.modalManager?.open('nicknameModal');
                    return;
                }
            }
            
            const searchModule = modules.search || window.App?.getModule('search');
            if (searchModule?.PlacesSearchModule?.useSelectedPlace) {
                searchModule.PlacesSearchModule.useSelectedPlace();
            }
        },
        'select-place': (el, modules) => {
            const placeIndex = el.dataset.placeIndex;
            if (placeIndex) {
                modules.search?.PlacesSearchModule?.selectPlace?.(parseInt(placeIndex));
            }
        },
        
        // Location permission actions
        'allow-location': (el, modules) => {
            App.handleLocationPermission(true);
        },
        'deny-location': (el, modules) => {
            App.handleLocationPermission(false);
        },
        
        // Cookie actions
        // Update cookie consent:
        'accept-all-cookies': (el, modules) => {
            App.handleCookieConsent(true);
        },
        'accept-essential-cookies': (el, modules) => {
            App.handleCookieConsent(false);
        },
        'save-cookie-preferences': (el, modules) => {
            const analyticsConsent = document.getElementById('analyticsConsent')?.checked;
            App.handleCookieConsent(analyticsConsent);
            modules.modalManager?.close('cookieSettings'); // CHANGED
        },
        'show-cookie-settings': (el, modules) => {
            modules.modalManager?.open('cookieSettings'); // CHANGED
        },

        'switch-to-leaderboard': (el, modules) => {
            switchTab('leaderboard');
        },

        // Add to action handlers in main.js:
        'change-nickname': (el, modules) => {
            const newNickname = prompt('Enter your new nickname:', window.App.getState('userNickname'));
            if (newNickname && newNickname.trim()) {
                // Update everywhere
                window.App.setState('userNickname', newNickname.trim());
                localStorage.setItem('userNickname', newNickname.trim());
                
                // Reload community hub
                const communityHub = modules.communityHub || window.App?.getModule('communityHub');
                if (communityHub) {
                    // Force reload profile
                    communityHub.loadUserProfile();
                    communityHub.renderHub();
                }
                
                modules.helpers?.showSuccessToast(`Nickname changed to ${newNickname}!`);
            }
        },
        
        // Update location blocked:
        'close-location-blocked': (el, modules) => {
            modules.modalManager?.close('locationBlockedModal'); // CHANGED
            // Open area search as alternative
            modules.modalManager?.open('areaModal'); // CHANGED
        },
        
        'reload-page': () => {
            location.reload();
        },

        // Community actions
        'quick-nearby': (el, modules) => {
            const community = modules.community || window.App?.getModule('community');
            community?.handleQuickNearby();
        },
        
        'thanks': (el, modules) => {
            const findId = el.dataset.findId;
            if (findId) {
                const community = modules.community || window.App?.getModule('community');
                community?.handleThanks(parseInt(findId));
            }
        },
        
        'browse-breweries': (el, modules) => {
            const community = modules.community || window.App?.getModule('community');
            community?.handleQuickAction('browse-breweries');
        },
        
        'new-to-gf': (el, modules) => {
            const community = modules.community || window.App?.getModule('community');
            community?.handleQuickAction('new-to-gf');
        },
        
        'add-find': (el, modules) => {
            const community = modules.community || window.App?.getModule('community');
            community?.handleQuickAction('add-find');
        },
        
        'saved-venues': (el, modules) => {
            const community = modules.community || window.App?.getModule('community');
            community?.handleQuickAction('saved-venues');
        },
        
        'find-stockists': (el, modules) => {
            const community = modules.community || window.App?.getModule('community');
            community?.handleQuickAction('find-stockists');
        },

        'open-community-hub': (el, modules) => {
            const communityHub = window.App?.getModule('communityHub');
            if (communityHub) {
                communityHub.open();
            } else {
                console.error('Community Hub module not loaded');
            }
        },
        
        'close-community-hub': (el, modules) => {
            modules.modalManager?.close('communityHubOverlay');
        },

        'open-search': (el, modules) => {
            console.log('🔍 Opening search overlay');
            
            // Store where we came from
            const currentContext = modules.nav?.getCurrentContext();
            window.App.setState('searchReturnContext', currentContext);
            
            // Close any open overlays first
            if (currentContext === 'map') {
                modules.modalManager?.close('fullMapOverlay');
            } else if (currentContext === 'venue') {
                modules.modalManager?.close('venueDetailsOverlay');
            } else if (currentContext === 'results') {
                modules.modalManager?.close('resultsOverlay');
            }
            
            // Small delay then open search
            setTimeout(() => {
                modules.modalManager?.open('searchOverlay', {
                    onOpen: () => {
                        modules.nav?.setPageContext('search'); // Make sure we set to 'search', not 'search-modal'
                    }
                });
            }, 100);
            
            modules.tracking?.trackEvent('search_overlay_opened', 'Navigation', 'bottom_nav');
        },
        
        'close-search': (el, modules) => {
            console.log('🔍 Closing search overlay');
            
            // Check where we came from before opening search
            const searchReturnContext = window.App.getState('searchReturnContext') || 'home';
            
            // Remove search context
            document.body.classList.remove('page-search');
            
            // Use ModalManager to close
            if (modules.modalManager) {
                modules.modalManager.close('searchOverlay');
            }
            
            // Return to where we came from
            if (searchReturnContext === 'results') {
                // Go back to results
                setTimeout(() => {
                    modules.modalManager?.open('resultsOverlay');
                    modules.nav?.setPageContext('results');
                }, 100);
            } else {
                // Default: go home
                modules.nav?.goToHome();
            }
        },

        'buy-gf-beer': (el, modules) => {
            // Set the state BEFORE opening
            window.App.setState('showPurchasableOnly', true);
            
            const breweries = modules.breweries || window.App?.getModule('breweries');
            if (breweries) {
                breweries.openBreweries(true); // Pass true to show purchasable only
            }
        },
        
        'open-breweries': (el, modules) => {
            // First, close any open primary overlays
            modules.modalManager?.closeGroup('primary');
            
            // Small delay to ensure DOM updates
            setTimeout(() => {
                const breweries = modules.breweries || window.App?.getModule('breweries');
                breweries?.openBreweries(false); // Add false parameter for normal view
            }, 50);
        },
        'search-brewery': (el, modules) => {
            const brewery = el.dataset.brewery;
            if (brewery) {
                modules.breweries?.searchBreweryBeers(brewery);
            }
        },
        'select-brewery': (el, modules) => {
            const brewery = el.dataset.brewery;
            if (brewery && modules.form) {
                modules.form.selectBrewery(brewery);
            }
        },
        'select-beer': (el, modules) => {
            const beerData = el.dataset.beerData;
            if (beerData && modules.form) {
                modules.form.selectBeer(beerData);
            }
        },
        'retry-breweries': (el, modules) => {
            modules.breweries?.loadBreweries();
        },

        'toggle-more-menu': (el, modules) => {
            const menu = document.getElementById('moreMenu');
            if (menu) {
                menu.classList.toggle('active');
            }
        },
        'about-us': (el, modules) => {
            if (modules.modalManager) {
                modules.modalManager.open('aboutOverlay');
            }
        },
        'about-gf': (el, modules) => {
            if (modules.modalManager) {
                modules.modalManager.open('gfInfoOverlay');
            }
        },
        'close-about': (el, modules) => {
            if (modules.modalManager) {
                modules.modalManager.close('aboutOverlay');
            }
        },
        'close-gf-info': (el, modules) => {
            if (modules.modalManager) {
                modules.modalManager.close('gfInfoOverlay');
            }
        },
        // For privacy, terms etc that have separate pages:
        'privacy-policy': (el, modules) => {
            window.location.href = '/privacy';
        },
        'terms-of-service': (el, modules) => {
            window.location.href = '/terms';
        },
        'show-beer-list': (el, modules) => {
            console.log('🍺 Show beer list clicked');
            const currentVenue = window.App.getState('currentVenue');
            
            if (!currentVenue) {
                console.error('❌ No current venue data');
                return;
            }
            
            console.log('📊 Current venue:', currentVenue);
            
            // Open beer list modal
            modules.modalManager?.open('beerListModal');
            
            // Set venue name
            const venueNameEl = document.getElementById('beerListVenueName');
            if (venueNameEl) venueNameEl.textContent = currentVenue.name;
            
            // Load beer list - make sure we're calling the right module
            const searchModule = modules.search || window.App?.getModule('search');
            if (searchModule?.loadBeerList) {
                searchModule.loadBeerList(currentVenue);
            } else {
                console.error('❌ loadBeerList function not found');
            }
        },
        
        'delete-beer': (el, modules) => {
            const beerId = el.dataset.beerId;
            const beerName = el.dataset.beerName;
            
            if (confirm(`Remove "${beerName}" from this venue?`)) {
                modules.api?.deleteBeerFromVenue?.(beerId);
            }
        },

        'save-nickname': (el, modules) => {
            const nickname = document.getElementById('nicknameInput')?.value.trim();
            if (nickname) {
                window.App.setState('userNickname', nickname);
                localStorage.setItem('userNickname', nickname);
                modules.modalManager?.close('nicknameModal');
                modules.helpers?.showToast(`👋 Welcome, ${nickname}!`);
                
                // Continue with whatever triggered the nickname prompt
                const pendingAction = window.App.getState('pendingActionAfterNickname');
                if (pendingAction) {
                    window.App.setState('pendingActionAfterNickname', null);
                    pendingAction();
                }
            }
        },
        
        'skip-nickname': (el, modules) => {
            window.App.setState('userNickname', 'Anonymous');
            modules.modalManager?.close('nicknameModal');
            
            const pendingAction = window.App.getState('pendingActionAfterNickname');
            if (pendingAction) {
                window.App.setState('pendingActionAfterNickname', null);
                pendingAction();
            }
        },

        'prev-page': (el, modules) => {
            modules.search?.goToPreviousPage();
        },
        
        'next-page': (el, modules) => {
            modules.search?.goToNextPage();
        },
        
        'goto-page': (el, modules) => {
            const pageNum = parseInt(el.dataset.page);
            if (pageNum) {
                modules.search?.goToPage(pageNum);
            }
        },

        'manual-venue-entry': (el, modules) => {
            modules.modalManager?.close('placesSearchModal');
            modules.modalManager?.open('manualVenueEntryModal');
        },
        
        'submit-manual-venue': (el, modules) => {
            const name = document.getElementById('manualVenueName')?.value.trim();
            const address = document.getElementById('manualVenueAddress')?.value.trim();
            const city = document.getElementById('manualVenueCity')?.value.trim();
            const postcode = document.getElementById('manualVenuePostcode')?.value.trim().toUpperCase();
            
            if (!name || !address || !city || !postcode) {
                modules.helpers?.showToast('Please fill in all fields', 'error');
                return;
            }
            
            // Validate postcode
            if (!modules.helpers?.isValidPostcode(postcode)) {
                modules.helpers?.showToast('Please enter a valid UK postcode', 'error');
                return;
            }
            
            const venueData = {
                name: name,
                address: `${address}, ${city}`,
                postcode: postcode,
                latitude: null,  // We'll geocode later
                longitude: null,
                source: 'manual_entry'
            };
            
            modules.modalManager?.close('manualVenueEntryModal');
            modules.helpers?.showLoadingToast('Adding venue to database...');
            
            // Use the existing submitNewVenue function
            modules.search?.PlacesSearchModule?.submitNewVenue(venueData);
        },

    },
    
    // ================================
    // SPECIALIZED HANDLERS
    // ================================
    handleDistanceSelection: (distance) => {
        console.log(`📍 Distance selected: ${distance}km`);
        
        const modalManager = App.getModule('modalManager');
        const search = App.getModule('search');
        
        modalManager?.close('distanceModal');
        search?.searchNearbyWithDistance?.(distance);
    },
    
    handleLocationPermission: (granted) => {
        const modal = document.getElementById('locationPermissionModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
        
        const event = new CustomEvent(granted ? 'locationPermissionGranted' : 'locationPermissionDenied');
        document.dispatchEvent(event);
    },
    
    handleCookieConsent: (analyticsAllowed) => {
        const helpers = App.getModule('helpers');
        const tracking = App.getModule('tracking');
        
        if (!helpers || !tracking) return;
        
        helpers.Storage.set('cookieConsent', true);
        helpers.Storage.set('analyticsConsent', analyticsAllowed);
        
        tracking.updateConsent(analyticsAllowed);
        
        // Hide banner, show float button
        const banner = document.getElementById('cookieConsent');
        
        if (banner) banner.style.display = 'none';
        
        helpers.showSuccessToast('✅ Cookie preferences saved!');
    },
    
    checkCookieConsent: () => {
        const helpers = App.getModule('helpers');
        const hasConsent = helpers?.Storage.get('cookieConsent');
        
        const banner = document.getElementById('cookieConsent');
        
        if (!hasConsent) {
            // No consent yet - show banner, hide float button
            if (banner) {
                banner.style.display = 'block';
                console.log('🍪 Showing cookie banner - no consent found');
            }
        } else {
            // Has consent - hide banner, show float button
            if (banner) {
                banner.style.display = 'none';
                console.log('🍪 Hiding cookie banner - consent already given');
            }
        }
    },
    
    // ================================
    // MAP HANDLERS
    // ================================
    toggleVenueDetailMap: (modules) => {
        const currentVenue = App.getState(STATE_KEYS.CURRENT_VENUE);
        const mapContainer = document.getElementById('venueMapContainer');
        const mapBtnText = document.getElementById('venueMapBtnText');
        const venueContainer = document.getElementById('venueContainer');
        
        if (!mapContainer || !mapBtnText) return;
        
        const isHidden = mapContainer.style.display === 'none' || !mapContainer.style.display;
        
        if (isHidden) {
            // Show map
            mapContainer.style.display = 'block';
            mapBtnText.textContent = 'Hide Map';
            if (venueContainer) venueContainer.classList.add('split-view');
            
            if (currentVenue?.latitude && currentVenue?.longitude && modules.map) {
                modules.map.initVenueDetailMap?.(currentVenue);
            }
        } else {
            // Hide map
            mapContainer.style.display = 'none';
            mapBtnText.textContent = 'Show on Map';
            if (venueContainer) venueContainer.classList.remove('split-view');
        }
        
        modules.tracking?.trackEvent('venue_map_toggle', 'Map', isHidden ? 'show' : 'hide');
    },
    
    showFullMap: async (modules) => {
        console.log('🗺️ Showing full UK map...');
    
        // Store where we came from INCLUDING search
        const currentContext = modules.nav?.getCurrentContext();
        App.setState('mapReturnContext', currentContext);
        console.log('📍 Storing map return context:', currentContext);
        
        // Check for location if needed
        if (!App.getState(STATE_KEYS.USER_LOCATION)) {
            try {
                const location = await modules.search?.requestLocationWithUI?.();
                if (location) {
                    App.setState(STATE_KEYS.USER_LOCATION, location);
                    modules.map?.setUserLocation?.(location);
                }
            } catch (error) {
                console.log('📍 Location not available:', error);
            }
        }
        
        const mapOverlay = document.getElementById('fullMapOverlay');
        if (mapOverlay) {
            mapOverlay.classList.add('active');
            mapOverlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            setTimeout(() => modules.map?.initFullUKMap?.(), 100);
            
            modules.tracking?.trackEvent('full_map_view', 'Navigation', 'nav_bar');

            // ADD THIS: Update navigation context after overlay is shown
            const navModule = modules.nav;
            navModule?.showMapWithContext();
        }
    },
    
    closeFullMap: (modules) => {
        const mapOverlay = document.getElementById('fullMapOverlay');
        if (mapOverlay) {
            mapOverlay.classList.remove('active');
            mapOverlay.style.display = 'none';
            document.body.style.overflow = '';
            
            modules.map?.cleanupFullUKMap?.();
        }
    },
    
    goToUserLocation: (modules) => {
        const location = App.getState(STATE_KEYS.USER_LOCATION);
        const map = App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
        const marker = App.getState(STATE_KEYS.MAP_DATA.USER_MARKER);
        
        if (!location) {
            modules.helpers?.showSuccessToast?.('📍 Location not available. Please enable location services.');
            return;
        }
        
        if (map && window.L) {
            map.setView([location.lat, location.lng], 14);
            
            if (marker) {
                marker.openPopup();
            }
            
            modules.tracking?.trackEvent('go_to_location', 'Map', 'button_click');
        }
    },
    
    // ================================
    // VENUE ACTIONS
    // ================================
    handleReportBeer: (modules) => {
        const venueData = App.getState(STATE_KEYS.CURRENT_VENUE);
        
        // Close overlays using modalManager
        modules.modalManager?.closeAllOverlays();
        
        document.body.style.overflow = '';
        
        // Open report modal
        modules.modalManager?.open('reportModal', { data: venueData });
        
        modules.tracking?.trackEvent('report_beer_click', 'User Action', venueData?.name || 'unknown');
    },
    
    openVenueExternalSearch: (modules) => {
        const venue = App.getState(STATE_KEYS.CURRENT_VENUE);
        if (!venue) return;
        
        const searchQuery = encodeURIComponent(`${venue.venue_name} ${venue.postcode} venue`);
        window.open(Constants.EXTERNAL.GOOGLE_SEARCH + searchQuery, '_blank');
        
        modules.tracking?.trackExternalLink?.('google_search', venue.venue_name);
    },
    
    openVenueDirections: (modules) => {
        const venue = App.getState(STATE_KEYS.CURRENT_VENUE);
        if (!venue) return;
        
        const destination = encodeURIComponent(`${venue.venue_name}, ${venue.address}, ${venue.postcode}`);
        window.open(Constants.EXTERNAL.GOOGLE_MAPS_DIRECTIONS + destination, '_blank');
        
        modules.tracking?.trackExternalLink?.('google_maps_directions', venue.venue_name);
    },
    
    // ================================
    // GLOBAL FUNCTIONS
    // ================================
    setupGlobalFunctions: () => {
        // Legacy support - these should eventually be removed
        window.closeResults = () => App.getModule('helpers')?.closeResults?.();
        window.showVenueDetails = (venueId) => App.getModule('search')?.showVenueDetails?.(venueId);
        window.toggleSearchResultsFullMap = () => App.getModule('map')?.toggleSearchResultsFullMap?.();
        window.acceptAllCookies = () => App.handleCookieConsent(true);
        window.acceptEssentialOnly = () => App.handleCookieConsent(false);
    },
    
    // ================================
    // ERROR HANDLING
    // ================================
    showInitError: (error) => {
        console.error('❌ Initialization error:', error);
        
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'init-error';
        fallbackDiv.innerHTML = `
            <div class="error-content">
                <h2>⚠️ Loading Error</h2>
                <p>Something went wrong. Please refresh the page.</p>
                <button onclick="location.reload()" class="btn btn-primary">
                    Refresh Page
                </button>
                <details>
                    <summary>Error details</summary>
                    <pre>${error.stack || error.message}</pre>
                </details>
            </div>
        `;
        document.body.appendChild(fallbackDiv);
    }
};


const storedNickname = localStorage.getItem('userNickname');
if (storedNickname) {
    App.setState('userNickname', storedNickname);
    console.log('✅ Synced nickname to app state:', storedNickname);
}



// ================================
// INITIALIZATION
// ================================
const initializeApp = () => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => App.initialize());
    } else {
        App.initialize();
    }
};

// Start initialization
initializeApp();

// Export for global access
window.CoeliacsApp = App;
window.App = App;

console.log('🍺 App module loaded - initialization will begin when DOM is ready');
