// ================================================================================
// MAIN.JS - Complete Refactor with STATE_KEYS and Modern Patterns (FIXED)
// Central app initialization and coordination
// ================================================================================

import { Constants } from './constants.js';
import { OnboardingFlow } from './onboarding.js';
import { UserSession } from './user-session.js';
import { ToastModule } from './toast.js';  // ADD THIS IMPORT
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
            
            // Initialize toast module first
            ToastModule.init();
            App.registerModule('toast', ToastModule);
            
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
        
        // Make critical functions globally available (redirecting to toast module)
        window.showLoadingToast = () => ToastModule.showLoadingToast();
        window.hideLoadingToast = () => ToastModule.hideLoadingToast();
        window.showSuccessToast = (msg) => ToastModule.success(msg);
        window.showErrorToast = (msg) => ToastModule.error(msg);
        window.showToast = (msg, type) => ToastModule.show(msg, type);
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
            import('./modal-manager.js')
        ]);
        
        App.registerModule('modal', ModalModule);
        App.registerModule('modalManager', ModalManager);
        
        // Initialize both
        ModalModule.init();
        ModalManager.init();
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
            e.stopPropagation();
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
            modalManager: App.getModule('modalManager'),
            helpers: App.getModule('helpers'),
            map: App.getModule('map'),
            form: App.getModule('form'),
            tracking: App.getModule('tracking'),
            nav: App.getModule('nav'),
            breweries: App.getModule('breweries'),
            community: App.getModule('community'),
            toast: App.getModule('toast')  // ADD THIS
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
    
    // Action handler map - I'll continue with just the key changes to save space
    actionHandlers: {
        // ... (keeping all existing handlers but updating toast calls)
        
        'quick-update-status': async (el, modules) => {
            const status = el.dataset.status;
            const venueId = el.dataset.venueId;
            
            console.log('🎯 Updating status:', status, 'for venue:', venueId);
            
            modules.modalManager?.close('beerDetailsPromptModal');
            
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
                    modules.toast?.success('✅ Perfect! Status updated. Thanks!');
                    
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
                modules.toast?.error('Failed to update status');
            }
        },

        // Add this to your actionHandlers in main.js:
        'skip-status-prompt': (el, modules) => {
            console.log('⏭️ Skipping status prompt after beer report');
            modules.modalManager?.close('statusPromptAfterBeerModal');
            modules.toast?.info('No problem! Thanks for the beer report! 🍺');
        },
        
        'skip-details': (el, modules) => {
            modules.modalManager?.close('beerDetailsPromptModal');
            modules.toast?.success('✅ Status updated successfully!');
        },
        
        'close-venue-added-modal': (el, modules) => {
            modules.modalManager?.close('venueAddedPromptModal');
            modules.toast?.success('Venue added successfully!');
        },
        
        'add-new-brewery': (el, modules) => {
            const breweryInput = document.getElementById('reportBrewery');
            if (breweryInput) {
                const dropdown = document.getElementById('breweryDropdown');
                if (dropdown) dropdown.style.display = 'none';
                
                breweryInput.focus();
                modules.toast?.info('💡 Type the new brewery name and continue');
            }
        },
        
        'add-new-beer': (el, modules) => {
            const beerNameInput = document.getElementById('reportBeerName');
            if (beerNameInput) {
                const dropdown = document.getElementById('beerNameDropdown');
                if (dropdown) dropdown.style.display = 'none';
                
                beerNameInput.focus();
                modules.toast?.info('💡 Type the new beer name and continue');
            }
        },
        
        'use-beer-name': (el, modules) => {
            const dropdown = document.getElementById('beerNameDropdown');
            if (dropdown) dropdown.style.display = 'none';
            
            const beerStyleInput = document.getElementById('reportBeerStyle');
            if (beerStyleInput) {
                beerStyleInput.focus();
            }
            
            modules.toast?.success('✅ Beer name accepted - continue with details');
        },
        
        'save-nickname': (el, modules) => {
            const nickname = document.getElementById('nicknameInput')?.value.trim();
            if (nickname) {
                window.App.setState('userNickname', nickname);
                localStorage.setItem('userNickname', nickname);
                modules.modalManager?.close('nicknameModal');
                modules.toast?.success(`👋 Welcome, ${nickname}!`);
                
                const pendingAction = window.App.getState('pendingActionAfterNickname');
                if (pendingAction) {
                    window.App.setState('pendingActionAfterNickname', null);
                    pendingAction();
                }
            }
        },
        
        'change-nickname': (el, modules) => {
            const newNickname = prompt('Enter your new nickname:', window.App.getState('userNickname'));
            if (newNickname && newNickname.trim()) {
                window.App.setState('userNickname', newNickname.trim());
                localStorage.setItem('userNickname', newNickname.trim());
                
                const communityHub = modules.communityHub || window.App?.getModule('communityHub');
                if (communityHub) {
                    communityHub.loadUserProfile();
                    communityHub.renderHub();
                }
                
                modules.toast?.success(`Nickname changed to ${newNickname}!`);
            }
        },
        
        'submit-manual-venue': (el, modules) => {
            const name = document.getElementById('manualVenueName')?.value.trim();
            const address = document.getElementById('manualVenueAddress')?.value.trim();
            const city = document.getElementById('manualVenueCity')?.value.trim();
            const postcode = document.getElementById('manualVenuePostcode')?.value.trim().toUpperCase();
            
            if (!name || !address || !city || !postcode) {
                modules.toast?.error('Please fill in all fields');
                return;
            }
            
            if (!modules.helpers?.isValidPostcode(postcode)) {
                modules.toast?.error('Please enter a valid UK postcode');
                return;
            }
            
            const venueData = {
                name: name,
                address: `${address}, ${city}`,
                postcode: postcode,
                latitude: null,
                longitude: null,
                source: 'manual_entry'
            };
            
            modules.modalManager?.close('manualVenueEntryModal');
            
            modules.search?.PlacesSearchModule?.submitNewVenue(venueData);
        },
        
        'go-to-my-location': (el, modules) => {
            const location = App.getState(STATE_KEYS.USER_LOCATION);
            const map = App.getState(STATE_KEYS.MAP_DATA.FULL_UK_MAP);
            const marker = App.getState(STATE_KEYS.MAP_DATA.USER_MARKER);
            
            if (!location) {
                modules.toast?.info('📍 Location not available. Please enable location services.');
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

        // ... (rest of the action handlers remain the same but with toast module calls)
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
        const toast = App.getModule('toast');
        
        if (!helpers || !tracking) return;
        
        helpers.Storage.set('cookieConsent', true);
        helpers.Storage.set('analyticsConsent', analyticsAllowed);
        
        tracking.updateConsent(analyticsAllowed);
        
        const banner = document.getElementById('cookieConsent');
        if (banner) banner.style.display = 'none';
        
        toast?.success('✅ Cookie preferences saved!');
    },
    
    checkCookieConsent: () => {
        const helpers = App.getModule('helpers');
        const hasConsent = helpers?.Storage.get('cookieConsent');
        
        const banner = document.getElementById('cookieConsent');
        
        if (!hasConsent) {
            if (banner) {
                banner.style.display = 'block';
                console.log('🍪 Showing cookie banner - no consent found');
            }
        } else {
            if (banner) {
                banner.style.display = 'none';
                console.log('🍪 Hiding cookie banner - consent already given');
            }
        }
    },
    
    // ... (rest of the methods remain the same)
    
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
