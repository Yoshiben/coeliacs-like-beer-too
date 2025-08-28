// ================================================================================
// CASCADE-FORM.JS - Complete Cascade Beer Report Form
// Handles the step-by-step beer reporting flow
// ================================================================================

export const CascadeForm = (() => {
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
        dropdownLoading: false  // Add this flag
    };

    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🔧 Initializing Cascade Form...');
        
        // Check if modal exists before initializing
        const modal = document.getElementById('reportModal');
        if (!modal) {
            console.log('⏳ Report modal not in DOM yet, deferring initialization');
            return false;
        }
        
        attachEventListeners();
        // setupClickOutside();  // COMMENTED OUT FOR NOW
        reset();
        console.log('✅ Cascade Form initialized');
        state.initialized = true;
        return true;
    };

    // Reset form to initial state
    const reset = () => {
        // Check if modal exists first
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
        
        // Reset UI - hide all steps
        document.querySelectorAll('.cascade-step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Show only format step
        const formatStep = document.getElementById('step-format');
        if (formatStep) formatStep.classList.add('active');
        
        // Hide all dropdowns
        document.querySelectorAll('.suggestions').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        
        // Hide brewery confirmed section
        const breweryConfirmed = document.getElementById('breweryConfirmed');
        if (breweryConfirmed) breweryConfirmed.classList.remove('show');
        
        // Hide submit button
        const formActions = document.getElementById('formActions');
        if (formActions) formActions.classList.remove('show');
        
        // Reset format buttons
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Reset progress bar
        updateProgress('format');
        
        // Clear form inputs
        const form = document.getElementById('reportForm');
        if (form) form.reset();
    };

    // Set venue context (called from main.js when opening modal)
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
    // EVENT LISTENERS
    // ================================
    const attachEventListeners = () => {
        console.log('📎 Attaching event listeners...');
        
        // Use event delegation for all clicks within the modal
        const modal = document.getElementById('reportModal');
        if (!modal) {
            console.error('❌ Modal not found for event listeners');
            return;
        }
        
        // Single delegated click handler for all buttons
        modal.addEventListener('click', (e) => {
            // Format buttons
            const formatBtn = e.target.closest('.format-btn');
            if (formatBtn) {
                e.preventDefault();
                e.stopPropagation(); // Stop event from bubbling to other handlers
                console.log('🔘 Format clicked:', formatBtn.dataset.format);
                selectFormat(formatBtn.dataset.format);
                return;
            }
            
            // Brewery knowledge buttons
            const knowsBtn = e.target.closest('[data-knows-brewery]');
            if (knowsBtn) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🏭 Brewery knowledge:', knowsBtn.dataset.knowsBrewery);
                handleBreweryKnowledge(knowsBtn.dataset.knowsBrewery === 'yes');
                return;
            }
            
            // Dropdown items - PRIORITY HANDLING
            const suggestionItem = e.target.closest('.suggestion-item');
            if (suggestionItem && suggestionItem.closest('#reportModal')) {  // Only if in our modal
                e.preventDefault();
                e.stopPropagation(); // Stop forms.js from handling it
                console.log('🎯 Cascade handling suggestion click');
                handleSuggestionClick(suggestionItem);
                return;
            }
        }, true); // Use capture phase to handle before other listeners
        
        // Brewery input with debounce
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
            
            // Keep dropdown open when clicking on input
            breweryInput.addEventListener('mousedown', (e) => {
                if (!breweryInput.value) {
                    e.preventDefault(); // Prevent default focus behavior
                    showAllBreweries();
                    breweryInput.focus(); // Manually focus after
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
        }
        
        // Form submission
        const form = document.getElementById('reportForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                handleSubmit(e);
            });
        }
    };

    // Setup click outside to close dropdowns  
    const setupClickOutside = () => {
        // Use mousedown instead of click to prevent conflicts
        document.addEventListener('mousedown', (e) => {
            // Check each dropdown
            const dropdowns = ['breweryDropdown', 'beerNameDropdown', 'beerSearchDropdown'];
            
            dropdowns.forEach(dropdownId => {
                const dropdown = document.getElementById(dropdownId);
                if (!dropdown || !dropdown.classList.contains('show')) return;
                
                const inputMap = {
                    'breweryDropdown': 'reportBrewery',
                    'beerNameDropdown': 'reportBeerName', 
                    'beerSearchDropdown': 'beerSearchFirst'
                };
                
                const inputId = inputMap[dropdownId];
                const input = document.getElementById(inputId);
                
                // Check if click is outside both input and dropdown
                const clickedOnInput = input && input.contains(e.target);
                const clickedOnDropdown = dropdown.contains(e.target);
                
                if (!clickedOnInput && !clickedOnDropdown) {
                    hideDropdown(dropdownId);
                }
            });
        });
    };

    // ================================
    // STEP 1: FORMAT SELECTION
    // ================================
    const selectFormat = (format) => {
        console.log('📍 selectFormat called with:', format);
        
        state.selectedFormat = format;
        console.log('📍 State updated:', state.selectedFormat);
        
        // Update UI
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.format === format);
        });
        console.log('📍 Updated button styles');
        
        // Set hidden input value
        const hiddenInput = document.getElementById('reportFormat');
        if (hiddenInput) {
            hiddenInput.value = format;
            console.log('📍 Set hidden input value:', format);
        } else {
            console.error('❌ Hidden input reportFormat not found!');
        }
        
        // Move to next step
        console.log('📍 About to show brewery-question step');
        showStep('brewery-question');
        updateProgress('brewery');
        console.log('📍 selectFormat complete');
    };

    // ================================
    // STEP 2: BREWERY KNOWLEDGE
    // ================================
    const handleBreweryKnowledge = (knowsBrewery) => {
        state.knowsBrewery = knowsBrewery;
        
        if (knowsBrewery) {
            // User knows brewery - show brewery selection
            showStep('brewery-select');
            const breweryInput = document.getElementById('reportBrewery');
            if (breweryInput) breweryInput.focus();
        } else {
            // User doesn't know brewery - show beer search
            showStep('beer-search');
            const beerSearchInput = document.getElementById('beerSearchFirst');
            if (beerSearchInput) beerSearchInput.focus();
        }
    };

    // ================================
    // BREWERY SEARCH & SELECTION
    // ================================
    const searchBreweries = async (query) => {
        try {
            const response = await fetch(`/api/breweries?q=${encodeURIComponent(query)}`);
            const breweries = await response.json();
            displayBreweryDropdown(breweries, query);
        } catch (error) {
            console.error('Error searching breweries:', error);
            hideDropdown('breweryDropdown');
        }
    };

    const showAllBreweries = async () => {
        // Prevent hiding while loading
        state.dropdownLoading = true;
        
        const dropdown = document.getElementById('breweryDropdown');
        if (dropdown) {
            dropdown.innerHTML = '<div class="dropdown-header">Loading breweries...</div>';
            dropdown.classList.add('show');
            dropdown.style.display = 'block'; // Force display
        }
        
        try {
            const response = await fetch('/api/breweries');
            const breweries = await response.json();
            
            // Only proceed if dropdown still exists and should be shown
            if (state.dropdownLoading && dropdown) {
                displayBreweryDropdown(breweries.slice(0, 50), '');
            }
        } catch (error) {
            console.error('Error loading breweries:', error);
            if (dropdown && state.dropdownLoading) {
                dropdown.innerHTML = '<div class="dropdown-header">Failed to load breweries</div>';
            }
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
            // Header
            if (query) {
                html += `<div class="dropdown-header">🔍 ${breweries.length} matches for "${escapeHtml(query)}"</div>`;
            } else {
                html += `<div class="dropdown-header">🍺 ${breweries.length} Breweries Available</div>`;
            }
            
            // Brewery list
            breweries.forEach(brewery => {
                html += `
                    <div class="suggestion-item" data-action="select-brewery" data-brewery="${escapeHtml(brewery)}">
                        <strong>${escapeHtml(brewery)}</strong>
                    </div>
                `;
            });
            
            // Add new brewery option if searching with a query
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
        
        // CRITICAL: Attach click handlers AFTER adding HTML
        dropdown.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const action = this.dataset.action;
                const brewery = this.dataset.brewery;
                
                console.log('🎯 Clicked:', action, brewery);
                
                if (action === 'select-brewery') {
                    selectBrewery(brewery);
                } else if (action === 'create-brewery') {
                    if (brewery) {
                        createNewBrewery(brewery);
                    } else {
                        // No brewery name, prompt for input
                        const input = document.getElementById('reportBrewery');
                        if (input) {
                            hideDropdown('breweryDropdown');
                            input.value = '';
                            input.placeholder = 'Type new brewery name...';
                            input.focus();
                            showToast('💡 Type the new brewery name');
                        }
                    }
                }
            });
        });
    };

    const selectBrewery = (breweryName) => {
        state.selectedBrewery = breweryName;
        state.isNewBrewery = false;
        
        // Fill input
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) breweryInput.value = breweryName;
        hideDropdown('breweryDropdown');
        
        // Show beer details step
        showStep('beer-details');
        updateProgress('beer');
        
        // Show brewery confirmation
        showBreweryConfirmed(breweryName);
        
        // Focus beer name input
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) beerNameInput.focus();
        
        // Load this brewery's beers
        loadBreweryBeers(breweryName);
    };

    const createNewBrewery = (breweryName) => {
        state.selectedBrewery = breweryName;
        state.isNewBrewery = true;
        
        // Fill input
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) breweryInput.value = breweryName;
        hideDropdown('breweryDropdown');
        
        // Show beer details step
        showStep('beer-details');
        updateProgress('beer');
        
        // Show brewery confirmation with NEW indicator
        showBreweryConfirmed(breweryName + ' (NEW)');
        
        // Focus beer name input
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) beerNameInput.focus();
        
        showToast(`🆕 "${breweryName}" will be added to our database!`);
    };

    // ================================
    // BEER SEARCH & SELECTION
    // ================================
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
                    html += `
                        <div class="suggestion-item beer-item" data-action="select-found-beer" data-beer='${JSON.stringify(beer)}'>
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
                    html += `
                        <div class="suggestion-item" data-action="select-brewery-beer" data-beer='${JSON.stringify(beer)}'>
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

    const loadBreweryBeers = async (breweryName) => {
        try {
            const response = await fetch(`/api/brewery/${encodeURIComponent(breweryName)}/beers`);
            const beers = await response.json();
            
            if (beers.length > 0) {
                showToast(`🍺 ${breweryName} has ${beers.length} beers in our database`);
            } else {
                showToast(`🆕 You're adding the first ${breweryName} beer!`);
            }
        } catch (error) {
            console.error('Error loading brewery beers:', error);
        }
    };

    const selectFoundBeer = (beer) => {
        state.selectedBeer = beer;
        state.selectedBrewery = beer.brewery_name;
        
        hideDropdown('beerSearchDropdown');
        
        // Move to beer details with pre-filled data
        showStep('beer-details');
        updateProgress('beer');
        
        // Show brewery
        showBreweryConfirmed(beer.brewery_name);
        
        // Fill in beer details
        const beerNameInput = document.getElementById('reportBeerName');
        const beerStyleInput = document.getElementById('reportBeerStyle');
        const beerABVInput = document.getElementById('reportBeerABV');
        
        if (beerNameInput) beerNameInput.value = beer.beer_name;
        if (beerStyleInput) beerStyleInput.value = beer.style || '';
        if (beerABVInput) beerABVInput.value = beer.abv || '';
        
        // Show submit button
        const formActions = document.getElementById('formActions');
        if (formActions) formActions.classList.add('show');
        
        showToast(`✅ Found it! ${beer.beer_name} by ${beer.brewery_name}`);
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
        
        // Show submit button
        const formActions = document.getElementById('formActions');
        if (formActions) formActions.classList.add('show');
        
        showToast(`✅ Selected: ${beer.beer_name}`);
    };

    // ================================
    // DROPDOWN CLICK HANDLER
    // ================================
    const handleSuggestionClick = (item) => {
        const action = item.dataset.action;
        console.log('🎯 Handling suggestion click:', action);
        
        switch(action) {
            case 'select-brewery':
                console.log('📍 Selecting brewery:', item.dataset.brewery);
                selectBrewery(item.dataset.brewery);
                break;
                
            case 'create-brewery':
                console.log('🔴 CREATE BREWERY - item.dataset:', item.dataset);
                console.log('🔴 Brewery value:', item.dataset.brewery);
                
                if (!item.dataset.brewery) {
                    console.error('❌ No brewery name provided!');
                    return;
                }
                
                createNewBrewery(item.dataset.brewery);
                break;
                
            case 'prompt-new-brewery':
                // Fixed: Don't redeclare breweryInput
                const input = document.getElementById('reportBrewery');
                if (input) {
                    hideDropdown('breweryDropdown');
                    input.value = '';
                    input.placeholder = 'Type new brewery name...';
                    input.focus();
                    showToast('💡 Type the new brewery name');
                }
                break;
                
            case 'select-found-beer':
                selectFoundBeer(JSON.parse(item.dataset.beer));
                break;
                
            case 'create-new-beer':
                // User doesn't know brewery, creating new beer
                const beerName = item.dataset.beer;
                const beerSearchInput = document.getElementById('beerSearchFirst');
                if (beerSearchInput) beerSearchInput.value = beerName;
                hideDropdown('beerSearchDropdown');
                
                // Move to brewery selection for this new beer
                showStep('brewery-select');
                updateProgress('brewery');
                const breweryInput = document.getElementById('reportBrewery');
                if (breweryInput) breweryInput.focus();
                showToast('🏭 Now select or add the brewery for this beer');
                break;
                
            case 'select-brewery-beer':
                selectBreweryBeer(JSON.parse(item.dataset.beer));
                break;
                
            case 'add-brewery-beer':
                // Adding new beer to known brewery
                const beerNameInput = document.getElementById('reportBeerName');
                if (beerNameInput) beerNameInput.value = item.dataset.beer;
                hideDropdown('beerNameDropdown');
                const beerStyleInput = document.getElementById('reportBeerStyle');
                if (beerStyleInput) beerStyleInput.focus();
                state.isNewBeer = true;
                const formActions = document.getElementById('formActions');
                if (formActions) formActions.classList.add('show');
                break;
        }
    };
    // ================================
    // FORM SUBMISSION
    // ================================
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Get user ID
        const userId = parseInt(localStorage.getItem('user_id')) || 
                      window.App?.getState('userId');
        
        if (!userId) {
            showToast('❌ Please log in first', 'error');
            return;
        }
        
        // Build submission data
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
                
                // Close modal
                if (window.App?.getModule('modalManager')) {
                    window.App.getModule('modalManager').close('reportModal');
                } else {
                    const modal = document.getElementById('reportModal');
                    if (modal) modal.classList.remove('active');
                }
                
                // Reset form
                reset();
                
                // Show status prompt if needed
                if (result.show_status_prompt && state.currentVenue) {
                    setTimeout(() => {
                        window.App?.trigger?.('show-status-prompt', state.currentVenue);
                    }, 300);
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
        console.log('🔄 showStep called with:', stepName);
        
        // Hide ALL steps first
        const allSteps = document.querySelectorAll('.cascade-step');
        console.log('🔄 Found', allSteps.length, 'cascade steps');
        
        allSteps.forEach(step => {
            console.log('  Hiding step:', step.id);
            step.classList.remove('active');
            step.style.display = 'none';  // Force hide with inline style
        });
        
        // Show ONLY the target step
        const targetStep = document.getElementById(`step-${stepName}`);
        if (targetStep) {
            targetStep.classList.add('active');
            targetStep.style.display = 'block';  // Force show with inline style
            console.log('🔄 Activated step:', stepName);
        } else {
            console.error('❌ Step not found:', `step-${stepName}`);
        }
        
        // Show submit button when on beer details
        if (stepName === 'beer-details') {
            const formActions = document.getElementById('formActions');
            if (formActions) {
                formActions.classList.add('show');
                console.log('🔄 Showed form actions');
            }
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
            dropdown.style.display = 'block'; // This might be the issue
        }
    };

    const hideDropdown = (dropdownId) => {
        // Don't hide if it's loading
        if (dropdownId === 'breweryDropdown' && state.dropdownLoading) {
            return;
        }
        
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.classList.remove('show');
            dropdown.style.display = 'none'; // Force hide with inline style
        }
    };

    const showBreweryConfirmed = (breweryName) => {
        const confirmed = document.getElementById('breweryConfirmed');
        const nameEl = document.getElementById('confirmedBreweryName');
        
        if (confirmed && nameEl) {
            nameEl.textContent = breweryName;
            confirmed.classList.add('show');
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
        selectBrewery,
        selectBreweryBeer,
        handleSubmit,
        selectFoundBeer
    };
})();

// ================================
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', () => {
    // Try to initialize
    if (!CascadeForm.init()) {
        // If modal doesn't exist yet, it will be initialized when opened
        console.log('📝 Cascade form will initialize when modal is opened');
    }
});

// Export for use by other modules
window.CascadeForm = CascadeForm;

// Also expose an initialization method for manual init
window.initCascadeForm = () => {
    if (!CascadeForm.getState().initialized) {
        CascadeForm.init();
    }
};
