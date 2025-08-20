// ================================================================================
// PWA-HANDLER.JS - Progressive Web App Installation & Management
// Handles: Service Worker, Install Prompts, iOS Guide, Updates
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
        this.checkIOSInstallGuide();
        this.handleAppInstalled();
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
            
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            
            // Save the event for later use
            this.deferredPrompt = e;
            
            // Show custom install button (only for non-iOS)
            if (!this.isIOS()) {
                this.showInstallPrompt();
            }
        });
    }

    showInstallPrompt() {
        // Don't show if dismissed this session
        if (sessionStorage.getItem('pwa-dismissed')) {
            return;
        }

        // Create install banner
        const installBanner = document.createElement('div');
        installBanner.id = 'pwa-install-banner';
        installBanner.innerHTML = `
            <div class="install-banner-content">
                <div class="install-icon">📱</div>
                <div class="install-text">
                    <strong>Install GF Beer Finder</strong>
                    <small>Get app-like experience & better location access</small>
                </div>
                <div class="install-actions">
                    <button class="btn btn-primary btn-sm" id="pwa-install-btn">Install</button>
                    <button class="btn btn-secondary btn-sm" id="pwa-dismiss-btn">×</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(installBanner);
        
        // Handle install button click
        document.getElementById('pwa-install-btn').addEventListener('click', async () => {
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                const result = await this.deferredPrompt.userChoice;
                
                console.log('📱 Install prompt result:', result.outcome);
                
                if (result.outcome === 'accepted') {
                    console.log('✅ User installed the PWA');
                }
                
                this.deferredPrompt = null;
            }
            
            installBanner.remove();
        });
        
        // Handle dismiss button
        document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
            installBanner.classList.add('removing');
            setTimeout(() => installBanner.remove(), 300);
            
            // Don't show again for this session
            sessionStorage.setItem('pwa-dismissed', 'true');
        });
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            if (document.contains(installBanner)) {
                installBanner.classList.add('removing');
                setTimeout(() => installBanner.remove(), 300);
            }
        }, 10000);
    }

    // ================================
    // iOS SPECIFIC
    // ================================
    
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    
    isStandalone() {
        return window.navigator.standalone || 
               window.matchMedia('(display-mode: standalone)').matches;
    }
    
    checkIOSInstallGuide() {
        if (this.isIOS() && !this.isStandalone()) {
            // Show after a short delay so user sees the main app first
            setTimeout(() => {
                this.showIOSInstallGuide();
            }, 3000);
        }
    }
    
    showIOSInstallGuide() {
        // Don't show if already installed or dismissed recently
        if (this.isStandalone() || sessionStorage.getItem('ios-guide-dismissed')) {
            return;
        }
        
        const guide = document.createElement('div');
        guide.id = 'ios-install-guide';
        guide.innerHTML = `
            <div class="ios-guide-content">
                <div class="ios-guide-header">
                    <div class="ios-guide-icon">📱</div>
                    <div class="ios-guide-text">
                        <strong>Install GF Beer Finder</strong>
                        <small>Get app-like experience & better location access</small>
                    </div>
                    <button class="ios-guide-close" id="ios-guide-close">×</button>
                </div>
                
                <div class="ios-guide-steps">
                    <div class="ios-step">
                        <span class="step-number">1</span>
                        <span class="step-icon">📤</span>
                        <span class="step-text">Tap the Share button below</span>
                    </div>
                    <div class="ios-step">
                        <span class="step-number">2</span>
                        <span class="step-icon">➕</span>
                        <span class="step-text">Select "Add to Home Screen"</span>
                    </div>
                    <div class="ios-step">
                        <span class="step-number">3</span>
                        <span class="step-icon">🍺</span>
                        <span class="step-text">Enjoy app-like experience!</span>
                    </div>
                </div>
                
                <div class="ios-guide-benefits">
                    <div class="benefit">⚡ Faster loading</div>
                    <div class="benefit">📍 Better location access</div>
                    <div class="benefit">🔄 Works offline</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(guide);
        
        // Handle close button
        document.getElementById('ios-guide-close').addEventListener('click', () => {
            this.dismissIOSGuide();
        });
        
        // Auto-dismiss after 15 seconds
        setTimeout(() => {
            if (document.contains(guide)) {
                this.dismissIOSGuide();
            }
        }, 15000);
    }
    
    dismissIOSGuide() {
        const guide = document.getElementById('ios-install-guide');
        if (guide) {
            guide.classList.add('removing');
            setTimeout(() => guide.remove(), 300);
        }
        
        // Don't show again for this session
        sessionStorage.setItem('ios-guide-dismissed', 'true');
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
            
            // Hide install prompt if still showing
            const banner = document.getElementById('pwa-install-banner');
            if (banner) banner.remove();
            
            // Hide iOS guide if still showing
            const guide = document.getElementById('ios-install-guide');
            if (guide) guide.remove();
            
            // Show success message
            this.showInstallSuccess();
        });
    }
    
    showInstallSuccess() {
        const successToast = document.createElement('div');
        successToast.className = 'pwa-success-toast';
        successToast.textContent = '🎉 App installed! Better location access enabled.';
        
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
}

// ================================
// INITIALIZE ON LOAD
// ================================

window.addEventListener('load', () => {
    window.pwaHandler = new PWAHandler();
});

console.log('📱 PWA Handler loaded');
