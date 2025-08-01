// ================================================================================
// MODAL-MANAGER.JS - Centralized Modal/Overlay Management System
// Prevents conflicts, manages z-index stacking, handles states properly
// ================================================================================

export const ModalManager = (() => {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        activeModals: [],
        activeOverlays: [],
        modalStack: [],
        overlayStack: [],
        blockedModals: new Set(),
        config: {
            allowMultipleModals: false,
            allowModalOverOverlay: false,
            debugMode: true
        }
    };
    
    // Modal/Overlay Registry with types and rules
    const registry = {
        // Search overlays (mutually exclusive)
        searchOverlay: { type: 'overlay', group: 'search', exclusive: true },
        resultsOverlay: { type: 'overlay', group: 'results', exclusive: true },
        fullMapOverlay: { type: 'overlay', group: 'map', exclusive: true },
        pubDetailsOverlay: { type: 'overlay', group: 'details', exclusive: true },
        breweriesOverlay: { type: 'overlay', group: 'breweries', exclusive: true },
        
        // Search modals (mutually exclusive within group)
        nameModal: { type: 'modal', group: 'search-input', exclusive: true },
        areaModal: { type: 'modal', group: 'search-input', exclusive: true },
        beerModal: { type: 'modal', group: 'search-input', exclusive: true },
        distanceModal: { type: 'modal', group: 'search-input', exclusive: true },
        
        // Status modals (can stack in specific order)
        gfStatusModal: { type: 'modal', group: 'status', stackable: true, order: 1 },
        gfStatusConfirmModal: { type: 'modal', group: 'status', stackable: true, order: 2 },
        beerDetailsPromptModal: { type: 'modal', group: 'status', stackable: true, order: 3 },
        
        // Form modals
        reportModal: { type: 'modal', group: 'form', exclusive: true },
        placesSearchModal: { type: 'modal', group: 'form', exclusive: true },
        
        // Info modals
        aboutModal: { type: 'modal', group: 'info', exclusive: true },
        gfInfoModal: { type: 'modal', group: 'info', exclusive: true },
        
        // System modals
        locationPermissionModal: { type: 'modal', group: 'system', priority: true },
        locationBlockedModal: { type: 'modal', group: 'system', priority: true },
        cookieConsent: { type: 'banner', group: 'system', priority: true },
        cookieSettings: { type: 'modal', group: 'system', exclusive: true }
    };
    
    // ================================
    // CORE FUNCTIONS
    // ================================
    
    const open = (elementId, options = {}) => {
        const config = registry[elementId];
        if (!config) {
            console.warn(`⚠️ Unknown modal/overlay: ${elementId}`);
            return false;
        }
        
        // Debug logging
        if (state.config.debugMode) {
            console.log(`🔓 ModalManager: Opening ${elementId}`, {
                type: config.type,
                group: config.group,
                currentStack: [...state.modalStack, ...state.overlayStack]
            });
        }
        
        // Check if blocked
        if (state.blockedModals.has(elementId)) {
            console.warn(`🚫 ${elementId} is blocked from opening`);
            return false;
        }
        
        // Handle exclusive groups
        if (config.exclusive) {
            closeGroup(config.group);
        }
        
        // Handle overlays vs modals
        if (config.type === 'overlay') {
            return openOverlay(elementId, config, options);
        } else if (config.type === 'modal') {
            return openModal(elementId, config, options);
        }
        
        return false;
    };
    
    const close = (elementId) => {
        const config = registry[elementId];
        if (!config) return false;
        
        if (state.config.debugMode) {
            console.log(`🔒 ModalManager: Closing ${elementId}`);
        }
        
        if (config.type === 'overlay') {
            return closeOverlay(elementId);
        } else if (config.type === 'modal') {
            return closeModal(elementId);
        }
        
        return false;
    };
    
    const openOverlay = (overlayId, config, options) => {
        // Close all overlays if exclusive
        if (config.exclusive) {
            closeAllOverlays();
        }
        
        const overlay = document.getElementById(overlayId);
        if (!overlay) {
            console.error(`❌ Overlay not found: ${overlayId}`);
            return false;
        }
        
        // Show overlay
        overlay.style.display = 'flex';
        overlay.classList.add('active');
        
        // Add to stack
        state.overlayStack.push(overlayId);
        state.activeOverlays.push(overlayId);
        
        // Lock body scroll
        if (state.activeOverlays.length === 1 && state.activeModals.length === 0) {
            document.body.style.overflow = 'hidden';
        }
        
        // Call lifecycle hook
        if (options.onOpen) options.onOpen();
        
        return true;
    };
    
    const closeOverlay = (overlayId) => {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return false;
        
        // Hide overlay
        overlay.style.display = 'none';
        overlay.classList.remove('active');
        
        // Remove from stacks
        state.overlayStack = state.overlayStack.filter(id => id !== overlayId);
        state.activeOverlays = state.activeOverlays.filter(id => id !== overlayId);
        
        // Restore body scroll if needed
        if (state.activeOverlays.length === 0 && state.activeModals.length === 0) {
            document.body.style.overflow = '';
        }
        
        return true;
    };
    
    const openModal = (modalId, config, options) => {
        // Check if we can open over current state
        if (state.activeOverlays.length > 0 && !state.config.allowModalOverOverlay && !config.priority) {
            console.warn(`🚫 Cannot open modal over overlay`);
            return false;
        }
        
        // Handle exclusive modals
        if (config.exclusive) {
            closeGroup(config.group);
        }
        
        // Check stackable rules
        if (config.stackable) {
            const lastModal = state.modalStack[state.modalStack.length - 1];
            const lastConfig = registry[lastModal];
            
            if (lastConfig && lastConfig.group === config.group) {
                // Check order
                if (config.order && lastConfig.order && config.order < lastConfig.order) {
                    console.warn(`🚫 Cannot open ${modalId} - wrong order in stack`);
                    return false;
                }
            }
        }
        
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`❌ Modal not found: ${modalId}`);
            return false;
        }
        
        // Show modal
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        // Add to stack
        state.modalStack.push(modalId);
        state.activeModals.push(modalId);
        
        // Lock body scroll
        document.body.style.overflow = 'hidden';
        
        // Update z-index for stacking
        updateZIndexes();
        
        // Call lifecycle hook
        if (options.onOpen) options.onOpen();
        
        return true;
    };
    
    const closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (!modal) return false;
        
        // Hide modal
        modal.style.display = 'none';
        modal.classList.remove('active');
        
        // Remove from stacks
        state.modalStack = state.modalStack.filter(id => id !== modalId);
        state.activeModals = state.activeModals.filter(id => id !== modalId);
        
        // Update z-indexes
        updateZIndexes();
        
        // Restore body scroll if needed
        if (state.activeModals.length === 0 && state.activeOverlays.length === 0) {
            document.body.style.overflow = '';
        }
        
        return true;
    };
    
    const closeGroup = (group) => {
        const toClose = [...state.activeModals, ...state.activeOverlays].filter(id => {
            const config = registry[id];
            return config && config.group === group;
        });
        
        toClose.forEach(id => close(id));
    };
    
    const closeAll = () => {
        closeAllModals();
        closeAllOverlays();
    };
    
    const closeAllModals = () => {
        [...state.activeModals].forEach(id => closeModal(id));
    };
    
    const closeAllOverlays = () => {
        [...state.activeOverlays].forEach(id => closeOverlay(id));
    };
    
    const updateZIndexes = () => {
        // Update z-indexes based on stack order
        state.modalStack.forEach((modalId, index) => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.zIndex = 1200 + (index * 10);
            }
        });
    };
    
    // ================================
    // BLOCKING SYSTEM
    // ================================
    
    const block = (elementId) => {
        state.blockedModals.add(elementId);
        close(elementId);
    };
    
    const unblock = (elementId) => {
        state.blockedModals.delete(elementId);
    };
    
    const blockGroup = (group) => {
        Object.entries(registry).forEach(([id, config]) => {
            if (config.group === group) {
                block(id);
            }
        });
    };
    
    // ================================
    // QUERY FUNCTIONS
    // ================================
    
    const isOpen = (elementId) => {
        return state.activeModals.includes(elementId) || state.activeOverlays.includes(elementId);
    };
    
    const getActive = () => {
        return {
            modals: [...state.activeModals],
            overlays: [...state.activeOverlays],
            all: [...state.activeModals, ...state.activeOverlays]
        };
    };
    
    const hasActiveModals = () => state.activeModals.length > 0;
    const hasActiveOverlays = () => state.activeOverlays.length > 0;
    
    // ================================
    // DEBUG FUNCTIONS
    // ================================
    
    const debug = {
        enable: () => { state.config.debugMode = true; },
        disable: () => { state.config.debugMode = false; },
        
        log: () => {
            console.log('🔍 ModalManager State:', {
                activeModals: state.activeModals,
                activeOverlays: state.activeOverlays,
                modalStack: state.modalStack,
                overlayStack: state.overlayStack,
                blocked: Array.from(state.blockedModals)
            });
        },
        
        test: {
            // Test opening status modals in wrong order
            testStatusModals: () => {
                console.log('Testing status modal order...');
                open('gfStatusConfirmModal'); // Should fail
                open('gfStatusModal'); // Should work
                open('gfStatusConfirmModal'); // Should work now
            },
            
            // Test exclusive groups
            testExclusive: () => {
                console.log('Testing exclusive groups...');
                open('nameModal');
                open('areaModal'); // Should close nameModal
            }
        }
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    
    const init = () => {
        console.log('🔧 Initializing ModalManager');
        
        // Set up global close handlers
        document.addEventListener('click', (e) => {
            // Close on backdrop click
            if (e.target.classList.contains('modal') || e.target.classList.contains('overlay')) {
                const id = e.target.id;
                if (id && isOpen(id)) {
                    close(id);
                }
            }
        });
        
        // ESC key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close top modal first, then overlays
                if (state.modalStack.length > 0) {
                    close(state.modalStack[state.modalStack.length - 1]);
                } else if (state.overlayStack.length > 0) {
                    close(state.overlayStack[state.overlayStack.length - 1]);
                }
            }
        });
        
        console.log('✅ ModalManager initialized');
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        open,
        close,
        closeAll,
        closeAllModals,
        closeAllOverlays,
        closeGroup,
        block,
        unblock,
        blockGroup,
        isOpen,
        getActive,
        hasActiveModals,
        hasActiveOverlays,
        debug,
        
        // Configuration
        config: (options) => {
            state.config = { ...state.config, ...options };
        }
    };
})();

// Auto-initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ModalManager.init);
} else {
    ModalManager.init();
}
