// ================================================================================
// MODALS.JS - Thin Wrapper for ModalManager
// Now delegates all modal operations to ModalManager for consistency
// ================================================================================

export const ModalModule = (() => {
    'use strict';
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get modalManager() { return window.App?.getModule('modalManager'); },
        get form() { return window.App?.getModule('form'); },
        get tracking() { return window.App?.getModule('tracking'); }
    };
    
    // ================================
    // INITIALIZATION FUNCTIONS
    // ================================
    const initializeReportModal = (pubData) => {
        console.log('🔧 Initializing report modal', pubData);
        
        const modal = document.getElementById('reportModal');
        if (!modal) return;
        
        const modalTitle = modal.querySelector('.modal-title');
        const modalSubtitle = document.getElementById('reportModalSubtitle');
        const pubSearchGroup = document.getElementById('pubSearchGroup');
        const reportForm = document.getElementById('reportForm');
        
        if (pubData) {
            // Pre-populated from specific pub
            if (pubSearchGroup) {
                pubSearchGroup.style.display = 'none';
            }
            
            // Show subtitle with pub name
            if (modalSubtitle) {
                modalSubtitle.textContent = `at ${pubData.name}`;
                modalSubtitle.style.display = 'block';
            }
            
            // Store pub data globally for form submission
            window.App.setState('selectedPubForReport', {
                pub_id: pubData.pub_id || pubData.id,
                name: pubData.name,
                address: pubData.address,
                postcode: pubData.postcode
            });
        } else {
            // Normal flow - hide subtitle
            if (modalSubtitle) {
                modalSubtitle.style.display = 'none';
            }
            if (pubSearchGroup) {
                pubSearchGroup.style.display = 'block';
            }
            window.App.setState('selectedPubForReport', null);
        }
    
        // Reset form
        if (reportForm) {
            reportForm.reset();
        }
        
        // Reset selected pub info
        document.getElementById('selectedPubInfo').style.display = 'none';
        document.getElementById('newPubFields').style.display = 'none';
        
        // Initialize form module event listeners
        const formModule = modules.form || window.FormModule;
        if (formModule && formModule.initReportDropdowns) {
            setTimeout(() => {
                formModule.initReportDropdowns();
                console.log('✅ Form dropdowns initialized');
            }, 100);
        }
        
        // Focus appropriate field
        setTimeout(() => {
            if (pubData) {
                focusInput('reportFormat');
            } else {
                focusInput('reportPubSearch');
            }
        }, 150);
    };
    
    // ================================
    // PLACEHOLDER UPDATE FUNCTIONS
    // ================================
    const updateAreaPlaceholder = () => {
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
    };
    
    const updateBeerPlaceholder = () => {
        const searchType = document.getElementById('beerSearchType');
        const input = document.getElementById('beerInput');
        
        if (!searchType || !input) return;
        
        const placeholders = {
            'brewery': 'Enter brewery name',
            'beer': 'Enter specific beer name',
            'style': 'Enter beer style'
        };
        
        input.placeholder = placeholders[searchType.value] || 'Enter search term';
    };
    
    // ================================
    // HELPER FUNCTIONS
    // ================================
    const focusInput = (inputId) => {
        const input = document.getElementById(inputId);
        if (input) {
            // Delay to ensure modal is fully rendered
            setTimeout(() => {
                input.focus();
                
                // Scroll into view on mobile
                if (window.innerHeight < 600) {
                    input.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }
            }, 300);
        }
    };
    
    // ================================
    // DELEGATED FUNCTIONS
    // ================================
    const open = (modalId, data = null) => {
        const manager = modules.modalManager;
        if (!manager) {
            console.error('❌ ModalManager not available');
            return false;
        }
        
        // Handle special initialization based on modal type
        const initHandlers = {
            'reportModal': () => initializeReportModal(data),
            'nameModal': () => focusInput('nameInput'),
            'areaModal': () => {
                updateAreaPlaceholder();
                focusInput('areaInput');
            },
            'beerModal': () => {
                updateBeerPlaceholder();
                focusInput('beerInput');
            }
        };
        
        const handler = initHandlers[modalId];
        
        return manager.open(modalId, {
            onOpen: handler,
            data: data
        });
    };
    
    const close = (modalId) => {
        const manager = modules.modalManager;
        if (!manager) {
            console.error('❌ ModalManager not available');
            return false;
        }
        
        return manager.close(modalId);
    };
    
    const closeAll = () => {
        const manager = modules.modalManager;
        if (manager) {
            manager.closeAll();
        }
    };
    
    const isOpen = (modalId) => {
        const manager = modules.modalManager;
        return manager ? manager.isOpen(modalId) : false;
    };
    
    // ================================
    // SPECIALIZED HANDLERS
    // ================================
    const openSearchModal = (type) => {
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
    };
    
    const openReportModal = (pubData = null) => {
        console.log('📸 Opening report modal with data:', pubData);
        open('reportModal', pubData);
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🔧 Initializing Modal Module (Wrapper)');
        // No need for event listeners - ModalManager handles them
        console.log('✅ Modal Module initialized as wrapper');
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        open,
        close,
        closeAll,
        isOpen,
        openSearchModal,
        openReportModal,
        updateAreaPlaceholder,
        updateBeerPlaceholder,
        initializeReportModal
    };
})();

// Auto-initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ModalModule.init);
} else {
    ModalModule.init();
}
