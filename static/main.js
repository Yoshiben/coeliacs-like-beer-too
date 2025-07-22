// ================================================================================
// MAIN.JS - Centralized Application Entry Point
// Handles proper module loading order and initialization
// ================================================================================

import { MapModule } from './map.js';
import { APIModule } from './api.js';
import { SearchModule } from './search.js';
import { ModalModule } from './modals.js';
import { FormModule } from './forms.js';
import { UtilsModule } from './utils.js';
import { Constants } from './constants.js';
import { TrackingModule } from './tracking.js';
import { UIModule } from './ui.js';

// Application state with initialization tracking
const AppState = {
    initialized: false,
    modules: {
        map: false,
        api: false,
        search: false,
        modal: false,
        form: false,
        utils: false,
        tracking: false,
        ui: false
    }
};

// Global namespace to prevent conflicts
window.CoeliacsApp = {
    modules: {},
    state: AppState,
    initialized: false
};

// Initialize application with proper dependency order
async function initializeApp() {
    console.log('🚀 Initializing Coeliacs Like Beer Too...');
    
    try {
        // Phase 1: Core utilities first (no dependencies)
        await initializeUtilities();
        
        // Phase 2: API and data layer
        await initializeDataLayer();
        
        // Phase 3: UI and interaction modules
        await initializeUILayer();
        
        // Phase 4: Feature modules that depend on others
        await initializeFeatureLayer();
        
        // Phase 5: Final setup
        await finalizeInitialization();
        
        // Mark as fully initialized
        AppState.initialized = true;
        window.CoeliacsApp.initialized = true;
        
        console.log('✅ Application initialized successfully!');
        
        // Track successful initialization
        TrackingModule.trackPageView('home', 'Coeliacs Like Beer Too - Home');
        
    } catch (error) {
        console.error('❌ Error initializing application:', error);
        showFallbackError(error);
    }
}

// Phase 1: Initialize utilities (no dependencies)
async function initializeUtilities() {
    console.log('🔧 Phase 1: Initializing utilities...');
    
    // Utils has no dependencies - safe to initialize first
    UtilsModule.init?.();
    AppState.modules.utils = true;
    
    // Make utilities globally available
    window.CoeliacsApp.modules.utils = UtilsModule;
    window.showLoadingToast = UtilsModule.showLoadingToast;
    window.hideLoadingToast = UtilsModule.hideLoadingToast;
    window.showSuccessToast = UtilsModule.showSuccessToast;
    window.animateNumber = UtilsModule.animateNumber;
    
    console.log('✅ Phase 1 complete');
}

// Phase 2: Initialize data layer
async function initializeDataLayer() {
    console.log('🔧 Phase 2: Initializing data layer...');
    
    // API module (no dependencies)
    APIModule.init?.();
    AppState.modules.api = true;
    window.CoeliacsApp.modules.api = APIModule;
    
    // Tracking module (no dependencies)
    TrackingModule.init?.();
    AppState.modules.tracking = true;
    window.CoeliacsApp.modules.tracking = TrackingModule;
    
    // Load initial stats
    await loadDashboardStats();
    
    console.log('✅ Phase 2 complete');
}

// Phase 3: Initialize UI layer
async function initializeUILayer() {
    console.log('🔧 Phase 3: Initializing UI layer...');
    
    // UI Module (depends on Utils)
    UIModule.init?.();
    AppState.modules.ui = true;
    window.CoeliacsApp.modules.ui = UIModule;
    window.closeResults = UIModule.closeResults;
    
    // Modal Module (depends on UI, Utils)
    ModalModule.init?.();
    AppState.modules.modal = true;
    window.CoeliacsApp.modules.modal = ModalModule;
    window.updateAreaPlaceholder = ModalModule.updateAreaPlaceholder;
    window.updateBeerPlaceholder = ModalModule.updateBeerPlaceholder;
    
    console.log('✅ Phase 3 complete');
}

// Phase 4: Initialize feature layer
async function initializeFeatureLayer() {
    console.log('🔧 Phase 4: Initializing feature layer...');
    
    // Map Module (depends on UI)
    MapModule.init?.();
    AppState.modules.map = true;
    window.CoeliacsApp.modules.map = MapModule;
    window.toggleSearchResultsFullMap = MapModule.toggleSearchResultsFullMap;
    
    // Form Module (depends on Modal, API)
    FormModule.init?.();
    AppState.modules.form = true;
    window.CoeliacsApp.modules.form = FormModule;
    
    // Search Module (depends on API, Map, Modal, UI)
    SearchModule.init?.();
    AppState.modules.search = true;
    window.CoeliacsApp.modules.search = SearchModule;
    window.closeSearchModal = SearchModule.closeSearchModal;
    window.showPubDetails = SearchModule.showPubDetails;
    
    console.log('✅ Phase 4 complete');
}

// Phase 5: Final setup
async function finalizeInitialization() {
    console.log('🔧 Phase 5: Finalizing...');
    
    // Check cookie consent
    checkCookieConsent();
    
    // Set up global error handler
    setupGlobalErrorHandler();
    
    // Initialize event delegation
    setupGlobalEventHandlers();
    
    console.log('✅ Phase 5 complete');
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const stats = await APIModule.getStats();
        
        // Animate numbers
        UtilsModule.animateNumber('totalPubs', stats.total_pubs);
        UtilsModule.animateNumber('gfPubs', stats.gf_pubs);
        
        console.log('📊 Stats loaded:', stats);
    } catch (error) {
        console.error('❌ Error loading stats:', error);
        // Use fallback values
        UtilsModule.animateNumber('totalPubs', Constants.DEFAULTS.TOTAL_PUBS);
        UtilsModule.animateNumber('gfPubs', Constants.DEFAULTS.GF_PUBS);
    }
}

