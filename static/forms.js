// ================================================================================
// FORMS.JS - Form Handling, Validation & Autocomplete
// Handles: All form operations, dropdown management, autocomplete functionality
// ================================================================================

import { APIModule } from './api.js';
import { ModalModule } from './modals.js';

export const FormModule = (function() {
    'use strict';
    
    // Private state
    const state = {
        selectedPubData: null,
        currentBrewery: null,
        searchTimeouts: {
            brewery: null,
            beer: null,
            style: null,
            pub: null
        },
        dropdownsOpen: new Set()
    };
    
    // Configuration
    const config = {
        debounceDelay: 300,
        minSearchLength: 2,
        maxSuggestions: 20,
        autocompleteDelay: 200
    };
    
    // ================================
    // REPORT FORM HANDLING
    // ================================
    
    async function handleReportSubmission(event) {
        event.preventDefault();
        console.log('📝 Handling report submission...');
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Collect form data
        const reportData = {
            beer_format: formData.get('reportFormat') || document.getElementById('reportFormat').value,
            brewery: formData.get('reportBrewery') || document.getElementById('reportBrewery').value,
            beer_name: formData.get('reportBeerName') || document.getElementById('reportBeerName').value,
            beer_style: formData.get('reportBeerStyle') || document.getElementById('reportBeerStyle').value,
            beer_abv: formData.get('reportBeerABV') || document.getElementById('reportBeerABV').value,
            notes: formData.get('reportNotes') || ''
        };
        
        console.log('📋 Form data collected:', reportData);
        
        // Add pub data
        if (window.selectedPubData || state.selectedPubData) {
            const pubData = window.selectedPubData || state.selectedPubData;
            reportData.pub_id = pubData.pub_id;
            reportData.pub_name = pubData.name;
            console.log('🏠 Using pre-populated pub:', pubData.name);
        } else {
            // Use searched/entered pub data
            reportData.pub_name = formData.get('reportPubName') || document.getElementById('reportPubName').value || 'Unknown Pub';
            reportData.address = formData.get('reportAddress') || document.getElementById('reportAddress').value || '';
            reportData.postcode = formData.get('reportPostcode') || document.getElementById('reportPostcode').value || '';
            console.log('🏠 Using manual pub data');
        }
        
        // Validate required fields
        const validation = validateReportForm(reportData);
        if (!validation.isValid) {
            showValidationError(validation.errors);
            return;
        }
        
        // Submit the report
        try {
            const result = await APIModule.submitBeerReport(reportData);
            
            if (result.success) {
                showSuccess('🎉 Beer report submitted successfully! Thanks for contributing!');
                
                // Close modal and reset form
                ModalModule.close('reportModal');
                resetReportForm();
                
                // Track success
                trackFormSubmission('beer_report', reportData);
            } else {
                showError(result.message || 'Failed to submit report');
            }
        } catch (error) {
            console.error('❌ Error submitting report:', error);
            showError('Error submitting report. Please try again.');
        }
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
    
    function showValidationError(errors) {
        const message = `❌ Please fill in: ${errors.join(', ')}`;
        if (window.showSuccessToast) {
            window.showSuccessToast(message);
        } else {
            alert(message);
        }
    }
    
    function resetReportForm() {
        const form = document.getElementById('reportForm');
        if (form) {
            form.reset();
        }
        
        // Clear state
        state.selectedPubData = null;
        window.selectedPubData = null;
        state.currentBrewery = null;
        
        // Reset UI elements
        document.getElementById('selectedPubInfo').style.display = 'none';
        document.getElementById('newPubFields').style.display = 'none';
        document.getElementById('pubSearchGroup').style.display = 'block';
        
        // Clear all dropdowns
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
    // PUB SEARCH & AUTOCOMPLETE
    // ================================
    
    async function initializePubSearch() {
        const pubSearchInput = document.getElementById('reportPubSearch');
        if (!pubSearchInput) return;
        
        // Debounced search
        pubSearchInput.addEventListener('input', debounce((e) => {
            searchPubs(e.target.value);
        }, config.debounceDelay));
        
        // Show suggestions on focus if has value
        pubSearchInput.addEventListener('focus', (e) => {
            if (e.target.value.length >= config.minSearchLength) {
                searchPubs(e.target.value);
            }
        });
    }
    
    async function searchPubs(query) {
        const suggestionsDiv = document.getElementById('pubSuggestions');
        if (!suggestionsDiv) return;
        
        if (query.length < config.minSearchLength) {
            hideDropdown('pubSuggestions');
            return;
        }
        
        try {
            const suggestions = await APIModule.getPubSuggestions(query, 'name', false);
            
            if (suggestions.length === 0) {
                // Show "add new pub" option
                suggestionsDiv.innerHTML = `
                    <div class="suggestion-item add-new" data-action="add-new-pub">
                        <strong>➕ Add "${query}" as new pub</strong>
                        <small>Can't find it? Add it to our database!</small>
                    </div>
                `;
            } else {
                // Show pub suggestions
                suggestionsDiv.innerHTML = suggestions.map(pub => `
                    <div class="suggestion-item" data-pub-id="${pub.pub_id}" data-action="select-pub">
                        <strong>${escapeHtml(pub.name)}</strong>
                        <small>${escapeHtml(pub.address)}, ${escapeHtml(pub.postcode)}</small>
                    </div>
                `).join('');
            }
            
            showDropdown('pubSuggestions');
        } catch (error) {
            console.error('Error searching pubs:', error);
            hideDropdown('pubSuggestions');
        }
    }
    
    function selectPub(pubElement) {
        const pubId = pubElement.dataset.pubId;
        const pubName = pubElement.querySelector('strong').textContent;
        const pubDetails = pubElement.querySelector('small').textContent;
        const [address, postcode] = pubDetails.split(', ');
        
        // Store selected pub data
        state.selectedPubData = {
            pub_id: parseInt(pubId),
            name: pubName,
            address: address,
            postcode: postcode
        };
        window.selectedPubData = state.selectedPubData;
        
        // Update UI
        document.getElementById('selectedPubInfo').style.display = 'block';
        document.getElementById('selectedPubName').textContent = pubName;
        document.getElementById('selectedPubAddress').textContent = pubDetails;
        document.getElementById('pubSearchGroup').style.display = 'none';
        
        hideDropdown('pubSuggestions');
        trackEvent('pub_selected', 'Form', pubName);
    }
    
    function showNewPubFields() {
        document.getElementById('newPubFields').style.display = 'block';
        document.getElementById('pubSearchGroup').style.display = 'none';
        document.getElementById('reportPubName').value = document.getElementById('reportPubSearch').value;
        
        hideDropdown('pubSuggestions');
        document.getElementById('reportAddress').focus();
    }
    
    function clearSelectedPub() {
        state.selectedPubData = null;
        window.selectedPubData = null;
        
        document.getElementById('selectedPubInfo').style.display = 'none';
        document.getElementById('pubSearchGroup').style.display = 'block';
        document.getElementById('reportPubSearch').value = '';
        document.getElementById('reportPubSearch').focus();
    }
    
    // ================================
    // BREWERY AUTOCOMPLETE
    // ================================
    
    async function searchBreweries(query) {
        clearTimeout(state.searchTimeouts.brewery);
        const dropdown = document.getElementById('breweryDropdown');
        if (!dropdown) return;
        
        // Show all breweries on empty/short query
        if (query.length < 1) {
            state.searchTimeouts.brewery = setTimeout(async () => {
                try {
                    const breweries = await APIModule.getBreweries();
                    displayBreweryDropdown(breweries.slice(0, 100), breweries.length);
                } catch (error) {
                    console.error('Error loading breweries:', error);
                    hideDropdown('breweryDropdown');
                }
            }, 100);
            return;
        }
        
        // Search for specific breweries
        state.searchTimeouts.brewery = setTimeout(async () => {
            try {
                const breweries = await APIModule.getBreweries(query);
                displayBreweryDropdown(breweries.slice(0, 50), breweries.length, query);
            } catch (error) {
                console.error('Error searching breweries:', error);
                hideDropdown('breweryDropdown');
            }
        }, config.debounceDelay);
    }
    
    function displayBreweryDropdown(breweries, totalCount, searchQuery = null) {
        const dropdown = document.getElementById('breweryDropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = '';
        
        if (breweries.length === 0) {
            hideDropdown('breweryDropdown');
            return;
        }
        
        // Add header
        const header = document.createElement('div');
        header.className = 'dropdown-header';
        header.innerHTML = searchQuery ? 
            `🔍 ${totalCount} matches for "${searchQuery}"` :
            `🍺 ${totalCount} Breweries Available`;
        dropdown.appendChild(header);
        
        // Add brewery items
        breweries.forEach(brewery => {
            const item = document.createElement('div');
            item.className = 'suggestion-item brewery-item';
            item.innerHTML = `<strong>${escapeHtml(brewery)}</strong>`;
            item.dataset.action = 'select-brewery';
            item.dataset.brewery = brewery;
            
            // Add click handler directly to ensure it works
            // item.addEventListener('click', (e) => {
            //     e.preventDefault();
            //     e.stopPropagation();
            //     selectBrewery(brewery);
            // });
            
            dropdown.appendChild(item);
        });
        
        showDropdown('breweryDropdown');
    }
    
    async function selectBrewery(brewery) {
        console.log('🍺 Brewery selected:', brewery);
        
        if (!brewery) {
            console.error('❌ No brewery provided to selectBrewery');
            return;
        }
        
        // Set brewery field
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) {
            breweryInput.value = brewery;
        }
        
        state.currentBrewery = brewery;
        
        // Hide brewery dropdown immediately
        hideDropdown('breweryDropdown');
        
        // Clear dependent fields
        const beerNameInput = document.getElementById('reportBeerName');
        const beerStyleInput = document.getElementById('reportBeerStyle');
        const beerABVInput = document.getElementById('reportBeerABV');
        
        if (beerNameInput) beerNameInput.value = '';
        if (beerStyleInput) beerStyleInput.value = '';
        if (beerABVInput) beerABVInput.value = '';
        
        // Load beers for this brewery
        try {
            loadBreweryBeers(brewery).catch(error => {
                console.error('❌ Error loading brewery beers:', error);
            });
        } catch (error) {
            console.error('❌ Error in loadBreweryBeers call:', error);
        }
        
        trackEvent('brewery_selected', 'Form', brewery);
    }
    
    async function loadBreweryBeers(brewery) {
        const beerNameInput = document.getElementById('reportBeerName');
        if (!beerNameInput) return;
        
        console.log(`🍺 Loading beers for ${brewery}...`);
        
        try {
            const beers = await APIModule.getBreweryBeers(brewery);
            
            if (beers.length === 0) {
                beerNameInput.placeholder = `Add new beer for ${brewery}`;
                showSuccess(`📝 No existing beers for ${brewery}. Add a new one!`);
                showAddNewBeerDropdown(brewery);
            } else {
                beerNameInput.placeholder = `Choose from ${beers.length} ${brewery} beers...`;
                showSuccess(`🍺 Found ${beers.length} beers from ${brewery}!`);
                displayBeerDropdown(beers, brewery);
            }
            
            // Focus beer name field
            setTimeout(() => beerNameInput.focus(), 200);
            
        } catch (error) {
            console.error('Error loading brewery beers:', error);
            beerNameInput.placeholder = 'Enter beer name...';
        }
    }
    
    // ================================
    // BEER NAME AUTOCOMPLETE
    // ================================
    
    async function searchBeerNames(query) {
        clearTimeout(state.searchTimeouts.beer);
        const dropdown = document.getElementById('beerNameDropdown');
        const brewery = document.getElementById('reportBrewery').value;
        
        if (!dropdown) return;
        
        // Show brewery beers on empty query
        if (query.length < 1 && brewery) {
            await loadBreweryBeers(brewery);
            return;
        }
        
        if (query.length < config.minSearchLength) {
            hideDropdown('beerNameDropdown');
            return;
        }
        
        state.searchTimeouts.beer = setTimeout(async () => {
            try {
                let beers;
                if (brewery) {
                    beers = await APIModule.getBreweryBeers(brewery, query);
                } else {
                    // Global beer search - would need new API endpoint
                    beers = [];
                }
                
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
    }
    
    function displayBeerDropdown(beers, brewery, searchQuery = null) {
        const dropdown = document.getElementById('beerNameDropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = '';
        
        // Header
        const header = document.createElement('div');
        header.className = 'dropdown-header';
        header.innerHTML = searchQuery ? 
            `🔍 ${beers.length} matches for "${searchQuery}"` :
            `🍺 ${beers.length} ${brewery} Beers`;
        dropdown.appendChild(header);
        
        // Add new beer option
        const addNewItem = document.createElement('div');
        addNewItem.className = 'suggestion-item add-new-item';
        addNewItem.innerHTML = `
            <strong>➕ Add New Beer for ${brewery}</strong><br>
            <small style="color: var(--text-muted);">Add a beer not in our database</small>
        `;
        addNewItem.dataset.action = 'add-new-beer';
        dropdown.appendChild(addNewItem);
        
        // Beer items
        beers.forEach(beer => {
            const item = document.createElement('div');
            item.className = 'suggestion-item beer-item';
            item.innerHTML = `
                <strong>${escapeHtml(beer.name)}</strong><br>
                <small style="color: var(--text-muted);">
                    ${escapeHtml(beer.style || 'Unknown style')} • ${beer.abv || '?'}% ABV
                    ${beer.gluten_status ? ' • ' + beer.gluten_status.replace('_', ' ') : ''}
                </small>
            `;
            item.dataset.action = 'select-beer';
            item.dataset.beerData = JSON.stringify(beer);
            dropdown.appendChild(item);
        });
        
        showDropdown('beerNameDropdown');
    }
    
    function displayAddNewBeerOption(query, brewery) {
        const dropdown = document.getElementById('beerNameDropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = `
            <div class="suggestion-item add-new-item" data-action="use-beer-name">
                <strong>➕ Add "${query}" as new beer</strong>
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
        
        dropdown.innerHTML = `
            <div class="dropdown-header">📝 No ${brewery} Beers in Database</div>
            <div class="suggestion-item add-new-item" data-action="focus-beer-name">
                <strong>➕ Add First Beer for ${brewery}</strong><br>
                <small style="color: var(--text-muted);">Be the first to add a ${brewery} beer!</small>
            </div>
        `;
        
        showDropdown('beerNameDropdown');
    }
    
    function selectBeer(beerData) {
        const beer = JSON.parse(beerData);
        
        // Fill fields
        document.getElementById('reportBeerName').value = beer.name;
        document.getElementById('reportBeerStyle').value = beer.style || '';
        document.getElementById('reportBeerABV').value = beer.abv || '';
        
        // Hide dropdown
        hideDropdown('beerNameDropdown');
        
        // Add visual feedback
        ['reportBeerName', 'reportBeerStyle', 'reportBeerABV'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('auto-filled');
                setTimeout(() => element.classList.remove('auto-filled'), 2000);
            }
        });
        
        showSuccess(`✅ Selected: ${beer.name} (${beer.abv}% ${beer.style})!`);
        
        // Focus next empty field
        focusNextEmptyField(['reportFormat', 'reportPhoto']);
        
        trackEvent('beer_selected', 'Form', beer.name);
    }
    
    // ================================
    // BEER STYLE AUTOCOMPLETE
    // ================================
    
    function searchBeerStyles(query) {
        clearTimeout(state.searchTimeouts.style);
        const dropdown = document.getElementById('beerStyleDropdown');
        
        if (!dropdown) return;
        
        if (query.length < 2) {
            hideDropdown('beerStyleDropdown');
            return;
        }
        
        // Common beer styles
        const commonStyles = [
            'IPA', 'Pale Ale', 'Lager', 'Pilsner', 'Stout', 'Porter',
            'Wheat Beer', 'Saison', 'Amber Ale', 'Brown Ale', 'Bitter',
            'Session IPA', 'Double IPA', 'Hazy IPA', 'Sour', 'Gose',
            'Belgian Ale', 'Blonde Ale', 'Red Ale', 'Mild', 'Best Bitter'
        ];
        
        const filtered = commonStyles.filter(style => 
            style.toLowerCase().includes(query.toLowerCase())
        );
        
        dropdown.innerHTML = '';
        
        if (filtered.length === 0) {
            hideDropdown('beerStyleDropdown');
            return;
        }
        
        filtered.forEach(style => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = style;
            item.dataset.action = 'select-style';
            item.dataset.style = style;
            dropdown.appendChild(item);
        });
        
        showDropdown('beerStyleDropdown');
    }
    
    function selectStyle(style) {
        document.getElementById('reportBeerStyle').value = style;
        hideDropdown('beerStyleDropdown');
        trackEvent('style_selected', 'Form', style);
    }
    
    // ================================
    // DROPDOWN MANAGEMENT
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
        const dropdownIds = [
            'breweryDropdown', 
            'beerNameDropdown', 
            'beerStyleDropdown', 
            'pubSuggestions'
        ];
        dropdownIds.forEach(id => hideDropdown(id));
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
                
                trackEvent('photo_selected', 'Form', 'photo_upload');
            }
        });
    }
    
    // ================================
    // HELPER FUNCTIONS
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
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
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
    
    function showSuccess(message) {
        if (window.showSuccessToast) {
            window.showSuccessToast(message);
        } else {
            console.log('✅', message);
        }
    }
    
    function showError(message) {
        if (window.showSuccessToast) {
            window.showSuccessToast(`❌ ${message}`);
        } else {
            console.error('❌', message);
        }
    }
    
    function trackEvent(action, category, label) {
        if (window.TrackingModule) {
            window.TrackingModule.trackEvent(action, category, label);
        }
    }
    
    function trackFormSubmission(formName, data) {
        if (window.TrackingModule) {
            window.TrackingModule.trackEvent('form_submission', 'Form', formName);
        }
    }
    
    // ================================
    // EVENT LISTENERS
    // ================================
    
    function setupEventListeners() {
        // Handle dropdown item clicks
        document.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]');
            
            // Also check if clicking on a brewery item without data-action
            const breweryItem = e.target.closest('.brewery-item');
            if (breweryItem && !action) {
                // Handle brewery selection
                const brewery = breweryItem.dataset.brewery || breweryItem.textContent.trim();
                if (brewery) {
                    selectBrewery(brewery);
                    return;
                }
            }
            
            if (!action) return;
            
            switch(action.dataset.action) {
                case 'select-pub':
                    selectPub(action);
                    break;
                case 'add-new-pub':
                    showNewPubFields();
                    break;
                case 'select-brewery':
                    selectBrewery(action.dataset.brewery);
                    break;
                case 'select-beer':
                    selectBeer(action.dataset.beerData);
                    break;
                case 'add-new-beer':
                    document.getElementById('reportBeerName').value = '';
                    document.getElementById('reportBeerName').focus();
                    hideDropdown('beerNameDropdown');
                    break;
                case 'use-beer-name':
                    hideDropdown('beerNameDropdown');
                    document.getElementById('reportBeerStyle').focus();
                    break;
                case 'focus-beer-name':
                    hideDropdown('beerNameDropdown');
                    document.getElementById('reportBeerName').focus();
                    showSuccess(`🎉 Adding first beer for ${state.currentBrewery}!`);
                    break;
                case 'select-style':
                    selectStyle(action.dataset.style);
                    break;
            }
        });
        
        // Hide dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            // Check if click is outside brewery dropdown
            if (!e.target.closest('.brewery-dropdown-container') && 
                !e.target.closest('#breweryDropdown') &&
                !e.target.closest('#reportBrewery')) {
                hideDropdown('breweryDropdown');
            }
            
            // Check if click is outside beer name dropdown
            if (!e.target.closest('.beer-name-container') && 
                !e.target.closest('#beerNameDropdown') &&
                !e.target.closest('#reportBeerName')) {
                hideDropdown('beerNameDropdown');
            }
            
            // Check if click is outside beer style dropdown
            if (!e.target.closest('.beer-style-container') && 
                !e.target.closest('#beerStyleDropdown') &&
                !e.target.closest('#reportBeerStyle')) {
                hideDropdown('beerStyleDropdown');
            }
            
            // Check if click is outside pub suggestions
            if (!e.target.closest('#reportPubSearch') && 
                !e.target.closest('#pubSuggestions')) {
                hideDropdown('pubSuggestions');
            }
        }, true); // Use capture phase to catch all clicks

        // Brewery autocomplete
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) {
            // Remove any existing listeners first
            const newBreweryInput = breweryInput.cloneNode(true);
            breweryInput.parentNode.replaceChild(newBreweryInput, breweryInput);
            
            // Add new listeners to the fresh element
            newBreweryInput.addEventListener('input', debounce((e) => {
                searchBreweries(e.target.value);
            }, config.debounceDelay));
            
            newBreweryInput.addEventListener('focus', (e) => {
                if (!e.target.value) {
                    searchBreweries(''); // Show all breweries on focus
                }
            });
            
            newBreweryInput.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!e.target.value) {
                    searchBreweries(''); // Show all breweries on click
                }
            });
        }
        
        // Beer name autocomplete
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) {
            // Remove any existing listeners first
            const newBeerNameInput = beerNameInput.cloneNode(true);
            beerNameInput.parentNode.replaceChild(newBeerNameInput, beerNameInput);
            
            newBeerNameInput.addEventListener('input', debounce((e) => {
                searchBeerNames(e.target.value);
            }, config.debounceDelay));
            
            newBeerNameInput.addEventListener('focus', (e) => {
                const brewery = document.getElementById('reportBrewery').value;
                if (brewery && !e.target.value) {
                    loadBreweryBeers(brewery); // Show brewery beers on focus
                }
            });
        }
        
        // Beer style autocomplete
        const beerStyleInput = document.getElementById('reportBeerStyle');
        if (beerStyleInput) {
            // Remove any existing listeners first
            const newBeerStyleInput = beerStyleInput.cloneNode(true);
            beerStyleInput.parentNode.replaceChild(newBeerStyleInput, beerStyleInput);
            
            newBeerStyleInput.addEventListener('input', debounce((e) => {
                searchBeerStyles(e.target.value);
            }, config.debounceDelay));
        }
    }
    
    // ================================
    // INITIALIZATION
    // ================================
    
    function init() {
        console.log('🔧 Initializing Form Module');
        
        setupEventListeners();
        initializePubSearch();
        initializePhotoUpload();
        
        // Initialize report form dropdowns when modal opens
        window.initReportDropdowns = initReportDropdowns;
        
        console.log('✅ Form Module initialized');
    }
    
    function initReportDropdowns() {
        console.log('🔧 Initializing report form dropdowns');
        
        // Clear any existing state
        hideAllDropdowns();
        
        // Re-initialize photo upload in case modal was closed/reopened
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
        clearSelectedPub,
        initReportDropdowns,
        resetReportForm,
        selectbrewery,
        
        // For external access if needed
        getSelectedPub: () => state.selectedPubData,
        getCurrentBrewery: () => state.currentBrewery
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', FormModule.init);
} else {
    FormModule.init();
}
