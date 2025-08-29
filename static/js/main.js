// ================================================================================
// MAIN.JS - Complete Refactor with STATE_KEYS and Modern Patterns
// Central app initialization and coordination
// ================================================================================

import { Constants } from './constants.js';
import { OnboardingFlow } from './onboarding.js';
import { ToastModule } from './toast.js'; 
import { UserSession } from './user-session.js';
import { VenueModule } from './venue.js'; 
const STATE_KEYS = Constants.STATE_KEYS;

console.log('OnboardingFlow loaded:', typeof OnboardingFlow);
console.log('UserSession loaded:', typeof UserSession);

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
            import('./community.js'),
            import('./nav.js'),
            import('./breweries.js'),
            import('./venue.js')
        ]);
        
        const [
            { MapModule },
            { SearchModule },
            { CommunityModule },
            { NavStateManager },
            breweriesImport,
            { VenueModule }
            
        ] = modules;
        
        App.registerModule('map', MapModule);
        App.registerModule('search', SearchModule);
        App.registerModule('community', CommunityModule);
        App.registerModule('venue', VenueModule);

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
    
        // Load user_id for existing nickname
        async function loadUserId() {
            const nickname = localStorage.getItem('userNickname');
            if (nickname && !localStorage.getItem('user_id')) {
                try {
                    const response = await fetch(`/api/get-user-id/${nickname}`);
                    if (response.ok) {
                        const data = await response.json();
                        localStorage.setItem('user_id', data.user_id);
                        window.App.setState('userId', data.user_id);
                        console.log(`✅ Found user_id ${data.user_id} for ${nickname}`);
                    }
                } catch (error) {
                    console.error('Failed to get user_id:', error);
                }
            }
        }
        
        await loadUserId();
    
        // ENHANCED LOCATION PERSISTENCE
        const LocationPersistence = {
            isIOS() {
                return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            },
    
            isPWA() {
                return window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone ||
                       document.referrer.includes('android-app://');
            },
    
            getCachedLocation() {
                try {
                    const cached = localStorage.getItem('lastKnownLocation');
                    if (cached) {
                        const data = JSON.parse(cached);
                        // 24-hour expiry
                        if (data.timestamp && (Date.now() - data.timestamp < 86400000)) {
                            return { 
                                lat: data.lat, 
                                lng: data.lng,
                                accuracy: data.accuracy || 100
                            };
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse cached location:', e);
                }
                return null;
            },
    
            saveLocation(lat, lng, accuracy = 100) {
                try {
                    localStorage.setItem('lastKnownLocation', JSON.stringify({
                        lat: lat,
                        lng: lng,
                        accuracy: accuracy,
                        timestamp: Date.now()
                    }));
                    
                    // Also save to session storage for quick access
                    sessionStorage.setItem('lastLat', lat);
                    sessionStorage.setItem('lastLng', lng);
                    sessionStorage.setItem('locationRequested', 'true');
                    
                    console.log('💾 Location persisted to storage');
                } catch (e) {
                    console.error('Failed to save location:', e);
                }
            },
    
            async initializeLocation() {
                // Check if we already have location in app state
                let currentLocation = window.App.getState('userLocation');
                if (currentLocation) {
                    console.log('📍 Location already in app state');
                    return currentLocation;
                }
    
                // For iOS Safari (not PWA), prefer cached location
                if (this.isIOS() && !this.isPWA()) {
                    const cached = this.getCachedLocation();
                    if (cached) {
                        window.App.setState('userLocation', cached);
                        window.App.setState('locationTimestamp', Date.now());
                        window.App.setState('locationAccuracy', cached.accuracy);
                        
                        console.log('📍 iOS Web: Using cached location to avoid permission prompt');
                        
                        // Try silent update in background
                        this.attemptSilentLocationUpdate();
                        
                        return cached;
                    }
                }
    
                // Check session storage (current session)
                const sessionLat = sessionStorage.getItem('lastLat');
                const sessionLng = sessionStorage.getItem('lastLng');
                if (sessionLat && sessionLng) {
                    const location = {
                        lat: parseFloat(sessionLat),
                        lng: parseFloat(sessionLng),
                        accuracy: 100
                    };
                    window.App.setState('userLocation', location);
                    console.log('📍 Using session storage location');
                    return location;
                }
    
                // Check localStorage (persistent)
                const cached = this.getCachedLocation();
                if (cached) {
                    window.App.setState('userLocation', cached);
                    console.log('📍 Using cached location from localStorage');
                    
                    // Attempt background update
                    this.attemptSilentLocationUpdate();
                    
                    return cached;
                }
    
                // Only request if we don't have any cached location
                if (!sessionStorage.getItem('locationRequested')) {
                    console.log('📍 No cached location, attempting one-time request');
                    return await this.requestFreshLocation();
                }
    
                return null;
            },
    
            async requestFreshLocation() {
                if (!navigator.geolocation) return null;
    
                return new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const location = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                                accuracy: position.coords.accuracy
                            };
                            
                            // Save everywhere
                            this.saveLocation(location.lat, location.lng, location.accuracy);
                            window.App.setState('userLocation', location);
                            window.App.setState('locationTimestamp', Date.now());
                            window.App.setState('locationAccuracy', location.accuracy);
                            
                            console.log('✅ Fresh location obtained and cached');
                            resolve(location);
                        },
                        (error) => {
                            console.log('📍 Location request failed:', error.message);
                            sessionStorage.setItem('locationRequested', 'true');
                            
                            // Still check for cached location as fallback
                            const cached = this.getCachedLocation();
                            if (cached) {
                                window.App.setState('userLocation', cached);
                                console.log('📍 Using cached location as fallback');
                            }
                            
                            resolve(null);
                        },
                        { 
                            enableHighAccuracy: false, 
                            timeout: 5000,
                            maximumAge: 300000 // 5 minutes
                        }
                    );
                });
            },
    
            attemptSilentLocationUpdate() {
                // Non-blocking background update
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            this.saveLocation(
                                position.coords.latitude,
                                position.coords.longitude,
                                position.coords.accuracy
                            );
                            console.log('📍 Background location update successful');
                        },
                        () => {
                            console.log('📍 Background update failed (expected on iOS)');
                        },
                        { 
                            enableHighAccuracy: false, 
                            timeout: 3000,
                            maximumAge: 0
                        }
                    );
                }
            }
        };
    
        // Initialize location
        await LocationPersistence.initializeLocation();
    
        // Show iOS PWA hint if appropriate
        if (LocationPersistence.isIOS() && !LocationPersistence.isPWA()) {
            const lastPromptTime = localStorage.getItem('lastIOSPWAPrompt');
            const daysSincePrompt = lastPromptTime ? 
                (Date.now() - parseInt(lastPromptTime)) / 86400000 : Infinity;
            
            if (daysSincePrompt > 7 && !sessionStorage.getItem('ios-guide-dismissed')) {
                setTimeout(() => {
                    if (window.pwaHandler) {
                        console.log('📱 iOS user might benefit from PWA installation');
                    }
                }, 10000); // Show after 10 seconds if needed
            }
        }
    
        // Continue with existing onboarding code...
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
        // Handle input events for various inputs
        const inputHandlers = {
            'placesSearchInput': () => {
                const search = App.getModule('search');
                search?.PlacesSearchModule?.handleSearch(e.target.value);
            },
            'nicknameInput': () => {
                // Handle nickname input changes
                if (window.OnboardingFlow) {
                    OnboardingFlow.checkNickname(e.target.value);
                }
            }
        };
        
        const handler = inputHandlers[e.target.id];
        if (handler) handler();
        
        // Also check for data-action on input elements
        if (e.target.dataset.action === 'check-nickname-input' && window.OnboardingFlow) {
            OnboardingFlow.checkNickname(e.target.value);
        }
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
            toast: App.getModule('toast'),
            venue: App.getModule('venue')
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
    
    actionHandlers: {
        
        // ================================
        // ONBOARDING ACTION HANDLERS
        // ================================
        
        // Age Gate actions
        'confirm-age': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.confirmAge();
            }
        },        
        'under-age': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.underAge();
            }
        },
        // PWA actions
        'show-install-guide': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.showInstallGuide();
            }
        },
        'skip-pwa-benefits': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.skipPWABenefits();
            }
        },
        'close-ios-guide': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.closeIOSGuide();
            }
        },
        'close-android-guide': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.closeAndroidGuide();
            }
        },
        'android-install-now': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.installAndroid();
            }
        },
        'post-install-go-to-app': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.postInstallGoToApp();
            }
        },
        
        'post-install-continue-browser': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.postInstallContinueBrowser();
            }
        },
        'accept-all-cookies': (el, modules) => {
            console.log('🔥 ACTION HANDLER CALLED');
            console.log('OnboardingFlow exists?', !!window.OnboardingFlow);
            console.log('acceptAllCookies exists?', typeof window.OnboardingFlow?.acceptAllCookies);
            
            if (window.OnboardingFlow) {
                window.OnboardingFlow.acceptAllCookies();
            }
        },
        
        'accept-selected-cookies': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.acceptSelectedCookies();
            }
        },
        
        'essential-only-cookies': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.essentialOnlyCookies();
            }
        },








        
        
        // Welcome actions
        'skip-welcome': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.skipWelcome();
            }
        },
        
        'show-nickname-selection': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.showNicknameSelection();
            }
        },
        
        // Nickname actions
        'skip-nickname': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.skipNickname();
            }
        },
        
        'generate-random-nickname': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.generateRandom();
            }
        },
        
        'check-nickname-input': (el, modules) => {
            // Note: This needs special handling for input events
            // We'll handle this in the global input handler instead
            const value = el.value;
            if (window.OnboardingFlow && value !== undefined) {
                OnboardingFlow.checkNickname(value);
            }
        },
        
        'select-avatar': (el, modules) => {
            const emoji = el.dataset.emoji;
            if (emoji && window.OnboardingFlow) {
                OnboardingFlow.selectAvatar(emoji);
            }
        },
        
        'use-nickname': (el, modules) => {
            const nickname = el.dataset.nickname;
            if (nickname && window.OnboardingFlow) {
                OnboardingFlow.useNickname(nickname);
            }
        },
        
        'save-nickname': (el, modules) => {
            console.log('🔍 OnboardingFlow exists?', !!window.OnboardingFlow);
            console.log('🔍 saveNickname exists?', !!window.OnboardingFlow?.saveNickname);
            if (window.OnboardingFlow) {
                OnboardingFlow.saveNickname();
            }
        },
        
        // Sign In actions
        'close-signin': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.closeModal('signIn');
            }
        },
        
        'back-to-nickname': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.backToNickname();
            }
        },
        
        'perform-signin': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.performSignIn();
            }
        },
        
        // Passcode actions
        'copy-passcode': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.copyPasscode();
            }
        },
        
        'download-passcode': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.downloadPasscode();
            }
        },
        
        'email-passcode': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.emailPasscode();
            }
        },
        
        'toggle-passcode-confirm': (el, modules) => {
            // Handle the checkbox toggle for passcode confirmation
            const continueBtn = document.getElementById('continueFromPasscode');
            if (continueBtn) {
                continueBtn.disabled = !el.checked;
            }
        },
        
        'continue-from-passcode': (el, modules) => {
            if (window.OnboardingFlow) {
                // Check if we're returning to community hub or just finishing
                const returnToCommunity = window.App?.getState('returnToCommunityAfterNickname');
                if (returnToCommunity) {
                    OnboardingFlow.confirmPasscodeSavedAndReturnToCommunity();
                } else {
                    OnboardingFlow.confirmPasscodeSaved();
                }
            }
        },
        
        'start-exploring': (el, modules) => {
            if (window.OnboardingFlow) {
                OnboardingFlow.finishOnboarding();  // This will now check for cookies
            }
        },


















        


        
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
                modules.toast?.error('📍 Location not available for this venue');
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
                
            } else if (currentContext === 'venue-details' || currentContext === 'venue') {
                // From venue details -> back to search results
                modules.modalManager?.close('venueDetailsOverlay');
                setTimeout(() => {
                    modules.modalManager?.open('resultsOverlay');
                    modules.nav?.setPageContext('results');
                }, 100);
                
            } else if (currentContext === 'results') {
                // Check if we came from auto-search (Find GF Beer button)
                const lastSearchType = window.App.getState('lastSearch.type');
                
                modules.modalManager?.close('resultsOverlay');
                
                if (lastSearchType === 'nearby' || lastSearchType === 'location') {
                    // Auto-search from home - go back to home
                    modules.nav?.goToHome();
                } else {
                    // Manual search - go back to search overlay
                    setTimeout(() => {
                        modules.modalManager?.open('searchOverlay');
                        modules.nav?.setPageContext('search');
                    }, 100);
                }
            } else if (currentContext === 'search') {
                // From search -> check where we came from
                const searchReturnContext = window.App.getState('searchReturnContext');
                modules.modalManager?.close('searchOverlay');
                
                // Always go home since you opened search from home via "Find GF Beer"
                modules.nav?.goToHome();
                
            } else {
                // Everything else -> home
                modules.nav?.goToHome();
            }
        },

        'close-ios-guide': (el, modules) => {
            if (window.pwaHandler) {
                window.pwaHandler.dismissIOSGuide();
            }
        },

        // Add these to your main.js action handlers:

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
        
        'skip-status-update': (el, modules) => {
            console.log('⏭️ Skipping status update');
            modules.modalManager?.close('beerDetailsPromptModal');
        },

        'accept-all-from-settings': (el, modules) => {
            console.log('✅ Accepting all cookies from settings');
            
            // Set all cookie preferences to true
            const preferences = {
                necessary: true,
                analytics: true,
                marketing: true
            };
            
            // Save preferences
            localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
            localStorage.setItem('cookiesAccepted', 'true');
            
            // Close the cookie settings modal
            modules.modalManager?.close('cookieSettings');
            
            // Update any cookie-dependent features
            if (preferences.analytics && modules.tracking) {
                console.log('📊 Analytics cookies accepted');
                // The tracking module should already be checking for permissions
            }
            
            console.log('✅ Cookie preferences saved:', preferences);
        },

        // Update the 'skip-status-prompt' action handler in main.js:

        'skip-status-prompt': async (el, modules) => {
            console.log('⏭️ Skipping status prompt after beer report');
            
            const statusPromptVenue = window.App.getState('statusPromptVenue');
            const statusPromptSubmittedBy = window.App.getState('statusPromptSubmittedBy');
            
            if (statusPromptVenue) {
                const currentStatus = statusPromptVenue.gf_status || 'unknown';
                
                if (currentStatus !== 'always_tap_cask' && currentStatus !== 'always_bottle_can') {
                    console.log('🔄 Auto-updating status to "currently" (from:', currentStatus, ')');
                    
                    // Get user_id from localStorage
                    const userId = parseInt(localStorage.getItem('user_id'));
                    console.log('👤 Using user_id:', userId);
                    
                    try {
                        const response = await fetch('/api/update-gf-status', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                venue_id: statusPromptVenue.venue_id,
                                status: 'currently',
                                user_id: userId,
                                submitted_by: statusPromptSubmittedBy || 
                                            window.App.getState('userNickname') || 
                                            localStorage.getItem('userNickname') || 
                                            'anonymous'
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (response.ok) {
                            if (result.duplicate) {
                                modules.toast?.info('Thanks for the beer report! 🍺');
                            } else {
                                modules.toast?.success('Thanks! Beer added & status set to "Currently has GF" 🍺✅');
                            }
                            
                            if (!result.duplicate && statusPromptVenue) {
                                window.App.setState('currentVenue', {
                                    ...statusPromptVenue,
                                    gf_status: 'currently'
                                });
                            }
                        } else {
                            modules.toast?.success('Thanks for the beer report! 🍺');
                        }
                    } catch (error) {
                        console.error('Failed to auto-update status:', error);
                        modules.toast?.success('Thanks for the beer report! 🍺');
                    }
                } else {
                    console.log('ℹ️ Venue already has "always" status:', currentStatus);
                    modules.toast?.success('Thanks for the beer report! 🍺');
                }
                
                window.App.setState('statusPromptVenue', null);
                window.App.setState('statusPromptSubmittedBy', null);
            } else {
                modules.toast?.info('Thanks for the beer report! 🍺');
            }
            
            modules.modalManager?.close('statusPromptAfterBeerModal');
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
            
            // Use GET request like the normal search
            const params = new URLSearchParams({
                q: searchQuery,
                type: 'beer'
            });
            
            fetch(`/api/search?${params}`)
            .then(response => response.json())
            .then(data => {
                const searchModule = modules.search || window.App?.getModule('search');
                if (searchModule && searchModule.displayResults) {
                    searchModule.displayResults(data);
                } else {
                    modules.toast?.error(`No venues found serving ${beerName}`);
                }
            })
            .catch(error => {
                console.error('Search error:', error);
                modules.toast?.error('Search failed');
            });
        },

        
        // Venue actions
        'view-venue': (el, modules) => {
            const venueId = el.dataset.venueId || el.closest('[data-venue-id]')?.dataset.venueId;
            if (venueId) modules.venue?.showVenueDetails?.(venueId);
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
                modules.venue?.showVenueDetails?.(venueId);
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

        'update-gf-status-new-venue': (el, modules) => {
            modules.modalManager?.close('venueAddedPromptModal');
            
            const venueId = window.App.getState('lastAddedVenueId');
            if (!venueId) {
                console.error('No venue ID found');
                return;
            }
            
            window.App.setState('currentVenue', {
                venue_id: venueId,
                venue_name: window.App.getState('lastAddedVenueName')
            });
            
            // Use venue module's openStatusModal instead
            console.trace('🔍 DEBUG: Opening GF status modal from main.js action handler');
            modules.modalManager?.open('gfStatusModal');
        },
        
        'report-gf-beer-new-venue': (el, modules) => {
            modules.modalManager?.close('venueAddedPromptModal');
            
            const venueId = window.App.getState('lastAddedVenueId');
            const venueName = window.App.getState('lastAddedVenueName');
            
            if (!venueId) {
                console.error('No venue ID found');
                return;
            }
            
            const venueData = {
                venue_id: venueId,
                venue_name: venueName
            };
            
            window.App.setState('currentVenue', venueData);
            
            modules.modalManager.open('reportModal', {
                onOpen: () => {
                    if (window.CascadeForm) {
                        window.CascadeForm.setVenue(venueData);  // THIS IS MISSING
                        window.CascadeForm.reset();
                    }
                }
            });
        },
        
        'close-venue-added-modal': (el, modules) => {
            modules.modalManager?.close('venueAddedPromptModal');
            modules.toast?.success('Venue added successfully!');
        },

        'quick-status-update': async (el, modules) => {
            const status = el.dataset.status;
            const statusPromptVenue = window.App.getState('statusPromptVenue');
            
            // Get venue ID from multiple possible sources
            const venueId = statusPromptVenue?.venue_id || 
                            statusPromptVenue?.id || 
                            el.dataset.venueId;
            
            if (!venueId) {
                console.error('❌ No venue ID found in any source');
                modules.toast?.error('Error: No venue selected');
                return;
            }
            
            console.log('🎯 Quick status update:', status, 'for venue:', venueId);
            console.log('👤 Submitted by:', statusPromptSubmittedBy);
            
            // Get user_id from localStorage since it's not being passed through state
            const userId = parseInt(localStorage.getItem('user_id'));
            console.log('🆔 User ID from localStorage:', userId);
            
            modules.modalManager?.close('statusPromptAfterBeerModal');
            modules.modalManager?.closeGroup('status');
            modules.modalManager?.block('gfStatusConfirmModal');
            modules.modalManager?.block('beerDetailsPromptModal');
            
            try {
                const response = await fetch('/api/update-gf-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        venue_id: statusPromptVenue.venue_id,
                        status: status,
                        user_id: userId,
                        submitted_by: statusPromptSubmittedBy || 
                                    window.App.getState('userNickname') || 
                                    localStorage.getItem('userNickname') || 
                                    'anonymous'
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    if (result.duplicate) {
                        modules.toast?.info('🍺 Beer added! Status already set to ' + status);
                    } else {
                        modules.toast?.success('🎉 Beer added + status updated! You are a legend! 🍺⭐');
                    }
                    
                    if (!result.duplicate && statusPromptVenue) {
                        window.App.setState('currentVenue', {
                            ...statusPromptVenue,
                            gf_status: status
                        });
                    }
                    
                    const communityHub = modules.communityHub || window.App?.getModule('communityHub');
                    if (communityHub?.isUserActive()) {
                        communityHub.trackAction('STATUS_UPDATE', { venue: statusPromptVenue.venue_name });
                    }
                    
                    window.App.setState('statusPromptVenue', null);
                    window.App.setState('statusPromptSubmittedBy', null);
                    
                    setTimeout(() => {
                        modules.modalManager?.unblock('gfStatusConfirmModal');
                        modules.modalManager?.unblock('beerDetailsPromptModal');
                    }, 1000);
                }
            } catch (error) {
                console.error('Failed to update status:', error);
                modules.toast?.error('Failed to update status');
                
                modules.modalManager?.unblock('gfStatusConfirmModal');
                modules.modalManager?.unblock('beerDetailsPromptModal');
            }
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
        'show-notifications-preview': (el, modules) => {
            modules.modalManager?.open('notificationsPreviewModal');
        },
        'go-to-my-location': (el, modules) => {
            App.goToUserLocation(modules);
        },

        'open-onboarding-nickname': (el, modules) => {
            console.log('🔓 Opening nickname modal from community hub');
            
            // Close community hub first
            modules.modalManager?.close('communityHubOverlay');
            
            // Small delay then use the PROPER onboarding flow
            setTimeout(() => {
                // Use the OnboardingFlow's nickname selection
                if (window.OnboardingFlow && window.OnboardingFlow.showNicknameSelection) {
                    // Set a flag so we know to reopen community hub after
                    window.App.setState('returnToCommunityAfterNickname', true);
                    
                    // Open the proper nickname modal with all its validation
                    window.OnboardingFlow.showNicknameSelection();
                } else {
                    console.error('OnboardingFlow not available');
                    modules.toast?.error('Could not open nickname selection');
                }
            }, 100);
        },
        
        // Form actions
        'report-beer': (el, modules) => {
            const venueData = window.App.getState('currentVenue');
            
            // Open report modal on top of venue details
            if (modules.modalManager) {
                modules.modalManager.open('reportModal', {
                    onOpen: () => {
                        // Initialize cascade form if needed
                        if (window.initCascadeForm) {
                            window.initCascadeForm();
                        }
                        
                        // Set venue and reset cascade form
                        if (window.CascadeForm) {
                            window.CascadeForm.setVenue(venueData);
                            window.CascadeForm.reset();
                        }
                        
                    }
                });
            }
            
            modules.tracking?.trackEvent('report_beer_click', 'User Action', venueData?.name || 'unknown');
        },

        'submit-beer-report': (el, modules) => {
            console.log('🎉 Submit beer report clicked!');
            
            // Call CascadeForm's submit handler directly
            if (window.CascadeForm) {
                // Create a fake event object since handleSubmit expects one
                const fakeEvent = { preventDefault: () => {} };
                window.CascadeForm.handleSubmit(fakeEvent);
            }
        },
        'clear-selected-venue': (el, modules) => {
            modules.form?.clearSelectedVenue?.();
        },

        // Status actions
        'change-gf-status': (el, modules) => {
            console.trace('🔍 DEBUG: Opening GF status modal from main.js action handler');
            modules.modalManager?.open('gfStatusModal');
        },


        'select-status': (el, modules) => {
            const status = el.dataset.status;
            console.log('📊 Status selected:', status);
            modules.venue?.selectStatus?.(status);
        },

        
        
        
        'confirm-status': (el, modules) => {
            modules.venue?.confirmStatusUpdate?.();
        },
        'cancel-status': (el, modules) => {
            modules.modalManager?.close('gfStatusConfirmModal');
        },
        'skip-details': (el, modules) => {
            modules.modalManager?.close('beerDetailsPromptModal');
            modules.toast?.success('✅ Status updated successfully!');
        },
        'add-beer-details': (el, modules) => {
            modules.modalManager?.close('beerDetailsPromptModal');
            window.App.setState('cameFromBeerDetailsPrompt', true);
            
            const currentVenue = window.App.getState('currentVenue');
            
            modules.modalManager.open('reportModal', {
                onOpen: () => {
                    // Just set venue and reset, don't initialize
                    if (window.CascadeForm) {
                        window.CascadeForm.setVenue(currentVenue);
                        window.CascadeForm.reset();
                    }
                }
            });
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

        'create-brewery': (el, modules) => {
            const breweryName = el.dataset.brewery;
            
            if (breweryName && window.CascadeForm) {
                // This is what should happen - just call createNewBrewery
                window.CascadeForm.createNewBrewery(breweryName);
            }
        },

        'add-brewery-beer': (el, modules) => {
            const beerName = el.dataset.beer;
            if (beerName && window.CascadeForm) {
                // Just set the beer name and show submit button
                const beerNameInput = document.getElementById('reportBeerName');
                if (beerNameInput) {
                    beerNameInput.value = beerName;
                }
                
                // Hide dropdown
                const dropdown = document.getElementById('beerNameDropdown');
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
                
                // Show submit button
                const formActions = document.getElementById('formActions');
                if (formActions) {
                    formActions.classList.add('show');
                }
            }
        },
        
        // Also add this one if you don't have it:
        'add-new-brewery': (el, modules) => {
            const breweryInput = document.getElementById('reportBrewery');
            if (breweryInput) {
                // Hide dropdown through forms module or directly
                const dropdown = document.getElementById('breweryDropdown');
                if (dropdown) dropdown.style.display = 'none';
                
                breweryInput.focus();
                modules.toast?.info('💡 Type the new brewery name and continue');
            }
        },
        
        'add-new-beer': (el, modules) => {
            const beerNameInput = document.getElementById('reportBeerName');
            if (beerNameInput) {
                // Hide dropdown directly since it's not exposed from forms module
                const dropdown = document.getElementById('beerNameDropdown');
                if (dropdown) dropdown.style.display = 'none';
                
                beerNameInput.focus();
                modules.toast?.info('💡 Type the new beer name and continue');
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
            
            modules.toast?.success('✅ Beer name accepted - continue with details');
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
        'save-cookie-preferences': (el, modules) => {
            const analyticsConsent = document.getElementById('analyticsConsent')?.checked;
            App.handleCookieConsent(analyticsConsent);
            modules.modalManager?.close('cookieSettings'); // CHANGED
        },
        'show-cookie-settings': (el, modules) => {
            modules.modalManager?.open('cookieSettings'); // CHANGED
        },

        'switch-to-leaderboard': (el, modules) => {
            // Just click the leaderboard tab - simplest solution!
            const leaderboardTab = document.querySelector('[data-hub-tab="leaderboard"]');
            if (leaderboardTab) {
                leaderboardTab.click();
            } else {
                console.error('Leaderboard tab not found');
            }
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
                
                modules.toast?.success(`Nickname changed to ${newNickname}!`);
            }
        },

        'update-beer-placeholder': (el, modules) => {
            const searchType = el.value;
            const input = document.getElementById('beerInput');
            if (input) {
                const placeholders = {
                    'brewery': 'Enter brewery name',
                    'beer': 'Enter beer name', 
                    'style': 'Enter beer style'
                };
                input.placeholder = placeholders[searchType] || 'Enter search term';
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
        
        'review-beers': (el, modules) => {
            const community = modules.community || window.App?.getModule('community');
            community?.handleQuickAction('review-beers');
        },

        'saved-venues': (el, modules) => {
            const community = modules.community || window.App?.getModule('community');
            community?.handleQuickAction('saved-venues');
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
            if (brewery && window.CascadeForm) {
                window.CascadeForm.selectBrewery(brewery);
            }
        },

        'select-brewery-beer': (el, modules) => {
            const beerData = el.dataset.beer;
            if (beerData && window.CascadeForm) {
                window.CascadeForm.selectBreweryBeer(JSON.parse(beerData));
            }
        },
        
        'select-found-beer': (el, modules) => {
            const beerData = el.dataset.beer;
            if (beerData && window.CascadeForm) {
                window.CascadeForm.selectFoundBeer(JSON.parse(beerData));
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
            // Close the more menu first
            const moreMenu = document.getElementById('moreMenu');
            if (moreMenu) {
                moreMenu.classList.remove('active');
            }
            
            // Then open the about overlay
            modules.modalManager.open('aboutOverlay');
            modules.tracking?.trackEvent('about_us_view', 'Navigation', 'more_menu');
        },
        'about-gf': (el, modules) => {
            // Close the more menu first
            const moreMenu = document.getElementById('moreMenu');
            if (moreMenu) {
                moreMenu.classList.remove('active');
            }
            
            // Then open the GF info overlay
            modules.modalManager.open('gfInfoOverlay');
            modules.tracking?.trackEvent('gf_info_view', 'Navigation', 'more_menu');
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
            if (venueNameEl) venueNameEl.textContent = currentVenue.venue_name;
            
            // Load beer list - make sure we're calling the right module
            const venueModule = modules.venue || window.App?.getModule('venue');
            if (venueModule?.loadBeerList) {
                venueModule.loadBeerList(currentVenue);
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
                modules.toast?.error('Please fill in all fields');
                return;
            }
            
            // Validate postcode
            if (!modules.helpers?.isValidPostcode(postcode)) {
                modules.toast?.error('Please enter a valid UK postcode');
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
        const toast = App.getModule('toast');
        
        if (!helpers || !tracking) return;
        
        helpers.Storage.set('cookieConsent', true);
        helpers.Storage.set('analyticsConsent', analyticsAllowed);
        
        tracking.updateConsent(analyticsAllowed);
        
        // Hide banner, show float button
        const banner = document.getElementById('cookieConsent');
        
        if (banner) banner.style.display = 'none';
        
        toast?.success('✅ Cookie preferences saved!');
    },
    
    checkCookieConsent: () => {
        const helpers = App.getModule('helpers');
        
        // Check BOTH the old and new storage keys
        const hasConsent = helpers?.Storage.get('cookieConsent') || 
                          localStorage.getItem('cookiesAccepted') === 'true';
        
        const banner = document.getElementById('cookieConsent');
        
        if (!hasConsent) {
            // No consent yet - show banner
            if (banner) {
                banner.style.display = 'block';
                console.log('🍪 Showing cookie banner - no consent found');
            }
        } else {
            // Has consent - hide banner
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
        
        // USE MODAL MANAGER INSTEAD OF MANUAL DOM MANIPULATION
        modules.modalManager.open('fullMapOverlay', {
            onOpen: () => {
                // Initialize map after overlay is properly opened
                setTimeout(() => modules.map?.initFullUKMap?.(), 100);
                
                // Update navigation context
                modules.nav?.showMapWithContext();
            }
        });
        
        modules.tracking?.trackEvent('full_map_view', 'Navigation', 'nav_bar');
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
        const toast = modules.toast;
        
        if (!location) {
            toast?.info('📍 Location not available. Please enable location services.');
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

// Enhanced Location Handling for PWA
const LocationManager = {
    
    // Check if running as PWA for better permissions
    isPWA() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone ||
               document.referrer.includes('android-app://');
    },
    
    // Enhanced permission check
    async checkPermissions() {
        if ('permissions' in navigator) {
            try {
                const result = await navigator.permissions.query({name: 'geolocation'});
                console.log('📍 Location permission:', result.state);
                return result.state;
            } catch (error) {
                console.log('⚠️ Permissions API not fully supported');
            }
        }
        return 'unknown';
    },
    
    // Request location with PWA optimizations
    async requestLocation(options = {}) {
        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000  // 5 minutes cache
        };
        
        const locationOptions = { ...defaultOptions, ...options };
        
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            // Show different UI for PWA vs browser
            if (this.isPWA()) {
                console.log('🚀 PWA mode: Enhanced location access');
                // PWA mode typically has more persistent permissions
            } else {
                console.log('🌐 Browser mode: Standard location access');
                // Show install prompt if permission issues persist
                this.suggestPWAInstall();
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('✅ Location obtained:', position.coords);
                    resolve(position);
                },
                (error) => {
                    console.error('❌ Location error:', error);
                    
                    // Handle different error types
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            if (!this.isPWA()) {
                                this.showPWALocationBenefit();
                            }
                            reject(new Error('Location access denied'));
                            break;
                        case error.POSITION_UNAVAILABLE:
                            reject(new Error('Location unavailable'));
                            break;
                        case error.TIMEOUT:
                            reject(new Error('Location request timed out'));
                            break;
                        default:
                            reject(new Error('Unknown location error'));
                    }
                },
                locationOptions
            );
        });
    },
    
    // Show PWA benefits for location
    showPWALocationBenefit() {
        // Only show if install prompt is available
        if (window.deferredPrompt) {
            const modal = document.createElement('div');
            modal.className = 'pwa-location-modal';
            modal.innerHTML = `
                <div class="modal-backdrop" onclick="this.parentElement.remove()">
                    <div class="modal-content" onclick="event.stopPropagation()">
                        <h3>📱 Better Location Access</h3>
                        <p>Installing as an app gives you:</p>
                        <ul>
                            <li>✅ More reliable location permissions</li>
                            <li>✅ Faster app loading</li>
                            <li>✅ Works offline</li>
                            <li>✅ No browser bars</li>
                        </ul>
                        <div class="modal-actions">
                            <button onclick="this.closest('.pwa-location-modal').remove()" 
                                    class="btn btn-secondary">Not Now</button>
                            <button onclick="window.deferredPrompt?.prompt(); this.closest('.pwa-location-modal').remove()" 
                                    class="btn btn-primary">Install App</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
    },
    
    // Suggest PWA for location issues
    suggestPWAInstall() {
        // Only suggest if we have install prompt and haven't dismissed
        if (window.deferredPrompt && !sessionStorage.getItem('pwa-dismissed')) {
            setTimeout(() => {
                const suggestion = document.createElement('div');
                suggestion.innerHTML = `
                    <div style="
                        position: fixed;
                        bottom: calc(var(--nav-height) + 16px);
                        left: 16px;
                        right: 16px;
                        background: #fbbf24;
                        color: #92400e;
                        padding: 12px;
                        border-radius: 12px;
                        z-index: 1500;
                        font-size: 0.9rem;
                        text-align: center;
                    ">
                        💡 <strong>Tip:</strong> Install as app for better location access
                        <button onclick="window.deferredPrompt?.prompt(); this.parentElement.remove()" 
                                style="margin-left: 8px; background: #92400e; color: white; border: none; padding: 4px 8px; border-radius: 8px; font-size: 0.8rem;">
                            Install
                        </button>
                    </div>
                `;
                
                document.body.appendChild(suggestion);
                setTimeout(() => suggestion.remove(), 8000);
            }, 2000);
        }
    },
    // iOS-specific location help
    showIOSLocationHelp() {
        const modal = document.createElement('div');
        modal.className = 'ios-location-modal';
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="this.parentElement.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <h3>📍 Enable Location on iPhone</h3>
                    <p>To find venues near you:</p>
                    
                    <div class="ios-location-steps">
                        <div class="location-step">
                            <span class="step-icon">⚙️</span>
                            <span>Open iPhone <strong>Settings</strong></span>
                        </div>
                        <div class="location-step">
                            <span class="step-icon">🌐</span>
                            <span>Tap <strong>Safari</strong></span>
                        </div>
                        <div class="location-step">
                            <span class="step-icon">📍</span>
                            <span>Tap <strong>Location</strong></span>
                        </div>
                        <div class="location-step">
                            <span class="step-icon">✅</span>
                            <span>Select <strong>"Ask Next Time"</strong></span>
                        </div>
                    </div>
                    
                    <div class="ios-tip">
                        💡 <strong>Better option:</strong> Install as app for more reliable location access!
                    </div>
                    
                    <div class="modal-actions">
                        <button onclick="this.closest('.ios-location-modal').remove()" 
                                class="btn btn-secondary">Use Postcode Instead</button>
                        ${!window.isStandalone() ? 
                            '<button onclick="showIOSInstallGuide(); this.closest(\'.ios-location-modal\').remove()" class="btn btn-primary">Install as App</button>' : 
                            '<button onclick="this.closest(\'.ios-location-modal\').remove()" class="btn btn-primary">Try Again</button>'
                        }
                    </div>
                </div>
            </div>
        `;
        
        // Add iOS-specific modal styles
        const style = document.createElement('style');
        style.textContent = `
            .ios-location-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100vh;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            
            .ios-location-modal .modal-content {
                background: white;
                border-radius: 16px;
                padding: 1.5rem;
                max-width: 350px;
                width: 90%;
                text-align: center;
            }
            
            .ios-location-steps {
                text-align: left;
                margin: 1rem 0;
            }
            
            .location-step {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 0;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .location-step:last-child {
                border-bottom: none;
            }
            
            .step-icon {
                font-size: 1.2rem;
                width: 24px;
                text-align: center;
            }
            
            .ios-tip {
                background: #e3f2fd;
                border: 1px solid #bbdefb;
                border-radius: 8px;
                padding: 12px;
                margin: 1rem 0;
                font-size: 0.9rem;
                text-align: left;
            }
            
            .modal-actions {
                display: flex;
                gap: 8px;
                margin-top: 1rem;
            }
            
            .modal-actions .btn {
                flex: 1;
                padding: 10px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
            }
            
            .btn-secondary {
                background: #f5f5f5;
                color: #666;
            }
            
            .btn-primary {
                background: #667eea;
                color: white;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);
    },
    
    // Update the existing requestLocation method to detect iOS
    async requestLocation(options = {}) {
        // ... existing code ...
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('✅ Location obtained:', position.coords);
                resolve(position);
            },
            (error) => {
                console.error('❌ Location error:', error);
                
                // Handle different error types with iOS-specific help
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        if (window.isIOS && window.isIOS()) {
                            this.showIOSLocationHelp();
                        } else if (!this.isPWA()) {
                            this.showPWALocationBenefit();
                        }
                        reject(new Error('Location access denied'));
                        break;
                    // ... rest of your error handling
                }
            },
            locationOptions
        );
    }
};

// Export for use in your existing code
window.LocationManager = LocationManager;



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
