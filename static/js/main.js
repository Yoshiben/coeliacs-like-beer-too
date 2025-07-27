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
    
    setupEventDelegation() {
        console.log('🔧 Setting up event delegation...');
        
        // Main click handler
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action], [data-modal], [data-distance]');
            if (!target) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            // Modal triggers
            if (target.dataset.modal) {
                this.openModal(target.dataset.modal);
            }
            
            // Action handlers
            if (target.dataset.action) {
                this.handleAction(target.dataset.action, target, e);
            }
            
            // Distance selection
            if (target.dataset.distance) {
                this.handleDistanceSelection(parseInt(target.dataset.distance));
            }
        }, true);
        
        // Modal close handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') || 
                e.target.classList.contains('search-modal') ||
                e.target.classList.contains('results-overlay')) {
                this.closeModal(e.target.id);
            }
            
            if (e.target.classList.contains('modal-close') || 
                e.target.closest('.modal-close') ||
                e.target.dataset.action === 'close-modal') {
                const modal = e.target.closest('.modal, .search-modal, .results-overlay');
                if (modal) this.closeModal(modal.id);
            }
        });
        
        // Escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal[style*="display: flex"], .modal.active');
                if (openModals.length > 0) {
                    this.closeModal(openModals[openModals.length - 1].id);
                }
            }
        });
        
        // Form submission handler
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.dataset.action) {
                e.preventDefault();
                e.stopPropagation();
                
                if (form.dataset.action === 'submit-report') {
                    const formModule = this.getModule('form');
                    if (formModule?.handleReportSubmission) {
                        formModule.handleReportSubmission(e);
                    } else {
                        console.error('❌ Form module not available');
                        if (window.showSuccessToast) {
                            window.showSuccessToast('❌ Unable to submit report. Please try again.');
                        }
                    }
                }
            }
        });
        
        console.log('✅ Event delegation setup complete');
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
    
    showFullMap(modules) {
        console.log('🗺️ Showing full UK map...');
        const mapOverlay = document.getElementById('fullMapOverlay');
        if (mapOverlay) {
            mapOverlay.classList.add('active');
            mapOverlay.style.display = 'flex';  // Force display
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
    toggleResultsMapFallback() {
        const listContainer = document.getElementById('resultsListContainer');
        const mapContainer = document.getElementById('resultsMapContainer');
        const mapBtnText = document.getElementById('resultsMapBtnText');
        
        if (mapContainer && listContainer && mapBtnText) {
            if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
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
