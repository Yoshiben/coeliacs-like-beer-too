// ================================================================================
// TOAST.JS - Single source of truth for ALL toasts
// No more loading toasts! Just success, error, info, warning
// ================================================================================

export const ToastModule = (() => {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        activeToasts: new Map(),
        containerElement: null
    };
    
    const config = {
        duration: 3000,
        animationDuration: 300,
        maxVisible: 3,
        position: 'bottom-center' // can be top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
    };
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🍞 Initializing Toast Module');
        
        // Create container if it doesn't exist
        if (!state.containerElement) {
            state.containerElement = document.createElement('div');
            state.containerElement.className = 'toast-container';
            state.containerElement.setAttribute('data-position', config.position);
            document.body.appendChild(state.containerElement);
        }
        
        // Clean up any old toasts from previous sessions
        document.querySelectorAll('.toast').forEach(toast => {
            if (!state.containerElement.contains(toast)) {
                toast.remove();
            }
        });
        
        console.log('✅ Toast Module initialized');
    };
    
    // ================================
    // CORE FUNCTIONS
    // ================================
    const createToastElement = (id, message, type) => {
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
        const icon = icons[type] || '';
        
        toast.innerHTML = `
            <div class="toast-content">
                ${icon ? `<span class="toast-icon">${icon}</span>` : ''}
                <span class="toast-message">${escapeHtml(message)}</span>
                <button class="toast-close" aria-label="Close">&times;</button>
            </div>
        `;
        
        // Add close button handler
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.onclick = () => hide(id);
        }
        
        return toast;
    };
    
    const show = (message, type = 'info', options = {}) => {
        // Don't show empty messages
        if (!message || message.trim() === '') return null;
        
        // Check for duplicate messages
        for (const [id, toastData] of state.activeToasts) {
            if (toastData.message === message && toastData.type === type) {
                console.log('🍞 Duplicate toast prevented:', message);
                return id;
            }
        }
        
        // Limit number of visible toasts
        if (state.activeToasts.size >= config.maxVisible) {
            const firstToastId = state.activeToasts.keys().next().value;
            hide(firstToastId);
        }
        
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const duration = options.duration !== undefined ? options.duration : config.duration;
        
        const toast = createToastElement(id, message, type);
        
        // Add to container
        if (!state.containerElement) init();
        state.containerElement.appendChild(toast);
        
        // Store in state
        state.activeToasts.set(id, {
            message,
            type,
            element: toast,
            timeout: null
        });
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Auto-hide if duration is set
        if (duration > 0) {
            const timeoutId = setTimeout(() => hide(id), duration);
            state.activeToasts.get(id).timeout = timeoutId;
        }
        
        console.log(`🍞 Toast shown: [${type}] ${message}`);
        return id;
    };
    
    const hide = (id) => {
        const toastData = state.activeToasts.get(id);
        if (!toastData) return;
        
        // Clear timeout if exists
        if (toastData.timeout) {
            clearTimeout(toastData.timeout);
        }
        
        const toast = toastData.element;
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.remove();
            }
            state.activeToasts.delete(id);
        }, config.animationDuration);
    };
    
    const hideAll = () => {
        console.log('🧹 Clearing all toasts');
        state.activeToasts.forEach((_, id) => hide(id));
    };
    
    // ================================
    // CONVENIENCE METHODS
    // ================================
    const success = (message, options) => show(message, 'success', options);
    const error = (message, options) => show(message, 'error', options);
    const warning = (message, options) => show(message, 'warning', options);
    const info = (message, options) => show(message, 'info', options);
    
    // ================================
    // UTILITY FUNCTIONS
    // ================================
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    // ================================
    // LEGACY SUPPORT (for old code)
    // ================================
    const showToast = show;
    const showSuccessToast = success;
    const showErrorToast = error;
    const showLoadingToast = () => {
        console.warn('⚠️ Loading toasts are deprecated. Use proper loading UI instead.');
        return { hide: () => {} };
    };
    const hideLoadingToast = () => {
        console.warn('⚠️ Loading toasts are deprecated.');
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        show,
        hide,
        hideAll,
        success,
        error,
        warning,
        info,
        
        // Legacy support
        showToast,
        showSuccessToast,
        showErrorToast,
        showLoadingToast,
        hideLoadingToast,
        
        // Utility
        clear: hideAll,
        
        // Debug
        getActive: () => state.activeToasts
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ToastModule.init);
} else {
    ToastModule.init();
}

// Make it globally available for legacy code
window.ToastModule = ToastModule;
