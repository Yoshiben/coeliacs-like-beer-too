// ================================================================================
// MAIN.JS - Complete Refactor with STATE_KEYS and Modern Patterns
// Central app initialization and coordination
// ================================================================================

import { Constants } from './constants.js';
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
        currentPub: null,
        selectedPubForReport: null,
        mapData: {
            allPubs: [],
            fullUKMapInstance: null,
            resultsMapInstance: null,
            pubDetailMapInstance: null,
            userMarker: null,
            gfPubsLayer: null,
            clusteredPubsLayer: null
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
        
        // Set up event delegation
        App.setupEventDelegation();
        
        // Set up global functions
        App.setupGlobalFunctions();
        
        // Check cookie consent
        App.checkCookieConsent();
        
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
                if (stats.total_pubs) {
                    helpers.animateNumber('totalPubs', stats.total_pubs);
                }
                if (stats.gf_pubs) {
                    helpers.animateNumber('gfPubs', stats.gf_pubs);
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
            modules.modalManager?.open('distanceModal');
        },
        'search-name': (el, modules) => {
            modules.modalManager?.open('nameModal');
        },
        'perform-name-search': (el, modules) => {
            modules.search?.searchByName();
        },
        'search-area': (el, modules) => {
            modules.modalManager?.open('areaModal')
        },
        'perform-area-search': (el, modules) => {
            modules.search?.searchByArea();
        },
        'search-beer': (el, modules) => {
            modules.modalManager?.open('beerModal');
        },
        'perform-beer-search': (el, modules) => {
            modules.search?.searchByBeer();
        },
        
        // Navigation actions
        'close-results': (el, modules) => {
            modules.nav?.goToHome();
            modules.tracking?.trackEvent('close_results', 'Navigation', 'button');
        },
        'close-pub-details': (el, modules) => {
            modules.nav?.goToHome();
        },
        'back-to-results': (el, modules) => {
            modules.nav?.goBackFromPub();
        },
        
        // Replace with:
        'nav-back': (el, modules) => {
            const currentContext = modules.nav?.getCurrentContext();
            
            if (currentContext === 'pub') {
                modules.nav?.goBackFromPub();
            } else if (currentContext === 'map') {
                // Check if we came from pub details
                const mapReturnContext = App.getState('mapReturnContext');
                if (mapReturnContext === 'pub') {
                    // Close map and return to pub details
                    modules.modalManager?.close('fullMapOverlay');
                    const currentPub = App.getState(STATE_KEYS.CURRENT_PUB);
                    if (currentPub) {
                        modules.search?.showPubDetails(currentPub.pub_id);
                    } else {
                        modules.nav?.goToHome();
                    }
                } else {
                    modules.nav?.goToHome();
                }
            } else {
                modules.nav?.goToHome();
            }
        },
        'close-modal': (el, modules) => {
            const modal = el.closest('.modal, .search-modal, .report-modal');
            if (modal?.id) {
                modules.modalManager?.close(modal.id) || modules.modal?.close(modal.id);
            }
        },

        
        // Pub actions
        'view-pub': (el, modules) => {
            const pubId = el.dataset.pubId || el.closest('[data-pub-id]')?.dataset.pubId;
            if (pubId) modules.search?.showPubDetails?.(pubId);
        },
        'view-pub-from-map': (el, modules) => {
            const pubId = el.dataset.pubId;
            if (pubId) {
                // First close the map overlay
                const mapOverlay = document.getElementById('fullMapOverlay');
                if (mapOverlay) {
                    mapOverlay.style.display = 'none';
                    mapOverlay.classList.remove('active');
                }
                
                // Then show pub details
                modules.search?.showPubDetails?.(pubId);
            }
        },
        'find-pub-online': (el, modules) => {
            App.openPubExternalSearch(modules);
        },
        'get-pub-directions': (el, modules) => {
            App.openPubDirections(modules);
        },
        
        // Map actions
        'toggle-results-map': (el, modules) => {
            modules.map?.toggleSearchResultsFullMap?.();
        },
        'toggle-pub-map': (el, modules) => {
            App.togglePubDetailMap(modules);
        },
        'show-pub-on-map': (el, modules) => {
            const currentPub = App.getState(STATE_KEYS.CURRENT_PUB);
            if (!currentPub || !currentPub.latitude || !currentPub.longitude) {
                modules.helpers?.showToast('📍 Location not available for this pub', 'error');
                return;
            }
            
            // Show full map
            App.showFullMap(modules);
            
            // After map loads, center on this pub
            setTimeout(() => {
                const map = App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
                if (map) {
                    map.setView([parseFloat(currentPub.latitude), parseFloat(currentPub.longitude)], 16);
                    
                    // Find and open the pub's popup
                    map.eachLayer(layer => {
                        if (layer.options && layer.options.pubId === currentPub.pub_id) {
                            layer.openPopup();
                        }
                    });
                }
            }, 500);
        },
        
        'show-full-map': (el, modules) => {
            // Check if we're on pub details
            const currentContext = modules.nav?.getCurrentContext();
            if (currentContext === 'pub') {
                // IMPORTANT: Close pub details overlay first
                modules.modalManager?.close('pubDetailsOverlay');
                
                // Show full map with this pub centered
                setTimeout(() => {
                    App.showFullMap(modules);
                    
                    // After map loads, center on the current pub
                    const currentPub = App.getState(STATE_KEYS.CURRENT_PUB);
                    if (currentPub && currentPub.latitude && currentPub.longitude) {
                        setTimeout(() => {
                            const map = App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
                            if (map) {
                                map.setView([parseFloat(currentPub.latitude), parseFloat(currentPub.longitude)], 16);
                                
                                // Find and open the pub's popup
                                map.eachLayer(layer => {
                                    if (layer.options && layer.options.pubId === currentPub.pub_id) {
                                        layer.openPopup();
                                    }
                                });
                            }
                        }, 500);
                    }
                }, 100);
            } else {
                // Normal map view
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
            const pubData = window.App.getState('currentPub');
            
            // Close overlays if needed
            modules.modalManager?.closeAllOverlays();
            document.body.style.overflow = '';
            
            // Open report modal with pub data
            if (modules.modalManager) {
                modules.modalManager.open('reportModal', {
                    onOpen: () => {
                        if (modules.modal?.initializeReportModal) {
                            modules.modal.initializeReportModal(pubData);
                        } else if (window.initializeReportModal) {
                            window.initializeReportModal(pubData);
                        }
                    }
                });
            }
            
            modules.tracking?.trackEvent('report_beer_click', 'User Action', pubData?.name || 'unknown');
        },

        'submit-report': (el, modules) => {
            const form = document.getElementById('reportForm');
            if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
        },
        'clear-selected-pub': (el, modules) => {
            modules.form?.clearSelectedPub?.();
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
            
            // Get the current pub from state
            const currentPub = window.App.getState('currentPub');
            
            // Open report modal with current pub data
            if (modules.modalManager) {
                modules.modalManager.open('reportModal', {
                    onOpen: () => {
                        // Initialize with current pub
                        if (modules.modal?.initializeReportModal) {
                            modules.modal.initializeReportModal(currentPub);
                        } else if (window.initializeReportModal) {
                            window.initializeReportModal(currentPub);
                        }
                    }
                });
            }
        },

        
        
        // Places search actions
        'add-new-pub-from-results': (el, modules) => {
            // Use modalManager to open the modal properly
            if (modules.modalManager) {
                modules.modalManager.open('placesSearchModal');
            } else {
                // Fallback to the search module
                const searchModule = modules.search || window.App?.getModule('search');
                if (searchModule?.PlacesSearchModule) {
                    searchModule.PlacesSearchModule.openPlacesSearch();
                }
            }
        },
        'search-google-places': (el, modules) => {
            modules.search?.PlacesSearchModule?.openPlacesSearch?.();
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
        
        'saved-pubs': (el, modules) => {
            const community = modules.community || window.App?.getModule('community');
            community?.handleQuickAction('saved-pubs');
        },
        
        'find-stockists': (el, modules) => {
            const community = modules.community || window.App?.getModule('community');
            community?.handleQuickAction('find-stockists');
        },

        'open-search': (el, modules) => {
            console.log('🔍 Opening search overlay');
            
            // Use ModalManager to open search overlay
            if (modules.modalManager) {
                modules.modalManager.open('searchOverlay', {
                    onOpen: () => {
                        // Update nav context
                        modules.nav?.showSearchWithContext();
                    }
                });
            } else {
                // Fallback if ModalManager not available
                const searchOverlay = document.getElementById('searchOverlay');
                if (searchOverlay) {
                    searchOverlay.style.display = 'flex';
                    searchOverlay.classList.add('active');
                    document.body.style.overflow = 'hidden';
                    modules.nav?.showSearchWithContext();
                }
            }
            
            modules.tracking?.trackEvent('search_overlay_opened', 'Navigation', 'bottom_nav');
        },
        
        'close-search': (el, modules) => {
            console.log('🔍 Closing search overlay');
            
            // Remove search context
            document.body.classList.remove('page-search');
            
            // Use ModalManager to close
            if (modules.modalManager) {
                modules.modalManager.close('searchOverlay');
            }
            
            // Return to home context
            modules.nav?.goToHome();
        },

        'open-breweries': (el, modules) => {
            const breweries = modules.breweries || window.App?.getModule('breweries');
            breweries?.openBreweries();
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
            const currentPub = window.App.getState('currentPub');
            
            if (!currentPub) {
                console.error('❌ No current pub data');
                return;
            }
            
            console.log('📊 Current pub:', currentPub);
            
            // Open beer list modal
            modules.modalManager?.open('beerListModal');
            
            // Set pub name
            const pubNameEl = document.getElementById('beerListPubName');
            if (pubNameEl) pubNameEl.textContent = currentPub.name;
            
            // Load beer list - make sure we're calling the right module
            const searchModule = modules.search || window.App?.getModule('search');
            if (searchModule?.loadBeerList) {
                searchModule.loadBeerList(currentPub);
            } else {
                console.error('❌ loadBeerList function not found');
            }
        },
        
        'delete-beer': (el, modules) => {
            const beerId = el.dataset.beerId;
            const beerName = el.dataset.beerName;
            
            if (confirm(`Remove "${beerName}" from this pub?`)) {
                modules.api?.deleteBeerFromPub?.(beerId);
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

        'manual-pub-entry': (el, modules) => {
            modules.modalManager?.close('placesSearchModal');
            modules.modalManager?.open('manualPubEntryModal');
        },
        
        'submit-manual-pub': (el, modules) => {
            const name = document.getElementById('manualPubName')?.value.trim();
            const address = document.getElementById('manualPubAddress')?.value.trim();
            const city = document.getElementById('manualPubCity')?.value.trim();
            const postcode = document.getElementById('manualPubPostcode')?.value.trim().toUpperCase();
            
            if (!name || !address || !city || !postcode) {
                modules.helpers?.showToast('Please fill in all fields', 'error');
                return;
            }
            
            // Validate postcode
            if (!modules.helpers?.isValidPostcode(postcode)) {
                modules.helpers?.showToast('Please enter a valid UK postcode', 'error');
                return;
            }
            
            const pubData = {
                name: name,
                address: `${address}, ${city}`,
                postcode: postcode,
                latitude: null,  // We'll geocode later
                longitude: null,
                source: 'manual_entry'
            };
            
            modules.modalManager?.close('manualPubEntryModal');
            modules.helpers?.showLoadingToast('Adding pub to database...');
            
            // Use the existing submitNewPub function
            modules.search?.PlacesSearchModule?.submitNewPub(pubData);
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
        const floatBtn = document.getElementById('cookieSettingsFloat');
        
        if (banner) banner.style.display = 'none';
        if (floatBtn) floatBtn.style.display = 'block';
        
        helpers.showSuccessToast('✅ Cookie preferences saved!');
    },
    
    checkCookieConsent: () => {
        const helpers = App.getModule('helpers');
        const hasConsent = helpers?.Storage.get('cookieConsent');
        
        if (!hasConsent) {
            const banner = document.getElementById('cookieConsent');
            if (banner) banner.style.display = 'block';
        } else {
            const floatBtn = document.getElementById('cookieSettingsFloat');
            if (floatBtn) floatBtn.style.display = 'block';
        }
    },
    
    // ================================
    // MAP HANDLERS
    // ================================
    togglePubDetailMap: (modules) => {
        const currentPub = App.getState(STATE_KEYS.CURRENT_PUB);
        const mapContainer = document.getElementById('pubMapContainer');
        const mapBtnText = document.getElementById('pubMapBtnText');
        const pubContainer = document.getElementById('pubContainer');
        
        if (!mapContainer || !mapBtnText) return;
        
        const isHidden = mapContainer.style.display === 'none' || !mapContainer.style.display;
        
        if (isHidden) {
            // Show map
            mapContainer.style.display = 'block';
            mapBtnText.textContent = 'Hide Map';
            if (pubContainer) pubContainer.classList.add('split-view');
            
            if (currentPub?.latitude && currentPub?.longitude && modules.map) {
                modules.map.initPubDetailMap?.(currentPub);
            }
        } else {
            // Hide map
            mapContainer.style.display = 'none';
            mapBtnText.textContent = 'Show on Map';
            if (pubContainer) pubContainer.classList.remove('split-view');
        }
        
        modules.tracking?.trackEvent('pub_map_toggle', 'Map', isHidden ? 'show' : 'hide');
    },
    
    showFullMap: async (modules) => {
        console.log('🗺️ Showing full UK map...');

        // Store where we came from
        const currentContext = modules.nav?.getCurrentContext();
        App.setState('mapReturnContext', currentContext);
        
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
    // PUB ACTIONS
    // ================================
    handleReportBeer: (modules) => {
        const pubData = App.getState(STATE_KEYS.CURRENT_PUB);
        
        // Close overlays using modalManager
        modules.modalManager?.closeAllOverlays();
        
        document.body.style.overflow = '';
        
        // Open report modal
        modules.modalManager?.open('reportModal', { data: pubData });
        
        modules.tracking?.trackEvent('report_beer_click', 'User Action', pubData?.name || 'unknown');
    },
    
    openPubExternalSearch: (modules) => {
        const pub = App.getState(STATE_KEYS.CURRENT_PUB);
        if (!pub) return;
        
        const searchQuery = encodeURIComponent(`${pub.name} ${pub.postcode} pub`);
        window.open(Constants.EXTERNAL.GOOGLE_SEARCH + searchQuery, '_blank');
        
        modules.tracking?.trackExternalLink?.('google_search', pub.name);
    },
    
    openPubDirections: (modules) => {
        const pub = App.getState(STATE_KEYS.CURRENT_PUB);
        if (!pub) return;
        
        const destination = encodeURIComponent(`${pub.name}, ${pub.address}, ${pub.postcode}`);
        window.open(Constants.EXTERNAL.GOOGLE_MAPS_DIRECTIONS + destination, '_blank');
        
        modules.tracking?.trackExternalLink?.('google_maps_directions', pub.name);
    },
    
    // ================================
    // GLOBAL FUNCTIONS
    // ================================
    setupGlobalFunctions: () => {
        // Legacy support - these should eventually be removed
        window.closeResults = () => App.getModule('helpers')?.closeResults?.();
        window.showPubDetails = (pubId) => App.getModule('search')?.showPubDetails?.(pubId);
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
