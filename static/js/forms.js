// ================================================================================
// FORMS.JS - Complete Refactor with STATE_KEYS, Arrow Functions and Consistency Fixes
// Handles: All form operations, validation, autocomplete, GF status updates
// ================================================================================

import { APIModule } from './api.js';
import { ModalModule } from './modals.js';
import { Constants } from './constants.js';

const STATE_KEYS = Constants.STATE_KEYS;

export const FormModule = (() => {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        searchTimeouts: {
            brewery: null,
            beer: null,
            style: null,
            pub: null
        },
        dropdownsOpen: new Set(),
        currentSubmission: null,
        isSubmitting: false  // ADD THIS
    };
    
    const config = {
        debounceDelay: 300,
        minSearchLength: 2,
        maxSuggestions: 20,
        autocompleteDelay: 200
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get api() { return window.App?.getModule('api') || APIModule; },
        get modal() { return window.App?.getModule('modal') || ModalModule; },
        get modalManager() { return window.App?.getModule('modalManager'); },
        get tracking() { return window.App?.getModule('tracking'); }
    };
    
    // ================================
    // UTILITIES
    // ================================
    const utils = {
        getSelectedPub: () => window.App.getState(STATE_KEYS.SELECTED_PUB_FOR_REPORT),
        
        setSelectedPub: (pubData) => window.App.setState(STATE_KEYS.SELECTED_PUB_FOR_REPORT, pubData),
        
        getCurrentPub: () => window.App.getState(STATE_KEYS.CURRENT_PUB),
        
        getCurrentBrewery: () => window.App.getState(STATE_KEYS.CURRENT_BREWERY),
        
        setCurrentBrewery: (brewery) => window.App.setState(STATE_KEYS.CURRENT_BREWERY, brewery),
        
        showToast: (message, type = 'success') => {
            if (window.showSuccessToast) {
                window.showSuccessToast(message);
            } else {
                console.log(type === 'success' ? '✅' : '❌', message);
            }
        },
        
        showLoadingToast: (message) => {
            if (window.showLoadingToast) {
                window.showLoadingToast(message);
            }
        },
        
        hideLoadingToast: () => {
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
        },
        
        escapeHtml: (text) => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        debounce: (func, wait) => {
            let timeout;
            return (...args) => {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    };
    
    // ================================
    // REPORT FORM SUBMISSION
    // ================================
    const handleReportSubmission = async (event) => {
        event.preventDefault();

        // Check for nickname first
        let nickname = window.App.getState('userNickname');
        if (!nickname) {
            nickname = localStorage.getItem('userNickname');
            if (nickname) {
                window.App.setState('userNickname', nickname);
            } else {
                // Store the pending submission
                window.App.setState('pendingActionAfterNickname', () => {
                    handleReportSubmission(event);
                });
                
                // Open nickname modal
                modules.modalManager?.open('nicknameModal');
                return;
            }

        // Prevent duplicate submissions
        if (state.isSubmitting) {
            console.log('⚠️ Submission already in progress');
            return;
        }
        
        console.log('📝 Handling report submission...');
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Collect and validate form data
        const reportData = collectReportData(formData);
        console.log('🔍 Report data collected:', reportData);
        
        const validation = validateReportForm(reportData);
        console.log('✅ Validation result:', validation);
        
        if (!validation.isValid) {
            utils.showToast(`❌ Please fill in: ${validation.errors.join(', ')}`, 'error');
            return;
        }
        
        // Show loading state
        utils.showLoadingToast('Submitting beer report...');
        state.currentSubmission = reportData;
        
        try {
            console.log('📤 Sending to API...');
            const result = await modules.api.submitBeerReport(reportData);
            console.log('📥 API Response:', result);
            
            utils.hideLoadingToast();
            
            if (result.success) {
                handleSubmissionSuccess(result, reportData);
            } else {
                console.error('❌ Submission failed:', result);
                utils.showToast(result.message || 'Failed to submit report', 'error');
            }
        } catch (error) {
            console.error('❌ Error submitting report:', error);
            utils.hideLoadingToast();
            utils.showToast('Error submitting report. Please try again.', 'error');
        } finally {
            state.currentSubmission = null;
            state.isSubmitting = false;
        }    
        };
    };
    
    const collectReportData = (formData) => {
        const reportData = {
            beer_format: formData.get('reportFormat') || document.getElementById('reportFormat')?.value,
            brewery: formData.get('reportBrewery') || document.getElementById('reportBrewery')?.value,
            beer_name: formData.get('reportBeerName') || document.getElementById('reportBeerName')?.value,
            beer_style: formData.get('reportBeerStyle') || document.getElementById('reportBeerStyle')?.value,
            beer_abv: formData.get('reportBeerABV') || document.getElementById('reportBeerABV')?.value,
            notes: formData.get('reportNotes') || ''
        };

        // ADD THIS: Check for beer_id
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput?.dataset.beerId) {
            reportData.beer_id = parseInt(beerNameInput.dataset.beerId);
        }
        
        // Add pub data - check both selected pub state and current pub state
        const selectedPub = utils.getSelectedPub() || utils.getCurrentPub();
        
        if (selectedPub && selectedPub.pub_id) {
            // Using existing pub from database
            reportData.pub_id = parseInt(selectedPub.pub_id) || parseInt(selectedPub.id);
            reportData.pub_name = selectedPub.name;
            console.log('🏠 Using selected pub:', selectedPub.name, 'ID:', reportData.pub_id);
        } else {
            // Manual pub entry or new pub
            const pubNameField = document.getElementById('reportPubName');
            const addressField = document.getElementById('reportAddress');
            const postcodeField = document.getElementById('reportPostcode');
            
            reportData.pub_name = pubNameField?.value || formData.get('reportPubName') || 'Unknown Pub';
            reportData.address = addressField?.value || formData.get('reportAddress') || '';
            reportData.postcode = postcodeField?.value || formData.get('reportPostcode') || '';
            
            // Don't send pub_id if it's a new pub
            reportData.pub_id = null;
            
            console.log('🏠 Using manual pub data:', reportData.pub_name);
        }
        
        // Clean up ABV field - ensure it's a proper number or null
        if (reportData.beer_abv) {
            reportData.beer_abv = parseFloat(reportData.beer_abv) || null;
        }
        
        return reportData;
    };
    
    const validateReportForm = (data) => {
        const errors = [];
        
        // Required fields
        if (!data.beer_format) errors.push('Beer Format');
        if (!data.brewery) errors.push('Brewery');
        if (!data.beer_name) errors.push('Beer Name');
        
        // Either need pub_id OR pub details
        if (!data.pub_id) {
            if (!data.pub_name) errors.push('Pub Name');
            // Only require address/postcode for new pubs
            if (data.pub_name && (!data.address || !data.postcode)) {
                console.warn('⚠️ New pub missing address/postcode - may fail validation');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    };
    
    // REPLACE the handleSubmissionSuccess function in forms.js (around line 177)

    const handleSubmissionSuccess = (result, reportData) => {
        utils.showToast('🎉 Beer report submitted successfully! Thanks for contributing!');
        
        // Close modal properly using modalManager
        if (modules.modalManager) {
            modules.modalManager.close('reportModal');
        } else {
            modules.modal.close('reportModal');
        }
        
        // Reset form
        resetReportForm();
        
        // IMPORTANT: Refresh the current pub to show the new beer
        const currentPub = utils.getCurrentPub();
        if (currentPub && currentPub.pub_id) {
            // Refresh pub details to get updated beer list
            const searchModule = window.App?.getModule('search');
            if (searchModule) {
                searchModule.showPubDetails(currentPub.pub_id);
            }
        }
        
        // Return to home view if not on pub details
        if (!currentPub) {
            returnToHomeView();
        }
        
        // Track success
        modules.tracking?.trackFormSubmission('beer_report', {
            tier: result.tier,
            status: result.status,
            brewery: reportData.brewery
        });
    };
    
    const returnToHomeView = () => {
        // Close any overlays
        ['pubDetailsOverlay', 'resultsOverlay'].forEach(id => {
            const overlay = document.getElementById(id);
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.remove('active');
            }
        });
        
        // Show home sections
        const heroSection = document.querySelector('.hero-section');
        const searchSection = document.querySelector('.search-section');
        
        if (heroSection) heroSection.style.display = 'block';
        if (searchSection) searchSection.style.display = 'flex';
        
        document.body.style.overflow = '';
    };
    
    const resetReportForm = () => {
        const form = document.getElementById('reportForm');
        if (form) form.reset();
        
        // Clear state
        utils.setSelectedPub(null);
        utils.setCurrentBrewery(null);
        
        // Reset UI
        document.getElementById('selectedPubInfo').style.display = 'none';
        document.getElementById('newPubFields').style.display = 'none';
        document.getElementById('pubSearchGroup').style.display = 'block';
        
        // Clear dropdowns
        hideAllDropdowns();
        
        // Reset photo upload
        resetPhotoUpload();
    };
    
    const resetPhotoUpload = () => {
        const photoLabel = document.querySelector('.photo-upload-compact');
        if (photoLabel) {
            photoLabel.classList.remove('active');
            const textEl = photoLabel.querySelector('.photo-upload-text');
            if (textEl) {
                textEl.innerHTML = `
                    <strong>Add a photo</strong><br>
                    <small>Beer menu, bottle, or tap</small>
                `;
            }
        }
    };
    
    // ================================
    // PUB SEARCH & SELECTION
    // ================================
    const searchPubs = utils.debounce(async (query) => {
        const suggestionsDiv = document.getElementById('pubSuggestions');
        if (!suggestionsDiv) return;
        
        if (query.length < config.minSearchLength) {
            hideDropdown('pubSuggestions');
            return;
        }
        
        try {
            const suggestions = await modules.api.getPubSuggestions(query, 'name', false);
            
            if (suggestions.length === 0) {
                displayNoResultsOption(suggestionsDiv, query);
            } else {
                displayPubSuggestions(suggestionsDiv, suggestions);
            }
            
            showDropdown('pubSuggestions');
        } catch (error) {
            console.error('Error searching pubs:', error);
            hideDropdown('pubSuggestions');
        }
    }, config.debounceDelay);
    
    const displayNoResultsOption = (container, query) => {
        container.innerHTML = `
            <div class="suggestion-item add-new" data-action="add-new-pub">
                <strong>➕ Add "${utils.escapeHtml(query)}" as new pub</strong>
                <small>Can't find it? Add it to our database!</small>
            </div>
        `;
    };
    
    const displayPubSuggestions = (container, suggestions) => {
        container.innerHTML = suggestions.map(pub => `
            <div class="suggestion-item" data-pub-id="${pub.pub_id}" data-action="select-pub">
                <strong>${utils.escapeHtml(pub.name)}</strong>
                <small>${utils.escapeHtml(pub.address)}, ${utils.escapeHtml(pub.postcode)}</small>
            </div>
        `).join('');
    };
    
    const selectPub = (pubElement) => {
        const pubId = pubElement.dataset.pubId;
        const pubName = pubElement.querySelector('strong').textContent;
        const pubDetails = pubElement.querySelector('small').textContent;
        const [address, postcode] = pubDetails.split(', ');
        
        const pubData = {
            pub_id: parseInt(pubId),
            name: pubName,
            address,
            postcode
        };
        
        utils.setSelectedPub(pubData);
        updateSelectedPubUI(pubData);
        hideDropdown('pubSuggestions');
        
        modules.tracking?.trackEvent('pub_selected', 'Form', pubName);
    };
    
    const updateSelectedPubUI = (pubData) => {
        document.getElementById('selectedPubInfo').style.display = 'block';
        document.getElementById('selectedPubName').textContent = pubData.name;
        document.getElementById('selectedPubAddress').textContent = `${pubData.address}, ${pubData.postcode}`;
        document.getElementById('pubSearchGroup').style.display = 'none';
    };
    
    const showNewPubFields = () => {
        document.getElementById('newPubFields').style.display = 'block';
        document.getElementById('pubSearchGroup').style.display = 'none';
        document.getElementById('reportPubName').value = document.getElementById('reportPubSearch').value;
        
        hideDropdown('pubSuggestions');
        document.getElementById('reportAddress').focus();
    };
    
    const clearSelectedPub = () => {
        utils.setSelectedPub(null);
        
        document.getElementById('selectedPubInfo').style.display = 'none';
        document.getElementById('pubSearchGroup').style.display = 'block';
        document.getElementById('reportPubSearch').value = '';
        document.getElementById('reportPubSearch').focus();
    };
    
    // ================================
    // BREWERY AUTOCOMPLETE
    // ================================
    const searchBreweries = utils.debounce(async (query) => {
        const dropdown = document.getElementById('breweryDropdown');
        if (!dropdown) return;
        
        try {
            const breweries = query.length < 1 ? 
                await modules.api.getBreweries() : 
                await modules.api.getBreweries(query);
            
            displayBreweryDropdown(
                breweries.slice(0, query.length < 1 ? 100 : 50), 
                breweries.length, 
                query
            );
        } catch (error) {
            console.error('Error searching breweries:', error);
            hideDropdown('breweryDropdown');
        }
    }, config.debounceDelay);
    
    const displayBreweryDropdown = (breweries, totalCount, searchQuery = null) => {
        const dropdown = document.getElementById('breweryDropdown');
        if (!dropdown || breweries.length === 0) {
            hideDropdown('breweryDropdown');
            return;
        }
        
        dropdown.innerHTML = '';
        
        // Header
        const header = createDropdownHeader(
            searchQuery ? 
                `🔍 ${totalCount} matches for "${searchQuery}"` :
                `🍺 ${totalCount} Breweries Available`
        );
        dropdown.appendChild(header);
        
        // Items
        breweries.forEach(brewery => {
            const item = createSuggestionItem(brewery, 'select-brewery', { brewery });
            dropdown.appendChild(item);
        });
        
        showDropdown('breweryDropdown');
    };
    
    const selectBrewery = async (brewery) => {
        console.log('🍺 Brewery selected:', brewery);
        
        document.getElementById('reportBrewery').value = brewery;
        utils.setCurrentBrewery(brewery);
        hideDropdown('breweryDropdown');
        
        // Clear dependent fields
        clearBeerFields();
        
        // Load beers for this brewery (only once!)
        try {
            await loadBreweryBeers(brewery);
        } catch (error) {
            console.error('❌ Error loading brewery beers:', error);
        }
        
        modules.tracking?.trackEvent('brewery_selected', 'Form', brewery);
    };
    
    const clearBeerFields = () => {
        ['reportBeerName', 'reportBeerStyle', 'reportBeerABV'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
    };
    
    const loadBreweryBeers = async (brewery) => {
        const beerNameInput = document.getElementById('reportBeerName');
        if (!beerNameInput) return;
        
        console.log(`🍺 Loading beers for ${brewery}...`);
        
        try {
            const beers = await modules.api.getBreweryBeers(brewery);
            
            if (beers.length === 0) {
                beerNameInput.placeholder = `Add new beer for ${brewery}`;
                utils.showToast(`📝 No existing beers for ${brewery}. Add a new one!`);
                showAddNewBeerDropdown(brewery);
            } else {
                beerNameInput.placeholder = `Choose from ${beers.length} ${brewery} beers...`;
                utils.showToast(`🍺 Found ${beers.length} beers from ${brewery}!`);
                displayBeerDropdown(beers, brewery);
            }
            
            setTimeout(() => beerNameInput.focus(), 200);
            
        } catch (error) {
            console.error('Error loading brewery beers:', error);
            beerNameInput.placeholder = 'Enter beer name...';
        }
    };
    
    // ================================
    // BEER NAME AUTOCOMPLETE
    // ================================
    const searchBeerNames = utils.debounce(async (query) => {
        const dropdown = document.getElementById('beerNameDropdown');
        const brewery = document.getElementById('reportBrewery').value;
        
        if (!dropdown) return;
        
        if (query.length < 1 && brewery) {
            await loadBreweryBeers(brewery);
            return;
        }
        
        if (query.length < config.minSearchLength) {
            hideDropdown('beerNameDropdown');
            return;
        }
        
        try {
            const beers = brewery ? 
                await modules.api.getBreweryBeers(brewery, query) : 
                [];
            
            if (beers.length === 0) {
                displayAddNewBeerOption(query, brewery);
            } else {
                displayBeerDropdown(beers, brewery, query);
            }
        } catch (error) {
            console.error('Error searching beers:', error);
            hideDropdown('beerNameDropdown');
        }
    }, config.debounceDelay);
    
    const displayBeerDropdown = (beers, brewery, searchQuery = null) => {
        const dropdown = document.getElementById('beerNameDropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = '';
        
        // Header
        const header = createDropdownHeader(
            searchQuery ? 
                `🔍 ${beers.length} matches for "${searchQuery}"` :
                `🍺 ${beers.length} ${brewery} Beers`
        );
        dropdown.appendChild(header);
        
        // Add new beer option
        const addNewItem = createAddNewItem(
            `➕ Add New Beer for ${brewery}`,
            'Add a beer not in our database',
            'add-new-beer'
        );
        dropdown.appendChild(addNewItem);
        
        // Beer items
        beers.forEach(beer => {
            const item = createBeerItem(beer);
            dropdown.appendChild(item);
        });
        
        showDropdown('beerNameDropdown');
    };
    
    const createBeerItem = (beer) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item beer-item';
        item.innerHTML = `
            <strong>${utils.escapeHtml(beer.name)}</strong><br>
            <small style="color: var(--text-muted);">
                ${utils.escapeHtml(beer.style || 'Unknown style')} • ${beer.abv || '?'}% ABV
                ${beer.gluten_status ? ' • ' + beer.gluten_status.replace('_', ' ') : ''}
            </small>
        `;
        item.dataset.action = 'select-beer';
        item.dataset.beerData = JSON.stringify(beer);
        return item;
    };
    
    const displayAddNewBeerOption = (query, brewery) => {
        const dropdown = document.getElementById('beerNameDropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = `
            <div class="suggestion-item add-new-item" data-action="use-beer-name">
                <strong>➕ Add "${utils.escapeHtml(query)}" as new beer</strong>
                <small style="color: var(--text-muted);">
                    ${brewery ? 'for ' + brewery : "We'll add this to our database"}
                </small>
            </div>
        `;
        
        showDropdown('beerNameDropdown');
    };
    
    const showAddNewBeerDropdown = (brewery) => {
        const dropdown = document.getElementById('beerNameDropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = '';
        
        const header = createDropdownHeader(`📝 No ${brewery} Beers in Database`);
        dropdown.appendChild(header);
        
        const addItem = createAddNewItem(
            `➕ Add First Beer for ${brewery}`,
            `Be the first to add a ${brewery} beer!`,
            'focus-beer-name'
        );
        dropdown.appendChild(addItem);
        
        showDropdown('beerNameDropdown');
    };
    
    const selectBeer = (beerData) => {
        const beer = JSON.parse(beerData);
        
        // Fill fields
        document.getElementById('reportBeerName').value = beer.name;
        document.getElementById('reportBeerStyle').value = beer.style || '';
        document.getElementById('reportBeerABV').value = beer.abv || '';
        
        // IMPORTANT: Store the beer_id in a data attribute or hidden field
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput && beer.beer_id) {
            beerNameInput.dataset.beerId = beer.beer_id;
        }
        
        hideDropdown('beerNameDropdown');
        
        // Visual feedback
        addAutoFillAnimation(['reportBeerName', 'reportBeerStyle', 'reportBeerABV']);
        
        utils.showToast(`✅ Selected: ${beer.name} (${beer.abv}% ${beer.style})!`);
        
        // Focus next empty field
        focusNextEmptyField(['reportFormat', 'reportPhoto']);
        
        modules.tracking?.trackEvent('beer_selected', 'Form', beer.name);
    };
    
    // ================================
    // BEER STYLE AUTOCOMPLETE
    // ================================
    const searchBeerStyles = utils.debounce((query) => {
        const dropdown = document.getElementById('beerStyleDropdown');
        if (!dropdown || query.length < 2) {
            hideDropdown('beerStyleDropdown');
            return;
        }
        
        const filtered = Constants.BEER_STYLES.filter(style => 
            style.toLowerCase().includes(query.toLowerCase())
        );
        
        displayStyleDropdown(dropdown, filtered);
    }, config.debounceDelay);
    
    const displayStyleDropdown = (dropdown, styles) => {
        if (styles.length === 0) {
            hideDropdown('beerStyleDropdown');
            return;
        }
        
        dropdown.innerHTML = styles.map(style => 
            `<div class="suggestion-item" data-action="select-style" data-style="${style}">${style}</div>`
        ).join('');
        
        showDropdown('beerStyleDropdown');
    };
    
    const selectStyle = (style) => {
        document.getElementById('reportBeerStyle').value = style;
        hideDropdown('beerStyleDropdown');
        modules.tracking?.trackEvent('style_selected', 'Form', style);
    };
    
    // ================================
    // GF STATUS FLOW
    // ================================
    const GFStatusFlow = {
        currentPub: null,
        selectedStatus: null,
        initialized: false, 
    
        init() {
            console.trace('🔍 DEBUG: GFStatusFlow.init() called!');
            // Only initialize once
            if (this.initialized) return;
            this.initialized = true;
            console.log('✅ GFStatusFlow initialized');
        },
        
        openStatusModal() {
            console.trace('🔍 DEBUG: Opening GF status modal from GFStatusFlow.openStatusModal');
            console.log('Current pub:', this.currentPub);
            // console.log('🔍 Opening GF status modal');
            
            // IMPORTANT: Get fresh pub data when button is clicked
            this.currentPub = utils.getCurrentPub();
            
            if (!this.currentPub || !this.currentPub.pub_id) {
                console.error('❌ No current pub data');
                utils.showToast('❌ No pub selected', 'error');
                return;
            }
            
            // Reset selected status
            this.selectedStatus = null;
            
            // Set pub name in modal
            const pubNameEl = document.getElementById('statusPubName');
            if (pubNameEl) {
                pubNameEl.textContent = this.currentPub.name;
            }
            
            // Use modalManager if available
            if (modules.modalManager) {
                console.log('🔍 DEBUG: About to call modalManager.open');
                modules.modalManager.open('gfStatusModal');
            } else {
                const modal = document.getElementById('gfStatusModal');
                if (modal) {
                    modal.style.display = 'flex';
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            }
        },
        
        selectStatus(status) {
            console.log('🔍 Status selected:', status);
            this.selectedStatus = status;
            
            // Close status selection modal using modalManager
            if (modules.modalManager) {
                modules.modalManager.close('gfStatusModal');
            } else {
                modules.modal.close('gfStatusModal');
            }
            
            // Update confirmation display
            const confirmStatusEl = document.getElementById('confirmStatus');
            const statusLabels = {
                'always_tap_cask': '⭐ Always Has Tap/Cask',
                'always_bottle_can': '✅ Always Has Bottles/Cans',
                'currently': '🔵 Available Now',
                'not_currently': '❌ Not Available',
                'unknown': '❓ Not Sure'
            };
            
            if (confirmStatusEl) {
                confirmStatusEl.innerHTML = statusLabels[status] || status;
            }
            
            // Show confirmation modal
            setTimeout(() => {
                if (modules.modalManager) {
                    modules.modalManager.open('gfStatusConfirmModal');
                } else {
                    modules.modal.open('gfStatusConfirmModal');
                }
            }, 100);
        },
        
        // ================================
        // FIX FOR GF STATUS UPDATE - REPLACE the confirmStatusUpdate function in forms.js (around line 685)
        // ================================
        
        async confirmStatusUpdate() {
            console.log('🔍 Confirming status update');
            
            // Get the current pub data properly
            const pubToUpdate = this.currentPub || utils.getCurrentPub();
            
            if (!pubToUpdate || !pubToUpdate.pub_id) {
                console.error('❌ No pub data available:', pubToUpdate);
                utils.showToast('❌ Error: No pub selected', 'error');
                return;
            }
            
            if (!this.selectedStatus) {
                console.error('❌ No status selected');
                utils.showToast('❌ Please select a status', 'error');
                return;
            }
            
            // Log what we're sending
            console.log('📤 Sending update:', {
                pub_id: pubToUpdate.pub_id,
                status: this.selectedStatus
            });
            
            // Close modals first
            if (modules.modalManager) {
                modules.modalManager.closeGroup('status');
            } else {
                modules.modal?.close('gfStatusConfirmModal');
                modules.modal?.close('gfStatusModal');
            }
            
            // Show loading
            utils.showLoadingToast('Updating status...');
            
            try {
                const response = await fetch('/api/update-gf-status', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        pub_id: parseInt(pubToUpdate.pub_id), // Ensure it's a number
                        status: this.selectedStatus
                    })
                });
                
                // Log response for debugging
                console.log('📥 Response status:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ Server error:', errorText);
                    throw new Error(`Server error: ${response.status}`);
                }
                
                const result = await response.json();
                utils.hideLoadingToast();
                
                // UPDATE THE DISPLAY IMMEDIATELY
                this.updateStatusDisplay(this.selectedStatus);
                
                // Update the current pub state
                const currentPub = window.App.getState(STATE_KEYS.CURRENT_PUB);
                if (currentPub) {
                    window.App.setState(STATE_KEYS.CURRENT_PUB, {
                        ...currentPub,
                        gf_status: this.selectedStatus
                    });
                }
                
                // Show success
                utils.showToast('✅ Status updated successfully!');
                
                // Track event
                modules.tracking?.trackEvent('gf_status_updated', 'Form', this.selectedStatus);
                
                // CHECK IF WE SHOULD PROMPT FOR BEER DETAILS
                if (this.selectedStatus === 'always_tap_cask' || 
                    this.selectedStatus === 'always_bottle_can' || 
                    this.selectedStatus === 'currently') {
                    
                    // Show the beer details prompt modal after a short delay
                    setTimeout(() => {
                        if (modules.modalManager) {
                            modules.modalManager.open('beerDetailsPromptModal');
                        } else {
                            modules.modal?.open('beerDetailsPromptModal');
                        }
                    }, 500);
                }
                
            } catch (error) {
                console.error('❌ Error updating status:', error);
                utils.hideLoadingToast();
                utils.showToast('❌ Failed to update status. Please try again.', 'error');
            }
        },
        
        updateStatusDisplay(status) {
            const statusEl = document.getElementById('currentGFStatus');
            if (!statusEl) return;
            
            const displays = {
                'always_tap_cask': {
                    icon: '⭐',
                    text: 'Always Has Tap/Cask',
                    meta: 'The holy grail of GF beer!'
                },
                'always_bottle_can': {
                    icon: '✅',
                    text: 'Always Has Bottles/Cans',
                    meta: 'Reliable GF options'
                },
                'currently': {
                    icon: '🔵',
                    text: 'Available Now',
                    meta: 'GF beer in stock'
                },
                'not_currently': {
                    icon: '❌',
                    text: 'Not Available',
                    meta: 'No GF options currently'
                },
                'unknown': {
                    icon: '❓',
                    text: 'Not Sure',
                    meta: 'Help us find out!'
                }
            };
            
            const display = displays[status] || displays.unknown;
            
            statusEl.className = `current-status ${status}`;
            statusEl.innerHTML = `
                <span class="status-icon">${display.icon}</span>
                <span class="status-text">${display.text}</span>
                <span class="status-meta">${display.meta}</span>
            `;
            
            // Also update the status card question if the status is now known
            if (status !== 'unknown') {
                const questionEl = document.querySelector('.status-question');
                if (questionEl) {
                    questionEl.innerHTML = '🍺 GF Beer Status';
                }
            }
        }
    };
    
    // ================================
    // DROPDOWN HELPERS
    // ================================
    const showDropdown = (dropdownId) => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.style.display = 'block';
            state.dropdownsOpen.add(dropdownId);
        }
    };
    
    const hideDropdown = (dropdownId) => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.style.display = 'none';
            state.dropdownsOpen.delete(dropdownId);
        }
    };
    
    const hideAllDropdowns = () => {
        ['breweryDropdown', 'beerNameDropdown', 'beerStyleDropdown', 'pubSuggestions']
            .forEach(id => hideDropdown(id));
    };
    
    // ================================
    // UI HELPERS
    // ================================
    const createDropdownHeader = (text) => {
        const header = document.createElement('div');
        header.className = 'dropdown-header';
        header.innerHTML = text;
        return header;
    };
    
    const createSuggestionItem = (text, action, data = {}) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<strong>${utils.escapeHtml(text)}</strong>`;
        item.dataset.action = action;
        Object.entries(data).forEach(([key, value]) => {
            item.dataset[key] = value;
        });
        return item;
    };
    
    const createAddNewItem = (title, subtitle, action) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item add-new-item';
        item.innerHTML = `
            <strong>${title}</strong><br>
            <small style="color: var(--text-muted);">${subtitle}</small>
        `;
        item.dataset.action = action;
        return item;
    };
    
    const addAutoFillAnimation = (fieldIds) => {
        fieldIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('auto-filled');
                setTimeout(() => element.classList.remove('auto-filled'), 2000);
            }
        });
    };
    
    const focusNextEmptyField = (fieldIds) => {
        for (const id of fieldIds) {
            const field = document.getElementById(id);
            if (field && !field.value) {
                field.focus();
                break;
            }
        }
    };
    
    // ================================
    // EVENT DELEGATION
    // ================================
    const setupEventDelegation = () => {
        // Main click handler for all form actions
        document.addEventListener('click', handleFormAction);
        
        // Hide dropdowns when clicking outside
        document.addEventListener('click', handleOutsideClick, true);
    };
    
    const handleFormAction = (e) => {
        const action = e.target.closest('[data-action]');
        if (!action) return;
        
        // Prevent default for all form actions
        e.preventDefault();
        e.stopPropagation();
        
        const actionHandlers = {
            'select-pub': () => selectPub(action),
            'add-new-pub': () => showNewPubFields(),
            'clear-selected-pub': () => clearSelectedPub(),
            'select-brewery': () => selectBrewery(action.dataset.brewery),
            'select-beer': () => selectBeer(action.dataset.beerData),
            'add-new-beer': () => {
                document.getElementById('reportBeerName').value = '';
                document.getElementById('reportBeerName').focus();
                hideDropdown('beerNameDropdown');
            },
            'use-beer-name': () => {
                hideDropdown('beerNameDropdown');
                document.getElementById('reportBeerStyle').focus();
            },
            'focus-beer-name': () => {
                hideDropdown('beerNameDropdown');
                document.getElementById('reportBeerName').focus();
                const brewery = utils.getCurrentBrewery();
                utils.showToast(`🎉 Adding first beer for ${brewery}!`);
            },
            'select-style': () => selectStyle(action.dataset.style),
            'change-gf-status': () => {
                console.trace('🔍 DEBUG: Opening GF status modal from forms.js action handler');
                GFStatusFlow.openStatusModal()
            },
            'select-status': () => GFStatusFlow.selectStatus(action.dataset.status),
            'confirm-status': () => GFStatusFlow.confirmStatusUpdate(),
            'cancel-status': () => modules.modal.close('gfStatusConfirmModal'),
            'skip-details': () => {
                modules.modal.close('beerDetailsPromptModal');
                utils.showToast('✅ Status updated successfully!');
            },
            'add-beer-details': () => {
                modules.modal.close('beerDetailsPromptModal');
                modules.modal.openReportModal(GFStatusFlow.currentPub);
            }
        };
        
        const handler = actionHandlers[action.dataset.action];
        if (handler) {
            handler();
        }
    };
    
    const handleOutsideClick = (e) => {
        // Check each dropdown
        const dropdownChecks = [
            { input: 'reportBrewery', dropdown: 'breweryDropdown', container: '.brewery-dropdown-container' },
            { input: 'reportBeerName', dropdown: 'beerNameDropdown', container: '.beer-name-container' },
            { input: 'reportBeerStyle', dropdown: 'beerStyleDropdown', container: '.beer-style-container' },
            { input: 'reportPubSearch', dropdown: 'pubSuggestions', container: null }
        ];
        
        dropdownChecks.forEach(({ input, dropdown, container }) => {
            const clickedInside = e.target.closest(`#${input}`) || 
                                 e.target.closest(`#${dropdown}`) ||
                                 (container && e.target.closest(container));
            
            if (!clickedInside) {
                hideDropdown(dropdown);
            }
        });
    };
    
    // ================================
    // INPUT LISTENERS
    // ================================
    const setupInputListeners = () => {
        // Pub search
        const pubSearchInput = document.getElementById('reportPubSearch');
        if (pubSearchInput) {
            pubSearchInput.addEventListener('input', (e) => searchPubs(e.target.value));
            pubSearchInput.addEventListener('focus', (e) => {
                if (e.target.value.length >= config.minSearchLength) {
                    searchPubs(e.target.value);
                }
            });
        }
        
        // Brewery input
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) {
            breweryInput.addEventListener('input', (e) => searchBreweries(e.target.value));
            breweryInput.addEventListener('focus', (e) => {
                if (!e.target.value) searchBreweries('');
            });
            breweryInput.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!e.target.value) searchBreweries('');
            });
        }
        
        // Beer name input
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) {
            beerNameInput.addEventListener('input', (e) => searchBeerNames(e.target.value));
            beerNameInput.addEventListener('focus', (e) => {
                const brewery = document.getElementById('reportBrewery').value;
                if (brewery && !e.target.value) {
                    loadBreweryBeers(brewery);
                }
            });
        }
        
        // Beer style input
        const beerStyleInput = document.getElementById('reportBeerStyle');
        if (beerStyleInput) {
            beerStyleInput.addEventListener('input', (e) => searchBeerStyles(e.target.value));
        }
    };
    
    // ================================
    // PHOTO UPLOAD
    // ================================
    const initializePhotoUpload = () => {
        const photoInput = document.getElementById('reportPhoto');
        const photoLabel = document.querySelector('.photo-upload-compact');
        
        if (!photoInput || !photoLabel) return;
        
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const fileName = file.name.length > 20 ? 
                    file.name.substring(0, 17) + '...' : 
                    file.name;
                
                photoLabel.classList.add('active');
                const textEl = photoLabel.querySelector('.photo-upload-text');
                if (textEl) {
                    textEl.innerHTML = `
                        <strong>📸 ${fileName}</strong><br>
                        <small>Click to change photo</small>
                    `;
                }
                
                modules.tracking?.trackEvent('photo_selected', 'Form', 'photo_upload');
            }
        });
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🔧 Initializing Form Module');
        
        setupEventDelegation();
        setupInputListeners();
        initializePhotoUpload();

        // Close dropdowns when scrolling the form
        const modalForm = document.querySelector('.report-modal .modal-form');
        if (modalForm) {
            modalForm.addEventListener('scroll', () => {
                hideAllDropdowns();
            });
        }
        
        console.log('✅ Form Module initialized');
    };
    
    const initReportDropdowns = () => {
        console.log('🔧 Initializing report form dropdowns');
        hideAllDropdowns();
        initializePhotoUpload();
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        handleReportSubmission,
        searchBreweries,
        searchBeerNames,
        searchBeerStyles,
        selectBrewery,
        selectBeer,
        clearSelectedPub,
        initReportDropdowns,
        resetReportForm,
        GFStatusFlow,
        getSelectedPub: utils.getSelectedPub,
        getCurrentBrewery: utils.getCurrentBrewery
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', FormModule.init);
} else {
    FormModule.init();
}
