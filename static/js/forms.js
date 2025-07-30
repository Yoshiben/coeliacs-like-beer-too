// ================================================================================
// FORMS.JS - Complete Refactor with STATE_KEYS and Consistency Fixes
// Handles: All form operations, validation, autocomplete, GF status updates
// ================================================================================

import { APIModule } from './api.js';
import { ModalModule } from './modals.js';
import { Constants } from './constants.js';

const STATE_KEYS = Constants.STATE_KEYS;

export const FormModule = (function() {
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
        currentSubmission: null
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
        get tracking() { return window.App?.getModule('tracking'); }
    };
    
    // ================================
    // UTILITIES
    // ================================
    const utils = {
        getSelectedPub() {
            return window.App.getState(STATE_KEYS.SELECTED_PUB_FOR_REPORT);
        },
        
        setSelectedPub(pubData) {
            window.App.setState(STATE_KEYS.SELECTED_PUB_FOR_REPORT, pubData);
        },
        
        getCurrentPub() {
            return window.App.getState(STATE_KEYS.CURRENT_PUB);
        },
        
        getCurrentBrewery() {
            return window.App.getState(STATE_KEYS.CURRENT_BREWERY);
        },
        
        setCurrentBrewery(brewery) {
            window.App.setState(STATE_KEYS.CURRENT_BREWERY, brewery);
        },
        
        showToast(message, type = 'success') {
            if (window.showSuccessToast) {
                window.showSuccessToast(message);
            } else {
                console.log(type === 'success' ? '✅' : '❌', message);
            }
        },
        
        showLoadingToast(message) {
            if (window.showLoadingToast) {
                window.showLoadingToast(message);
            }
        },
        
        hideLoadingToast() {
            if (window.hideLoadingToast) {
                window.hideLoadingToast();
            }
        },
        
        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        debounce(func, wait) {
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
    };
    
    // ================================
    // REPORT FORM SUBMISSION
    // ================================
    async function handleReportSubmission(event) {
        event.preventDefault();
        console.log('📝 Handling report submission...');
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Collect and validate form data
        const reportData = collectReportData(formData);
        const validation = validateReportForm(reportData);
        
        if (!validation.isValid) {
            utils.showToast(`❌ Please fill in: ${validation.errors.join(', ')}`, 'error');
            return;
        }
        
        // Show loading state
        utils.showLoadingToast('Submitting beer report...');
        state.currentSubmission = reportData;
        
        try {
            const result = await modules.api.submitBeerReport(reportData);
            
            utils.hideLoadingToast();
            
            if (result.success) {
                handleSubmissionSuccess(result);
            } else {
                utils.showToast(result.message || 'Failed to submit report', 'error');
            }
        } catch (error) {
            console.error('❌ Error submitting report:', error);
            utils.hideLoadingToast();
            utils.showToast('Error submitting report. Please try again.', 'error');
        } finally {
            state.currentSubmission = null;
        }
    }
    
    function collectReportData(formData) {
        const reportData = {
            beer_format: formData.get('reportFormat') || document.getElementById('reportFormat')?.value,
            brewery: formData.get('reportBrewery') || document.getElementById('reportBrewery')?.value,
            beer_name: formData.get('reportBeerName') || document.getElementById('reportBeerName')?.value,
            beer_style: formData.get('reportBeerStyle') || document.getElementById('reportBeerStyle')?.value,
            beer_abv: formData.get('reportBeerABV') || document.getElementById('reportBeerABV')?.value,
            notes: formData.get('reportNotes') || ''
        };
        
        // Add pub data
        const selectedPub = utils.getSelectedPub();
        if (selectedPub) {
            reportData.pub_id = selectedPub.pub_id;
            reportData.pub_name = selectedPub.name;
            console.log('🏠 Using selected pub:', selectedPub.name);
        } else {
            // Manual pub entry
            reportData.pub_name = formData.get('reportPubName') || document.getElementById('reportPubName')?.value || 'Unknown Pub';
            reportData.address = formData.get('reportAddress') || document.getElementById('reportAddress')?.value || '';
            reportData.postcode = formData.get('reportPostcode') || document.getElementById('reportPostcode')?.value || '';
            console.log('🏠 Using manual pub data');
        }
        
        return reportData;
    }
    
    function validateReportForm(data) {
        const errors = [];
        
        if (!data.beer_format) errors.push('Beer Format');
        if (!data.brewery) errors.push('Brewery');
        if (!data.beer_name) errors.push('Beer Name');
        if (!data.pub_id && !data.pub_name) errors.push('Pub Name');
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    function handleSubmissionSuccess(result) {
        utils.showToast('🎉 Beer report submitted successfully! Thanks for contributing!');
        
        // Close modal properly using ModalModule
        modules.modal.close('reportModal');
        
        // Reset form
        resetReportForm();
        
        // Return to home view
        returnToHomeView();
        
        // Track success
        modules.tracking?.trackEvent('beer_report_submitted', 'Form', 'success');
    }
    
    function returnToHomeView() {
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
    }
    
    function resetReportForm() {
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
    }
    
    function resetPhotoUpload() {
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
    }
    
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
    
    function displayNoResultsOption(container, query) {
        container.innerHTML = `
            <div class="suggestion-item add-new" data-action="add-new-pub">
                <strong>➕ Add "${utils.escapeHtml(query)}" as new pub</strong>
                <small>Can't find it? Add it to our database!</small>
            </div>
        `;
    }
    
    function displayPubSuggestions(container, suggestions) {
        container.innerHTML = suggestions.map(pub => `
            <div class="suggestion-item" data-pub-id="${pub.pub_id}" data-action="select-pub">
                <strong>${utils.escapeHtml(pub.name)}</strong>
                <small>${utils.escapeHtml(pub.address)}, ${utils.escapeHtml(pub.postcode)}</small>
            </div>
        `).join('');
    }
    
    function selectPub(pubElement) {
        const pubId = pubElement.dataset.pubId;
        const pubName = pubElement.querySelector('strong').textContent;
        const pubDetails = pubElement.querySelector('small').textContent;
        const [address, postcode] = pubDetails.split(', ');
        
        const pubData = {
            pub_id: parseInt(pubId),
            name: pubName,
            address: address,
            postcode: postcode
        };
        
        utils.setSelectedPub(pubData);
        updateSelectedPubUI(pubData);
        hideDropdown('pubSuggestions');
        
        modules.tracking?.trackEvent('pub_selected', 'Form', pubName);
    }
    
    function updateSelectedPubUI(pubData) {
        document.getElementById('selectedPubInfo').style.display = 'block';
        document.getElementById('selectedPubName').textContent = pubData.name;
        document.getElementById('selectedPubAddress').textContent = `${pubData.address}, ${pubData.postcode}`;
        document.getElementById('pubSearchGroup').style.display = 'none';
    }
    
    function showNewPubFields() {
        document.getElementById('newPubFields').style.display = 'block';
        document.getElementById('pubSearchGroup').style.display = 'none';
        document.getElementById('reportPubName').value = document.getElementById('reportPubSearch').value;
        
        hideDropdown('pubSuggestions');
        document.getElementById('reportAddress').focus();
    }
    
    function clearSelectedPub() {
        utils.setSelectedPub(null);
        
        document.getElementById('selectedPubInfo').style.display = 'none';
        document.getElementById('pubSearchGroup').style.display = 'block';
        document.getElementById('reportPubSearch').value = '';
        document.getElementById('reportPubSearch').focus();
    }
    
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
    
    function displayBreweryDropdown(breweries, totalCount, searchQuery = null) {
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
    }
    
    async function selectBrewery(brewery) {
        console.log('🍺 Brewery selected:', brewery);
        
        document.getElementById('reportBrewery').value = brewery;
        utils.setCurrentBrewery(brewery);
        hideDropdown('breweryDropdown');
        
        // Clear dependent fields
        clearBeerFields();
        
        // Load beers for this brewery
        try {
            await loadBreweryBeers(brewery);
        } catch (error) {
            console.error('❌ Error loading brewery beers:', error);
        }
        
        modules.tracking?.trackEvent('brewery_selected', 'Form', brewery);
    }
    
    function clearBeerFields() {
        ['reportBeerName', 'reportBeerStyle', 'reportBeerABV'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
    }
    
    async function loadBreweryBeers(brewery) {
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
    }
    
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
    
    function displayBeerDropdown(beers, brewery, searchQuery = null) {
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
    }
    
    function createBeerItem(beer) {
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
    }
    
    function displayAddNewBeerOption(query, brewery) {
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
    }
    
    function showAddNewBeerDropdown(brewery) {
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
    }
    
    function selectBeer(beerData) {
        const beer = JSON.parse(beerData);
        
        // Fill fields
        document.getElementById('reportBeerName').value = beer.name;
        document.getElementById('reportBeerStyle').value = beer.style || '';
        document.getElementById('reportBeerABV').value = beer.abv || '';
        
        hideDropdown('beerNameDropdown');
        
        // Visual feedback
        addAutoFillAnimation(['reportBeerName', 'reportBeerStyle', 'reportBeerABV']);
        
        utils.showToast(`✅ Selected: ${beer.name} (${beer.abv}% ${beer.style})!`);
        
        // Focus next empty field
        focusNextEmptyField(['reportFormat', 'reportPhoto']);
        
        modules.tracking?.trackEvent('beer_selected', 'Form', beer.name);
    }
    
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
    
    function displayStyleDropdown(dropdown, styles) {
        if (styles.length === 0) {
            hideDropdown('beerStyleDropdown');
            return;
        }
        
        dropdown.innerHTML = styles.map(style => 
            `<div class="suggestion-item" data-action="select-style" data-style="${style}">${style}</div>`
        ).join('');
        
        showDropdown('beerStyleDropdown');
    }
    
    function selectStyle(style) {
        document.getElementById('reportBeerStyle').value = style;
        hideDropdown('beerStyleDropdown');
        modules.tracking?.trackEvent('style_selected', 'Form', style);
    }
    
    // ================================
    // GF STATUS FLOW
    // ================================
    const GFStatusFlow = {
        currentPub: null,
        selectedStatus: null,
        
        openStatusModal() {
            console.log('🔍 Opening GF status modal');
            this.currentPub = utils.getCurrentPub();
            
            if (!this.currentPub) {
                console.error('❌ No current pub data');
                utils.showToast('❌ No pub selected', 'error');
                return;
            }
            
            // Set pub name in modal
            const pubNameEl = document.getElementById('statusPubName');
            if (pubNameEl) {
                pubNameEl.textContent = this.currentPub.name;
            }
            
            modules.modal.open('gfStatusModal');
        },
        
        selectStatus(status) {
            this.selectedStatus = status;
            
            // Close status selection modal
            modules.modal.close('gfStatusModal');
            
            // Update confirmation display
            const confirmStatusEl = document.getElementById('confirmStatus');
            const statusLabels = {
                'always': '⭐ Always Available',
                'currently': '✅ Available Now',
                'not_currently': '❌ Not Available',
                'unknown': '❓ Not Sure'
            };
            
            if (confirmStatusEl) {
                confirmStatusEl.innerHTML = statusLabels[status] || status;
            }
            
            // Show confirmation modal
            setTimeout(() => {
                modules.modal.open('gfStatusConfirmModal');
            }, 100);
        },
        
        async confirmStatusUpdate() {
            console.log('🔍 Confirming status update');
            
            const pubToUpdate = this.currentPub || utils.getCurrentPub();
            if (!pubToUpdate || !pubToUpdate.pub_id) {
                console.error('❌ No pub data available');
                utils.showToast('❌ Error: No pub selected', 'error');
                return;
            }
            
            if (!this.selectedStatus) {
                console.error('❌ No status selected');
                return;
            }
            
            // Close modals
            modules.modal.close('gfStatusConfirmModal');
            modules.modal.close('gfStatusModal');
            
            // Show loading
            utils.showLoadingToast('Updating status...');
            
            try {
                const response = await fetch('/api/update-gf-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pub_id: pubToUpdate.pub_id,
                        status: this.selectedStatus
                    })
                });
                
                utils.hideLoadingToast();
                
                if (response.ok) {
                    this.updateStatusDisplay(this.selectedStatus);
                    
                    // Show appropriate follow-up
                    if (this.selectedStatus === 'always' || this.selectedStatus === 'currently') {
                        modules.modal.open('beerDetailsPromptModal');
                    } else {
                        utils.showToast('✅ Status updated successfully!');
                    }
                    
                    modules.tracking?.trackEvent('gf_status_updated', 'Form', this.selectedStatus);
                } else {
                    throw new Error('Failed to update status');
                }
            } catch (error) {
                console.error('Error updating status:', error);
                utils.hideLoadingToast();
                utils.showToast('❌ Failed to update status', 'error');
            }
        },
        
        updateStatusDisplay(status) {
            const statusEl = document.getElementById('currentGFStatus');
            if (!statusEl) return;
            
            const displays = {
                'always': {
                    icon: '⭐',
                    text: 'Always Available',
                    meta: 'Permanent GF options!'
                },
                'currently': {
                    icon: '✅',
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
        }
    };
    
    // ================================
    // DROPDOWN HELPERS
    // ================================
    function showDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.style.display = 'block';
            state.dropdownsOpen.add(dropdownId);
        }
    }
    
    function hideDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.style.display = 'none';
            state.dropdownsOpen.delete(dropdownId);
        }
    }
    
    function hideAllDropdowns() {
        ['breweryDropdown', 'beerNameDropdown', 'beerStyleDropdown', 'pubSuggestions']
            .forEach(id => hideDropdown(id));
    }
    
    // ================================
    // UI HELPERS
    // ================================
    function createDropdownHeader(text) {
        const header = document.createElement('div');
        header.className = 'dropdown-header';
        header.innerHTML = text;
        return header;
    }
    
    function createSuggestionItem(text, action, data = {}) {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<strong>${utils.escapeHtml(text)}</strong>`;
        item.dataset.action = action;
        Object.entries(data).forEach(([key, value]) => {
            item.dataset[key] = value;
        });
        return item;
    }
    
    function createAddNewItem(title, subtitle, action) {
        const item = document.createElement('div');
        item.className = 'suggestion-item add-new-item';
        item.innerHTML = `
            <strong>${title}</strong><br>
            <small style="color: var(--text-muted);">${subtitle}</small>
        `;
        item.dataset.action = action;
        return item;
    }
    
    function addAutoFillAnimation(fieldIds) {
        fieldIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('auto-filled');
                setTimeout(() => element.classList.remove('auto-filled'), 2000);
            }
        });
    }
    
    function focusNextEmptyField(fieldIds) {
        for (const id of fieldIds) {
            const field = document.getElementById(id);
            if (field && !field.value) {
                field.focus();
                break;
            }
        }
    }
    
    // ================================
    // EVENT DELEGATION
    // ================================
    function setupEventDelegation() {
        // Main click handler for all form actions
        document.addEventListener('click', handleFormAction);
        
        // Hide dropdowns when clicking outside
        document.addEventListener('click', handleOutsideClick, true);
    }
    
    function handleFormAction(e) {
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
                modules.modal.openReportModal(GFStatusFlow.currentPub);
            }
        };
        
        const handler = actionHandlers[action.dataset.action];
        if (handler) {
            handler();
        }
    }
    
    function handleOutsideClick(e) {
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
    }
    
    // ================================
    // INPUT LISTENERS
    // ================================
    function setupInputListeners() {
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
    }
    
    // ================================
    // PHOTO UPLOAD
    // ================================
    function initializePhotoUpload() {
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
    }
    
    // ================================
    // INITIALIZATION
    // ================================
    function init() {
        console.log('🔧 Initializing Form Module');
        
        setupEventDelegation();
        setupInputListeners();
        initializePhotoUpload();
        
        // Expose report form handler globally for the form submit
        const reportForm = document.getElementById('reportForm');
        if (reportForm) {
            reportForm.addEventListener('submit', handleReportSubmission);
        }
        
        console.log('✅ Form Module initialized');
    }
    
    function initReportDropdowns() {
        console.log('🔧 Initializing report form dropdowns');
        hideAllDropdowns();
        initializePhotoUpload();
    }
    
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
        
        // Expose for external access if needed
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

// DO NOT add window.FormModule = FormModule here!
