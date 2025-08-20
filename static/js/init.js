// ================================================================================
// INIT.JS - App Initialization & Legacy Handlers
// Handles: Photo uploads, performance monitoring, app initialization checks
// ================================================================================

class AppInitializer {
    constructor() {
        this.setupEventHandlers();
        this.checkAppStatus();
        this.monitorPerformance();
        this.logDebugInfo();
    }

    // ================================
    // EVENT HANDLERS
    // ================================
    
    setupEventHandlers() {
        console.log('🔧 Setting up legacy event handlers...');
        
        // Photo upload handler
        this.setupPhotoUpload();
        
        // Other legacy handlers can be added here
    }

    setupPhotoUpload() {
        const photoInput = document.getElementById('reportPhoto');
        const photoLabel = document.querySelector('.photo-upload-compact');
        
        if (!photoInput || !photoLabel) return;
        
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const fileName = file.name.length > 20 ? 
                file.name.substring(0, 17) + '...' : 
                file.name;
            
            const textEl = photoLabel.querySelector('.photo-upload-text');
            if (textEl) {
                textEl.innerHTML = `<strong>📸 ${fileName}</strong><br><small>Click to change photo</small>`;
            }
            photoLabel.classList.add('active');
        });
    }

    // ================================
    // APP STATUS CHECK
    // ================================
    
    checkAppStatus() {
        // Check if main app initialized properly after 3 seconds
        setTimeout(() => {
            if (!window.CoeliacsApp?.initialized) {
                console.warn('⚠️ App initialization may have failed');
                this.handleInitializationFailure();
            } else {
                console.log('✅ App initialized successfully');
            }
        }, 3000);
    }

    handleInitializationFailure() {
        // Could show a user-friendly error or attempt recovery
        // For now just log
        console.error('App failed to initialize properly');
        
        // Check for common issues
        if (!window.APP_CONFIG) {
            console.error('APP_CONFIG not found - template variables may not be loading');
        }
        
        if (typeof mapboxgl === 'undefined' && document.getElementById('fullMap')) {
            console.error('Mapbox GL not loaded but map element exists');
        }
    }

    // ================================
    // PERFORMANCE MONITORING
    // ================================
    
    monitorPerformance() {
        if (!performance || !performance.timing) return;
        
        window.addEventListener('load', () => {
            setTimeout(() => {
                const timing = performance.timing;
                
                // Ensure we have valid timing data
                if (timing.loadEventEnd > 0 && timing.navigationStart > 0) {
                    const metrics = this.calculateMetrics(timing);
                    this.logPerformanceMetrics(metrics);
                    
                    // Send to analytics if enabled
                    if (window.gtag && this.hasAnalyticsConsent()) {
                        this.sendMetricsToAnalytics(metrics);
                    }
                }
            }, 100);
        });
    }

    calculateMetrics(timing) {
        return {
            // Total page load time
            loadTime: timing.loadEventEnd - timing.navigationStart,
            
            // Time to first byte
            ttfb: timing.responseStart - timing.navigationStart,
            
            // DOM processing time
            domProcessing: timing.domComplete - timing.domLoading,
            
            // Resource load time
            resourceLoad: timing.loadEventEnd - timing.responseEnd,
            
            // DNS lookup time
            dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
            
            // TCP connection time
            tcpConnect: timing.connectEnd - timing.connectStart
        };
    }

    logPerformanceMetrics(metrics) {
        console.group('⚡ Performance Metrics');
        console.log(`Page Load: ${metrics.loadTime}ms`);
        console.log(`TTFB: ${metrics.ttfb}ms`);
        console.log(`DOM Processing: ${metrics.domProcessing}ms`);
        console.log(`Resource Load: ${metrics.resourceLoad}ms`);
        console.log(`DNS Lookup: ${metrics.dnsLookup}ms`);
        console.log(`TCP Connect: ${metrics.tcpConnect}ms`);
        console.groupEnd();
        
        // Warn if page is slow
        if (metrics.loadTime > 5000) {
            console.warn('⚠️ Page load time is high (>5s). Consider optimization.');
        }
    }

    sendMetricsToAnalytics(metrics) {
        try {
            // Send custom events to Google Analytics
            gtag('event', 'performance', {
                'event_category': 'Performance',
                'event_label': 'Page Load',
                'value': Math.round(metrics.loadTime),
                'page_load_time': metrics.loadTime,
                'ttfb': metrics.ttfb,
                'dom_processing': metrics.domProcessing
            });
        } catch (error) {
            console.error('Failed to send metrics to analytics:', error);
        }
    }

    hasAnalyticsConsent() {
        // Check if user has consented to analytics cookies
        const consent = localStorage.getItem('cookieConsent');
        return consent ? JSON.parse(consent).analytics !== false : false;
    }

    // ================================
    // DEBUG INFO
    // ================================
    
    logDebugInfo() {
        // Only log in development or if debug flag is set
        if (!this.isDebugMode()) return;
        
        console.group('🐛 Debug Information');
        
        // Cache buster
        if (window.APP_CONFIG?.cacheBuster) {
            console.log('🚀 Cache Buster:', window.APP_CONFIG.cacheBuster);
        }
        
        // User agent (truncated)
        console.log('📱 User Agent:', navigator.userAgent.substring(0, 50) + '...');
        
        // Viewport
        console.log('📺 Viewport:', `${window.innerWidth}x${window.innerHeight}`);
        
        // Connection type
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            console.log('🌐 Connection:', connection.effectiveType || 'unknown');
            if (connection.downlink) {
                console.log('⬇️ Downlink:', `${connection.downlink} Mbps`);
            }
        }
        
        // Device memory (if available)
        if (navigator.deviceMemory) {
            console.log('💾 Device Memory:', `${navigator.deviceMemory} GB`);
        }
        
        // CPU cores
        if (navigator.hardwareConcurrency) {
            console.log('🖥️ CPU Cores:', navigator.hardwareConcurrency);
        }
        
        // Service Worker status
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg) {
                    console.log('🔧 Service Worker:', reg.active ? 'Active' : 'Installing');
                }
            });
        }
        
        // Local storage usage
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate().then(estimate => {
                const usage = (estimate.usage / 1024 / 1024).toFixed(2);
                const quota = (estimate.quota / 1024 / 1024).toFixed(2);
                console.log('💿 Storage:', `${usage} MB / ${quota} MB`);
            });
        }
        
        console.groupEnd();
    }

    isDebugMode() {
        // Check various debug indicators
        return (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.search.includes('debug=true') ||
            localStorage.getItem('debugMode') === 'true' ||
            window.APP_CONFIG?.environment === 'development'
        );
    }

    // ================================
    // UTILITIES
    // ================================
    
    // Expose some utilities globally if needed
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// ================================
// INITIALIZE ON DOM READY
// ================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.appInitializer = new AppInitializer();
    });
} else {
    // DOM already loaded
    window.appInitializer = new AppInitializer();
}

// ================================
// GLOBAL ERROR HANDLER
// ================================

window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    
    // Could send to error tracking service
    if (window.APP_CONFIG?.environment === 'production') {
        // Log to error tracking service
        // e.g., Sentry, LogRocket, etc.
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Prevent the default error handling
    event.preventDefault();
});

console.log('🚀 App Initializer loaded');
