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
            venue: null
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
        getSelectedVenue: () => window.App.getState(STATE_KEYS.SELECTED_PUB_FOR_REPORT),
        
        setSelectedVenue: (venueData) => window.App.setState(STATE_KEYS.SELECTED_PUB_FOR_REPORT, venueData),
        
        getCurrentVenue: () => window.App.getState(STATE_KEYS.CURRENT_PUB),
        
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
        event.stopPropagation(); // Add this to prevent duplicate submissions
    
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
        } // <-- This closing brace was missing!
    
        // Prevent duplicate submissions
        if (state.isSubmitting) {
            console.log('⚠️ Submission already in progress');
            return;
        }
        
        state.isSubmitting = true; // Set flag immediately
        
        console.log('📝 Handling report submission...');
        
        const form = event.target.closest('form') || document.getElementById('reportForm');
        if (!form) {
            console.error('❌ Form not found');
            state.isSubmitting = false;
            return;
        }
        
        const formData = new FormData(form);
        
        // Collect and validate form data
        const reportData = collectReportData(formData);
        console.log('🔍 Report data collected:', reportData);
        
        const validation = validateReportForm(reportData);
        console.log('✅ Validation result:', validation);
        
        if (!validation.isValid) {
            utils.showToast(`❌ Please fill in: ${validation.errors.join(', ')}`, 'error');
            state.isSubmitting = false; // Reset flag
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
    
    const collectReportData = (formData) => {
        // First try FormData, then fallback to direct element access
        const reportData = {
            beer_format: formData.get('reportFormat') || document.getElementById('reportFormat')?.value || '',
            brewery: formData.get('reportBrewery') || document.getElementById('reportBrewery')?.value || '',
            beer_name: formData.get('reportBeerName') || document.getElementById('reportBeerName')?.value || '',
            beer_style: formData.get('reportBeerStyle') || document.getElementById('reportBeerStyle')?.value || '',
            beer_abv: formData.get('reportBeerABV') || document.getElementById('reportBeerABV')?.value || '',
            notes: formData.get('reportNotes') || document.getElementById('reportNotes')?.value || ''
        };
    
        // ADD THIS: Check for beer_id
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput?.dataset.beerId) {
            reportData.beer_id = parseInt(beerNameInput.dataset.beerId);
        }
        
        // Add venue data - check both selected venue state and current venue state
        const selectedVenue = utils.getSelectedVenue() || utils.getCurrentVenue();
        
        if (selectedVenue && selectedVenue.venue_id) {
            // Using existing venue from database
            reportData.venue_id = parseInt(selectedVenue.venue_id) || parseInt(selectedVenue.id);
            reportData.venue_name = selectedVenue.name;
            console.log('🏠 Using selected venue:', selectedVenue.name, 'ID:', reportData.venue_id);
        } else {
            // Manual venue entry or new venue
            const venueNameField = document.getElementById('reportVenueName');
            const addressField = document.getElementById('reportAddress');
            const postcodeField = document.getElementById('reportPostcode');
            
            reportData.venue_name = venueNameField?.value || formData.get('reportVenueName') || '';
            reportData.address = addressField?.value || formData.get('reportAddress') || '';
            reportData.postcode = postcodeField?.value || formData.get('reportPostcode') || '';
            
            // Don't send venue_id if it's a new venue
            reportData.venue_id = null;
            
            console.log('🏠 Using manual venue data:', reportData.venue_name);
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
        
        // Either need venue_id OR venue details
        if (!data.venue_id) {
            if (!data.venue_name) errors.push('Venue Name');
            // Only require address/postcode for new venues
            if (data.venue_name && (!data.address || !data.postcode)) {
                console.warn('⚠️ New venue missing address/postcode - may fail validation');
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
        
        // IMPORTANT: Refresh the current venue to show the new beer
        const currentVenue = utils.getCurrentVenue();
        if (currentVenue && currentVenue.venue_id) {
            // Refresh venue details to get updated beer list
            const searchModule = window.App?.getModule('search');
            if (searchModule) {
                searchModule.showVenueDetails(currentVenue.venue_id);
            }
        }
        
        // Return to home view if not on venue details
        if (!currentVenue) {
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
        ['venueDetailsOverlay', 'resultsOverlay'].forEach(id => {
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
        utils.setSelectedVenue(null);
        utils.setCurrentBrewery(null);
        
        // Reset UI
        document.getElementById('selectedVenueInfo').style.display = 'none';
        document.getElementById('newVenueFields').style.display = 'none';
        document.getElementById('venueSearchGroup').style.display = 'block';
        
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
    const searchVenues = utils.debounce(async (query) => {
        const suggestionsDiv = document.getElementById('venueSuggestions');
        if (!suggestionsDiv) return;
        
        if (query.length < config.minSearchLength) {
            hideDropdown('venueSuggestions');
            return;
        }
        
        try {
            const suggestions = await modules.api.getVenueSuggestions(query, 'name', false);
            
            if (suggestions.length === 0) {
                displayNoResultsOption(suggestionsDiv, query);
            } else {
                displayVenueSuggestions(suggestionsDiv, suggestions);
            }
            
            showDropdown('venueSuggestions');
        } catch (error) {
            console.error('Error searching venues:', error);
            hideDropdown('venueSuggestions');
        }
    }, config.debounceDelay);
    
    const displayNoResultsOption = (container, query) => {
        container.innerHTML = `
            <div class="suggestion-item add-new" data-action="add-new-venue">
                <strong>➕ Add "${utils.escapeHtml(query)}" as new venue</strong>
                <small>Can't find it? Add it to our database!</small>
            </div>
        `;
    };
    
    const displayVenueSuggestions = (container, suggestions) => {
        container.innerHTML = suggestions.map(venue => `
            <div class="suggestion-item" data-venue-id="${venue.venue_id}" data-action="select-venue">
                <strong>${utils.escapeHtml(venue.name)}</strong>
                <small>${utils.escapeHtml(venue.address)}, ${utils.escapeHtml(venue.postcode)}</small>
            </div>
        `).join('');
    };
    
    const selectVenue = (venueElement) => {
        const venueId = venueElement.dataset.venueId;
        const venueName = venueElement.querySelector('strong').textContent;
        const venueDetails = venueElement.querySelector('small').textContent;
        const [address, postcode] = venueDetails.split(', ');
        
        const venueData = {
            venue_id: parseInt(venueId),
            name: venueName,
            address,
            postcode
        };
        
        utils.setSelectedVenue(venueData);
        updateSelectedVenueUI(venueData);
        hideDropdown('venueSuggestions');
        
        modules.tracking?.trackEvent('venue_selected', 'Form', venueName);
    };
    
    const updateSelectedVenueUI = (venueData) => {
        document.getElementById('selectedVenueInfo').style.display = 'block';
        document.getElementById('selectedVenueName').textContent = venueData.name;
        document.getElementById('selectedVenueAddress').textContent = `${venueData.address}, ${venueData.postcode}`;
        document.getElementById('venueSearchGroup').style.display = 'none';
    };
    
    const showNewVenueFields = () => {
        document.getElementById('newVenueFields').style.display = 'block';
        document.getElementById('venueSearchGroup').style.display = 'none';
        document.getElementById('reportVenueName').value = document.getElementById('reportVenueSearch').value;
        
        hideDropdown('venueSuggestions');
        document.getElementById('reportAddress').focus();
    };
    
    const clearSelectedVenue = () => {
        utils.setSelectedVenue(null);
        
        document.getElementById('selectedVenueInfo').style.display = 'none';
        document.getElementById('venueSearchGroup').style.display = 'block';
        document.getElementById('reportVenueSearch').value = '';
        document.getElementById('reportVenueSearch').focus();
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
        currentVenue: null,
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
            console.log('Current venue:', this.currentVenue);
            // console.log('🔍 Opening GF status modal');
            
            // IMPORTANT: Get fresh venue data when button is clicked
            this.currentVenue = utils.getCurrentVenue();
            
            if (!this.currentVenue || !this.currentVenue.venue_id) {
                console.error('❌ No current venue data');
                utils.showToast('❌ No venue selected', 'error');
                return;
            }
            
            // Reset selected status
            this.selectedStatus = null;
            
            // Set venue name in modal
            const venueNameEl = document.getElementById('statusVenueName');
            if (venueNameEl) {
                venueNameEl.textContent = this.currentVenue.name;
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
            
            // Get the current venue data properly
            const venueToUpdate = this.currentVenue || utils.getCurrentVenue();
            
            if (!venueToUpdate || !venueToUpdate.venue_id) {
                console.error('❌ No venue data available:', venueToUpdate);
                utils.showToast('❌ Error: No venue selected', 'error');
                return;
            }
            
            if (!this.selectedStatus) {
                console.error('❌ No status selected');
                utils.showToast('❌ Please select a status', 'error');
                return;
            }
            
            // Log what we're sending
            console.log('📤 Sending update:', {
                venue_id: venueToUpdate.venue_id,
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
                        venue_id: parseInt(venueToUpdate.venue_id), // Ensure it's a number
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
                
                // Update the current venue state
                const currentVenue = window.App.getState(STATE_KEYS.CURRENT_PUB);
                if (currentVenue) {
                    window.App.setState(STATE_KEYS.CURRENT_PUB, {
                        ...currentVenue,
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
        ['breweryDropdown', 'beerNameDropdown', 'beerStyleDropdown', 'venueSuggestions']
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
            'select-venue': () => selectVenue(action),
            'add-new-venue': () => showNewVenueFields(),
            'clear-selected-venue': () => clearSelectedVenue(),
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
                modules.modal.openReportModal(GFStatusFlow.currentVenue);
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
            { input: 'reportVenueSearch', dropdown: 'venueSuggestions', container: null }
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
        // Venue search
        const venueSearchInput = document.getElementById('reportVenueSearch');
        if (venueSearchInput) {
            venueSearchInput.addEventListener('input', (e) => searchVenues(e.target.value));
            venueSearchInput.addEventListener('focus', (e) => {
                if (e.target.value.length >= config.minSearchLength) {
                    searchVenues(e.target.value);
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
        clearSelectedVenue,
        initReportDropdowns,
        resetReportForm,
        GFStatusFlow,
        getSelectedVenue: utils.getSelectedVenue,
        getCurrentBrewery: utils.getCurrentBrewery
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', FormModule.init);
} else {
    FormModule.init();
}
