// ================================================================================
// FORMS.JS - Streamlined Version
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
        searchTimeouts: {},
        dropdownsOpen: new Set(),
        isSubmitting: false
    };
    
    const config = {
        debounceDelay: 300,
        minSearchLength: 2,
        maxSuggestions: 20
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
        getSelectedVenue: () => window.App.getState(STATE_KEYS.SELECTED_VENUE_FOR_REPORT),
        setSelectedVenue: (venueData) => window.App.setState(STATE_KEYS.SELECTED_VENUE_FOR_REPORT, venueData),
        getCurrentVenue: () => window.App.getState(STATE_KEYS.CURRENT_VENUE),
        getCurrentBrewery: () => window.App.getState(STATE_KEYS.CURRENT_BREWERY),
        setCurrentBrewery: (brewery) => window.App.setState(STATE_KEYS.CURRENT_BREWERY, brewery),
        
        showToast: (message, type = 'success') => {
            const toastFn = type === 'success' ? window.showSuccessToast : window.showErrorToast;
            if (toastFn) toastFn(message);
            else console.log(type === 'success' ? '✅' : '❌', message);
        },
        
        showLoadingToast: (message) => window.showLoadingToast?.(message),
        hideLoadingToast: () => window.hideLoadingToast?.(),
        
        escapeHtml: (text) => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        debounce: (func, wait) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func(...args), wait);
            };
        },
        
        getFormElements: () => ({
            brewery: document.getElementById('reportBrewery'),
            beerName: document.getElementById('reportBeerName'),
            beerStyle: document.getElementById('reportBeerStyle'),
            beerABV: document.getElementById('reportBeerABV'),
            venueSearch: document.getElementById('reportVenueSearch'),
            venueName: document.getElementById('reportVenueName'),
            address: document.getElementById('reportAddress'),
            postcode: document.getElementById('reportPostcode')
        })
    };
    
    // ================================
    // REPORT FORM SUBMISSION
    // ================================
    const handleReportSubmission = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        // Check for nickname first
        let nickname = window.App.getState('userNickname') || localStorage.getItem('userNickname');
        if (!nickname) {
            window.App.setState('pendingActionAfterNickname', () => handleReportSubmission(event));
            modules.modalManager?.open('nicknameModal');
            return;
        }

        if (state.isSubmitting) return;
        state.isSubmitting = true;
        
        const form = event.target.closest('form') || document.getElementById('reportForm');
        if (!form) {
            state.isSubmitting = false;
            return;
        }
        
        const reportData = collectReportData(new FormData(form));
        const validation = validateReportForm(reportData);
        
        if (!validation.isValid) {
            utils.showToast(`❌ Please fill in: ${validation.errors.join(', ')}`, 'error');
            state.isSubmitting = false;
            return;
        }
        
        utils.showLoadingToast('Submitting beer report...');
        
        try {
            const result = await modules.api.submitBeerReport(reportData);
            utils.hideLoadingToast();
            
            if (result.success) {
                handleSubmissionSuccess(result, reportData);
            } else {
                utils.showToast(result.message || 'Failed to submit report', 'error');
            }
        } catch (error) {
            console.error('❌ Error submitting report:', error);
            utils.hideLoadingToast();
            utils.showToast('Error submitting report. Please try again.', 'error');
        } finally {
            state.isSubmitting = false;
        }
    };
    
    const collectReportData = (formData) => {
        const elements = utils.getFormElements();
        
        const reportData = {
            beer_format: formData.get('reportFormat') || document.getElementById('reportFormat')?.value || '',
            brewery: formData.get('reportBrewery') || elements.brewery?.value || '',
            beer_name: formData.get('reportBeerName') || elements.beerName?.value || '',
            beer_style: formData.get('reportBeerStyle') || elements.beerStyle?.value || '',
            beer_abv: formData.get('reportBeerABV') || elements.beerABV?.value || '',
            notes: formData.get('reportNotes') || document.getElementById('reportNotes')?.value || ''
        };

        // DEBUG: Log what we actually collected
        console.log('🔍 Report data collected:', reportData);
        console.log('🔍 FormData entries:', Array.from(formData.entries()));
        console.log('🔍 Format element value:', document.getElementById('reportFormat')?.value);

        // Add beer_id if available
        if (elements.beerName?.dataset.beerId) {
            reportData.beer_id = parseInt(elements.beerName.dataset.beerId);
        }
        
        // Add venue data
        const selectedVenue = utils.getSelectedVenue() || utils.getCurrentVenue();
        if (selectedVenue?.venue_id) {
            reportData.venue_id = parseInt(selectedVenue.venue_id) || parseInt(selectedVenue.id);
            reportData.venue_name = selectedVenue.name;
        } else {
            reportData.venue_name = elements.venueName?.value || formData.get('reportVenueName') || '';
            reportData.address = elements.address?.value || formData.get('reportAddress') || '';
            reportData.postcode = elements.postcode?.value || formData.get('reportPostcode') || '';
            reportData.venue_id = null;
        }
        
        if (reportData.beer_abv) {
            reportData.beer_abv = parseFloat(reportData.beer_abv) || null;
        }
        
        return reportData;
    };
    
    const validateReportForm = (data) => {
        const required = [
            ['beer_format', 'Beer Format'],
            ['brewery', 'Brewery'], 
            ['beer_name', 'Beer Name']
        ];
        
        const errors = required.filter(([key]) => !data[key]).map(([, label]) => label);
        
        if (!data.venue_id && !data.venue_name) {
            errors.push('Venue Name');
        }
        
        return { isValid: errors.length === 0, errors };
    };

    const handleSubmissionSuccess = (result, reportData) => {
        utils.showToast('🎉 Beer report submitted successfully! Thanks for contributing!');
        
        modules.modalManager ? 
            modules.modalManager.close('reportModal') : 
            modules.modal.close('reportModal');
        
        resetReportForm();
        
        const currentVenue = utils.getCurrentVenue();
        if (currentVenue?.venue_id) {
            const searchModule = window.App?.getModule('search');
            searchModule?.showVenueDetails?.(currentVenue.venue_id);
        } else {
            returnToHomeView();
        }
        
        modules.tracking?.trackFormSubmission('beer_report', {
            tier: result.tier,
            status: result.status,
            brewery: reportData.brewery
        });
    };
    
    const returnToHomeView = () => {
        ['venueDetailsOverlay', 'resultsOverlay'].forEach(id => {
            const overlay = document.getElementById(id);
            if (overlay) {
                overlay.style.display = 'none';
                overlay.classList.remove('active');
            }
        });
        
        const heroSection = document.querySelector('.hero-section');
        const searchSection = document.querySelector('.search-section');
        
        if (heroSection) heroSection.style.display = 'block';
        if (searchSection) searchSection.style.display = 'flex';
        
        document.body.style.overflow = '';
    };
    
    const resetReportForm = () => {
        const form = document.getElementById('reportForm');
        if (form) form.reset();
        
        utils.setSelectedVenue(null);
        utils.setCurrentBrewery(null);
        
        document.getElementById('selectedVenueInfo').style.display = 'none';
        document.getElementById('newVenueFields').style.display = 'none';
        document.getElementById('venueSearchGroup').style.display = 'block';
        
        hideAllDropdowns();
        resetPhotoUpload();
    };
    
    const resetPhotoUpload = () => {
        const photoLabel = document.querySelector('.photo-upload-compact');
        if (photoLabel) {
            photoLabel.classList.remove('active');
            const textEl = photoLabel.querySelector('.photo-upload-text');
            if (textEl) {
                textEl.innerHTML = `<strong>Add a photo</strong><br><small>Beer menu, bottle, or tap</small>`;
            }
        }
    };
    
    // ================================
    // VENUE SEARCH & SELECTION
    // ================================
    const searchVenues = utils.debounce(async (query) => {
        const suggestionsDiv = document.getElementById('venueSuggestions');
        if (!suggestionsDiv || query.length < config.minSearchLength) {
            hideDropdown('venueSuggestions');
            return;
        }
        
        try {
            const suggestions = await modules.api.getVenueSuggestions(query, 'name', false);
            
            if (suggestions.length === 0) {
                suggestionsDiv.innerHTML = `
                    <div class="suggestion-item add-new" data-action="add-new-venue">
                        <strong>➕ Add "${utils.escapeHtml(query)}" as new venue</strong>
                        <small>Can't find it? Add it to our database!</small>
                    </div>
                `;
            } else {
                suggestionsDiv.innerHTML = suggestions.map(venue => `
                    <div class="suggestion-item" data-venue-id="${venue.venue_id}" data-action="select-venue">
                        <strong>${utils.escapeHtml(venue.name)}</strong>
                        <small>${utils.escapeHtml(venue.address)}, ${utils.escapeHtml(venue.postcode)}</small>
                    </div>
                `).join('');
            }
            
            showDropdown('venueSuggestions');
        } catch (error) {
            console.error('Error searching venues:', error);
            hideDropdown('venueSuggestions');
        }
    }, config.debounceDelay);
    
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
    // BREWERY & BEER AUTOCOMPLETE
    // ================================
    const searchBreweries = utils.debounce(async (query) => {
        const dropdown = document.getElementById('breweryDropdown');
        if (!dropdown) return;
        
        try {
            const breweries = query.length < 1 ? 
                await modules.api.getBreweries() : 
                await modules.api.getBreweries(query);
            
            displayDropdown(dropdown, 'brewery', breweries.slice(0, query.length < 1 ? 100 : 50), 
                query.length < 1 ? `🍺 ${breweries.length} Breweries Available` : 
                `🔍 ${breweries.length} matches for "${query}"`);
        } catch (error) {
            console.error('Error searching breweries:', error);
            hideDropdown('breweryDropdown');
        }
    }, config.debounceDelay);
    
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
            const beers = brewery ? await modules.api.getBreweryBeers(brewery, query) : [];
            
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
    
    const selectBrewery = async (brewery) => {
        const elements = utils.getFormElements();
        elements.brewery.value = brewery;
        utils.setCurrentBrewery(brewery);
        hideDropdown('breweryDropdown');
        
        clearBeerFields();
        
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
    
    const selectBeer = (beerData) => {
        const beer = JSON.parse(beerData);
        const elements = utils.getFormElements();
        
        elements.beerName.value = beer.beer_name;
        elements.beerStyle.value = beer.style || '';
        elements.beerABV.value = beer.abv || '';
        
        if (beer.beer_id) {
            elements.beerName.dataset.beerId = beer.beer_id;
        }
        
        hideDropdown('beerNameDropdown');
        
        addAutoFillAnimation(['reportBeerName', 'reportBeerStyle', 'reportBeerABV']);
        utils.showToast(`✅ Selected: ${beer.beer_name} (${beer.abv}% ${beer.style})!`);
        focusNextEmptyField(['reportFormat', 'reportPhoto']);
        
        modules.tracking?.trackEvent('beer_selected', 'Form', beer.beer_name);
    };
    
    // ================================
    // DROPDOWN HELPERS
    // ================================
    const displayDropdown = (dropdown, type, items, headerText) => {
        if (!dropdown || items.length === 0) {
            hideDropdown(dropdown.id);
            return;
        }
        
        // Remove any inline styles and use CSS classes
        dropdown.className = `suggestions ${type}-suggestions`;
        dropdown.innerHTML = `
            <div class="dropdown-header">${headerText}</div>
            ${items.map(item => createSuggestionItem(item, `select-${type}`, { [type]: item })).join('')}
        `;
        
        showDropdown(dropdown.id);
    };
    
    const displayBeerDropdown = (beers, brewery, searchQuery = null) => {
        const dropdown = document.getElementById('beerNameDropdown');
        if (!dropdown) return;
        
        const headerText = searchQuery ? 
            `🔍 ${beers.length} matches for "${searchQuery}"` :
            `🍺 ${beers.length} ${brewery} Beers`;
        
        dropdown.className = 'suggestions beer-suggestions';
        dropdown.innerHTML = `
            <div class="dropdown-header">${headerText}</div>
            <div class="suggestion-item add-new-item" data-action="add-new-beer">
                <strong>➕ Add New Beer for ${brewery}</strong>
                <small>Add a beer not in our database</small>
            </div>
            ${beers.map(beer => createBeerItem(beer)).join('')}
        `;
        
        showDropdown('beerNameDropdown');
    };
    
    const createBeerItem = (beer) => {
        return `
            <div class="suggestion-item beer-item" data-action="select-beer" data-beer-data='${JSON.stringify(beer)}'>
                <strong>${utils.escapeHtml(beer.beer_name)}</strong><br>
                <small>
                    ${utils.escapeHtml(beer.style || 'Unknown style')} • ${beer.abv || '?'}% ABV
                    ${beer.gluten_status ? ' • ' + beer.gluten_status.replace('_', ' ') : ''}
                </small>
            </div>
        `;
    };
    
    const createSuggestionItem = (text, action, data = {}) => {
        const dataAttrs = Object.entries(data).map(([key, value]) => `data-${key}="${value}"`).join(' ');
        return `<div class="suggestion-item" data-action="${action}" ${dataAttrs}><strong>${utils.escapeHtml(text)}</strong></div>`;
    };
    
    const displayAddNewBeerOption = (query, brewery) => {
        const dropdown = document.getElementById('beerNameDropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = `
            <div class="suggestion-item add-new-item" data-action="use-beer-name">
                <strong>➕ Add "${utils.escapeHtml(query)}" as new beer</strong>
                <small>
                    ${brewery ? 'for ' + brewery : "We'll add this to our database"}
                </small>
            </div>
        `;
        
        showDropdown('beerNameDropdown');
    };
    
    const showAddNewBeerDropdown = (brewery) => {
        const dropdown = document.getElementById('beerNameDropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = `
            <div class="dropdown-header">📝 No ${brewery} Beers in Database</div>
            <div class="suggestion-item add-new-item" data-action="focus-beer-name">
                <strong>➕ Add First Beer for ${brewery}</strong><br>
                <small>Be the first to add a ${brewery} beer!</small>
            </div>
        `;
        
        showDropdown('beerNameDropdown');
    };
    
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
    // GF STATUS FLOW
    // ================================
    const GFStatusFlow = {
        currentVenue: null,
        selectedStatus: null,
        initialized: false,
    
        init() {
            if (this.initialized) return;
            this.initialized = true;
            console.log('✅ GFStatusFlow initialized');
        },
        
        openStatusModal() {
            this.currentVenue = utils.getCurrentVenue();
            
            if (!this.currentVenue?.venue_id) {
                console.error('❌ No current venue data');
                utils.showToast('❌ No venue selected', 'error');
                return;
            }
            
            this.selectedStatus = null;
            
            const venueNameEl = document.getElementById('statusVenueName');
            if (venueNameEl) {
                venueNameEl.textContent = this.currentVenue.name;
            }
            
            modules.modalManager ? 
                modules.modalManager.open('gfStatusModal') :
                openModal('gfStatusModal');
        },
        
        selectStatus(status) {
            this.selectedStatus = status;
            
            modules.modalManager ? 
                modules.modalManager.close('gfStatusModal') :
                modules.modal.close('gfStatusModal');
            
            const statusLabels = {
                'always_tap_cask': '⭐ Always Has Tap/Cask',
                'always_bottle_can': '✅ Always Has Bottles/Cans',
                'currently': '🔵 Available Now',
                'not_currently': '❌ Not Available',
                'unknown': '❓ Not Sure'
            };
            
            const confirmStatusEl = document.getElementById('confirmStatus');
            if (confirmStatusEl) {
                confirmStatusEl.innerHTML = statusLabels[status] || status;
            }
            
            setTimeout(() => {
                modules.modalManager ? 
                    modules.modalManager.open('gfStatusConfirmModal') :
                    modules.modal.open('gfStatusConfirmModal');
            }, 100);
        },
        
        async confirmStatusUpdate() {
            const venueToUpdate = this.currentVenue || utils.getCurrentVenue();
            
            if (!venueToUpdate?.venue_id || !this.selectedStatus) {
                utils.showToast('❌ Error: Missing venue or status', 'error');
                return;
            }
            
            modules.modalManager ? 
                modules.modalManager.closeGroup('status') :
                [modules.modal?.close('gfStatusConfirmModal'), modules.modal?.close('gfStatusModal')];
            
            utils.showLoadingToast('Updating status...');
            
            try {
                const response = await fetch('/api/update-gf-status', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        venue_id: parseInt(venueToUpdate.venue_id),
                        status: this.selectedStatus
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }
                
                await response.json();
                utils.hideLoadingToast();
                
                this.updateStatusDisplay(this.selectedStatus);
                
                const currentVenue = window.App.getState(STATE_KEYS.CURRENT_VENUE);
                if (currentVenue) {
                    window.App.setState(STATE_KEYS.CURRENT_VENUE, {
                        ...currentVenue,
                        gf_status: this.selectedStatus
                    });
                }
                
                utils.showToast('✅ Status updated successfully!');
                modules.tracking?.trackEvent('gf_status_updated', 'Form', this.selectedStatus);
                
                if (['always_tap_cask', 'always_bottle_can', 'currently'].includes(this.selectedStatus)) {
                    setTimeout(() => {
                        modules.modalManager ? 
                            modules.modalManager.open('beerDetailsPromptModal') :
                            modules.modal?.open('beerDetailsPromptModal');
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
                'always_tap_cask': { icon: '⭐', text: 'Always Has Tap/Cask', meta: 'The holy grail of GF beer!' },
                'always_bottle_can': { icon: '✅', text: 'Always Has Bottles/Cans', meta: 'Reliable GF options' },
                'currently': { icon: '🔵', text: 'Available Now', meta: 'GF beer in stock' },
                'not_currently': { icon: '❌', text: 'Not Available', meta: 'No GF options currently' },
                'unknown': { icon: '❓', text: 'Not Sure', meta: 'Help us find out!' }
            };
            
            const display = displays[status] || displays.unknown;
            
            statusEl.className = `current-status ${status}`;
            statusEl.innerHTML = `
                <span class="status-icon">${display.icon}</span>
                <span class="status-text">${display.text}</span>
                <span class="status-meta">${display.meta}</span>
            `;
            
            if (status !== 'unknown') {
                const questionEl = document.querySelector('.status-question');
                if (questionEl) {
                    questionEl.innerHTML = '🍺 GF Beer Status';
                }
            }
        }
    };
    
    // ================================
    // UI HELPERS
    // ================================
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
    
    const openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };
    
    // ================================
    // EVENT DELEGATION
    // ================================
    const setupEventDelegation = () => {
        document.addEventListener('click', handleFormAction);
        document.addEventListener('click', handleOutsideClick, true);
    };
    
    const handleFormAction = (e) => {
        const action = e.target.closest('[data-action]');
        if (!action) return;
        
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
            'change-gf-status': () => GFStatusFlow.openStatusModal(),
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
        if (handler) handler();
    };
    
    const handleOutsideClick = (e) => {
        const dropdownChecks = [
            { input: 'reportBrewery', dropdown: 'breweryDropdown' },
            { input: 'reportBeerName', dropdown: 'beerNameDropdown' },
            { input: 'reportVenueSearch', dropdown: 'venueSuggestions' }
        ];
        
        dropdownChecks.forEach(({ input, dropdown }) => {
            const clickedInside = e.target.closest(`#${input}`) || e.target.closest(`#${dropdown}`);
            if (!clickedInside) hideDropdown(dropdown);
        });
    };
    
    // ================================
    // INPUT LISTENERS
    // ================================
    const setupInputListeners = () => {
        const inputs = [
            { id: 'reportVenueSearch', handler: (e) => searchVenues(e.target.value) },
            { id: 'reportBrewery', handler: (e) => searchBreweries(e.target.value) },
            { id: 'reportBeerName', handler: (e) => searchBeerNames(e.target.value) }
        ];
        
        inputs.forEach(({ id, handler }) => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', handler);
                input.addEventListener('focus', (e) => {
                    if (id === 'reportBrewery' && !e.target.value) searchBreweries('');
                    if (id === 'reportBeerName' && !e.target.value) {
                        const brewery = document.getElementById('reportBrewery').value;
                        if (brewery) loadBreweryBeers(brewery);
                    }
                });
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
        
        const modalForm = document.querySelector('.report-modal .modal-form');
        if (modalForm) {
            modalForm.addEventListener('scroll', hideAllDropdowns);
        }
        
        console.log('✅ Form Module initialized');
    };
    
    const initReportDropdowns = () => {
        console.log('🔧 Initializing report form dropdowns');
        hideAllDropdowns();
        
        // // Pre-populate brewery dropdown when modal opens
        // const breweryInput = document.getElementById('reportBrewery');
        // if (breweryInput) {
        //     // Trigger brewery search with empty string to show all breweries
        //     searchBreweries('');
        // }
    };
    
    // ================================
    // VENUELIC API
    // ================================
    return {
        init,
        handleReportSubmission,
        searchBreweries,
        searchBeerNames,
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
