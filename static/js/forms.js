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
    
    const handleReportSubmission = async (event) => {
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
            console.log('🔍 DEBUG - Pub data being sent:', {
                pub_id: reportData.pub_id,
                pub_name: reportData.pub_name,
                has_pub_id: !!reportData.pub_id
            });
        } else {
            // Use searched/entered pub data
            reportData.pub_name = formData.get('reportPubName') || document.getElementById('reportPubName').value || 'Unknown Pub';
            reportData.address = formData.get('reportAddress') || document.getElementById('reportAddress').value || '';
            reportData.postcode = formData.get('reportPostcode') || document.getElementById('reportPostcode').value || '';
            console.log('🏠 Using manual pub data');
            console.log('🔍 DEBUG - Manual pub data:', {
                pub_name: reportData.pub_name,
                address: reportData.address,
                postcode: reportData.postcode
            });
        }
        
        console.log('🔍 DEBUG - Full reportData before API call:', reportData);
        
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

                // Debug: Log what's happening
                console.log('🔍 Before modal close - checking hero visibility');
                const heroSection = document.querySelector('.hero-section');
                console.log('Hero section display:', heroSection?.style.display);
                
                // Close modal and reset form
                ModalModule.close('reportModal');
                resetReportForm();
                
                // Force return to home view
                // Close any open overlays and show home sections
                const pubDetailsOverlay = document.getElementById('pubDetailsOverlay');
                if (pubDetailsOverlay) {
                    pubDetailsOverlay.style.display = 'none';
                    pubDetailsOverlay.classList.remove('active');
                }
                
                const resultsOverlay = document.getElementById('resultsOverlay');
                if (resultsOverlay) {
                    resultsOverlay.style.display = 'none';
                    resultsOverlay.classList.remove('active');
                }
                
                // Restore body scroll
                document.body.style.overflow = '';
                
                // Show home sections
                // const heroSection = document.querySelector('.hero-section');
                const searchSection = document.querySelector('.search-section');
                if (heroSection) {
                    heroSection.style.display = 'block';
                    console.log('✅ Hero section restored after form submission');
                }
                if (searchSection) {
                    searchSection.style.display = 'flex';
                    console.log('✅ Search section restored after form submission');
                }
                
                // Track success
                trackFormSubmission('beer_report', reportData);

                // Debug: Check after modal close
                setTimeout(() => {
                    console.log('🔍 After modal close - checking hero visibility');
                    const heroSectionAfter = document.querySelector('.hero-section');
                    console.log('Hero section display after:', heroSectionAfter?.style.display);
                }, 500);
                
                // Track success
                trackFormSubmission('beer_report', reportData);
            } else {
                showError(result.message || 'Failed to submit report');
            }
        } catch (error) {
            console.error('❌ Error submitting report:', error);
            showError('Error submitting report. Please try again.');
        }
    };
    
    const validateReportForm = (data) => {
        const errors = [];
        
        if (!data.beer_format) errors.push('Beer Format');
        if (!data.brewery) errors.push('Brewery');
        if (!data.beer_name) errors.push('Beer Name');
        if (!data.pub_id && !data.pub_name) errors.push('Pub Name');
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    };
    
    const showValidationError = (errors) => {
        const message = `❌ Please fill in: ${errors.join(', ')}`;
        if (window.showSuccessToast) {
            window.showSuccessToast(message);
        } else {
            alert(message);
        }
    };
    
    const resetReportForm = () => {
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
    // PUB SEARCH & AUTOCOMPLETE
    // ================================
    
    const initializePubSearch = async () => {
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
    };
    
    const searchPubs = async (query) => {
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
    };
    
    const selectPub = (pubElement) => {
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
    };
    
    const showNewPubFields = () => {
        document.getElementById('newPubFields').style.display = 'block';
        document.getElementById('pubSearchGroup').style.display = 'none';
        document.getElementById('reportPubName').value = document.getElementById('reportPubSearch').value;
        
        hideDropdown('pubSuggestions');
        document.getElementById('reportAddress').focus();
    };
    
    const clearSelectedPub = () => {
        state.selectedPubData = null;
        window.selectedPubData = null;
        
        document.getElementById('selectedPubInfo').style.display = 'none';
        document.getElementById('pubSearchGroup').style.display = 'block';
        document.getElementById('reportPubSearch').value = '';
        document.getElementById('reportPubSearch').focus();
    };
    
    // ================================
    // BREWERY AUTOCOMPLETE
    // ================================
    
    const searchBreweries = async (query) => {
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
    };
    
    const displayBreweryDropdown = (breweries, totalCount, searchQuery = null) => {
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
            dropdown.appendChild(item);
        });
        
        showDropdown('breweryDropdown');
    };
    
    const selectBrewery = async (brewery) => {
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
            await loadBreweryBeers(brewery);
        } catch (error) {
            console.error('❌ Error loading brewery beers:', error);
        }
        
        trackEvent('brewery_selected', 'Form', brewery);
    };
    
    const loadBreweryBeers = async (brewery) => {
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
    };
    
    // ================================
    // BEER NAME AUTOCOMPLETE
    // ================================
    
    const searchBeerNames = async (query) => {
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
    };
    
    const displayBeerDropdown = (beers, brewery, searchQuery = null) => {
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
    };
    
    const displayAddNewBeerOption = (query, brewery) => {
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
    };
    
    const showAddNewBeerDropdown = (brewery) => {
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
    };
    
    const selectBeer = (beerData) => {
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
    };
    
    // ================================
    // BEER STYLE AUTOCOMPLETE
    // ================================
    
    const searchBeerStyles = (query) => {
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
    };
    
    const selectStyle = (style) => {
        document.getElementById('reportBeerStyle').value = style;
        hideDropdown('beerStyleDropdown');
        trackEvent('style_selected', 'Form', style);
    };
    
    // ================================
    // DROPDOWN MANAGEMENT
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
        const dropdownIds = [
            'breweryDropdown', 
            'beerNameDropdown', 
            'beerStyleDropdown', 
            'pubSuggestions'
        ];
        dropdownIds.forEach(id => hideDropdown(id));
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
                
                trackEvent('photo_selected', 'Form', 'photo_upload');
            }
        });
    };
    
    // ================================
    // HELPER FUNCTIONS
    // ================================
    
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
    
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
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
    
    const showSuccess = (message) => {
        if (window.showSuccessToast) {
            window.showSuccessToast(message);
        } else {
            console.log('✅', message);
        }
    };
    
    const showError = (message) => {
        if (window.showSuccessToast) {
            window.showSuccessToast(`❌ ${message}`);
        } else {
            console.error('❌', message);
        }
    };
    
    const trackEvent = (action, category, label) => {
        if (window.TrackingModule) {
            window.TrackingModule.trackEvent(action, category, label);
        }
    };
    
    const trackFormSubmission = (formName, data) => {
        if (window.TrackingModule) {
            window.TrackingModule.trackEvent('form_submission', 'Form', formName);
        }
    };
    
    // ================================
    // EVENT LISTENERS
    // ================================
    
    const setupEventListeners = () => {
        // Handle dropdown item clicks
        document.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]');
            
            if (!action) return;
            
            switch(action.dataset.action) {
                case 'select-pub':
                    selectPub(action);
                    break;
                case 'add-new-pub':
                    showNewPubFields();
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
        }, true);

        // Brewery autocomplete
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) {
            const newBreweryInput = breweryInput.cloneNode(true);
            breweryInput.parentNode.replaceChild(newBreweryInput, breweryInput);
            
            newBreweryInput.addEventListener('input', debounce((e) => {
                searchBreweries(e.target.value);
            }, config.debounceDelay));
            
            newBreweryInput.addEventListener('focus', (e) => {
                if (!e.target.value) {
                    searchBreweries('');
                }
            });
            
            newBreweryInput.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!e.target.value) {
                    searchBreweries('');
                }
            });
        }
        
        // Beer name autocomplete
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) {
            const newBeerNameInput = beerNameInput.cloneNode(true);
            beerNameInput.parentNode.replaceChild(newBeerNameInput, beerNameInput);
            
            newBeerNameInput.addEventListener('input', debounce((e) => {
                searchBeerNames(e.target.value);
            }, config.debounceDelay));
            
            newBeerNameInput.addEventListener('focus', (e) => {
                const brewery = document.getElementById('reportBrewery').value;
                if (brewery && !e.target.value) {
                    loadBreweryBeers(brewery);
                }
            });
        }
        
        // Beer style autocomplete
        const beerStyleInput = document.getElementById('reportBeerStyle');
        if (beerStyleInput) {
            const newBeerStyleInput = beerStyleInput.cloneNode(true);
            beerStyleInput.parentNode.replaceChild(newBeerStyleInput, beerStyleInput);
            
            newBeerStyleInput.addEventListener('input', debounce((e) => {
                searchBeerStyles(e.target.value);
            }, config.debounceDelay));
        }
    };

    // ADD: Complete GF Status flow handler

    const GFStatusFlow = {
        currentPub: null,
        selectedStatus: null,
        
        init() {
            this.setupEventListeners();
        },
        
        setupEventListeners() {
            // Change status button
            document.addEventListener('click', (e) => {
                if (e.target.closest('[data-action="change-gf-status"]')) {
                    this.openStatusModal();
                }
                
                // Status option selection
                if (e.target.closest('.status-option')) {
                    const option = e.target.closest('.status-option');
                    this.selectStatus(option.dataset.status);
                }
                
                // Confirm status
                if (e.target.matches('[data-action="confirm-status"]')) {
                    this.confirmStatusUpdate();
                }
                
                // Cancel status
                if (e.target.matches('[data-action="cancel-status"]')) {
                    this.closeModal('gfStatusConfirmModal');
                }
                
                // Skip details
                if (e.target.matches('[data-action="skip-details"]')) {
                    this.closeModal('beerDetailsPromptModal');
                    this.showSuccessMessage();
                }
                
                // Add beer details
                if (e.target.matches('[data-action="add-beer-details"]')) {
                    this.closeModal('beerDetailsPromptModal');
                    this.openBeerReportModal();
                }
            });
        },
        
        openStatusModal() {
            console.log('🔍 openStatusModal called');

            // Debug z-indexes
            const pubOverlay = document.getElementById('pubDetailsOverlay');
            const statusModal = document.getElementById('gfStatusModal');
            
            console.log('🎯 Z-index check:');
            console.log('Pub overlay z-index:', window.getComputedStyle(pubOverlay).zIndex);
            console.log('Status modal z-index:', window.getComputedStyle(statusModal).zIndex);
            this.currentPub = window.currentPubData;
            console.log('🏠 Current pub:', this.currentPub);
            
            if (!this.currentPub) {
                console.error('❌ No current pub data');
                return;
            }
            
            // Set pub name in modal
            const pubNameEl = document.getElementById('statusPubName');
            if (pubNameEl) {
                pubNameEl.textContent = this.currentPub.name;
                console.log('✅ Set pub name:', this.currentPub.name);
            } else {
                console.warn('⚠️ statusPubName element not found');
            }
            
            // Open modal
            this.openModal('gfStatusModal');
        },
        
        selectStatus(status) {
            this.selectedStatus = status;
            this.closeModal('gfStatusModal');
            
            // Show confirmation
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
            
            this.openModal('gfStatusConfirmModal');
        },
        
        async confirmStatusUpdate() {
            this.closeModal('gfStatusConfirmModal');
            
            try {
                // Show loading
                if (window.showLoadingToast) {
                    window.showLoadingToast('Updating status...');
                }
                
                // Send update
                const response = await fetch('/api/update-gf-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pub_id: this.currentPub.pub_id,
                        status: this.selectedStatus
                    })
                });
                
                if (response.ok) {
                    // Update UI
                    this.updateStatusDisplay(this.selectedStatus);
                    
                    // Hide loading
                    if (window.hideLoadingToast) {
                        window.hideLoadingToast();
                    }
                    
                    // Show beer details prompt for positive statuses
                    if (this.selectedStatus === 'always' || this.selectedStatus === 'currently') {
                        this.openModal('beerDetailsPromptModal');
                    } else {
                        this.showSuccessMessage();
                    }
                }
            } catch (error) {
                console.error('Error updating status:', error);
                if (window.showSuccessToast) {
                    window.showSuccessToast('❌ Failed to update status');
                }
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
        },
        
        openBeerReportModal() {
            // Use existing report modal
            if (window.ModalModule) {
                window.ModalModule.openReportModal(this.currentPub);
            }
        },
        
        showSuccessMessage() {
            if (window.showSuccessToast) {
                window.showSuccessToast('✅ Status updated successfully!');
            }
        },
        
        openModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                // Force it to the absolute top
                modal.style.cssText = `
                    display: flex !important;
                    z-index: 999999 !important;
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                `;
                document.body.style.overflow = 'hidden';
            }
        },
        
        closeModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
            
            // Restore pub overlay
            const pubOverlay = document.getElementById('pubDetailsOverlay');
            if (pubOverlay) {
                pubOverlay.style.display = 'flex';
            }
        }
    }
    
    // Initialize when ready
    // document.addEventListener('DOMContentLoaded', () => GFStatusFlow.init());
    
    // ================================
    // INITIALIZATION
    // ================================
    
    const init = () => {
        console.log('🔧 Initializing Form Module');
        
        setupEventListeners();
        initializePubSearch();
        initializePhotoUpload();
        GFStatusFlow.init(); // ADD THIS LINE
        
        window.initReportDropdowns = initReportDropdowns;
        
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
        setupEventListeners,
        GFStatusFlow,
        
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
