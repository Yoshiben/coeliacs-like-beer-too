// ================================================================================
// MODALS.JS - Centralized Modal Management
// Handles: All modal operations, animations, and state
// ================================================================================

export const ModalModule = (function() {
    'use strict';
    
    // Private state
    let activeModals = [];
    let modalConfig = {
        animation: {
            duration: 300,
            easing: 'ease-out'
        },
        backdrop: {
            opacity: 0.8,
            blur: 5
        },
        focusTrap: true
    };
    
    // Modal registry - maps modal IDs to their config
    const modalRegistry = {
        // Search modals
        'nameModal': {
            type: 'search',
            onOpen: () => focusInput('nameInput'),
            onClose: () => clearInput('nameInput')
        },
        'areaModal': {
            type: 'search',
            onOpen: () => {
                updateAreaPlaceholder();
                focusInput('areaInput');
            },
            onClose: () => clearInput('areaInput')
        },
        'beerModal': {
            type: 'search',
            onOpen: () => {
                updateBeerPlaceholder();
                initializeBeerAutocomplete();
                focusInput('beerInput');
            },
            onClose: () => clearInput('beerInput')
        },
        'distanceModal': {
            type: 'search',
            onOpen: null,
            onClose: null
        },
        
        // Info modals
        'aboutModal': {
            type: 'info',
            trackingLabel: 'about_modal'
        },
        'gfInfoModal': {
            type: 'info',
            trackingLabel: 'gf_info_modal'
        },
        
        // Form modals
        'reportModal': {
            type: 'form',
            onOpen: (data) => initializeReportModal(data),
            onClose: () => resetReportForm()
        },
        
        // Settings modals
        'cookieSettings': {
            type: 'settings',
            onOpen: () => loadCookiePreferences(),
            onClose: null
        },
        
        // Admin modals
        'adminReviewModal': {
            type: 'admin',
            fullscreen: true,
            onOpen: (modalType) => loadAdminModalContent(modalType),
            onClose: () => clearAdminModalState()
        }
    };
    
    // ================================
    // CORE MODAL FUNCTIONS
    // ================================
    
    function open(modalId, data = null) {
        console.log(`🔓 Opening modal: ${modalId}`, data);
        
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`❌ Modal not found: ${modalId}`);
            return false;
        }
        
        // Get modal config
        const config = modalRegistry[modalId] || {};
        
        // Close any active search modals if opening another search modal
        if (config.type === 'search') {
            closeAllOfType('search');
        }
        
        // Show modal with animation
        modal.style.display = 'flex';
        modal.style.opacity = '0';
        
        // Force reflow
        modal.offsetHeight;
        
        // Animate in
        modal.style.transition = `opacity ${modalConfig.animation.duration}ms ${modalConfig.animation.easing}`;
        modal.style.opacity = '1';
        
        // Add to active modals
        activeModals.push(modalId);
        
        // Prevent body scroll
        if (activeModals.length === 1) {
            document.body.style.overflow = 'hidden';
        }
        
        // Call onOpen callback if exists
        if (config.onOpen) {
            setTimeout(() => {
                config.onOpen(data);
            }, 100);
        }
        
        // Track event
        if (config.trackingLabel) {
            trackEvent('modal_open', 'Modal', config.trackingLabel);
        }
        
        // Set up focus trap
        if (modalConfig.focusTrap) {
            setupFocusTrap(modal);
        }
        
        return true;
    }
    
    function close(modalId) {
        console.log(`🔒 Closing modal: ${modalId}`);
        
        const modal = document.getElementById(modalId);
        if (!modal) return false;
        
        const config = modalRegistry[modalId] || {};
        
        // Animate out
        modal.style.opacity = '0';
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.style.opacity = '';
            modal.style.transition = '';
            
            // Remove from active modals
            activeModals = activeModals.filter(id => id !== modalId);
            
            // Restore body scroll if no modals active
            if (activeModals.length === 0) {
                document.body.style.overflow = '';
            }
            
            // Call onClose callback
            if (config.onClose) {
                config.onClose();
            }
            
            // Track event
            if (config.trackingLabel) {
                trackEvent('modal_close', 'Modal', config.trackingLabel);
            }
            
        }, modalConfig.animation.duration);
        
        return true;
    }
    
    function closeAll() {
        console.log('🔒 Closing all modals');
        const modalsToClose = [...activeModals];
        modalsToClose.forEach(modalId => close(modalId));
    }
    
    function closeAllOfType(type) {
        const modalsToClose = activeModals.filter(modalId => {
            const config = modalRegistry[modalId];
            return config && config.type === type;
        });
        modalsToClose.forEach(modalId => close(modalId));
    }
    
    function isOpen(modalId) {
        return activeModals.includes(modalId);
    }
    
    // ================================
    // SPECIALIZED MODAL HANDLERS
    // ================================
    
    function openSearchModal(type) {
        const modalMap = {
            'name': 'nameModal',
            'area': 'areaModal',
            'beer': 'beerModal',
            'distance': 'distanceModal'
        };
        
        const modalId = modalMap[type];
        if (modalId) {
            open(modalId);
        }
    }
    
    function openReportModal(pubData = null) {
        console.log('📸 Opening report modal with data:', pubData);
        open('reportModal', pubData);
    }
    
    function openAdminModal(modalType) {
        console.log('👮 Opening admin modal:', modalType);
        open('adminReviewModal', modalType);
    }
    
    // ================================
    // MODAL INITIALIZATION FUNCTIONS
    // ================================
    
    function initializeReportModal(pubData) {
        console.log('🔧 Initializing report modal', pubData);
        
        const modal = document.getElementById('reportModal');
        const modalTitle = modal.querySelector('.modal-title');
        const pubSearchGroup = document.getElementById('pubSearchGroup');
        const reportForm = document.getElementById('reportForm');
        
        if (pubData) {
            // Pre-populated from specific pub
            if (pubSearchGroup) {
                pubSearchGroup.style.display = 'none';
            }
            
            modalTitle.innerHTML = `📸 Report GF Beer Find<br><small style="color: var(--text-secondary); font-weight: 400;">at ${pubData.name}</small>`;
            
            // Store pub data globally for form submission
            window.selectedPubData = {
                pub_id: pubData.pub_id || pubData.id,
                name: pubData.name,
                address: pubData.address,
                postcode: pubData.postcode
            };
        } else {
            // Normal flow
            if (pubSearchGroup) {
                pubSearchGroup.style.display = 'block';
            }
            modalTitle.innerHTML = '📸 Report GF Beer Find';
            window.selectedPubData = null;
        }
        
        // Reset form
        if (reportForm) {
            reportForm.reset();
        }
        
        // Initialize dropdowns
        initializeReportModalDropdowns();
        
        // Focus appropriate field
        setTimeout(() => {
            if (pubData) {
                focusInput('reportFormat');
            } else {
                focusInput('reportPubSearch');
            }
        }, 150);
    }
    
    function resetReportForm() {
        const reportForm = document.getElementById('reportForm');
        if (reportForm) {
            reportForm.reset();
        }
        
        // Reset selected pub
        window.selectedPubData = null;
        document.getElementById('selectedPubInfo').style.display = 'none';
        document.getElementById('newPubFields').style.display = 'none';
        
        // Hide all dropdowns
        ['breweryDropdown', 'beerNameDropdown', 'beerStyleDropdown', 'pubSuggestions'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
        
        // Reset photo upload
        const photoLabel = document.querySelector('.photo-upload-compact');
        if (photoLabel) {
            photoLabel.style.borderColor = 'var(--border-light)';
            photoLabel.style.background = 'var(--bg-section)';
            const textEl = photoLabel.querySelector('.photo-upload-text');
            if (textEl) {
                textEl.innerHTML = `
                    <strong>Add a photo</strong><br>
                    <small>Beer menu, bottle, or tap</small>
                `;
            }
        }
    }
    
    function loadCookiePreferences() {
        const analyticsConsent = localStorage.getItem('analyticsConsent');
        const consentCheckbox = document.getElementById('analyticsConsent');
        if (consentCheckbox) {
            consentCheckbox.checked = analyticsConsent === 'true';
        }
    }
    
    function loadAdminModalContent(modalType) {
        // This will be handled by the admin module
        if (window.AdminModule && window.AdminModule.loadModalContent) {
            window.AdminModule.loadModalContent(modalType);
        }
    }
    
    function clearAdminModalState() {
        // This will be handled by the admin module
        if (window.AdminModule && window.AdminModule.clearModalState) {
            window.AdminModule.clearModalState();
        }
    }
    
    // ================================
    // HELPER FUNCTIONS
    // ================================
    
    function focusInput(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            input.focus();
        }
    }
    
    function clearInput(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = '';
        }
    }
    
    function updateAreaPlaceholder() {
        const searchType = document.getElementById('areaSearchType');
        const input = document.getElementById('areaInput');
        
        if (!searchType || !input) return;
        
        if (searchType.value === 'postcode') {
            input.placeholder = 'Enter a postcode...';
            input.setAttribute('pattern', '[A-Za-z]{1,2}[0-9Rr][0-9A-Za-z]? ?[0-9][ABD-HJLNP-UW-Zabd-hjlnp-uw-z]{2}');
        } else {
            input.placeholder = 'Enter a city or region...';
            input.removeAttribute('pattern');
        }
    }
    
    function updateBeerPlaceholder() {
        const searchType = document.getElementById('beerSearchType');
        const input = document.getElementById('beerInput');
        
        if (!searchType || !input) return;
        
        const placeholders = {
            'brewery': 'Enter brewery name',
            'beer': 'Enter specific beer name',
            'style': 'Enter beer style'
        };
        
        input.placeholder = placeholders[searchType.value] || 'Enter search term';
    }
    
    function initializeBeerAutocomplete() {
        // Delegate to forms module
        if (window.FormModule && window.FormModule.initBeerAutocomplete) {
            window.FormModule.initBeerAutocomplete();
        }
    }
    
    function initializeReportModalDropdowns() {
        // Delegate to forms module
        if (window.FormModule && window.FormModule.initReportDropdowns) {
            window.FormModule.initReportDropdowns();
        }
    }
    
    function setupFocusTrap(modal) {
        const focusableElements = modal.querySelectorAll(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        );
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }
        });
    }
    
    function trackEvent(action, category, label) {
        if (window.TrackingModule) {
            window.TrackingModule.trackEvent(action, category, label);
        }
    }
    
    // ================================
    // EVENT LISTENERS
    // ================================
    
    function setupEventListeners() {
        // Close modal when clicking backdrop
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') || e.target.classList.contains('search-modal')) {
                const modal = e.target;
                if (modal.id && activeModals.includes(modal.id)) {
                    close(modal.id);
                }
            }
        });
        
        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && activeModals.length > 0) {
                const lastModal = activeModals[activeModals.length - 1];
                close(lastModal);
            }
        });
        
        // Close button handlers (using delegation)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close') || 
                e.target.closest('.modal-close')) {
                const modal = e.target.closest('.modal, .search-modal');
                if (modal && modal.id) {
                    close(modal.id);
                }
            }
        });
    }
    
    // ================================
    // INITIALIZATION
    // ================================
    
    function init() {
        console.log('🔧 Initializing Modal Module');
        setupEventListeners();
        console.log('✅ Modal Module initialized');
    }
    
    // ================================
    // PUBLIC API
    // ================================
    
    return {
        init,
        open,
        close,
        closeAll,
        closeAllOfType,
        isOpen,
        openSearchModal,
        openReportModal,
        openAdminModal,
        
        // For external access if needed
        getActiveModals: () => [...activeModals],
        updateConfig: (newConfig) => {
            modalConfig = { ...modalConfig, ...newConfig };
        }
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ModalModule.init);
} else {
    ModalModule.init();
}
