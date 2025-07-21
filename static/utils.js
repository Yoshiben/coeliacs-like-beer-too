// ================================================================================
// UTILS.JS - General Utility Functions
// Handles: Toasts, animations, formatting, debouncing, storage, and common helpers
// ================================================================================

export const UtilsModule = (function() {
    'use strict';
    
    // ================================
    // TOAST NOTIFICATION SYSTEM
    // ================================
    
    function showLoadingToast(message = 'Loading...') {
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
    }
    
    function hideLoadingToast() {
        const toast = document.getElementById('loadingToast');
        if (!toast) return;
        
        toast.style.animation = 'slideOutDown 0.3s ease-in';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }
    
    function showSuccessToast(message = 'Success!') {
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
    }
    
    // ================================
    // NUMBER ANIMATION
    // ================================
    
    function animateNumber(elementId, targetNumber, duration = 2000) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`Element ${elementId} not found for number animation`);
            return;
        }
        
        const startNumber = parseInt(element.textContent.replace(/,/g, '')) || 0;
        const startTime = performance.now();
        
        function updateNumber(currentTime) {
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
        }
        
        requestAnimationFrame(updateNumber);
    }
    
    // ================================
    // DEBOUNCE UTILITY
    // ================================
    
    function debounce(func, wait) {
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
    
    // ================================
    // HTML ESCAPING
    // ================================
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ================================
    // DISTANCE CALCULATION
    // ================================
    
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // ================================
    // LOCAL STORAGE HELPERS
    // ================================
    
    const Storage = {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Error reading from localStorage:', e);
                return defaultValue;
            }
        },
        
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Error writing to localStorage:', e);
                return false;
            }
        },
        
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error('Error removing from localStorage:', e);
                return false;
            }
        },
        
        clear() {
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
        get(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) {
                return parts.pop().split(';').shift();
            }
            return null;
        },
        
        set(name, value, days = 365) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = `expires=${date.toUTCString()}`;
            document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
        },
        
        remove(name) {
            this.set(name, '', -1);
        }
    };
    
    // ================================
    // FORMAT HELPERS
    // ================================
    
    function formatDate(date, format = 'short') {
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
    }
    
    function formatDistanceText(distance) {
        if (distance < 1) {
            return `${Math.round(distance * 1000)}m away`;
        }
        return `${distance.toFixed(1)}km away`;
    }
    
    // ================================
    // DEVICE DETECTION
    // ================================
    
    function isMobile() {
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    function isTouch() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    
    // ================================
    // HAPTIC FEEDBACK
    // ================================
    
    function vibrate(pattern = 10) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    // ================================
    // SCROLL HELPERS
    // ================================
    
    function scrollToElement(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const defaultOptions = {
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        };
        
        element.scrollIntoView({ ...defaultOptions, ...options });
    }
    
    function lockBodyScroll() {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    }
    
    function unlockBodyScroll() {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    }
    
    // ================================
    // VALIDATION HELPERS
    // ================================
    
    function isValidPostcode(postcode) {
        const regex = /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
        return regex.test(postcode.replace(/\s/g, ''));
    }
    
    function isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
    
    // ================================
    // QUERY PARAMS HELPERS
    // ================================
    
    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }
    
    function setQueryParam(param, value) {
        const url = new URL(window.location);
        url.searchParams.set(param, value);
        window.history.pushState({}, '', url);
    }
    
    function removeQueryParam(param) {
        const url = new URL(window.location);
        url.searchParams.delete(param);
        window.history.pushState({}, '', url);
    }
    
    // ================================
    // PUBLIC API
    // ================================
    
    return {
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
