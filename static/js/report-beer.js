// ================================================================================
// REPORT-BEER.JS - Beer Reporting Form
// Handles the step-by-step beer reporting flow
// ================================================================================

export const ReportBeer = (() => {
    'use strict';
    
    // ================================
    // STATE MANAGEMENT
    // ================================
    const state = {
        currentStep: 'format',
        selectedFormat: null,
        knowsBrewery: null,
        selectedBrewery: null,
        selectedBeer: null,
        isNewBrewery: false,
        isNewBeer: false,
        currentVenue: null,
        initialized: false,
        dropdownLoading: false
    };

    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🍺 Initializing Beer Report Form...');
        
        const modal = document.getElementById('reportModal');
        if (!modal) {
            console.log('⏳ Report modal not in DOM yet, deferring initialization');
            return false;
        }
        
        attachEventListeners();
        reset();
        console.log('✅ Beer Report Form initialized');
        state.initialized = true;
        return true;
    };

    // Reset form to initial state
    const reset = () => {
        console.log('🔄 FORM RESET CALLED');
        
        const modal = document.getElementById('reportModal');
        if (!modal) {
            console.log('📝 Report modal not found, skipping reset');
            return;
        }
        
        // Reset state
        state.currentStep = 'format';
        state.selectedFormat = null;
        state.knowsBrewery = null;
        state.selectedBrewery = null;
        state.selectedBeer = null;
        state.isNewBrewery = false;
        state.isNewBeer = false;
        
        // Clear form inputs
        const form = document.getElementById('reportForm');
        if (form) form.reset();
        
        // Reset format buttons
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Hide all dropdowns
        document.querySelectorAll('.suggestions').forEach(dropdown => {
            dropdown.classList.remove('show');
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
        });
        
        // Hide confirmation sections
        const breweryConfirmed = document.getElementById('breweryConfirmed');
        if (breweryConfirmed) {
            breweryConfirmed.classList.remove('show');
            breweryConfirmed.style.display = 'none';
        }
        
        const beerConfirmed = document.getElementById('beerConfirmed');
        if (beerConfirmed) {
            beerConfirmed.classList.remove('show');
            beerConfirmed.style.display = 'none';
        }
        
        // IMPORTANT: Show beer name input and label again (they get hidden when beer is confirmed)
        const beerNameInput = document.getElementById('reportBeerName');
        const beerNameLabel = beerNameInput?.previousElementSibling;
        if (beerNameInput) {
            beerNameInput.style.display = 'block';
            if (beerNameLabel && beerNameLabel.tagName === 'LABEL') {
                beerNameLabel.style.display = 'block';
            }
        }
        
        // Remove any highlight classes
        document.querySelectorAll('.optional-highlight').forEach(el => {
            el.classList.remove('optional-highlight');
        });
        
        // Hide submit button
        const formActions = document.getElementById('formActions');
        if (formActions) {
            formActions.classList.remove('show');
            formActions.style.display = 'none';
        }
        
        // Reset to first step
        showStep('format');
        updateProgress('format');
        
        console.log('✅ FORM RESET COMPLETE');
    };

    // Set venue context
    const setVenue = (venue) => {
        state.currentVenue = venue;
        if (venue) {
            const venueIdInput = document.getElementById('venueId');
            const venueNameInput = document.getElementById('venueName');
            if (venueIdInput) venueIdInput.value = venue.venue_id || venue.id;
            if (venueNameInput) venueNameInput.value = venue.venue_name || venue.name;
        }
    };

    // ================================
    // EVENT LISTENERS (only for inputs, not dropdowns)
    // ================================
    const attachEventListeners = () => {
        console.log('📎 Attaching event listeners...');
        
        const modal = document.getElementById('reportModal');
        if (!modal) {
            console.error('❌ Modal not found for event listeners');
            return;
        }
        
        // Format buttons and brewery knowledge buttons are handled by main.js delegation
        // We only need input listeners here
        
        // Brewery input
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) {
            let breweryTimeout;
            
            breweryInput.addEventListener('input', (e) => {
                clearTimeout(breweryTimeout);
                breweryTimeout = setTimeout(() => {
                    searchBreweries(e.target.value);
                }, 300);
            });
            
            breweryInput.addEventListener('focus', (e) => {
                if (!breweryInput.value) {
                    showAllBreweries();
                }
            });
        }
        
        // Beer search input (when brewery unknown)
        const beerSearchInput = document.getElementById('beerSearchFirst');
        if (beerSearchInput) {
            let beerSearchTimeout;
            beerSearchInput.addEventListener('input', (e) => {
                clearTimeout(beerSearchTimeout);
                beerSearchTimeout = setTimeout(() => {
                    searchBeersGlobally(e.target.value);
                }, 300);
            });
        }
        
        // Beer name input (when brewery is known)
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) {
            let beerNameTimeout;
            
            beerNameInput.addEventListener('input', (e) => {
                clearTimeout(beerNameTimeout);
                beerNameTimeout = setTimeout(() => {
                    if (state.selectedBrewery) {
                        searchBreweryBeers(e.target.value);
                    }
                }, 300);
            });
            
            beerNameInput.addEventListener('focus', async (e) => {
                if (state.selectedBrewery && !beerNameInput.value) {
                    await loadAndShowBreweryBeers(state.selectedBrewery);
                }
            });
        }
    };

    // ================================
    // STEP MANAGEMENT
    // ================================
    const selectFormat = (format) => {
        state.selectedFormat = format;
        
        // Update UI
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.format === format);
        });
        
        // Set hidden input
        const hiddenInput = document.getElementById('reportFormat');
        if (hiddenInput) hiddenInput.value = format;
        
        // Move to next step
        showStep('brewery-question');
        updateProgress('brewery');
    };

    const handleBreweryKnowledge = (knowsBrewery) => {
        state.knowsBrewery = knowsBrewery;
        
        if (knowsBrewery) {
            showStep('brewery-select');
            const breweryInput = document.getElementById('reportBrewery');
            if (breweryInput) breweryInput.focus();
        } else {
            showStep('beer-search');
            const beerSearchInput = document.getElementById('beerSearchFirst');
            if (beerSearchInput) beerSearchInput.focus();
        }
    };

    // ================================
    // BREWERY FUNCTIONS
    // ================================
    // Add Levenshtein distance function first
    const levenshteinDistance = (str1, str2) => {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    };
    
    const searchBreweries = async (query) => {
        try {
            const response = await fetch('/api/breweries');
            const allBreweries = await response.json();
            
            if (!query) {
                displayBreweryDropdown(allBreweries.slice(0, 50), '');
                return;
            }
            
            const queryLower = query.toLowerCase();
            
            // Find exact matches
            const exactMatches = allBreweries.filter(brewery => 
                brewery.toLowerCase().includes(queryLower)
            );
            
            // Find fuzzy matches - check if query matches START of any word in brewery name
            const fuzzyMatches = allBreweries.filter(brewery => {
                const breweryLower = brewery.toLowerCase();
                
                // Direct substring match
                if (breweryLower.includes(queryLower)) return true;
                
                // Check if query matches start of brewery name (with tolerance)
                if (breweryLower.startsWith(queryLower)) return true;
                
                // Check if brewery starts with something SIMILAR to query
                const queryLen = queryLower.length;
                const breweryStart = breweryLower.substring(0, queryLen + 2); // Get start of brewery
                const distance = levenshteinDistance(queryLower, breweryStart);
                if (distance <= 2) return true;
                
                // Check each word
                const words = breweryLower.split(' ');
                return words.some(word => {
                    // Check if query matches start of word
                    if (word.startsWith(queryLower)) return true;
                    
                    // Check distance to start of word
                    const wordStart = word.substring(0, queryLen + 2);
                    const dist = levenshteinDistance(queryLower, wordStart);
                    return dist <= 1;
                });
            });
            
            // Remove duplicates
            const uniqueResults = [...new Set([...exactMatches, ...fuzzyMatches])];
            
            // Special handling for known common typos
            const typoMap = {
                'dura': 'daura',
                'estrella': 'estrella damm',
                'peroni': 'peroni nastro'
            };
            
            if (typoMap[queryLower]) {
                const corrected = allBreweries.filter(b => 
                    b.toLowerCase().includes(typoMap[queryLower])
                );
                corrected.forEach(match => {
                    if (!uniqueResults.includes(match)) {
                        uniqueResults.unshift(match);  // Add to front
                    }
                });
            }
            
            displayBreweryDropdown(uniqueResults.slice(0, 20), query);
        } catch (error) {
            console.error('Error searching breweries:', error);
            hideDropdown('breweryDropdown');
        }
    };
    
    const showAllBreweries = async () => {
        state.dropdownLoading = true;
        
        const dropdown = document.getElementById('breweryDropdown');
        if (dropdown) {
            dropdown.innerHTML = '<div class="dropdown-header">Loading breweries...</div>';
            dropdown.classList.add('show');
            dropdown.style.display = 'block';
        }
        
        try {
            const response = await fetch('/api/breweries');
            const breweries = await response.json();
            
            if (state.dropdownLoading && dropdown) {
                displayBreweryDropdown(breweries.slice(0, 50), '');
            }
        } catch (error) {
            console.error('Error loading breweries:', error);
        } finally {
            state.dropdownLoading = false;
        }
    };

    const displayBreweryDropdown = (breweries, query) => {
        const dropdown = document.getElementById('breweryDropdown');
        if (!dropdown) return;
        
        let html = '';
        
        if (breweries.length === 0 && query) {
            html = `
                <div class="dropdown-header">🔍 No matches found</div>
                <div class="suggestion-item new-brewery" data-action="create-brewery" data-brewery="${escapeHtml(query)}">
                    <strong>➕ Add "${escapeHtml(query)}" as new brewery</strong>
                    <small>This will be added to our database</small>
                </div>
            `;
        } else {
            if (query) {
                html += `<div class="dropdown-header">🔍 ${breweries.length} matches for "${escapeHtml(query)}"</div>`;
            } else {
                html += `<div class="dropdown-header">🍺 ${breweries.length} Breweries Available</div>`;
            }
            
            breweries.forEach(brewery => {
                html += `
                    <div class="suggestion-item" data-action="select-brewery" data-brewery="${escapeHtml(brewery)}">
                        <strong>${escapeHtml(brewery)}</strong>
                    </div>
                `;
            });
            
            if (query && !breweries.some(b => b.toLowerCase() === query.toLowerCase())) {
                html += `
                    <div class="suggestion-item new-brewery" data-action="create-brewery" data-brewery="${escapeHtml(query)}">
                        <strong>➕ Add "${escapeHtml(query)}" as new brewery</strong>
                        <small>Not in list? Add it!</small>
                    </div>
                `;
            }
        }
        
        dropdown.innerHTML = html;
        showDropdown('breweryDropdown');
    };

    const selectBrewery = async (breweryName) => {
        state.selectedBrewery = breweryName;
        state.isNewBrewery = false;
        
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) breweryInput.value = breweryName;
        hideDropdown('breweryDropdown');
        
        showStep('beer-details');
        updateProgress('beer');
        
        showBreweryConfirmed(breweryName, false);
        
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) {
            beerNameInput.focus();
            await loadAndShowBreweryBeers(breweryName);
        }
    };

    const createNewBrewery = (breweryName) => {
        state.selectedBrewery = breweryName;
        state.isNewBrewery = true;
        
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) breweryInput.value = breweryName;
        hideDropdown('breweryDropdown');
        
        showStep('beer-details');
        updateProgress('beer');
        
        showBreweryConfirmed(breweryName, true);
        
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) beerNameInput.focus();
        
        showToast(`🆕 "${breweryName}" will be added to our database!`);
    };

    // ================================
    // BEER FUNCTIONS
    // ================================
    const loadAndShowBreweryBeers = async (breweryName) => {
        try {
            const response = await fetch(`/api/brewery/${encodeURIComponent(breweryName)}/beers`);
            const beers = await response.json();
            
            const dropdown = document.getElementById('beerNameDropdown');
            if (!dropdown) return;
            
            let html = '';
            
            if (beers.length > 0) {
                html = `<div class="dropdown-header">🍺 ${beers.length} ${breweryName} beers</div>`;
                beers.forEach(beer => {
                    const beerData = escapeHtml(JSON.stringify(beer));
                    html += `
                        <div class="suggestion-item" data-action="select-brewery-beer" data-beer='${beerData}'>
                            <strong>${escapeHtml(beer.beer_name)}</strong>
                            <small>${escapeHtml(beer.style || 'Unknown')} • ${beer.abv || '?'}% ABV</small>
                        </div>
                    `;
                });
                
                html += `
                    <div class="suggestion-item new-beer" data-action="prompt-new-beer">
                        <strong>➕ Add new ${breweryName} beer</strong>
                    </div>
                `;
                
                showToast(`🍺 ${breweryName} has ${beers.length} beers in our database`);
            } else {
                html = `
                    <div class="dropdown-header">🆕 No ${breweryName} beers yet</div>
                    <div class="suggestion-item new-beer" data-action="prompt-new-beer">
                        <strong>➕ Add the first ${breweryName} beer!</strong>
                    </div>
                `;
                showToast(`🆕 You're adding the first ${breweryName} beer!`);
            }
            
            dropdown.innerHTML = html;
            showDropdown('beerNameDropdown');
            
        } catch (error) {
            console.error('Error loading brewery beers:', error);
        }
    };

    const searchBeersGlobally = async (query) => {
        if (query.length < 2) {
            hideDropdown('beerSearchDropdown');
            return;
        }
        
        try {
            const response = await fetch(`/api/beers/search?q=${encodeURIComponent(query)}`);
            const beers = await response.json();
            
            const dropdown = document.getElementById('beerSearchDropdown');
            if (!dropdown) return;
            
            let html = '';
            
            if (beers.length > 0) {
                html = `<div class="dropdown-header">🔍 ${beers.length} beers found</div>`;
                beers.forEach(beer => {
                    const beerData = escapeHtml(JSON.stringify(beer));
                    html += `
                        <div class="suggestion-item beer-item" data-action="select-found-beer" data-beer='${beerData}'>
                            <strong>${escapeHtml(beer.beer_name)}</strong>
                            <small>🏭 ${escapeHtml(beer.brewery_name)} • ${escapeHtml(beer.style || 'Unknown style')}</small>
                        </div>
                    `;
                });
            } else {
                html = `
                    <div class="dropdown-header">No beers found</div>
                    <div class="suggestion-item new-beer" data-action="create-new-beer" data-beer="${escapeHtml(query)}">
                        <strong>➕ Add "${escapeHtml(query)}" as new beer</strong>
                        <small>We'll help you add the brewery next</small>
                    </div>
                `;
            }
            
            dropdown.innerHTML = html;
            showDropdown('beerSearchDropdown');
            
        } catch (error) {
            console.error('Error searching beers:', error);
        }
    };

    const searchBreweryBeers = async (query) => {
        if (!state.selectedBrewery) return;
        
        try {
            const response = await fetch(`/api/brewery/${encodeURIComponent(state.selectedBrewery)}/beers?q=${encodeURIComponent(query)}`);
            const beers = await response.json();
            
            const dropdown = document.getElementById('beerNameDropdown');
            if (!dropdown) return;
            
            let html = '';
            
            if (beers.length > 0) {
                html = `<div class="dropdown-header">🍺 ${beers.length} ${state.selectedBrewery} beers</div>`;
                beers.forEach(beer => {
                    const beerData = escapeHtml(JSON.stringify(beer));
                    html += `
                        <div class="suggestion-item" data-action="select-brewery-beer" data-beer='${beerData}'>
                            <strong>${escapeHtml(beer.beer_name)}</strong>
                            <small>${escapeHtml(beer.style || 'Unknown')} • ${beer.abv || '?'}% ABV</small>
                        </div>
                    `;
                });
            } else if (query) {
                html = `
                    <div class="suggestion-item new-beer" data-action="add-brewery-beer" data-beer="${escapeHtml(query)}">
                        <strong>➕ Add "${escapeHtml(query)}" to ${state.selectedBrewery}</strong>
                    </div>
                `;
            }
            
            if (html) {
                dropdown.innerHTML = html;
                showDropdown('beerNameDropdown');
            } else {
                hideDropdown('beerNameDropdown');
            }
            
        } catch (error) {
            console.error('Error loading brewery beers:', error);
        }
    };

    const selectBreweryBeer = (beer) => {
        // Fill beer details
        const beerNameInput = document.getElementById('reportBeerName');
        const beerStyleInput = document.getElementById('reportBeerStyle');
        const beerABVInput = document.getElementById('reportBeerABV');
        
        if (beerNameInput) beerNameInput.value = beer.beer_name;
        if (beerStyleInput) beerStyleInput.value = beer.style || '';
        if (beerABVInput) beerABVInput.value = beer.abv || '';
        
        hideDropdown('beerNameDropdown');
        
        // Show beer as confirmed (this will hide the input)
        showBeerConfirmed(beer.beer_name, false);
        
        // Show submit button immediately
        showSubmitButton();
        
        showToast(`✅ Selected: ${beer.beer_name}`);
    };

    const selectFoundBeer = (beer) => {
        state.selectedBeer = beer;
        state.selectedBrewery = beer.brewery_name;
        
        hideDropdown('beerSearchDropdown');
        
        showStep('beer-details');
        updateProgress('beer');
        
        // Show both as confirmed
        showBreweryConfirmed(beer.brewery_name, false);
        showBeerConfirmed(beer.beer_name, false);
        
        // Fill in beer details
        const beerNameInput = document.getElementById('reportBeerName');
        const beerStyleInput = document.getElementById('reportBeerStyle');
        const beerABVInput = document.getElementById('reportBeerABV');
        
        if (beerNameInput) beerNameInput.value = beer.beer_name;
        if (beerStyleInput) beerStyleInput.value = beer.style || '';
        if (beerABVInput) beerABVInput.value = beer.abv || '';
        
        // Show submit button immediately
        showSubmitButton();
        
        showToast(`✅ Found it! ${beer.beer_name} by ${beer.brewery_name}`);
    };

    const promptNewBeer = () => {
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) {
            hideDropdown('beerNameDropdown');
            beerNameInput.value = '';
            beerNameInput.placeholder = `Enter new ${state.selectedBrewery} beer name...`;
            beerNameInput.focus();
            
            // Highlight optional fields
            const beerStyleInput = document.getElementById('reportBeerStyle');
            const beerABVInput = document.getElementById('reportBeerABV');
            if (beerStyleInput) beerStyleInput.classList.add('optional-highlight');
            if (beerABVInput) beerABVInput.classList.add('optional-highlight');
            
            // Show submit button immediately
            showSubmitButton();
            
            state.isNewBeer = true;
            showToast(`💡 Type the new ${state.selectedBrewery} beer name (style & ABV optional but helpful!)`);
        }
    };

    const createNewBeer = (beerName) => {
        const beerSearchInput = document.getElementById('beerSearchFirst');
        if (beerSearchInput) beerSearchInput.value = beerName;
        hideDropdown('beerSearchDropdown');
        
        state.selectedBeer = { beer_name: beerName, isNew: true };
        
        showStep('brewery-select');
        updateProgress('brewery');
        
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) {
            breweryInput.focus();
            breweryInput.classList.add('optional-highlight');
        }
        
        showToast('🏭 Now select or add the brewery for this new beer');
    };

    const addBreweryBeer = (beerName) => {
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) beerNameInput.value = beerName;
        hideDropdown('beerNameDropdown');
        
        showBeerConfirmed(beerName, true);
        
        const beerStyleInput = document.getElementById('reportBeerStyle');
        const beerABVInput = document.getElementById('reportBeerABV');
        if (beerStyleInput) {
            beerStyleInput.focus();
            beerStyleInput.classList.add('optional-highlight');
        }
        if (beerABVInput) {
            beerABVInput.classList.add('optional-highlight');
        }
        
        state.isNewBeer = true;
        
        // Show submit button
        showSubmitButton();
        
        showToast('💡 Add style & ABV if you know them (optional but helpful!)');
    };

    // ================================
    // FORM SUBMISSION
    // ================================
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const userId = parseInt(localStorage.getItem('user_id')) || 
                      window.App?.getState('userId');
        
        if (!userId) {
            showToast('❌ Please log in first', 'error');
            return;
        }
        
        const formData = {
            venue_id: state.currentVenue?.venue_id || state.currentVenue?.id,
            format: state.selectedFormat,
            brewery_name: state.selectedBrewery || document.getElementById('reportBrewery')?.value,
            beer_name: document.getElementById('reportBeerName')?.value,
            beer_style: document.getElementById('reportBeerStyle')?.value,
            beer_abv: document.getElementById('reportBeerABV')?.value,
            user_id: userId,
            submitted_by: window.App?.getState('userNickname') || 
                         localStorage.getItem('userNickname') || 
                         'anonymous'
        };
        
        console.log('📤 Submitting:', formData);
        
        try {
            const response = await fetch('/api/submit_beer_update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('🎉 Beer reported successfully!');
                
                if (window.App?.getModule('modalManager')) {
                    window.App.getModule('modalManager').close('reportModal');
                }
                
                // Refresh venue to show the new beer
                const venueModule = window.App?.getModule('venue');
                if (state.currentVenue?.venue_id) {
                    venueModule?.showVenueDetails(state.currentVenue.venue_id);
                }
                
                reset();
                
                // CHECK: Don't show status prompt if we came from the beer details prompt
                const cameFromBeerDetailsPrompt = window.App?.getState('cameFromBeerDetailsPrompt');
                
                if (result.show_status_prompt && state.currentVenue && !cameFromBeerDetailsPrompt) {
                    const venueModule = window.App?.getModule('venue');
                    if (venueModule?.showStatusPromptAfterBeer) {
                        setTimeout(() => {
                            venueModule.showStatusPromptAfterBeer(
                                state.currentVenue,
                                formData.submitted_by,
                                formData.user_id
                            );
                        }, 300);
                    }
                }
                
                // Clear the flag after checking
                if (cameFromBeerDetailsPrompt) {
                    window.App?.setState('cameFromBeerDetailsPrompt', false);
                }
            } else {
                showToast(result.error || '❌ Failed to submit', 'error');
            }
        } catch (error) {
            console.error('Submit error:', error);
            showToast('❌ Failed to submit. Please try again.', 'error');
        }
    };
    // ================================
    // UI HELPERS
    // ================================
    const showStep = (stepName) => {
        const allSteps = document.querySelectorAll('.cascade-step');
        
        allSteps.forEach(step => {
            step.classList.remove('active');
            step.style.display = 'none';
        });
        
        const targetStep = document.getElementById(`step-${stepName}`);
        if (targetStep) {
            targetStep.classList.add('active');
            targetStep.style.display = 'block';
        }
    };

    const updateProgress = (activeStep) => {
        const steps = ['format', 'brewery', 'beer'];
        const activeIndex = steps.indexOf(activeStep);
        
        document.querySelectorAll('.progress-step').forEach((step, index) => {
            if (!step) return;
            
            step.classList.remove('active', 'completed');
            
            if (index < activeIndex) {
                step.classList.add('completed');
            } else if (index === activeIndex) {
                step.classList.add('active');
            }
        });
    };

    const showDropdown = (dropdownId) => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.classList.add('show');
            dropdown.style.display = 'block';
        }
    };

    const hideDropdown = (dropdownId) => {
        if (dropdownId === 'breweryDropdown' && state.dropdownLoading) {
            return;
        }
        
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.classList.remove('show');
            dropdown.style.display = 'none';
        }
    };

    const showBreweryConfirmed = (breweryName, isNew) => {
        const confirmed = document.getElementById('breweryConfirmed');
        const nameEl = document.getElementById('confirmedBreweryName');
        
        if (confirmed && nameEl) {
            nameEl.textContent = breweryName + (isNew ? ' (NEW)' : '');
            confirmed.classList.add('show');
            confirmed.style.display = 'block';
            
            if (isNew) {
                confirmed.classList.add('new-required');
            } else {
                confirmed.classList.remove('new-required');
            }
        }
    };

    const showBeerConfirmed = (beerName, isNew) => {
        const confirmed = document.getElementById('beerConfirmed');
        const nameEl = document.getElementById('confirmedBeerName');
        
        if (confirmed && nameEl) {
            nameEl.textContent = beerName + (isNew ? ' (NEW)' : '');
            confirmed.classList.add('show');
            confirmed.style.display = 'block';
        }
        
        // Hide the beer name input field when confirmed
        const beerNameInput = document.getElementById('reportBeerName');
        const beerNameLabel = beerNameInput?.previousElementSibling;
        if (beerNameInput) {
            beerNameInput.style.display = 'none';
            if (beerNameLabel && beerNameLabel.tagName === 'LABEL') {
                beerNameLabel.style.display = 'none';
            }
        }
        
        // Also hide the dropdown
        hideDropdown('beerNameDropdown');
    };

    const showSubmitButton = () => {
        const formActions = document.getElementById('formActions');
        if (formActions) {
            formActions.classList.add('show');
            formActions.style.display = 'block';
        }
    };

    const showToast = (message, type = 'success') => {
        if (window.showSuccessToast && type === 'success') {
            window.showSuccessToast(message);
        } else if (window.showErrorToast && type === 'error') {
            window.showErrorToast(message);
        } else {
            console.log(`${type === 'success' ? '✅' : '❌'} ${message}`);
        }
    };

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    };

    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        reset,
        setVenue,
        getState: () => state,
        // Format & flow
        selectFormat,
        handleBreweryKnowledge,
        // Brewery actions
        selectBrewery,
        createNewBrewery,
        // Beer actions  
        selectBreweryBeer,
        selectFoundBeer,
        promptNewBeer,
        createNewBeer,
        addBreweryBeer,
        // Form
        handleSubmit,
        // UI helpers (if main.js needs them)
        hideDropdown,
        showToast
    };
})();

// ================================
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', () => {
    if (!ReportBeer.init()) {
        console.log('📝 Beer report form will initialize when modal is opened');
    }
});

// Export for use by other modules
window.ReportBeer = ReportBeer;

window.initReportBeer = () => {
    if (!ReportBeer.getState().initialized) {
        ReportBeer.init();
    }
};

// Keep the old names for compatibility until you update main.js
window.CascadeForm = ReportBeer;
window.initCascadeForm = window.initReportBeer;
