// ================================================================================
// PWA-HANDLER.JS - Progressive Web App Installation & Management
// Simplified version - install prompts now handled by onboarding flow
// ================================================================================

class PWAHandler {
    constructor() {
        this.deferredPrompt = null;
        this.init();
    }

    init() {
        console.log('🚀 Initializing PWA Handler...');
        this.registerServiceWorker();
        this.setupInstallPrompt();
        this.handleAppInstalled();
        this.detectPWAMode();
    }

    // ================================
    // SERVICE WORKER
    // ================================
    
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('❌ Service Worker not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/static/js/service-worker.js');
            console.log('✅ Service Worker registered:', registration.scope);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
                console.log('🔄 New version available');
                const newWorker = registration.installing;
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        this.showUpdateNotification();
                    }
                });
            });
            
        } catch (error) {
            console.log('❌ Service Worker registration failed:', error);
        }
    }

    // ================================
    // INSTALL PROMPT (Android/Desktop)
    // ================================
    
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('📱 PWA install prompt available');
            
            // Prevent the mini-infobar from appearing
            e.preventDefault();
            
            // Save the event so onboarding flow can use it
            this.deferredPrompt = e;
            window.pwaHandler.deferredPrompt = e;
            
            // Don't show any automatic prompts - onboarding handles this now
        });
    }

    // ================================
    // INSTALL METHODS (called by onboarding)
    // ================================
    
    async promptInstall() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const result = await this.deferredPrompt.userChoice;
            
            console.log('📱 Install prompt result:', result.outcome);
            
            if (result.outcome === 'accepted') {
                console.log('✅ User installed the PWA');
            }
            
            this.deferredPrompt = null;
            return result.outcome;
        }
        return 'dismissed';
    }
    
    // ================================
    // DEVICE DETECTION (used by onboarding)
    // ================================
    
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    
    isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }
    
    isDesktop() {
        return !this.isIOS() && !this.isAndroid();
    }
    
    isStandalone() {
        return window.navigator.standalone || 
               window.matchMedia('(display-mode: standalone)').matches;
    }
    
    canInstall() {
        return this.deferredPrompt !== null;
    }

    // ================================
    // UPDATE NOTIFICATION
    // ================================
    
    showUpdateNotification() {
        const updateBanner = document.createElement('div');
        updateBanner.className = 'pwa-update-banner';
        updateBanner.innerHTML = `
            <strong>🚀 New version available!</strong>
            <button class="pwa-update-btn" id="update-btn">Update</button>
        `;
        
        document.body.appendChild(updateBanner);
        
        document.getElementById('update-btn').addEventListener('click', () => {
            window.location.reload();
        });
        
        setTimeout(() => updateBanner.remove(), 5000);
    }

    // ================================
    // APP INSTALLED SUCCESS
    // ================================
    
    handleAppInstalled() {
        window.addEventListener('appinstalled', () => {
            console.log('🎉 PWA was installed successfully');
            
            // Show success message
            this.showInstallSuccess();
            
            // Notify onboarding flow if it's listening
            window.dispatchEvent(new Event('pwaInstalled'));
        });
    }
    
    showInstallSuccess() {
        const successToast = document.createElement('div');
        successToast.className = 'pwa-success-toast';
        successToast.textContent = '🎉 App installed successfully!';
        
        document.body.appendChild(successToast);
        setTimeout(() => successToast.remove(), 3000);
    }

    // ================================
    // UTILITIES
    // ================================
    
    isPWA() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone ||
               document.referrer.includes('android-app://');
    }
    
    detectPWAMode() {
        if (this.isPWA()) {
            console.log('🚀 Running as PWA - enhanced features available');
            document.body.classList.add('pwa-mode');
            
            // Better location handling for PWA mode
            if ('permissions' in navigator) {
                navigator.permissions.query({name: 'geolocation'}).then(result => {
                    console.log('📍 Location permission status:', result.state);
                });
            }
        }
    }
    
    // ================================
    // RETURNING USER CHECK (for old flow compatibility)
    // ================================
    
    checkReturningUser() {
        // This is now handled differently but kept for compatibility
        // Returning users who already have the app won't see prompts
        // New users get prompts during onboarding
        return localStorage.getItem('userNickname') !== null;
    }
}

// ================================
// INITIALIZE ON LOAD
// ================================

window.addEventListener('load', () => {
    window.pwaHandler = new PWAHandler();
});

console.log('📱 PWA Handler loaded');