// Check cookie consent
function checkCookieConsent() {
    const consent = UtilsModule.Storage.get('cookieConsent');
    const analyticsConsent = UtilsModule.Storage.get('analyticsConsent');
    
    if (!consent) {
        setTimeout(() => {
            UIModule.setElementVisibility('cookieConsent', true);
        }, 1000);
    } else {
        UIModule.setElementVisibility('cookieSettingsFloat', true);
        
        if (analyticsConsent === true) {
            TrackingModule.updateConsent(true);
        }
    }
}

// Global error handler
function setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        TrackingModule.trackError('javascript_error', event.error.message);
        
        // Show user-friendly message for critical errors
        if (event.error && event.error.message.includes('Module')) {
            showFallbackError(event.error);
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        TrackingModule.trackError('promise_rejection', event.reason.toString());
        event.preventDefault();
    });
}

// Centralized event delegation
function setupGlobalEventHandlers() {
    // Handle data-modal attributes
    document.addEventListener('click', (e) => {
        const modalTrigger = e.target.closest('[data-modal]');
        if (modalTrigger) {
            e.preventDefault();
            const modalId = modalTrigger.dataset.modal;
            ModalModule.open(modalId);
        }
    });
    
    // Handle data-action attributes
    document.addEventListener('click', (e) => {
        const actionTrigger = e.target.closest('[data-action]');
        if (actionTrigger) {
            e.preventDefault();
            const action = actionTrigger.dataset.action;
            handleGlobalAction(action, actionTrigger);
        }
    });
    
    // Handle distance options
    document.addEventListener('click', (e) => {
        const distanceOption = e.target.closest('[data-distance]');
        if (distanceOption) {
            const distance = parseInt(distanceOption.dataset.distance);
            SearchModule.searchNearbyWithDistance(distance);
        }
    });
    
    // Handle form submissions
    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (form.dataset.action === 'submit-report') {
            e.preventDefault();
            FormModule.handleReportSubmission(e);
        }
    });
}

// Handle global actions
function handleGlobalAction(action, element) {
    switch(action) {
        case 'location-search':
            SearchModule.startLocationSearch();
            break;
        case 'search-name':
            SearchModule.searchByName();
            break;
        case 'search-area':
            SearchModule.searchByArea();
            break;
        case 'search-beer':
            SearchModule.searchByBeer();
            break;
        case 'close-modal':
            const modal = element.closest('.modal, .search-modal');
            if (modal && modal.id) {
                ModalModule.close(modal.id);
            }
            break;
        case 'report-beer':
            if (window.currentPubData) {
                ModalModule.openReportModal(window.currentPubData);
            } else {
                ModalModule.openReportModal();
            }
            break;
        case 'accept-all-cookies':
            acceptAllCookies();
            break;
        case 'accept-essential-cookies':
            acceptEssentialOnly();
            break;
        case 'close-pub-details':
            closePubDetails();
            break;
        case 'back-to-results':
            SearchModule.goBackToResults();
            break;
        case 'toggle-pub-map':
            togglePubDetailsSplitMap();
            break;
        case 'close-results':
            UIModule.closeResults();
            break;
        case 'toggle-results-map':
            MapModule.toggleSearchResultsFullMap();
            break;
        case 'view-pub':
            const pubId = element.dataset.pubId;
            SearchModule.showPubDetails(pubId);
            break;
        case 'update-area-placeholder':
            ModalModule.updateAreaPlaceholder();
            break;
        case 'update-beer-placeholder':
            ModalModule.updateBeerPlaceholder();
            break;
    }
}

// Show fallback error message
function showFallbackError(error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 9999;
        font-family: system-ui;
    `;
    errorDiv.innerHTML = `
        <strong>⚠️ Loading Error</strong><br>
        Something went wrong. Please refresh the page.<br>
        <button onclick="location.reload()" style="background: white; color: #ef4444; border: none; padding: 4px 8px; border-radius: 4px; margin-top: 8px;">
            Refresh Page
        </button>
    `;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 10000);
}

// Cookie functions (global scope needed)
window.acceptAllCookies = function() {
    UtilsModule.Storage.set('cookieConsent', true);
    UtilsModule.Storage.set('analyticsConsent', true);
    UIModule.setElementVisibility('cookieConsent', false);
    UIModule.setElementVisibility('cookieSettingsFloat', true);
    TrackingModule.updateConsent(true);
    UtilsModule.showSuccessToast('✅ Cookie preferences saved. Thanks!');
};

window.acceptEssentialOnly = function() {
    UtilsModule.Storage.set('cookieConsent', true);
    UtilsModule.Storage.set('analyticsConsent', false);
    UIModule.setElementVisibility('cookieConsent', false);
    UIModule.setElementVisibility('cookieSettingsFloat', true);
    UtilsModule.showSuccessToast('✅ Essential cookies only. You can change this anytime.');
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Export for debugging
window.AppState = AppState;
