// ================================================================================
// UTILS.JS - General Utility Functions (CONVERTED TO CONST FORMAT)
// Handles: Toasts, animations, formatting, debouncing, storage, and common helpers
// ================================================================================

export const UtilsModule = (function() {
    'use strict';
    
    // ================================
    // TOAST NOTIFICATION SYSTEM
    // ================================
    
    const showLoadingToast = (message = 'Loading...') => {
        const toast = document.getElementById('loadingToast');
        if (!toast) {
            console.warn('Loading toast element not found');
            return;
        }
        
        const messageEl = document.getElementById('loadingMessage');
        if (messageEl) {
            messageEl.textContent = message;
        }
        
        toast.style.display = 'block';
        toast.style.animation = 'slideInUp 0.3s ease-out';
    };
    
    const hideLoadingToast = () => {
        const toast = document.getElementById('loadingToast');
        if (!toast) return;
        
        toast.style.animation = 'slideOutDown 0.3s ease-in';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    };
    
    const showSuccessToast = (message = 'Success!') => {
        const toast = document.getElementById('successToast');
        if (!toast) {
            console.warn('Success toast element not found');
            // Fallback to console
            console.log('✅', message);
            return;
        }
        
        const messageEl = document.getElementById('successMessage');
        if (messageEl) {
            messageEl.textContent = message;
        }
        
        toast.style.display = 'block';
        toast.style.animation = 'slideInUp 0.3s ease-out';
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutDown 0.3s ease-in';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 300);
        }, 3000);
    };
    
    // ================================
    // CENTRALIZED OVERLAY MANAGEMENT
    // ================================
    
    const closeAllOverlaysAndGoHome = () => {
        console.log('🏠 Closing all overlays and returning to home');
        
        // Close pub details overlay
        const pubDetailsOverlay = document.getElementById('pubDetailsOverlay');
        if (pubDetailsOverlay && pubDetailsOverlay.classList.contains('active')) {
            pubDetailsOverlay.style.display = 'none';
            pubDetailsOverlay.classList.remove('active');
            console.log('✅ Pub details overlay closed');
        }
        
        // Close results overlay
        const resultsOverlay = document.getElementById('resultsOverlay');
        if (resultsOverlay && resultsOverlay.classList.contains('active')) {
            resultsOverlay.style.display = 'none';
            resultsOverlay.classList.remove('active');
            console.log('✅ Results overlay closed');
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
        
        // Restore background scrolling
        document.body.style.overflow = '';
        
        // Reset map containers
        const resultsMapContainer = document.getElementById('resultsMapContainer');
        const resultsListContainer = document.getElementById('resultsListContainer');
        const mapBtnText = document.getElementById('resultsMapBtnText');
        
        if (resultsMapContainer) resultsMapContainer.style.display = 'none';
        if (resultsListContainer) resultsListContainer.style.display = 'block';
        if (mapBtnText) mapBtnText.textContent = 'Map';
        
        // Track the action
        if (window.App?.getModule('tracking')) {
            window.App.getModule('tracking').trackEvent('close_overlays', 'Navigation', 'home');
        }
        
        console.log('✅ Successfully returned to home view');
        return true;
    };
    
    // ================================
    // NUMBER ANIMATION
    // ================================
    
    const animateNumber = (elementId, targetNumber, duration = 2000) => {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`Element ${elementId} not found for number animation`);
            return;
        }
        
        const startNumber = parseInt(element.textContent.replace(/,/g, '')) || 0;
        const startTime = performance.now();
        
        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out cubic animation
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentNumber = Math.floor(startNumber + (targetNumber - startNumber) * easeOut);
            
            // Format with commas
            element.textContent = currentNumber.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                // Ensure final number is exactly correct
                element.textContent = targetNumber.toLocaleString();
            }
        };
        
        requestAnimationFrame(updateNumber);
    };
    
    // ================================
    // DEBOUNCE UTILITY
    // ================================
    
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
    
    // ================================
    // HTML ESCAPING
    // ================================
    
    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    // ================================
    // DISTANCE CALCULATION
    // ================================
    
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };
    
    // ================================
    // LOCAL STORAGE HELPERS
    // ================================
    
    const Storage = {
        get: (key, defaultValue = null) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Error reading from localStorage:', e);
                return defaultValue;
            }
        },
        
        set: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Error writing to localStorage:', e);
                return false;
            }
        },
        
        remove: (key) => {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error('Error removing from localStorage:', e);
                return false;
            }
        },
        
        clear: () => {
            try {
                localStorage.clear();
                return true;
            } catch (e) {
                console.error('Error clearing localStorage:', e);
                return false;
            }
        }
    };
    
    // ================================
    // COOKIE HELPERS
    // ================================
    
    const Cookies = {
        get: (name) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) {
                return parts.pop().split(';').shift();
            }
            return null;
        },
        
        set: (name, value, days = 365) => {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = `expires=${date.toUTCString()}`;
            document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
        },
        
        remove: (name) => {
            this.set(name, '', -1);
        }
    };
    
    // ================================
    // FORMAT HELPERS
    // ================================
    
    const formatDate = (date, format = 'short') => {
        const d = new Date(date);
        
        if (format === 'short') {
            return d.toLocaleDateString();
        } else if (format === 'long') {
            return d.toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } else if (format === 'time') {
            return d.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        return d.toLocaleString();
    };
    
    const formatDistanceText = (distance) => {
        if (distance < 1) {
            return `${Math.round(distance * 1000)}m away`;
        }
        return `${distance.toFixed(1)}km away`;
    };
    
    // ================================
    // DEVICE DETECTION
    // ================================
    
    const isMobile = () => {
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };
    
    const isTouch = () => {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    };
    
    // ================================
    // HAPTIC FEEDBACK
    // ================================
    
    const vibrate = (pattern = 10) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    };
    
    // ================================
    // SCROLL HELPERS
    // ================================
    
    const scrollToElement = (elementId, options = {}) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const defaultOptions = {
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        };
        
        element.scrollIntoView({ ...defaultOptions, ...options });
    };
    
    const lockBodyScroll = () => {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    };
    
    const unlockBodyScroll = () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    };
    
    // ================================
    // VALIDATION HELPERS
    // ================================
    
    const isValidPostcode = (postcode) => {
        const regex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
        return regex.test(postcode.replace(/\s/g, ''));
    };
    
    const isValidEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };
    
    // ================================
    // QUERY PARAMS HELPERS
    // ================================
    
    const getQueryParam = (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    };
    
    const setQueryParam = (param, value) => {
        const url = new URL(window.location);
        url.searchParams.set(param, value);
        window.history.pushState({}, '', url);
    };
    
    const removeQueryParam = (param) => {
        const url = new URL(window.location);
        url.searchParams.delete(param);
        window.history.pushState({}, '', url);
    };
    
    // ================================
    // PUBLIC API
    // ================================

    debugLocation: async () => {
        console.log('🔍 LOCATION DEBUG STARTED');
        console.log('📱 User Agent:', navigator.userAgent.substring(0, 100));
        console.log('🌐 Online:', navigator.onLine);
        console.log('📡 Connection:', navigator.connection?.effectiveType || 'unknown');
        
        if (!navigator.geolocation) {
            console.error('❌ Geolocation not supported');
            return { error: 'Geolocation not supported' };
        }
        
        console.log('✅ Geolocation API available');
        
        // Test high accuracy
        console.log('🎯 Testing HIGH ACCURACY positioning...');
        try {
            const highAccResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('High accuracy timeout')), 15000);
                
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        clearTimeout(timeout);
                        resolve({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            timestamp: pos.timestamp,
                            method: 'high_accuracy'
                        });
                    },
                    (err) => {
                        clearTimeout(timeout);
                        reject(err);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 15000,
                        maximumAge: 0
                    }
                );
            });
            
            console.log('✅ High accuracy result:', highAccResult);
        } catch (error) {
            console.log('❌ High accuracy failed:', error.message);
        }
        
        // Test network positioning
        console.log('📶 Testing NETWORK positioning...');
        try {
            const networkResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Network timeout')), 10000);
                
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        clearTimeout(timeout);
                        resolve({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            timestamp: pos.timestamp,
                            method: 'network'
                        });
                    },
                    (err) => {
                        clearTimeout(timeout);
                        reject(err);
                    },
                    {
                        enableHighAccuracy: false,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            });
            
            console.log('✅ Network result:', networkResult);
        } catch (error) {
            console.log('❌ Network positioning failed:', error.message);
        }
        
        // Test current implementation
        console.log('🧪 Testing CURRENT implementation...');
        try {
            if (window.App?.getModule('search')?.getUserLocation) {
                const currentResult = await window.App.getModule('search').getUserLocation();
                console.log('✅ Current implementation result:', currentResult);
            } else {
                console.log('❌ Current implementation not available');
            }
        } catch (error) {
            console.log('❌ Current implementation failed:', error.message);
        }
        
        console.log('🔍 LOCATION DEBUG COMPLETED');
    }
    
    return {
        // Centralized overlay management
        closeAllOverlaysAndGoHome,
        
        // Toast notifications
        showLoadingToast,
        hideLoadingToast,
        showSuccessToast,
        
        // Animations
        animateNumber,
        
        // Utilities
        debounce,
        escapeHtml,
        calculateDistance,
        
        // Storage
        Storage,
        Cookies,
        
        // Formatting
        formatDate,
        formatDistanceText,
        
        // Device detection
        isMobile,
        isTouch,
        vibrate,
        
        // Scroll management
        scrollToElement,
        lockBodyScroll,
        unlockBodyScroll,
        
        // Validation
        isValidPostcode,
        isValidEmail,
        
        // URL helpers
        getQueryParam,
        setQueryParam,
        removeQueryParam
    };
})();

// Make it globally available
window.UtilsModule = UtilsModule;
