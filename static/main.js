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
        
        const { UIModule } = await import('./ui.js');
        const { ModalModule } = await import('./modals.js');
        
        this.registerModule('ui', UIModule);
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
            const utils = this.getModule('utils');
            
            if (utils) {
                utils.animateNumber('totalPubs', stats.total_pubs);
                utils.animateNumber('gfPubs', stats.gf_pubs);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    },
    
    setupEventDelegation() {
        console.log('🔧 Setting up fixed event delegation...');
        
        // Handle all data-* attributes in one place
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action], [data-modal], [data-distance]');
            if (!target) return;
            
            // Modal triggers - FIXED
            if (target.dataset.modal) {
                e.preventDefault();
                const modalId = target.dataset.modal;
                console.log(`🔓 Opening modal: ${modalId}`);
                
                const modal = document.getElementById(modalId);
                if (modal) {
                    // Force proper display
                    modal.style.display = 'flex';
                    modal.classList.add('active'); // For CSS targeting
                    document.body.style.overflow = 'hidden'; // Prevent background scroll
                    
                    console.log(`✅ Modal ${modalId} opened successfully`);
                } else {
                    console.error(`❌ Modal ${modalId} not found in DOM`);
                }
            }
            
            // Action handlers - FIXED
            if (target.dataset.action) {
                e.preventDefault();
                this.handleAction(target.dataset.action, target);
            }
            
            // Distance selection - FIXED
            if (target.dataset.distance) {
                const distance = parseInt(target.dataset.distance);
                this.handleDistanceSelection(distance);
            }
        });
        
        // Modal close handlers - FIXED
        document.addEventListener('click', (e) => {
            // Close on backdrop click
            if (e.target.classList.contains('modal') || e.target.classList.contains('search-modal')) {
                const modal = e.target;
                this.closeModal(modal.id);
            }
            
            // Close on close button click
            if (e.target.classList.contains('modal-close') || 
                e.target.closest('.modal-close') ||
                e.target.dataset.action === 'close-modal') {
                const modal = e.target.closest('.modal, .search-modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            }
        });
        
        // Escape key handler - FIXED
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close the topmost modal
                const openModals = document.querySelectorAll('.modal[style*="display: flex"], .modal.active');
                if (openModals.length > 0) {
                    const lastModal = openModals[openModals.length - 1];
                    this.closeModal(lastModal.id);
                }
            }
        });
    },
    
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
    
    // Event handlers without circular dependencies
    handleModalTrigger(modalId) {
        const modal = this.getModule('modal');
        if (modal) {
            modal.open(modalId);
        }
    },
    
    handleAction(action, element) {
        const searchModule = this.getModule('search');
        const modalModule = this.getModule('modal');
        
        switch(action) {
            case 'location-search':
                searchModule?.startLocationSearch?.();
                break;
            case 'search-name':
                modalModule?.openSearchModal?.('name');
                break;
            case 'search-area':
                modalModule?.openSearchModal?.('area');
                break;
            case 'search-beer':
                modalModule?.openSearchModal?.('beer');
                break;
            case 'view-pub':
                const pubId = element.dataset.pubId;
                searchModule?.showPubDetails?.(pubId);
                break;
            // Add more actions as needed
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
    
    handleFormSubmission(e) {
        const form = this.getModule('form');
        if (form) {
            form.handleReportSubmission(e);
        }
    },
    
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
