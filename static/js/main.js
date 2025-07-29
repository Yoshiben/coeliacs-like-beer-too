// ================================================================================
// MAIN.JS - Cleaned and Optimized Version
// ================================================================================

import { Constants } from './constants.js';

// ================================
// EVENT BUS - Central Communication Hub
// ================================
class EventBus extends EventTarget {
    emit(eventName, data) {
        this.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }
    
    on(eventName, handler) {
        this.addEventListener(eventName, handler);
    }
    
    off(eventName, handler) {
        this.removeEventListener(eventName, handler);
    }
}

// ================================
// GLOBAL NAMESPACE - Single Source of Truth
// ================================
const App = {
    initialized: false,
    modules: {},
    events: new EventBus(),
    
    // State management
    state: {
        currentView: 'home',
        userLocation: null,
        searchResults: [],
        selectedPub: null
    },
    
    // Register module
    registerModule(name, module) {
        this.modules[name] = module;
        this.events.emit('module-registered', { name, module });
    },
    
    // Get module safely
    getModule(name) {
        return this.modules[name] || null;
    },

    // Convenience getter for form module
    getForm() {
        return this.getModule('form');
    },
    
    // Initialize app in phases
    async initialize() {
        console.log('🚀 Initializing App...');
        
        try {
            await this.loadPhase1(); // Core utilities
            await this.loadPhase2(); // API & Data
            await this.loadPhase3(); // UI Components
            await this.loadPhase4(); // Features
            
            this.initialized = true;
            this.events.emit('app-initialized');
            console.log('✅ App initialization complete!');
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.showFallback(error);
        }
    },
    
    async loadPhase1() {
        console.log('🔧 Phase 1: Loading Core Utilities...');
        
        const { HelpersModule } = await import('./helpers.js');
        this.registerModule('helpers', HelpersModule);
        this.registerModule('ui', HelpersModule); // Legacy support
        this.registerModule('utils', HelpersModule); // Legacy support
        
        // Make essential functions globally available
        window.showLoadingToast = HelpersModule.showLoadingToast;
        window.hideLoadingToast = HelpersModule.hideLoadingToast;
        window.showSuccessToast = HelpersModule.showSuccessToast;
        window.animateNumber = HelpersModule.animateNumber;
        window.closeResults = HelpersModule.closeResults;
    },
    
    async loadPhase2() {
        console.log('🔧 Phase 2: Loading Data Layer...');
        
        const { APIModule } = await import('./api.js');
        const { TrackingModule } = await import('./tracking.js');
        
        this.registerModule('api', APIModule);
        this.registerModule('tracking', TrackingModule);
        
        // Load initial stats
        await this.loadStats();
    },
    
    async loadPhase3() {
        console.log('🔧 Phase 3: Loading UI Layer...');
        
        const { ModalModule } = await import('./modals.js');
        this.registerModule('modal', ModalModule);
        
        // Set up UI event delegation
        this.setupEventDelegation();
    },
    
    async loadPhase4() {
        console.log('🔧 Phase 4: Loading Features...');
        
        const { MapModule } = await import('./map.js');
        const { SearchModule } = await import('./search.js');
        const { FormModule } = await import('./forms.js');
        
        // NOW you can use the modules after the imports complete
        console.log('🔍 About to register search module');
        this.registerModule('map', MapModule);
        this.registerModule('search', SearchModule);
        this.registerModule('form', FormModule);
        
        // Set up global functions
        this.setupGlobalFunctions();
    },
    
    async loadStats() {
        try {
            const api = this.getModule('api');
            if (!api) return;
            
            const stats = await api.getStats();
            const helpers = this.getModule('helpers');
            
            if (helpers) {
                helpers.animateNumber('totalPubs', stats.total_pubs);
                helpers.animateNumber('gfPubs', stats.gf_pubs);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    },
    
    // LOCATION: main.js - setupEventDelegation method
    // CHECK: Make sure you have this structure
    
    setupEventDelegation() {
        console.log('🔧 Setting up event delegation...');
        
        // Main click handler
        document.addEventListener('click', (e) => {
            // Debug what was clicked
            console.log('🖱️ Click detected:', e.target);
            
            const target = e.target.closest('[data-action], [data-modal], [data-distance]');
            if (!target) {
                console.log('❌ No data-action found on clicked element');
                return;
            }
            
            console.log('✅ Found action element:', target.dataset);
            
            e.preventDefault();
            e.stopPropagation();
            
            // Modal triggers
            if (target.dataset.modal) {
                console.log('🔲 Opening modal:', target.dataset.modal);
                this.openModal(target.dataset.modal);
            }
            
            // Action handlers
            if (target.dataset.action) {
                console.log('🎯 Handling action:', target.dataset.action);
                this.handleAction(target.dataset.action, target, e);
            }
            
            // Distance selection
            if (target.dataset.distance) {
                console.log('📏 Distance selected:', target.dataset.distance);
                this.handleDistanceSelection(parseInt(target.dataset.distance));
            }
        }, true); // <-- Make sure this 'true' is here for capture phase
    },
    
    setupGlobalFunctions() {
        const helpers = this.getModule('helpers');
        
        window.closeResults = () => helpers?.closeResults?.();
        window.showPubDetails = (pubId) => this.getModule('search')?.showPubDetails?.(pubId);
        window.toggleSearchResultsFullMap = () => this.getModule('map')?.toggleSearchResultsFullMap?.();
        window.closePubDetails = () => helpers?.closePubDetails?.();
        
        // Cookie functions
        window.acceptAllCookies = () => this.handleCookieConsent(true);
        window.acceptEssentialOnly = () => this.handleCookieConsent(false);
    },
    
    handleAction(action, element, event) {
        console.log(`🎬 ACTION TRIGGERED: "${action}"`, {
            element: element,
            hasSearchModule: !!this.getModule('search'),
            hasModalModule: !!this.getModule('modal'),
            hasFormModule: !!this.getModule('form'),
            availableModules: Object.keys(this.modules)
        });
        console.log(`🎬 Processing action: ${action}`);
        
        // Get all modules once
        const modules = {
            search: this.getModule('search'),
            modal: this.getModule('modal'),
            helpers: this.getModule('helpers'),
            map: this.getModule('map'),
            form: this.getModule('form'),
            tracking: this.getModule('tracking')
        };

        console.log('📦 Modules loaded:', {
            search: !!modules.search,
            modal: !!modules.modal,
            helpers: !!modules.helpers,
            map: !!modules.map,
            form: !!modules.form,
            tracking: !!modules.tracking
        });
        
        // Define action handlers
        const actionHandlers = {
            'location-search': () => {
                console.log('📍 Starting location search...');
                modules.search?.startLocationSearch?.();
            },
            
            'view-details': () => {
                console.log('🏠 Viewing pub details...');
                const pubId = element.dataset.pubId || element.closest('[data-pub-id]')?.dataset.pubId;
                if (pubId && modules.search?.showPubDetails) {
                    modules.search.showPubDetails(pubId);
                }
            },
            
            'search-name': () => {
                console.log('🔍 Performing name search...');
                modules.search?.searchByName?.();
            },
            
            'search-area': () => {
                console.log('🔍 Performing area search...');
                modules.search?.searchByArea?.();
            },
            
            'search-beer': () => {
                console.log('🔍 Performing beer search...');
                modules.search?.searchByBeer?.();
            },
            
            'close-results': () => {
                console.log('🏠 Closing results...');
                modules.helpers?.closeAllOverlaysAndGoHome?.();
                modules.tracking?.trackEvent('close_results', 'Navigation', 'home_button');
            },
            
            'toggle-results-map': () => {
                console.log('🗺️ Toggling results map...');
                modules.map?.toggleSearchResultsFullMap?.() || this.toggleResultsMapFallback();
            },
            
            'toggle-pub-map': () => {
                console.log('🗺️ Toggling pub detail map...');
                this.togglePubDetailMap(modules.map);
            },
            
            'view-pub': () => {
                const pubId = element.dataset.pubId;
                if (pubId) modules.search?.showPubDetails?.(pubId);
            },
            
            'back-to-results': () => {
                console.log('🔙 Going back to results...');
                if (!modules.search?.goBackToResults?.()) {
                    this.fallbackBackToResults();
                }
            },
            
            'close-pub-details': () => {
                console.log('🏠 Closing pub details...');
                modules.helpers?.closeAllOverlaysAndGoHome?.();
            },
            
            'submit-report': () => {
                console.log('📝 Submit report triggered');
                const reportForm = document.getElementById('reportForm');
                if (reportForm) {
                    reportForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            },
            
            'report-beer': () => {
                console.log('📝 Report beer action triggered');
                this.handleReportBeer(modules);
            },
            
            'show-full-map': () => {
                console.log('🗺️ Showing full UK map...');
                this.showFullMap(modules);
            },
            
            'close-full-map': () => {
                console.log('🏠 Closing full UK map...');
                this.closeFullMap(modules);
            },
            
            'change-gf-status': () => {
                console.log('📊 Opening GF status modal...');
                this.openModal('gfStatusModal');
            },
            
            'select-status': () => {
                const status = element.dataset.status;
                modules.form?.GFStatusFlow?.selectStatus?.(status);
            },
            
            'confirm-status': () => {
                modules.form?.GFStatusFlow?.confirmStatusUpdate?.();
            },
            
            'cancel-status': () => {
                this.closeModal('gfStatusConfirmModal');
            },
            
            'skip-details': () => {
                this.closeModal('beerDetailsPromptModal');
                window.showSuccessToast?.('✅ Status updated successfully!');
            },
            
            'add-beer-details': () => {
                this.closeModal('beerDetailsPromptModal');
                modules.modal?.openReportModal?.(window.currentPubData);
            },
            
            'add-new-pub-from-results': () => {
                console.log('➕ Adding new pub from no results');
                modules.modal?.openReportModal?.({ isNewPub: true });
            },
            
            'search-google-places': () => {
                console.log('🔍 Opening places search');
                modules.search?.PlacesSearchModule?.openPlacesSearch?.();
            },
            
            'use-selected-place': () => {
                console.log('✅ Using selected place');
                modules.search?.PlacesSearchModule?.useSelectedPlace?.();
            },
            
            'select-brewery': () => {
                const brewery = element.dataset.brewery;
                if (brewery) modules.form?.selectBrewery?.(brewery);
            },
            
            'select-beer': () => {
                const beerData = element.dataset.beerData;
                if (beerData) modules.form?.selectBeer?.(beerData);
            },
            
            'close-modal': () => {
                const modal = element.closest('.modal, .search-modal');
                if (modal) this.closeModal(modal.id);
            },

            'clear-selected-pub': () => {
                console.log('🗑️ Clearing selected pub...');
                const form = modules.form;
                if (form?.clearSelectedPub) {
                    form.clearSelectedPub();
                } else {
                    // Fallback
                    if (window.FormModule?.clearSelectedPub) {
                        window.FormModule.clearSelectedPub();
                    }
                }
            },
            
            'reload-page': () => {
                console.log('🔄 Reloading page...');
                location.reload();
            },
            
            'view-pub-from-map': () => {
                console.log('🗺️ Viewing pub from map popup...');
                const pubId = element.dataset.pubId;
                if (pubId && modules.search?.showPubDetails) {
                    modules.search.showPubDetails(pubId);
                }
            },
            
            // Also update the places search input handler:
            'search-places-input': () => {
                const query = element.value;
                console.log('🔍 Places search input:', query);
                
                if (modules.search?.PlacesSearchModule?.handleSearch) {
                    modules.search.PlacesSearchModule.handleSearch(query);
                }
            },

            'find-pub-online': () => {
                console.log('🔍 Finding pub online...');
                const pub = window.App.state.currentPub || window.currentPubData;
                if (pub) {
                    const searchQuery = encodeURIComponent(`${pub.name} ${pub.postcode} pub`);
                    window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
                    
                    const tracking = modules.tracking;
                    if (tracking) {
                        tracking.trackExternalLink('google_search', pub.name);
                    }
                }
            },
            
            'get-pub-directions': () => {
                console.log('🧭 Getting directions to pub...');
                const pub = window.App.state.currentPub || window.currentPubData;
                if (pub) {
                    const destination = encodeURIComponent(`${pub.name}, ${pub.address}, ${pub.postcode}`);
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
                    
                    const tracking = modules.tracking;
                    if (tracking) {
                        tracking.trackExternalLink('google_maps_directions', pub.name);
                    }
                }
            },

            // LOCATION: main.js - handleAction method
            // ACTION: ADD these final action handlers
            
            // Add to actionHandlers object:
            
            'select-place': () => {
                console.log('📍 Selecting place from search...');
                const placeData = element.dataset.place;
                if (placeData && modules.search?.PlacesSearchModule?.selectPlace) {
                    const place = JSON.parse(placeData);
                    modules.search.PlacesSearchModule.selectPlace(place);
                }
            },
            
            'update-area-placeholder': () => {
                console.log('📝 Updating area search placeholder...');
                const modal = modules.modal;
                if (modal?.updateAreaPlaceholder) {
                    modal.updateAreaPlaceholder();
                }
            },
            
            'update-beer-placeholder': () => {
                console.log('🍺 Updating beer search placeholder...');
                const modal = modules.modal;
                if (modal?.updateBeerPlaceholder) {
                    modal.updateBeerPlaceholder();
                }
            },
            
            // Cookie actions (if not already present):
            'accept-all-cookies': () => {
                console.log('🍪 Accepting all cookies...');
                this.handleCookieConsent(true);
            },
            
            'accept-essential-cookies': () => {
                console.log('🍪 Accepting essential cookies only...');
                this.handleCookieConsent(false);
            },
            
            'save-cookie-preferences': () => {
                console.log('🍪 Saving cookie preferences...');
                const analyticsConsent = document.getElementById('analyticsConsent')?.checked;
                this.handleCookieConsent(analyticsConsent);
                this.closeModal('cookieSettings');
            },
            
            'show-cookie-settings': () => {
                console.log('🍪 Showing cookie settings...');
                this.openModal('cookieSettings');
            },

            'allow-location': () => {
                console.log('📍 User allowed location access');
                
                // Hide the modal
                const modal = document.getElementById('locationPermissionModal');
                if (modal) {
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                }
                
                // Trigger the location permission flow in search module
                const event = new CustomEvent('locationPermissionGranted');
                document.dispatchEvent(event);
            },
            
            'deny-location': () => {
                console.log('📍 User denied location access');
                
                // Hide the modal
                const modal = document.getElementById('locationPermissionModal');
                if (modal) {
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                }
                
                // Trigger the denial in search module
                const event = new CustomEvent('locationPermissionDenied');
                document.dispatchEvent(event);
            },

            'go-to-my-location': () => {
                console.log('📍 Go to my location clicked');
                const mapModule = modules.map;
                const currentLocation = window.App.state.userLocation;
                
                if (!currentLocation) {
                    if (window.showSuccessToast) {
                        window.showSuccessToast('📍 Location not available. Please enable location services.');
                    }
                    return;
                }
                
                if (window.fullUKMap) {
                    window.fullUKMap.setView([currentLocation.lat, currentLocation.lng], 14);
                    
                    if (window.fullUKMapUserMarker) {
                        window.fullUKMapUserMarker.openPopup();
                    }
                    
                    modules.tracking?.trackEvent('go_to_location', 'Map Interaction', 'button_click');
                }
            }

            if (!actionHandlers[action]) {
                console.error(`❌ No handler found for action: "${action}"`);
                console.log('Available actions:', Object.keys(actionHandlers));
                return;
            }
        };
        
        // Execute handler if exists
        const handler = actionHandlers[action];
        if (handler) {
            handler();
        } else {
            console.log(`❓ Unhandled action: ${action}`);
        }
    },
    
    togglePubDetailMap(mapModule) {
        const currentPub = window.currentPubData || this.state?.selectedPub;
        const mapContainer = document.getElementById('pubMapContainer');
        const mapBtnText = document.getElementById('pubMapBtnText');
        const pubContainer = document.getElementById('pubContainer');
        
        if (!mapContainer || !mapBtnText) {
            console.error('❌ Map elements not found');
            return;
        }
        
        if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
            // Show map
            console.log('🗺️ Activating split-screen view...');
            
            mapContainer.style.display = 'block';
            mapBtnText.textContent = 'Hide Map';
            if (pubContainer) pubContainer.classList.add('split-view');
            
            if (currentPub && currentPub.latitude && currentPub.longitude && mapModule) {
                mapModule.initPubDetailMap?.(currentPub);
            }
        } else {
            // Hide map
            console.log('🗺️ Deactivating split-screen view...');
            
            mapContainer.style.display = 'none';
            mapBtnText.textContent = 'Show on Map';
            if (pubContainer) pubContainer.classList.remove('split-view');
        }
        
        this.getModule('tracking')?.trackEvent('pub_map_toggle', 'Map Interaction', 
            mapContainer.style.display === 'block' ? 'show' : 'hide');
    },
    
    handleReportBeer(modules) {
        const pubData = window.currentPubData || this.state?.selectedPub;
        
        // Close overlays
        ['pubDetailsOverlay', 'resultsOverlay'].forEach(id => {
            const overlay = document.getElementById(id);
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.remove('active');
            }
        });
        
        document.body.style.overflow = '';
        
        // Open report modal
        if (modules.modal?.openReportModal) {
            modules.modal.openReportModal(pubData);
        } else {
            this.fallbackOpenReportModal(pubData);
        }
        
        modules.tracking?.trackEvent('report_beer_click', 'User Action', pubData?.name || 'unknown_pub');
    },
    
    async showFullMap(modules) {
        console.log('🗺️ Showing full UK map...');
        
        // Check if we need location first
        if (!window.App.state.userLocation) {
            try {
                if (modules.search?.requestLocationWithUI) {
                    console.log('📍 Requesting location for map...');
                    window.App.state.userLocation = await modules.search.requestLocationWithUI();
                    
                    if (modules.map?.setUserLocation) {
                        modules.map.setUserLocation(window.App.state.userLocation);
                    }
                }
            } catch (error) {
                console.log('📍 User declined location or error:', error);
                // Continue anyway
            }
        }
        
        const mapOverlay = document.getElementById('fullMapOverlay');
        if (mapOverlay) {
            mapOverlay.classList.add('active');
            mapOverlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            if (modules.map?.initFullUKMap) {
                setTimeout(() => modules.map.initFullUKMap(), 100);
            }
            
            modules.tracking?.trackEvent('full_map_view', 'Navigation', 'nav_bar');
        } else {
            console.error('❌ Map overlay element not found!');
        }
    },
    
    closeFullMap(modules) {
        const fullMapOverlay = document.getElementById('fullMapOverlay');
        if (fullMapOverlay) {
            fullMapOverlay.classList.remove('active');
            fullMapOverlay.style.display = 'none';
            document.body.style.overflow = '';
            
            modules.map?.cleanupFullUKMap?.();
        }
    },
    
    handleDistanceSelection(distance) {
        console.log(`📍 Distance ${distance}km selected`);
        
        this.closeModal('distanceModal');
        
        const search = this.getModule('search');
        if (search) {
            search.searchNearbyWithDistance(distance);
        } else {
            console.error('❌ Search module not available');
        }
    },
    
    handleCookieConsent(analyticsAllowed) {
        const helpers = this.getModule('helpers');
        const tracking = this.getModule('tracking');
        
        if (!helpers || !tracking) return;
        
        helpers.Storage.set('cookieConsent', true);
        helpers.Storage.set('analyticsConsent', analyticsAllowed);
        
        tracking.updateConsent(analyticsAllowed);
        
        const banner = document.getElementById('cookieConsent');
        if (banner) banner.style.display = 'none';
        
        const floatBtn = document.getElementById('cookieSettingsFloat');
        if (floatBtn) floatBtn.style.display = 'block';
        
        helpers.showSuccessToast('✅ Cookie preferences saved!');
    },
    
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            console.log(`✅ Modal ${modalId} opened`);
        } else {
            console.error(`❌ Modal ${modalId} not found`);
        }
    },
    
    closeModal(modalId) {
        if (!modalId) return;
        
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
            document.body.style.overflow = '';
            console.log(`✅ Modal ${modalId} closed`);
        }
    },
    
    // Fallback methods
    // UPDATE the toggleResultsMapFallback method in main.js to handle location:

    async toggleResultsMapFallback() {
        const listContainer = document.getElementById('resultsListContainer');
        const mapContainer = document.getElementById('resultsMapContainer');
        const mapBtnText = document.getElementById('resultsMapBtnText');
        
        if (mapContainer && listContainer && mapBtnText) {
            if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
                // Check for location before showing map
                if (!window.App.state.userLocation) {
                    try {
                        const modules = this.modules;
                        if (modules.search?.requestLocationWithUI) {
                            console.log('📍 Requesting location for results map...');
                            window.App.state.userLocation = await modules.search.requestLocationWithUI();
                            
                            if (modules.map?.setUserLocation) {
                                modules.map.setUserLocation(window.App.state.userLocation);
                            }
                        }
                    } catch (error) {
                        console.log('📍 User declined location or error:', error);
                    }
                }
                
                listContainer.style.display = 'none';
                mapContainer.style.display = 'block';
                mapBtnText.textContent = 'List';
            } else {
                listContainer.style.display = 'block';
                mapContainer.style.display = 'none';
                mapBtnText.textContent = 'Map';
            }
        }
    },
    
    // LEAVE the action exactly as you have it:
    'toggle-results-map': () => {
        console.log('🗺️ Toggling results map...');
        modules.map?.toggleSearchResultsFullMap?.() || this.toggleResultsMapFallback();
    },
    
    fallbackBackToResults() {
        const resultsOverlay = document.getElementById('resultsOverlay');
        const pubDetailsOverlay = document.getElementById('pubDetailsOverlay');
        if (resultsOverlay && pubDetailsOverlay) {
            pubDetailsOverlay.style.display = 'none';
            pubDetailsOverlay.classList.remove('active');
            resultsOverlay.style.display = 'flex';
            resultsOverlay.classList.add('active');
        }
    },
    
    fallbackOpenReportModal(pubData) {
        const reportModal = document.getElementById('reportModal');
        if (reportModal) {
            window.selectedPubData = pubData;
            reportModal.style.display = 'flex';
            reportModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            if (pubData?.name) {
                const modalTitle = reportModal.querySelector('.modal-title');
                if (modalTitle) {
                    modalTitle.innerHTML = `📸 Report GF Beer Find<br><small style="color: var(--text-secondary); font-weight: 400;">at ${pubData.name}</small>`;
                }
                
                const pubSearchGroup = document.getElementById('pubSearchGroup');
                if (pubSearchGroup) pubSearchGroup.style.display = 'none';
            }
        }
    },
    
    showFallback(error) {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'initialization-fallback';
        fallbackDiv.innerHTML = `
            <strong>⚠️ Loading Error</strong>
            Something went wrong. Please refresh the page.<br>
            <button onclick="location.reload()" class="fallback-btn">
                Refresh Page
            </button>
        `;
        document.body.appendChild(fallbackDiv);
        
        setTimeout(() => fallbackDiv.remove(), 10000);
    }
};

// ================================
// INITIALIZATION
// ================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.initialize());
} else {
    App.initialize();
}

// Export for global access
window.CoeliacsApp = App;
window.App = App;

console.log('🍺 Main module loaded - app will initialize when DOM ready...');
