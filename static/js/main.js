// ================================================================================
// MAIN.JS - Updated to use consolidated helpers.js
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

    getForm() {
        return this.getModule('form');
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
    
    async loadPhase1() {
        console.log('🔧 Phase 1: Loading Core Utilities...');
        
        // Load consolidated helpers module
        const { HelpersModule } = await import('./helpers.js');
        this.registerModule('helpers', HelpersModule);
        
        // Legacy support - register as both ui and utils
        this.registerModule('ui', HelpersModule);
        this.registerModule('utils', HelpersModule);
        
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
        
        // Set up global functions that templates expect
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
        
        // Form submission handler
        document.addEventListener('submit', (e) => {
            // Check if it's a form with data-action
            const form = e.target;
            if (form.dataset.action) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log(`📝 Form submission: ${form.dataset.action}`);
                
                if (form.dataset.action === 'submit-report') {
                    console.log('📸 Handling beer report submission');
                    
                    // Get the form module
                    const formModule = window.App?.getModule('form') || window.FormModule;
                    
                    if (formModule && formModule.handleReportSubmission) {
                        // Call the submission handler
                        formModule.handleReportSubmission(e);
                    } else {
                        console.error('❌ Form module not available for submission');
                        // Fallback - show error
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
        // Set up functions that templates expect without circular imports
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
        
        const searchModule = this.getModule('search');
        const modalModule = this.getModule('modal');
        const helpersModule = this.getModule('helpers');
        const mapModule = this.getModule('map');
        
        switch(action) {
            case 'location-search':
                console.log('📍 Starting location search...');
                if (searchModule?.startLocationSearch) {
                    searchModule.startLocationSearch();
                }
                break;

            case 'view-details':
                console.log('🏠 Viewing pub details from map popup...');
                const pubIdFromMap = element.dataset.pubId || 
                                    element.closest('[data-pub-id]')?.dataset.pubId;
                if (pubIdFromMap && searchModule?.showPubDetails) {
                    searchModule.showPubDetails(pubIdFromMap);
                } else {
                    console.error('❌ No pub ID found or search module unavailable');
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
                console.log('🏠 Close results clicked - using centralized close function');
                if (helpersModule?.closeAllOverlaysAndGoHome) {
                    helpersModule.closeAllOverlaysAndGoHome();
                } else {
                    // Fallback
                    window.HelpersModule?.closeAllOverlaysAndGoHome?.();
                }
                break;
                
            case 'toggle-results-map':
                console.log('🗺️ Toggling results map...');
                if (mapModule?.toggleSearchResultsFullMap) {
                    mapModule.toggleSearchResultsFullMap();
                } else {
                    // Fallback implementation
                    this.toggleResultsMapFallback();
                }
                break;
            
            case 'toggle-pub-map':
                console.log('🗺️ Toggling pub detail map...');
                
                // Debug: Check all possible sources of pub data
                const currentPub = window.currentPubData || 
                                  App.state?.selectedPub || 
                                  window.selectedPubData ||
                                  App.getModule('search')?.getCurrentPub?.();
                
                console.log('🔍 Debug - Checking pub data sources:');
                console.log('  window.currentPubData:', window.currentPubData);
                console.log('  App.state.selectedPub:', App.state?.selectedPub);
                console.log('  window.selectedPubData:', window.selectedPubData);
                console.log('  Final currentPub:', currentPub);
                
                // Get the map container and button
                const mapContainer = document.getElementById('pubMapContainer');
                const mapBtnText = document.getElementById('pubMapBtnText');
                
                if (!mapContainer) {
                    console.error('❌ Map container not found');
                    break;
                }
                
                if (!mapBtnText) {
                    console.error('❌ Map button text element not found');
                    break;
                }
                
                if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
                    // Show map - activate split view
                    console.log('🗺️ Activating split-screen view...');
                    
                    mapContainer.style.display = 'block';
                    mapBtnText.textContent = 'Hide Map';
                    
                    // Add split-view class to container
                    const pubContainer = document.getElementById('pubContainer');
                    if (pubContainer) {
                        pubContainer.classList.add('split-view');
                        console.log('✅ Added split-view class');
                    }
                    
                    // Initialize the pub detail map
                    if (!currentPub) {
                        console.error('❌ No current pub data available for map');
                        // Show error in map container
                        const mapPlaceholder = mapContainer.querySelector('.pub-map-placeholder');
                        if (mapPlaceholder) {
                            mapPlaceholder.innerHTML = `
                                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                                    <div style="font-size: 2rem; margin-bottom: 10px;">❌</div>
                                    <div>No pub data available</div>
                                    <div style="font-size: 0.8rem; margin-top: 5px;">Please try refreshing the page</div>
                                </div>
                            `;
                        }
                    } else {
                        console.log('🗺️ Found pub data, initializing map for:', currentPub.name);
                        
                        if (mapModule) {
                            try {
                                if (mapModule.initPubDetailMap) {
                                    console.log('🗺️ Calling initPubDetailMap...');
                                    mapModule.initPubDetailMap(currentPub);
                                } else if (mapModule.initPubDetailsSplitMap) {
                                    console.log('🗺️ Using initPubDetailsSplitMap fallback...');
                                    mapModule.initPubDetailsSplitMap(currentPub);
                                } else {
                                    console.error('❌ No pub map initialization function found');
                                    // Fallback - show basic info
                                    const mapPlaceholder = mapContainer.querySelector('.pub-map-placeholder');
                                    if (mapPlaceholder) {
                                        if (currentPub.latitude && currentPub.longitude) {
                                            mapPlaceholder.innerHTML = `
                                                <div style="text-align: center; padding: 20px;">
                                                    <div style="font-size: 1.2rem; margin-bottom: 10px;">📍 ${currentPub.name}</div>
                                                    <div style="color: var(--text-secondary);">Lat: ${currentPub.latitude}</div>
                                                    <div style="color: var(--text-secondary);">Lng: ${currentPub.longitude}</div>
                                                    <div style="margin-top: 10px; font-size: 0.8rem;">Map function not available</div>
                                                </div>
                                            `;
                                        } else {
                                            mapPlaceholder.innerHTML = `
                                                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                                                    <div style="font-size: 2rem; margin-bottom: 10px;">📍</div>
                                                    <div>No coordinates available</div>
                                                    <div style="font-size: 0.8rem; margin-top: 5px;">for ${currentPub.name}</div>
                                                </div>
                                            `;
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error('❌ Error initializing pub map:', error);
                                const mapPlaceholder = mapContainer.querySelector('.pub-map-placeholder');
                                if (mapPlaceholder) {
                                    mapPlaceholder.innerHTML = `
                                        <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                                            <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
                                            <div>Map initialization failed</div>
                                            <div style="font-size: 0.8rem; margin-top: 5px;">${error.message}</div>
                                        </div>
                                    `;
                                }
                            }
                        } else {
                            console.error('❌ Map module not available');
                        }
                    }
                    
                    console.log('✅ Split-screen map view activated');
                } else {
                    // Hide map - return to full detail view
                    console.log('🗺️ Deactivating split-screen view...');
                    
                    mapContainer.style.display = 'none';
                    mapBtnText.textContent = 'Show on Map';
                    
                    // Remove split-view class
                    const pubContainer = document.getElementById('pubContainer');
                    if (pubContainer) {
                        pubContainer.classList.remove('split-view');
                    }
                    
                    console.log('✅ Returned to full detail view');
                }
                
                // Track the action
                if (App.getModule('tracking')) {
                    App.getModule('tracking').trackEvent('pub_map_toggle', 'Map Interaction', 
                        mapContainer.style.display === 'block' ? 'show' : 'hide');
                }
                break;
                
            case 'view-pub':
                console.log('🏠 Viewing pub details...');
                const pubId = element.dataset.pubId;
                if (pubId && searchModule?.showPubDetails) {
                    searchModule.showPubDetails(pubId);
                }
                break;
                
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

                if (helpersModule?.closeAllOverlaysAndGoHome) {
                    helpersModule.closeAllOverlaysAndGoHome();
                } else {
                    // Fallback if helpers not available
                    window.HelpersModule?.closeAllOverlaysAndGoHome?.();
                }
                break;

            case 'submit-report':
                console.log('📝 Submit report button clicked');
                
                // Find the form and submit it programmatically
                const reportForm = document.getElementById('reportForm');
                if (reportForm) {
                    // Trigger the form's submit event
                    const submitEvent = new Event('submit', {
                        bubbles: true,
                        cancelable: true
                    });
                    reportForm.dispatchEvent(submitEvent);
                    console.log('✅ Triggered form submission');
                } else {
                    console.error('❌ Report form not found');
                }
                break;

            case 'search-breweries':
                console.log('🏭 Searching breweries...');
                const breweryInput = element;
                const breweryQuery = breweryInput.value;
                
                const formModuleForBrewery = this.getModule('form');
                if (formModuleForBrewery && formModuleForBrewery.searchBreweries) {
                    formModuleForBrewery.searchBreweries(breweryQuery);
                } else {
                    console.error('❌ Form module or searchBreweries not available');
                }
                break;
            
            case 'search-beer-names':
                console.log('🍺 Searching beer names...');
                const beerInput = element;
                const beerQuery = beerInput.value;
                
                const formModuleBeer = this.getModule('form');
                if (formModuleBeer && formModuleBeer.searchBeerNames) {
                    formModuleBeer.searchBeerNames(beerQuery);
                } else {
                    console.error('❌ Form module or searchBeerNames not available');
                }
                break;
            
            case 'search-beer-styles':
                console.log('🎨 Searching beer styles...');
                const styleInput = element;
                const styleQuery = styleInput.value;
                
                const formModuleStyle = this.getModule('form');
                if (formModuleStyle && formModuleStyle.searchBeerStyles) {
                    formModuleStyle.searchBeerStyles(styleQuery);
                } else {
                    console.error('❌ Form module or searchBeerStyles not available');
                }
                break;

            case 'select-brewery':
                console.log('🏭 Selecting brewery from dropdown...');
                const brewery = element.dataset.brewery;
                
                if (brewery) {
                    const formModule = this.getModule('form');
                    if (formModule && formModule.selectBrewery) {
                        formModule.selectBrewery(brewery);
                    } else {
                        console.error('❌ Form module or selectBrewery not available');
                    }
                }
                break;

            case 'select-beer':
                console.log('🍺 Selecting beer from dropdown...');
                const beerData = element.dataset.beerData;
                
                if (beerData) {
                    const formModule = this.getModule('form');
                    if (formModule && formModule.selectBeer) {
                        formModule.selectBeer(beerData);
                    } else {
                        console.error('❌ Form module or selectBeer not available');
                    }
                }
                break;
                
            case 'close-modal':
                console.log('🔒 Closing modal...');
                const modal = element.closest('.modal, .search-modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
                break;
                
            case 'report-beer':
                console.log('📝 Report beer action triggered');
                
                // Get the current pub data
                const pubData = window.currentPubData || 
                               App.state?.selectedPub || 
                               window.selectedPubData;
                
                console.log('🔍 Current pub data for report:', pubData);
                
                // Close pub details overlay first
                const pubDetailsOverlay = document.getElementById('pubDetailsOverlay');
                if (pubDetailsOverlay) {
                    pubDetailsOverlay.style.display = 'none';
                    pubDetailsOverlay.classList.remove('active');
                    console.log('✅ Closed pub details overlay');
                }
                
                // Also close results overlay if it's open
                const resultsOverlay = document.getElementById('resultsOverlay');
                if (resultsOverlay) {
                    resultsOverlay.style.display = 'none';
                    resultsOverlay.classList.remove('active');
                    console.log('✅ Closed results overlay');
                }
                
                // Restore body scroll
                document.body.style.overflow = '';
                
                // Open report modal with pub data
                if (modalModule && modalModule.openReportModal) {
                    console.log('🔓 Opening report modal with pub data');
                    modalModule.openReportModal(pubData);
                } else {
                    console.error('❌ Modal module or openReportModal not available');
                    
                    // Fallback - try direct modal opening
                    const reportModal = document.getElementById('reportModal');
                    if (reportModal) {
                        console.log('🔓 Using fallback to open report modal');
                        
                        // Store pub data for the form
                        window.selectedPubData = pubData;
                        
                        // Show the modal
                        reportModal.style.display = 'flex';
                        reportModal.classList.add('active');
                        document.body.style.overflow = 'hidden';
                        
                        // Update modal title if we have pub data
                        if (pubData && pubData.name) {
                            const modalTitle = reportModal.querySelector('.modal-title');
                            if (modalTitle) {
                                modalTitle.innerHTML = `📸 Report GF Beer Find<br><small style="color: var(--text-secondary); font-weight: 400;">at ${pubData.name}</small>`;
                            }
                            
                            // Hide pub search field
                            const pubSearchGroup = document.getElementById('pubSearchGroup');
                            if (pubSearchGroup) {
                                pubSearchGroup.style.display = 'none';
                            }
                        }
                        
                        console.log('✅ Report modal opened via fallback');
                    } else {
                        console.error('❌ Report modal element not found');
                        alert('Sorry, the report form is not available right now. Please try again later.');
                    }
                }
                
                // Track the action
                const tracking = this.getModule('tracking');
                if (tracking) {
                    tracking.trackEvent('report_beer_click', 'User Action', pubData?.name || 'unknown_pub');
                }
                
                break;
                
            default:
                console.log(`❓ Unhandled action: ${action}`);
                break;

            // In setupEventDelegation function, add this case:
            case 'show-full-map':
                console.log('🗺️ Showing full UK map...');
                
                // Show the map overlay
                const mapOverlay = document.getElementById('fullMapOverlay');
                if (mapOverlay) {
                    mapOverlay.classList.add('active');
                    mapOverlay.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                    
                    // Initialize the map
                    const mapModule = this.getModule('map');
                    if (mapModule && mapModule.initFullUKMap) {
                        setTimeout(() => {
                            mapModule.initFullUKMap();
                        }, 100);
                    }
                    
                    // Track the action
                    const tracking = this.getModule('tracking');
                    if (tracking) {
                        tracking.trackEvent('full_map_view', 'Navigation', 'nav_bar');
                    }
                }
                break;
            
            case 'close-full-map':
                console.log('🏠 Closing full UK map...');
                
                const fullMapOverlay = document.getElementById('fullMapOverlay');
                if (fullMapOverlay) {
                    fullMapOverlay.classList.remove('active');
                    fullMapOverlay.style.display = 'none';
                    document.body.style.overflow = '';
                    
                    // Clean up map
                    const mapModule = this.getModule('map');
                    if (mapModule && mapModule.cleanupFullUKMap) {
                        mapModule.cleanupFullUKMap();
                    }
                }
                break;

            case 'change-gf-status':
                console.log('📊 Opening GF status modal...');
                
                // Use the working ModalModule instead
                const modalModule = this.getModule('modal');
                if (modalModule) {
                    modalModule.open('gfStatusModal');
                } else {
                    // Fallback
                    const modal = document.getElementById('gfStatusModal');
                    if (modal) {
                        modal.style.display = 'flex';
                        modal.style.zIndex = '100000'; // FORCE IT ABOVE EVERYTHING
                        document.body.style.overflow = 'hidden';
                    }
                }
                break;

            case 'select-status':
                console.log('📊 Status option selected');
                const status = element.dataset.status;
                
                const formModuleStatus = this.getModule('form');
                if (formModuleStatus && formModuleStatus.GFStatusFlow) {
                    formModuleStatus.GFStatusFlow.selectStatus(status);
                }
                break;
            
            case 'confirm-status':
                console.log('✅ Confirming status update');
                
                const formModuleConfirm = this.getModule('form');
                if (formModuleConfirm && formModuleConfirm.GFStatusFlow) {
                    formModuleConfirm.GFStatusFlow.confirmStatusUpdate();
                }
                break;
            
            case 'cancel-status':
                console.log('❌ Cancelling status update');
                this.closeModal('gfStatusConfirmModal');
                break;
            
            case 'skip-details':
                console.log('⏭️ Skipping beer details');
                this.closeModal('beerDetailsPromptModal');
                if (window.showSuccessToast) {
                    window.showSuccessToast('✅ Status updated successfully!');
                }
                break;
            
            case 'add-beer-details':
                console.log('📝 Adding beer details');
                this.closeModal('beerDetailsPromptModal');
                
                const modalModuleReport = this.getModule('modal');
                if (modalModuleReport) {
                    modalModuleReport.openReportModal(window.currentPubData);
                }
                break;

            case 'add-new-pub-from-results':
                console.log('➕ Adding new pub from no results');
                // Open report modal in "new pub" mode
                const modalModule = this.getModule('modal');
                if (modalModule) {
                    modalModule.openReportModal({ isNewPub: true });
                }
                break;
            
            case 'search-google-places':
                console.log('🔍 Opening places search');
                PlacesSearchModule.openPlacesSearch();
                break;
            
            case 'use-selected-place':
                console.log('✅ Using selected place');
                PlacesSearchModule.useSelectedPlace();
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
    
    handleCookieConsent(analyticsAllowed) {
        const helpers = this.getModule('helpers');
        const tracking = this.getModule('tracking');
        
        if (!helpers || !tracking) return;
        
        helpers.Storage.set('cookieConsent', true);
        helpers.Storage.set('analyticsConsent', analyticsAllowed);
        
        tracking.updateConsent(analyticsAllowed);
        
        // Hide consent banner
        const banner = document.getElementById('cookieConsent');
        if (banner) banner.style.display = 'none';
        
        // Show settings float
        const floatBtn = document.getElementById('cookieSettingsFloat');
        if (floatBtn) floatBtn.style.display = 'block';
        
        helpers.showSuccessToast('✅ Cookie preferences saved!');
    },
    
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
window.App = App; // Shorter alias

console.log('🍺 Main module loaded - app will initialize when DOM ready...');
