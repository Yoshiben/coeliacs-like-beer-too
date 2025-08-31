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
            allowModalOverOverlay: true,
            debugMode: true
        }
    };
    
    // Modal/Overlay Registry with types and rules
    const registry = {

        // Legal modals group
        privacyModal: { type: 'modal', group: 'legal', exclusive: false, priority: true, zIndex: 10000 },
        termsModal: { type: 'modal', group: 'legal', exclusive: false, priority: true, zIndex: 10000 },
        liabilityModal: { type: 'modal', group: 'legal', exclusive: false, priority: true},

        // Onboarding modals group (complete set)
        ageGateModal: { type: 'modal', group: 'onboarding', exclusive: true, priority: true },
        
        welcomeModal: { type: 'modal', group: 'onboarding', exclusive: true },
        nicknameModal: { type: 'modal', group: 'onboarding', exclusive: true },
        signInModal: { type: 'modal', group: 'onboarding', exclusive: true },
        passcodeModal: { type: 'modal', group: 'onboarding', exclusive: true },
        benefitsModal: { type: 'modal', group: 'onboarding', exclusive: true },
        cookieModal: { type: 'modal', group: 'onboarding', exclusive: true }, 

        

        
        // Search overlays (mutually exclusive)
        searchOverlay: { type: 'overlay', group: 'primary', exclusive: true },
        resultsOverlay: { type: 'overlay', group: 'primary', exclusive: true, hasInternalViews: true, defaultView: 'list' },
        fullMapOverlay: { type: 'overlay', group: 'primary', exclusive: true },
        venueDetailsOverlay: { type: 'overlay', group: 'primary', exclusive: true },
        breweriesOverlay: { type: 'overlay', group: 'primary', exclusive: true },
        communityHubOverlay: { type: 'overlay', group: 'primary', exclusive: true },
        communityHubOverlay: { type: 'overlay', group: 'primary', exclusive: true },

        // Info overlays
        aboutOverlay: { type: 'overlay', group: 'info', exclusive: true, zIndex: 1500 },
        gfInfoOverlay: { type: 'overlay', group: 'info', exclusive: true, zIndex: 1500 },
        getInTouchOverlay: { type: 'overlay', group: 'info', exclusive: true, zIndex: 1500 },
        
        
        // Search modals (mutually exclusive within group)
        nameModal: { type: 'modal', group: 'search-input', exclusive: true },
        areaModal: { type: 'modal', group: 'search-input', exclusive: true },
        beerModal: { type: 'modal', group: 'search-input', exclusive: true },
        distanceModal: { type: 'modal', group: 'search-input', exclusive: true },
        beerListModal: { type: 'modal', group: 'venue-sub', exclusive: true },
        breweryBeersModal: { type: 'modal', group: 'brewery', exclusive: true },
        manualVenueEntryModal: { type: 'modal', group: 'form', exclusive: true },
        statusPromptAfterBeerModal: { type: 'modal', group: 'status', stackable: true, order: 4 },
        
        
        // Status modals (can stack in specific order)
        gfStatusModal: { type: 'modal', group: 'status', stackable: true, order: 1, priority: true },
        gfStatusConfirmModal: { type: 'modal', group: 'status', stackable: true, order: 2 },
        beerDetailsPromptModal: { type: 'modal', group: 'status', stackable: true, order: 3 },
        statusConfirmModal: { type: 'modal', group: 'status', stackable: true, order: 4 },
        
        // Form modals
        reportModal: { type: 'modal', group: 'form', exclusive: true, priority: false },
        placesSearchModal: { type: 'modal', group: 'form', exclusive: true },
        venueAddedPromptModal: { type: 'modal', group: 'form', exclusive: true },
        
        // System modals
        locationPermissionModal: { type: 'modal', group: 'system', priority: true },
        locationBlockedModal: { type: 'modal', group: 'system', priority: true },
        notificationsPreviewModal: { type: 'modal', group: 'system', exclusive: true },
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
        
        // Check if already open - if so, just refresh content
        const isAlreadyOpen = state.activeModals.includes(elementId) || 
                              state.activeOverlays.includes(elementId);
        
        if (isAlreadyOpen && options.onOpen) {
            console.log(`🔄 ${elementId} already open, refreshing content`);
            options.onOpen();
            return true;
        }
        
        // Handle exclusive groups (but don't close self)
        if (config.exclusive) {
            closeGroup(config.group, elementId);
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
        
        // Special handling for report modal - reset cascade form
        if (elementId === 'reportModal' && window.CascadeForm) {
            window.CascadeForm.reset();
            console.log('🔄 Reset cascade form on modal close');
        }
        
        if (config.type === 'overlay') {
            return closeOverlay(elementId);
        } else if (config.type === 'modal') {
            return closeModal(elementId);
        }
        
        return false;
    };
    
    const openOverlay = (overlayId, config, options) => {
        // Check if already open
        if (state.activeOverlays.includes(overlayId)) {
            console.log(`⚠️ ${overlayId} is already open`);
            
            // If already open but has onOpen callback, call it to refresh content
            if (options.onOpen) {
                options.onOpen();
            }
            
            return true;
        }
        
        // Handle exclusive groups
        if (config.exclusive && config.group) {
            // Close ALL overlays in the same group (not just active ones)
            const overlaysToClose = state.activeOverlays.filter(id => {
                const overlayConfig = registry[id];
                return overlayConfig && overlayConfig.group === config.group && id !== overlayId;
            });
            
            overlaysToClose.forEach(id => {
                console.log(`🔒 Closing ${id} to open ${overlayId}`);
                closeOverlay(id);
            });
            
            // IMPORTANT: Also close any overlay that's visually shown but not in our state
            if (config.group === 'primary') {
                // Manually ensure all primary overlays are hidden
                const primaryOverlays = ['searchOverlay', 'resultsOverlay', 'fullMapOverlay', 'venueDetailsOverlay', 'breweriesOverlay'];
                primaryOverlays.forEach(id => {
                    if (id !== overlayId) {
                        const overlay = document.getElementById(id);
                        if (overlay && (overlay.style.display === 'flex' || overlay.classList.contains('active'))) {
                            console.log(`🧹 Force closing ${id}`);
                            overlay.style.display = 'none';
                            overlay.classList.remove('active');
                        }
                    }
                });
            }
        }
        
        const overlay = document.getElementById(overlayId);
        if (!overlay) {
            console.error(`❌ Overlay not found: ${overlayId}`);
            return false;
        }
        
        // Hide community home for primary overlays
        if (config.group === 'primary') {
            const communityHome = document.querySelector('.community-home');
            if (communityHome) {
                communityHome.style.display = 'none';
            }
        }
        
        // Show overlay
        overlay.style.display = 'flex';
        overlay.classList.add('active');
        
        // ADD THIS: Apply z-index if specified in config
        if (config.zIndex) {
            overlay.style.zIndex = config.zIndex;
            console.log(`📏 Applied z-index ${config.zIndex} to ${overlayId}`);
        }
        
        // NEW CODE: Reset to default view if it has internal views
        if (config.hasInternalViews && config.defaultView) {
            toggleInternalView(overlayId, config.defaultView);
        }
        
        // Add to stack
        state.overlayStack.push(overlayId);
        state.activeOverlays.push(overlayId);
        
        // Lock body scroll
        if (state.activeOverlays.length === 1 && state.activeModals.length === 0) {
            document.body.style.overflow = 'hidden';
        }
        
        // Call lifecycle hook
        if (options.onOpen) {
            options.onOpen();
        }
        
        console.log(`✅ Opened overlay: ${overlayId}`);
        console.log(`📊 Active overlays: ${state.activeOverlays.join(', ')}`);
        
        return true;
    };
    
    const closeOverlay = (overlayId) => {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return false;
        
        // Hide overlay
        overlay.style.display = 'none';
        overlay.classList.remove('active');
        
        // Remove from ALL stacks (both overlayStack and activeOverlays)
        state.overlayStack = state.overlayStack.filter(id => id !== overlayId);
        state.activeOverlays = state.activeOverlays.filter(id => id !== overlayId);
        
        // Show community home if no overlays are active
        if (state.activeOverlays.length === 0) {
            const communityHome = document.querySelector('.community-home');
            if (communityHome) {
                communityHome.style.display = 'block';
            }
        }
        
        // Restore body scroll if needed
        if (state.activeOverlays.length === 0 && state.activeModals.length === 0) {
            document.body.style.overflow = '';
        }
        
        return true;
    };
    
    const openModal = (modalId, config, options) => {
        // Special handling for cookie settings - always close cookie consent first
        if (modalId === 'cookieSettings' || modalId === 'cookieSettingsFloat') {
            const cookieConsent = document.getElementById('cookieConsent');
            if (cookieConsent) {
                cookieConsent.classList.remove('show');
                cookieConsent.style.display = 'none';
            }
        }
        
        // Check if we can open over current state
        if (state.activeOverlays.length > 0 && !state.config.allowModalOverOverlay && !config.priority) {
            console.warn(`🚫 Cannot open modal over overlay`);
            return false;
        }
        
        // Handle exclusive modals
        if (config.exclusive) {
            closeGroup(config.group, modalId);
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
    
    const closeGroup = (group, exceptId = null) => {
        const toClose = [...state.activeModals, ...state.activeOverlays].filter(id => {
            const config = registry[id];
            return config && config.group === group && id !== exceptId;
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
        state.modalStack.forEach((modalId, index) => {
            const modal = document.getElementById(modalId);
            if (modal) {
                // Check if this modal should cover the nav
                if (modal.dataset.coverNav === 'true') {
                    modal.style.zIndex = 9999 + (index * 10);  // Above nav
                } else {
                    modal.style.zIndex = 1200 + (index * 10);   // Below nav (assuming nav is ~1000)
                }
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
    // INTERNAL VIEW MANAGEMENT
    // ================================
    const toggleInternalView = (overlayId, viewType) => {
        console.log(`🔄 Toggling internal view in ${overlayId} to ${viewType}`);
        
        const config = registry[overlayId];
        if (!config || !config.hasInternalViews) {
            console.warn(`⚠️ ${overlayId} doesn't support internal views`);
            return false;
        }
        
        // Store the current view state
        if (!state.internalViews) {
            state.internalViews = {};
        }
        state.internalViews[overlayId] = viewType;
        
        // Special handling for results overlay
        if (overlayId === 'resultsOverlay') {
            const listContainer = document.getElementById('resultsListContainer');
            const mapContainer = document.getElementById('resultsMapContainer');

            console.log('🔄 List container found:', !!listContainer);
            console.log('🔄 Map container found:', !!mapContainer);
            
            if (viewType === 'map') {
                console.log('🔄 Switching to MAP view');
                if (listContainer) listContainer.style.display = 'none';
                if (mapContainer) {
                    mapContainer.style.display = 'block';
                    mapContainer.style.flex = '1';
                    mapContainer.style.height = '100%';
                }

                // HIDE PAGINATION FOR MAP VIEW
                if (paginationContainer) {
                    paginationContainer.style.display = 'none';
                }
                
            } else {
                console.log('🔄 Switching to LIST view');
                if (listContainer) {
                    listContainer.style.display = 'block';
                    listContainer.style.flex = '1';
                }
                if (mapContainer) mapContainer.style.display = 'none';
            }
        }
        
        return true;
    };

    const getInternalView = (overlayId) => {
        return state.internalViews?.[overlayId] || registry[overlayId]?.defaultView || null;
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
        toggleInternalView,
        getInternalView,
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
