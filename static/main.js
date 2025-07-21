// ================================================================================
// MAIN.JS - Application Entry Point
// Initializes all modules and sets up the application
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

// Make modules globally available for inline onclick handlers
window.MapModule = MapModule;
window.APIModule = APIModule;
window.SearchModule = SearchModule;
window.ModalModule = ModalModule;
window.FormModule = FormModule;
window.UtilsModule = UtilsModule;
window.Constants = Constants;
window.TrackingModule = TrackingModule;
window.UIModule = UIModule;

// Application state
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

// Initialize application
async function initializeApp() {
    console.log('🚀 Initializing Coeliacs Like Beer Too...');
    
    try {
        // Load stats first
        await loadDashboardStats();
        
        // Check cookie consent
        checkCookieConsent();
        
        // Set up global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            TrackingModule.trackError('javascript_error', event.error.message);
        });
        
        // Mark as initialized
        AppState.initialized = true;
        console.log('✅ Application initialized successfully!');
        
        // Track page view
        TrackingModule.trackPageView('home', 'Coeliacs Like Beer Too - Home');
        
    } catch (error) {
        console.error('❌ Error initializing application:', error);
        UIModule.showToast('Error loading application. Please refresh.', 'error');
    }
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

// Global functions that need to be available for onclick handlers
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
