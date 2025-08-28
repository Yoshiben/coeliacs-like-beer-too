// ================================================================================
// CASCADE-FORM.JS - Complete Cascade Beer Report Form
// Handles the step-by-step beer reporting flow
// ================================================================================

const CascadeForm = {
    // ================================
    // STATE MANAGEMENT
    // ================================
    state: {
        currentStep: 'format',
        selectedFormat: null,
        knowsBrewery: null,
        selectedBrewery: null,
        selectedBeer: null,
        isNewBrewery: false,
        isNewBeer: false,
        currentVenue: null
    },

    // ================================
    // INITIALIZATION
    // ================================
    init() {
        console.log('🔧 Initializing Cascade Form...');
        
        // Check if modal exists before initializing
        const modal = document.getElementById('reportModal');
        if (!modal) {
            console.log('⏳ Report modal not in DOM yet, deferring initialization');
            return false;
        }
        
        this.attachEventListeners();
        this.setupClickOutside();
        this.reset();
        console.log('✅ Cascade Form initialized');
        return true;
    },

    // Reset form to initial state
    reset() {
        // Check if modal exists first
        const modal = document.getElementById('reportModal');
        if (!modal) {
            console.log('📝 Report modal not found, skipping reset');
            return;
        }
        
        // Reset state
        this.state.currentStep = 'format';
        this.state.selectedFormat = null;
        this.state.knowsBrewery = null;
        this.state.selectedBrewery = null;
        this.state.selectedBeer = null;
        this.state.isNewBrewery = false;
        this.state.isNewBeer = false;
        
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
        this.updateProgress('format');
        
        // Clear form inputs
        const form = document.getElementById('reportForm');
        if (form) form.reset();
    },

    // Set venue context (called from main.js when opening modal)
    setVenue(venue) {
        this.state.currentVenue = venue;
        if (venue) {
            document.getElementById('venueId').value = venue.venue_id || venue.id;
            document.getElementById('venueName').value = venue.venue_name || venue.name;
        }
    },

    // ================================
    // EVENT LISTENERS
    // ================================
    attachEventListeners() {
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
                console.log('🔘 Format clicked:', formatBtn.dataset.format);
                this.selectFormat(formatBtn.dataset.format);
                return;
            }
            
            // Brewery knowledge buttons
            const knowsBtn = e.target.closest('[data-knows-brewery]');
            if (knowsBtn) {
                e.preventDefault();
                console.log('🏭 Brewery knowledge:', knowsBtn.dataset.knowsBrewery);
                this.handleBreweryKnowledge(knowsBtn.dataset.knowsBrewery === 'yes');
                return;
            }
            
            // Dropdown items
            const suggestionItem = e.target.closest('.suggestion-item');
            if (suggestionItem) {
                e.preventDefault();
                this.handleSuggestionClick(suggestionItem);
                return;
            }
        });
        
        // Brewery input with debounce
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) {
            let breweryTimeout;
            breweryInput.addEventListener('input', (e) => {
                clearTimeout(breweryTimeout);
                breweryTimeout = setTimeout(() => {
                    this.searchBreweries(e.target.value);
                }, 300);
            });
            
            breweryInput.addEventListener('focus', () => {
                if (!breweryInput.value) {
                    this.showAllBreweries();
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
                    this.searchBeersGlobally(e.target.value);
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
                    if (this.state.selectedBrewery) {
                        this.searchBreweryBeers(e.target.value);
                    }
                }, 300);
            });
        }
        
        // Form submission
        const form = document.getElementById('reportForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                this.handleSubmit(e);
            });
        }
    },

    // Setup click outside to close dropdowns
    setupClickOutside() {
        document.addEventListener('click', (e) => {
            const dropdowns = ['breweryDropdown', 'beerNameDropdown', 'beerSearchDropdown'];
            
            dropdowns.forEach(dropdownId => {
                const dropdown = document.getElementById(dropdownId);
                if (!dropdown) return;
                
                const inputMap = {
                    'breweryDropdown': 'reportBrewery',
                    'beerNameDropdown': 'reportBeerName',
                    'beerSearchDropdown': 'beerSearchFirst'
                };
                
                const inputId = inputMap[dropdownId];
                const input = document.getElementById(inputId);
                
                // If click is not on the input or dropdown, hide it
                if (!e.target.closest(`#${dropdownId}`) && 
                    !e.target.closest(`#${inputId}`)) {
                    this.hideDropdown(dropdownId);
                }
            });
        });
    },

    // ================================
    // STEP 1: FORMAT SELECTION
    // ================================
    selectFormat(format) {
        this.state.selectedFormat = format;
        
        // Update UI
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.format === format);
        });
        
        // Set hidden input value
        document.getElementById('reportFormat').value = format;
        
        // Move to next step
        this.showStep('brewery-question');
        this.updateProgress('brewery');
    },

    // ================================
    // STEP 2: BREWERY KNOWLEDGE
    // ================================
    handleBreweryKnowledge(knowsBrewery) {
        this.state.knowsBrewery = knowsBrewery;
        
        if (knowsBrewery) {
            // User knows brewery - show brewery selection
            this.showStep('brewery-select');
            document.getElementById('reportBrewery').focus();
        } else {
            // User doesn't know brewery - show beer search
            this.showStep('beer-search');
            document.getElementById('beerSearchFirst').focus();
        }
    },

    // ================================
    // BREWERY SEARCH & SELECTION
    // ================================
    async searchBreweries(query) {
        try {
            const response = await fetch(`/api/breweries?q=${encodeURIComponent(query)}`);
            const breweries = await response.json();
            this.displayBreweryDropdown(breweries, query);
        } catch (error) {
            console.error('Error searching breweries:', error);
            this.hideDropdown('breweryDropdown');
        }
    },

    async showAllBreweries() {
        const dropdown = document.getElementById('breweryDropdown');
        if (dropdown) {
            dropdown.innerHTML = '<div class="dropdown-header">Loading breweries...</div>';
            this.showDropdown('breweryDropdown');
        }
        
        try {
            const response = await fetch('/api/breweries');
            const breweries = await response.json();
            this.displayBreweryDropdown(breweries.slice(0, 50), '');
        } catch (error) {
            console.error('Error loading breweries:', error);
            dropdown.innerHTML = '<div class="dropdown-header">Failed to load breweries</div>';
        }
    },

    displayBreweryDropdown(breweries, query) {
        const dropdown = document.getElementById('breweryDropdown');
        if (!dropdown) return;
        
        let html = '';
        
        if (breweries.length === 0 && query) {
            html = `
                <div class="dropdown-header">🔍 No matches found</div>
                <div class="suggestion-item new-brewery" data-action="create-brewery" data-brewery="${this.escapeHtml(query)}">
                    <strong>➕ Add "${this.escapeHtml(query)}" as new brewery</strong>
                    <small>This will be added to our database</small>
                </div>
            `;
        } else {
            // Header
            if (query) {
                html += `<div class="dropdown-header">🔍 ${breweries.length} matches for "${this.escapeHtml(query)}"</div>`;
            } else {
                html += `<div class="dropdown-header">🍺 ${breweries.length} Breweries Available</div>`;
            }
            
            // Brewery list
            breweries.forEach(brewery => {
                html += `
                    <div class="suggestion-item" data-action="select-brewery" data-brewery="${this.escapeHtml(brewery)}">
                        <strong>${this.escapeHtml(brewery)}</strong>
                    </div>
                `;
            });
            
            // Add new option if searching
            if (query && !breweries.some(b => b.toLowerCase() === query.toLowerCase())) {
                html += `
                    <div class="suggestion-item new-brewery" data-action="create-brewery" data-brewery="${this.escapeHtml(query)}">
                        <strong>➕ Add "${this.escapeHtml(query)}" as new brewery</strong>
                        <small>Not in list? Add it!</small>
                    </div>
                `;
            }
        }
        
        dropdown.innerHTML = html;
        this.showDropdown('breweryDropdown');
    },

    selectBrewery(breweryName) {
        this.state.selectedBrewery = breweryName;
        this.state.isNewBrewery = false;
        
        // Fill input
        document.getElementById('reportBrewery').value = breweryName;
        this.hideDropdown('breweryDropdown');
        
        // Show beer details step
        this.showStep('beer-details');
        this.updateProgress('beer');
        
        // Show brewery confirmation
        this.showBreweryConfirmed(breweryName);
        
        // Focus beer name input
        document.getElementById('reportBeerName').focus();
        
        // Load this brewery's beers
        this.loadBreweryBeers(breweryName);
    },

    createNewBrewery(breweryName) {
        this.state.selectedBrewery = breweryName;
        this.state.isNewBrewery = true;
        
        // Fill input
        document.getElementById('reportBrewery').value = breweryName;
        this.hideDropdown('breweryDropdown');
        
        // Show beer details step
        this.showStep('beer-details');
        this.updateProgress('beer');
        
        // Show brewery confirmation with NEW indicator
        this.showBreweryConfirmed(breweryName + ' (NEW)');
        
        // Focus beer name input
        document.getElementById('reportBeerName').focus();
        
        this.showToast(`🆕 "${breweryName}" will be added to our database!`);
    },

    // ================================
    // BEER SEARCH & SELECTION
    // ================================
    async searchBeersGlobally(query) {
        if (query.length < 2) {
            this.hideDropdown('beerSearchDropdown');
            return;
        }
        
        try {
            const response = await fetch(`/api/beers/search?q=${encodeURIComponent(query)}`);
            const beers = await response.json();
            
            const dropdown = document.getElementById('beerSearchDropdown');
            let html = '';
            
            if (beers.length > 0) {
                html = `<div class="dropdown-header">🔍 ${beers.length} beers found</div>`;
                beers.forEach(beer => {
                    html += `
                        <div class="suggestion-item beer-item" data-action="select-found-beer" data-beer='${JSON.stringify(beer)}'>
                            <strong>${this.escapeHtml(beer.beer_name)}</strong>
                            <small>🏭 ${this.escapeHtml(beer.brewery_name)} • ${this.escapeHtml(beer.style || 'Unknown style')}</small>
                        </div>
                    `;
                });
            } else {
                html = `
                    <div class="dropdown-header">No beers found</div>
                    <div class="suggestion-item new-beer" data-action="create-new-beer" data-beer="${this.escapeHtml(query)}">
                        <strong>➕ Add "${this.escapeHtml(query)}" as new beer</strong>
                        <small>We'll help you add the brewery next</small>
                    </div>
                `;
            }
            
            dropdown.innerHTML = html;
            this.showDropdown('beerSearchDropdown');
            
        } catch (error) {
            console.error('Error searching beers:', error);
        }
    },

    async searchBreweryBeers(query) {
        if (!this.state.selectedBrewery) return;
        
        try {
            const response = await fetch(`/api/brewery/${encodeURIComponent(this.state.selectedBrewery)}/beers?q=${encodeURIComponent(query)}`);
            const beers = await response.json();
            
            const dropdown = document.getElementById('beerNameDropdown');
            let html = '';
            
            if (beers.length > 0) {
                html = `<div class="dropdown-header">🍺 ${beers.length} ${this.state.selectedBrewery} beers</div>`;
                beers.forEach(beer => {
                    html += `
                        <div class="suggestion-item" data-action="select-brewery-beer" data-beer='${JSON.stringify(beer)}'>
                            <strong>${this.escapeHtml(beer.beer_name)}</strong>
                            <small>${this.escapeHtml(beer.style || 'Unknown')} • ${beer.abv || '?'}% ABV</small>
                        </div>
                    `;
                });
            } else if (query) {
                html = `
                    <div class="suggestion-item new-beer" data-action="add-brewery-beer" data-beer="${this.escapeHtml(query)}">
                        <strong>➕ Add "${this.escapeHtml(query)}" to ${this.state.selectedBrewery}</strong>
                    </div>
                `;
            }
            
            if (html) {
                dropdown.innerHTML = html;
                this.showDropdown('beerNameDropdown');
            } else {
                this.hideDropdown('beerNameDropdown');
            }
            
        } catch (error) {
            console.error('Error loading brewery beers:', error);
        }
    },

    async loadBreweryBeers(breweryName) {
        try {
            const response = await fetch(`/api/brewery/${encodeURIComponent(breweryName)}/beers`);
            const beers = await response.json();
            
            if (beers.length > 0) {
                this.showToast(`🍺 ${breweryName} has ${beers.length} beers in our database`);
            } else {
                this.showToast(`🆕 You're adding the first ${breweryName} beer!`);
            }
        } catch (error) {
            console.error('Error loading brewery beers:', error);
        }
    },

    selectFoundBeer(beer) {
        this.state.selectedBeer = beer;
        this.state.selectedBrewery = beer.brewery_name;
        
        this.hideDropdown('beerSearchDropdown');
        
        // Move to beer details with pre-filled data
        this.showStep('beer-details');
        this.updateProgress('beer');
        
        // Show brewery
        this.showBreweryConfirmed(beer.brewery_name);
        
        // Fill in beer details
        document.getElementById('reportBeerName').value = beer.beer_name;
        document.getElementById('reportBeerStyle').value = beer.style || '';
        document.getElementById('reportBeerABV').value = beer.abv || '';
        
        // Show submit button
        document.getElementById('formActions').classList.add('show');
        
        this.showToast(`✅ Found it! ${beer.beer_name} by ${beer.brewery_name}`);
    },

    selectBreweryBeer(beer) {
        // Fill beer details
        document.getElementById('reportBeerName').value = beer.beer_name;
        document.getElementById('reportBeerStyle').value = beer.style || '';
        document.getElementById('reportBeerABV').value = beer.abv || '';
        
        this.hideDropdown('beerNameDropdown');
        
        // Show submit button
        document.getElementById('formActions').classList.add('show');
        
        this.showToast(`✅ Selected: ${beer.beer_name}`);
    },

    // ================================
    // DROPDOWN CLICK HANDLER
    // ================================
    handleSuggestionClick(item) {
        const action = item.dataset.action;
        
        switch(action) {
            case 'select-brewery':
                this.selectBrewery(item.dataset.brewery);
                break;
                
            case 'create-brewery':
                this.createNewBrewery(item.dataset.brewery);
                break;
                
            case 'select-found-beer':
                this.selectFoundBeer(JSON.parse(item.dataset.beer));
                break;
                
            case 'create-new-beer':
                // User doesn't know brewery, creating new beer
                const beerName = item.dataset.beer;
                document.getElementById('beerSearchFirst').value = beerName;
                this.hideDropdown('beerSearchDropdown');
                
                // Move to brewery selection for this new beer
                this.showStep('brewery-select');
                this.updateProgress('brewery');
                document.getElementById('reportBrewery').focus();
                this.showToast('🏭 Now select or add the brewery for this beer');
                break;
                
            case 'select-brewery-beer':
                this.selectBreweryBeer(JSON.parse(item.dataset.beer));
                break;
                
            case 'add-brewery-beer':
                // Adding new beer to known brewery
                document.getElementById('reportBeerName').value = item.dataset.beer;
                this.hideDropdown('beerNameDropdown');
                document.getElementById('reportBeerStyle').focus();
                this.state.isNewBeer = true;
                document.getElementById('formActions').classList.add('show');
                break;
        }
    },

    // ================================
    // FORM SUBMISSION
    // ================================
    async handleSubmit(e) {
        e.preventDefault();
        
        // Get user ID
        const userId = parseInt(localStorage.getItem('user_id')) || 
                      window.App?.getState('userId');
        
        if (!userId) {
            this.showToast('❌ Please log in first', 'error');
            return;
        }
        
        // Build submission data
        const formData = {
            venue_id: this.state.currentVenue?.venue_id || this.state.currentVenue?.id,
            format: this.state.selectedFormat,
            brewery_name: this.state.selectedBrewery || document.getElementById('reportBrewery').value,
            beer_name: document.getElementById('reportBeerName').value,
            beer_style: document.getElementById('reportBeerStyle').value,
            beer_abv: document.getElementById('reportBeerABV').value,
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
                this.showToast('🎉 Beer reported successfully!');
                
                // Close modal
                if (window.App?.getModule('modalManager')) {
                    window.App.getModule('modalManager').close('reportModal');
                } else {
                    document.getElementById('reportModal').classList.remove('active');
                }
                
                // Reset form
                this.reset();
                
                // Show status prompt if needed
                if (result.show_status_prompt && this.state.currentVenue) {
                    setTimeout(() => {
                        window.App?.trigger?.('show-status-prompt', this.state.currentVenue);
                    }, 300);
                }
            } else {
                this.showToast(result.error || '❌ Failed to submit', 'error');
            }
        } catch (error) {
            console.error('Submit error:', error);
            this.showToast('❌ Failed to submit. Please try again.', 'error');
        }
    },

    // ================================
    // UI HELPERS
    // ================================
    showStep(stepName) {
        // Hide all steps
        document.querySelectorAll('.cascade-step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Show target step
        const targetStep = document.getElementById(`step-${stepName}`);
        if (targetStep) {
            targetStep.classList.add('active');
        }
        
        // Show submit button when on beer details
        if (stepName === 'beer-details') {
            document.getElementById('formActions').classList.add('show');
        }
    },

    updateProgress(activeStep) {
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
    },

    showDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.classList.add('show');
        }
    },

    hideDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    },

    showBreweryConfirmed(breweryName) {
        const confirmed = document.getElementById('breweryConfirmed');
        const nameEl = document.getElementById('confirmedBreweryName');
        
        if (confirmed && nameEl) {
            nameEl.textContent = breweryName;
            confirmed.classList.add('show');
        }
    },

    showToast(message, type = 'success') {
        if (window.showSuccessToast && type === 'success') {
            window.showSuccessToast(message);
        } else if (window.showErrorToast && type === 'error') {
            window.showErrorToast(message);
        } else {
            console.log(`${type === 'success' ? '✅' : '❌'} ${message}`);
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
};

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
    if (!CascadeForm.state.initialized) {
        CascadeForm.state.initialized = CascadeForm.init();
    }
};
