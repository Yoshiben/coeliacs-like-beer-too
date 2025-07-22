// ================================================================================
// MAIN.JS - Fixed Circular Dependencies with Event Bus Pattern
// REPLACE: Your existing main.js entirely
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
    
    // Register module without circular imports
    registerModule(name, module) {
        this.modules[name] = module;
        this.events.emit('module-registered', { name, module });
    },
    
    // Get module safely
    getModule(name) {
        return this.modules[name] || null;
    },
    
    // Initialize app in phases
    async initialize() {
        console.log('🚀 Initializing App with Event Bus Pattern...');
        
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
    
    // 🔧 ADD MISSING COMMA here if needed
    async loadPhase1() {
        console.log('🔧 Phase 1: Loading Core Utilities...');
        
        const { UtilsModule } = await import('./utils.js');
        this.registerModule('utils', UtilsModule);
        
        // Make essential utils globally available
        window.showLoadingToast = UtilsModule.showLoadingToast;
        window.hideLoadingToast = UtilsModule.hideLoadingToast;
        window.showSuccessToast = UtilsModule.showSuccessToast;
        window.animateNumber = UtilsModule.animateNumber;
    },
    
    // 🔧 ADD MISSING COMMA here if needed
    async loadPhase2() {
        console.log('🔧 Phase 2: Loading Data Layer...');
        
        const { APIModule } = await import('./api.js');
        const { TrackingModule } = await import('./tracking.js');
        
        this.registerModule('api', APIModule);
        this.registerModule('tracking', TrackingModule);
        
        // Load initial stats
        await this.loadStats();
    },
    
    // 🔧 ADD MISSING COMMA here if needed
    async loadPhase3() {
        console.log('🔧 Phase 3: Loading UI Layer...');
        
        const { UIModule } = await import('./ui.js');
        const { ModalModule } = await import('./modals.js');
        
        this.registerModule('ui', UIModule);
        this.registerModule('modal', ModalModule);
        
        // Set up UI event delegation
        this.setupEventDelegation();
    },
    
    // 🔧 ADD MISSING COMMA here if needed
    async loadPhase4() {
        console.log('🔧 Phase 4: Loading Features...');
        
        const { MapModule } = await import('./map.js');
        const { SearchModule } = await import('./search.js');
        const { FormModule } = await import('./forms.js');
        
        this.registerModule('map', MapModule);
        this.registerModule('search', SearchModule);
        this.registerModule('form', FormModule);
        
        // Set up global functions that templates expect
        this.setupGlobalFunctions();
    },
    
    // 🔧 ADD MISSING COMMA here if needed
    async loadStats() {
        try {
            const api = this.getModule('api');
            if (!api) return;
            
            const stats = await api.getStats();
            const utils = this.getModule('utils');
            
            if (utils) {
                utils.animateNumber('totalPubs', stats.total_pubs);
                utils.animateNumber('gfPubs', stats.gf_pubs);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    },
    
    // 🔧 ADD MISSING COMMA here if needed
    setupEventDelegation() {
        console.log('🔧 Setting up fixed event delegation...');
        
        // Handle all data-* attributes in one place with proper event capture
        document.addEventListener('click', (e) => {
            // Find the closest element with a data-action attribute
            const target = e.target.closest('[data-action], [data-modal], [data-distance]');
            if (!target) return;
            
            // Prevent default for all handled actions
            e.preventDefault();
            e.stopPropagation();
            
            console.log('🎯 Event delegation caught:', target.dataset);
            
            // Modal triggers
            if (target.dataset.modal) {
                const modalId = target.dataset.modal;
                console.log(`🔓 Opening modal: ${modalId}`);
                
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.style.display = 'flex';
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                    console.log(`✅ Modal ${modalId} opened successfully`);
                } else {
                    console.error(`❌ Modal ${modalId} not found in DOM`);
                }
            }
            
            // Action handlers
            if (target.dataset.action) {
                console.log(`🎬 Handling action: ${target.dataset.action}`);
                this.handleAction(target.dataset.action, target, e);
            }
            
            // Distance selection
            if (target.dataset.distance) {
                const distance = parseInt(target.dataset.distance);
                console.log(`📍 Distance selected: ${distance}km`);
                this.handleDistanceSelection(distance);
            }
        }, true); // Use capture phase to ensure we catch all events
        
        // Modal close handlers with higher specificity
        document.addEventListener('click', (e) => {
            // Close on backdrop click
            if (e.target.classList.contains('modal') || 
                e.target.classList.contains('search-modal') ||
                e.target.classList.contains('results-overlay')) {
                
                const modal = e.target;
                console.log(`🔒 Backdrop click detected on: ${modal.id}`);
                this.closeModal(modal.id);
            }
            
            // Close on close button click
            if (e.target.classList.contains('modal-close') || 
                e.target.closest('.modal-close') ||
                e.target.dataset.action === 'close-modal') {
                
                const modal = e.target.closest('.modal, .search-modal, .results-overlay');
                if (modal) {
                    console.log(`🔒 Close button clicked for: ${modal.id}`);
                    this.closeModal(modal.id);
                }
            }
        });
        
        // Escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal[style*="display: flex"], .modal.active');
                if (openModals.length > 0) {
                    const lastModal = openModals[openModals.length - 1];
                    console.log(`⌨️ Escape pressed - closing: ${lastModal.id}`);
                    this.closeModal(lastModal.id);
                }
            }
        });
        
        console.log('✅ Event delegation setup complete');
    },
    
    // 🔧 ADD MISSING COMMA here if needed
    setupGlobalFunctions() {
        // Set up functions that templates expect without circular imports
        window.closeResults = () => this.getModule('ui')?.closeResults?.();
        window.showPubDetails = (pubId) => this.getModule('search')?.showPubDetails?.(pubId);
        window.toggleSearchResultsFullMap = () => this.getModule('map')?.toggleSearchResultsFullMap?.();
        window.closePubDetails = () => this.getModule('ui')?.closePubDetails?.();
        
        // Cookie functions
        window.acceptAllCookies = () => this.handleCookieConsent(true);
        window.acceptEssentialOnly = () => this.handleCookieConsent(false);
    },
    
    handleAction(action, element, event) {
        console.log(`🎬 Processing action: ${action}`);
        
        const searchModule = this.getModule('search');
        const modalModule = this.getModule('modal');
        const uiModule = this.getModule('ui');
        
        switch(action) {
            case 'location-search':
                console.log('📍 Starting location search...');
                if (searchModule?.startLocationSearch) {
                    searchModule.startLocationSearch();
                }
                break;
                
            case 'search-name':
                console.log('🔍 Performing name search...');
                if (searchModule?.searchByName) {
                    searchModule.searchByName();
                }
                break;
                
            case 'search-area':
                console.log('🔍 Performing area search...');
                if (searchModule?.searchByArea) {
                    searchModule.searchByArea();
                }
                break;
                
            case 'search-beer':
                console.log('🔍 Performing beer search...');
                if (searchModule?.searchByBeer) {
                    searchModule.searchByBeer();
                }
                break;
                
            case 'close-results':
                console.log('🏠 Closing results overlay...');
                if (uiModule?.closeResults) {
                    uiModule.closeResults();
                } else {
                    // Fallback
                    window.closeResults?.();
                }
                break;
                
            case 'toggle-results-map':
                console.log('🗺️ MAIN.JS: Enhanced map toggle handler...');
                
                // 🔧 FIX: Prevent any split-view classes from being applied
                const resultsOverlay = document.getElementById('resultsOverlay');
                const mapContainer = document.getElementById('resultsMapContainer');
                const listContainer = document.getElementById('resultsListContainer');
                
                // Remove split-view classes that might interfere
                if (resultsOverlay) resultsOverlay.classList.remove('split-view');
                if (mapContainer) mapContainer.classList.remove('split-view');
                
                // Check current state and toggle
                const isMapCurrentlyVisible = mapContainer && mapContainer.style.display === 'block';
                
                console.log('🔍 Current state:', {
                    mapVisible: isMapCurrentlyVisible,
                    mapDisplay: mapContainer?.style.display,
                    listDisplay: listContainer?.style.display
                });
                
                // Get the map module
                const mapModule = this.getModule('map');
                if (mapModule && mapModule.toggleSearchResultsFullMap) {
                    console.log('🗺️ Using map module toggle function');
                    mapModule.toggleSearchResultsFullMap();
                } else {
                    console.log('🔧 Using fallback map toggle');
                    
                    // Fallback implementation with enhanced debugging
                    if (mapContainer && listContainer) {
                        const mapBtnText = document.getElementById('resultsMapBtnText');
                        
                        if (!isMapCurrentlyVisible) {
                            // Show FULL-SCREEN map
                            console.log('🗺️ Activating FULL-SCREEN map mode...');
                            
                            listContainer.style.display = 'none';
                            mapContainer.style.display = 'block';
                            mapContainer.style.flex = '1';
                            mapContainer.style.height = '100%';
                            
                            if (mapBtnText) mapBtnText.textContent = 'List';
                            
                            // Force map initialization
                            setTimeout(() => {
                                if (mapModule && mapModule.initResultsMap) {
                                    console.log('🔄 Force-initializing results map...');
                                    const searchModule = this.getModule('search');
                                    const pubs = searchModule?.getCurrentResults() || [];
                                    mapModule.initResultsMap(pubs);
                                }
                            }, 150);
                            
                        } else {
                            // Show list
                            console.log('📋 Activating list mode...');
                            
                            listContainer.style.display = 'block';
                            mapContainer.style.display = 'none';
                            
                            if (mapBtnText) mapBtnText.textContent = 'Map';
                        }
                        
                        console.log('✅ Map toggle completed via fallback');
                    }
                }
                
                // Track the toggle
                const tracking = this.getModule('tracking');
                if (tracking) {
                    const newState = mapContainer?.style.display === 'block' ? 'show_fullscreen' : 'show_list';
                    tracking.trackEvent('map_toggle_enhanced', 'Map Interaction', newState);
                }
                
                break;
                
            case 'view-pub':
                console.log('🏠 Viewing pub details...');
                const pubId = element.dataset.pubId;
                if (pubId && searchModule?.showPubDetails) {
                    searchModule.showPubDetails(pubId);
                }
                break;
                
            // 🔧 ADD: Missing back-to-results case
            case 'back-to-results':
                console.log('🔙 Going back to results...');
                if (searchModule?.goBackToResults) {
                    searchModule.goBackToResults();
                } else {
                    console.error('❌ Search module goBackToResults not available');
                    // Fallback - try to show results overlay
                    const resultsOverlay = document.getElementById('resultsOverlay');
                    const pubDetailsOverlay = document.getElementById('pubDetailsOverlay');
                    if (resultsOverlay && pubDetailsOverlay) {
                        pubDetailsOverlay.style.display = 'none';
                        pubDetailsOverlay.classList.remove('active');
                        resultsOverlay.style.display = 'flex';
                        resultsOverlay.classList.add('active');
                    }
                }
                break;
                
            case 'close-pub-details':
                console.log('🏠 Closing pub details and going home...');
                
                // Prevent any other close actions from running
                event.stopPropagation();
                event.preventDefault();

                const utils = this.getModule('utils');
                if (utils?.closeAllOverlaysAndGoHome) {
                    utils.closeAllOverlaysAndGoHome();
                } else {
                    // Fallback if utils not available
                    window.UtilsModule?.closeAllOverlaysAndGoHome?.();
                }
                break;
                
                // Close pub details overlay first
                const pubDetailsOverlay = document.getElementById('pubDetailsOverlay');
                if (pubDetailsOverlay && pubDetailsOverlay.classList.contains('active')) {
                    pubDetailsOverlay.style.display = 'none';
                    pubDetailsOverlay.classList.remove('active');
                    console.log('✅ Pub details overlay closed');
                }
                
                // Close results overlay too (if it exists)
                const resultsOverlay = document.getElementById('resultsOverlay');
                if (resultsOverlay && resultsOverlay.classList.contains('active')) {
                    resultsOverlay.style.display = 'none';
                    resultsOverlay.classList.remove('active');
                    console.log('✅ Results overlay also closed');
                }
                
                // Show home sections
                const heroSection = document.querySelector('.hero-section');
                const searchSection = document.querySelector('.search-section');
                if (heroSection) {
                    heroSection.style.display = 'block';
                    console.log('✅ Hero section restored');
                }
                if (searchSection) {
                    searchSection.style.display = 'flex';
                    console.log('✅ Search section restored');
                }
                
                // Restore body scroll
                document.body.style.overflow = '';
                
                // Update app state
                this.state.currentView = 'home';
                
                // Track the action
                const tracking = this.getModule('tracking');
                if (tracking) {
                    tracking.trackEvent('close_pub_details', 'Navigation', 'home_button');
                }
                
                console.log('✅ Returned to home view');
                break;

            case 'close-results':
                console.log('🏠 Close results clicked - using centralized close function');
                
                const utilsModule = this.getModule('utils');
                if (utilsModule?.closeAllOverlaysAndGoHome) {
                    utilsModule.closeAllOverlaysAndGoHome();
                } else {
                    // Fallback
                    window.UtilsModule?.closeAllOverlaysAndGoHome?.();
                }
                break;
                
            case 'close-modal':
                console.log('🔒 Closing modal...');
                const modal = element.closest('.modal, .search-modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
                break;
                
            default:
                console.log(`❓ Unhandled action: ${action}`);
                break;
        }
    },
    
    handleDistanceSelection(distance) {
        console.log(`📍 Distance ${distance}km selected`);
        
        // CLOSE the distance modal first
        const modalModule = this.getModule('modal');
        if (modalModule) {
            modalModule.close('distanceModal');
        } else {
            // Fallback close
            const modal = document.getElementById('distanceModal');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        }
        
        // Then start the search
        const search = this.getModule('search');
        if (search) {
            search.searchNearbyWithDistance(distance);
        } else {
            console.error('❌ Search module not available');
        }
    },
    
    // 🔧 ADD MISSING COMMA here if needed
    handleCookieConsent(analyticsAllowed) {
        const utils = this.getModule('utils');
        const tracking = this.getModule('tracking');
        
        if (!utils || !tracking) return;
        
        utils.Storage.set('cookieConsent', true);
        utils.Storage.set('analyticsConsent', analyticsAllowed);
        
        tracking.updateConsent(analyticsAllowed);
        
        // Hide consent banner
        const banner = document.getElementById('cookieConsent');
        if (banner) banner.style.display = 'none';
        
        // Show settings float
        const floatBtn = document.getElementById('cookieSettingsFloat');
        if (floatBtn) floatBtn.style.display = 'block';
        
        utils.showSuccessToast('✅ Cookie preferences saved!');
    },
    
    // 🔧 ADD MISSING COMMA here if needed
    toggleResultsMapFallback() {
        const listContainer = document.getElementById('resultsListContainer');
        const mapContainer = document.getElementById('resultsMapContainer');
        const mapBtnText = document.getElementById('resultsMapBtnText');
        
        if (mapContainer && listContainer && mapBtnText) {
            if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
                // Show map
                listContainer.style.display = 'none';
                mapContainer.style.display = 'block';
                mapBtnText.textContent = 'List';
                console.log('✅ Map view activated (fallback)');
            } else {
                // Show list
                listContainer.style.display = 'block';
                mapContainer.style.display = 'none';
                mapBtnText.textContent = 'Map';
                console.log('✅ List view activated (fallback)');
            }
        }
    },
    
    // 🔧 ADD MISSING COMMA here if needed
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
    
    // 🔧 ENSURE THIS HAS A COMMA if there are more methods after it
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
    
    // 🔧 MAKE SURE: No comma after the last method in the object
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
window.App = App; // Shorter alias

console.log('🍺 Main module loaded - app will initialize when DOM ready...');
