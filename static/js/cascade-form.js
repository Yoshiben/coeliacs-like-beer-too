// ================================================================================
// CASCADE BEER FORM HANDLER
// Add this to your forms.js or create a new cascade-form.js file
// ================================================================================

const CascadeForm = {
    // State
    currentStep: 'format',
    selectedFormat: null,
    knowsBrewery: null,
    selectedBrewery: null,
    selectedBeer: null,
    isNewBrewery: false,
    isNewBeer: false,
    
    // Initialize
    init() {
        this.attachEventListeners();
        this.setupClickOutside();
        this.reset();
        console.log('✅ Cascade form initialized');
    },
    
    // Reset form to initial state
    reset() {
        this.currentStep = 'format';
        this.selectedFormat = null;
        this.knowsBrewery = null;
        this.selectedBrewery = null;
        this.selectedBeer = null;
        this.isNewBrewery = false;
        this.isNewBeer = false;
        
        // Reset UI
        document.querySelectorAll('.cascade-step').forEach(step => {
            step.style.display = 'none';
        });
        document.getElementById('step-format').style.display = 'block';
        
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        document.getElementById('formActions').style.display = 'none';
        document.getElementById('newItemAlert').style.display = 'none';
        
        // Reset progress
        this.updateProgress('format');
        
        // Clear all inputs
        document.getElementById('reportForm').reset();
    },
    
    // Attach event listeners
    attachEventListeners() {
        // Format selection
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectFormat(e.currentTarget.dataset.format);
            });
        });
        
        // Brewery knowledge choice
        document.querySelectorAll('[data-knows-brewery]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleBreweryKnowledge(e.currentTarget.dataset.knowsBrewery === 'yes');
            });
        });
        
        // Brewery input
        const breweryInput = document.getElementById('reportBrewery');
        if (breweryInput) {
            breweryInput.addEventListener('input', debounce((e) => {
                this.searchBreweries(e.target.value);
            }, 300));
            
            breweryInput.addEventListener('focus', () => {
                if (!breweryInput.value) {
                    this.showAllBreweries();
                }
            });
        }
        
        // Beer search (when brewery unknown)
        const beerSearchInput = document.getElementById('beerSearchFirst');
        if (beerSearchInput) {
            beerSearchInput.addEventListener('input', debounce((e) => {
                this.searchBeersGlobally(e.target.value);
            }, 300));
        }
        
        // Beer name input (when brewery known)
        const beerNameInput = document.getElementById('reportBeerName');
        if (beerNameInput) {
            beerNameInput.addEventListener('input', debounce((e) => {
                if (this.selectedBrewery) {
                    this.searchBreweryBeers(e.target.value);
                }
            }, 300));
        }
        
        // Toggle optional details
        document.querySelector('[data-action="toggle-optional"]')?.addEventListener('click', () => {
            this.toggleOptionalDetails();
        });
        
        // Not found brewery link
        document.querySelector('[data-action="brewery-not-found"]')?.addEventListener('click', () => {
            this.handleNewBrewery();
        });
        
        // Form submit
        document.getElementById('reportForm')?.addEventListener('submit', (e) => {
            this.handleSubmit(e);
        });
        
        // Dropdown clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.suggestion-item')) {
                this.handleSuggestionClick(e.target.closest('.suggestion-item'));
            }
        });
    },
    
    // Step 1: Select format
    selectFormat(format) {
        this.selectedFormat = format;
        
        // Update UI
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.format === format);
        });
        
        document.getElementById('reportFormat').value = format;
        
        // Show next step
        this.showStep('brewery-question');
        this.updateProgress('brewery');
    },
    
    // Step 2: Handle brewery knowledge
    handleBreweryKnowledge(knows) {
        this.knowsBrewery = knows;
        
        if (knows) {
            // Show brewery selection
            this.showStep('brewery-select');
            document.getElementById('reportBrewery').focus();
        } else {
            // Show beer search
            this.showStep('beer-search');
            document.getElementById('beerSearchFirst').focus();
        }
    },
    
    // Search breweries
    async searchBreweries(query) {
        const dropdown = document.getElementById('breweryDropdown');
        
        try {
            const response = await fetch(`/api/breweries?q=${encodeURIComponent(query)}`);
            const breweries = await response.json();
            
            this.displayBreweryDropdown(breweries, query);
        } catch (error) {
            console.error('Error searching breweries:', error);
        }
    },
    
    // Show all breweries on focus
    async showAllBreweries() {
        const dropdown = document.getElementById('breweryDropdown');
        const input = document.getElementById('reportBrewery');
        
        // Show loading state
        dropdown.innerHTML = '<div class="suggestions loading"></div>';
        dropdown.style.display = 'block';
        input.classList.add('dropdown-open');
        
        try {
            const response = await fetch('/api/breweries');
            const breweries = await response.json();
            
            this.displayBreweryDropdown(breweries.slice(0, 50), '');
        } catch (error) {
            console.error('Error loading breweries:', error);
            dropdown.innerHTML = '<div class="suggestions empty">Failed to load breweries</div>';
        }
    },

    setupClickOutside() {
        document.addEventListener('click', (e) => {
            // Check if clicked outside any dropdown
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
    
    // Display brewery dropdown
    displayBreweryDropdown(breweries, query) {
        const dropdown = document.getElementById('breweryDropdown');
        const input = document.getElementById('reportBrewery');
        
        if (!dropdown) return;
        
        // Add class to input for styling
        input.classList.add('dropdown-open');
        
        if (breweries.length === 0 && query) {
            dropdown.innerHTML = `
                <div class="dropdown-header">🔍 No matches found</div>
                <div class="suggestion-item new-brewery" data-action="create-brewery" data-brewery="${this.escapeHtml(query)}">
                    <strong>➕ Add "${this.escapeHtml(query)}" as new brewery</strong>
                    <small>This will be added to our database</small>
                </div>
            `;
        } else {
            // Build dropdown content
            let html = '';
            
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
            
            // Add new option at the end if there's a query
            if (query && !breweries.some(b => b.toLowerCase() === query.toLowerCase())) {
                html += `
                    <div class="suggestion-item new-brewery" data-action="create-brewery" data-brewery="${this.escapeHtml(query)}">
                        <strong>➕ Add "${this.escapeHtml(query)}" as new brewery</strong>
                        <small>Not in list? Add it!</small>
                    </div>
                `;
            }
            
            dropdown.innerHTML = html;
        }
        
        // Show dropdown with proper positioning
        dropdown.style.display = 'block';
        dropdown.classList.add('active');
        
        // Ensure dropdown is visible in viewport
        this.ensureDropdownVisible(dropdown);
    },

    // Hide dropdown properly
    hideDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.style.display = 'none';
            dropdown.classList.remove('active');
            
            // Remove class from associated input
            const inputMap = {
                'breweryDropdown': 'reportBrewery',
                'beerNameDropdown': 'reportBeerName',
                'beerSearchDropdown': 'beerSearchFirst'
            };
            
            const inputId = inputMap[dropdownId];
            if (inputId) {
                const input = document.getElementById(inputId);
                if (input) input.classList.remove('dropdown-open');
            }
        }
    },

    // Ensure dropdown is visible in viewport
    ensureDropdownVisible(dropdown) {
        if (!dropdown) return;
        
        const rect = dropdown.getBoundingClientRect();
        const modal = dropdown.closest('.modal-content');
        
        if (modal) {
            const modalRect = modal.getBoundingClientRect();
            const dropdownBottom = rect.bottom;
            const modalBottom = modalRect.bottom;
            
            // If dropdown extends beyond modal, adjust modal scroll
            if (dropdownBottom > modalBottom) {
                const scrollAmount = dropdownBottom - modalBottom + 20;
                modal.scrollTop += scrollAmount;
            }
        }
    },
    
    // Helper to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },
    
    // Search beers globally (when brewery unknown)
    async searchBeersGlobally(query) {
        if (query.length < 2) return;
        
        const dropdown = document.getElementById('beerSearchDropdown');
        
        try {
            // This would search ALL beers in database
            const response = await fetch(`/api/beers/search?q=${encodeURIComponent(query)}`);
            const beers = await response.json();
            
            if (beers.length > 0) {
                dropdown.innerHTML = beers.map(beer => `
                    <div class="suggestion-item beer-item" data-action="select-found-beer" data-beer='${JSON.stringify(beer)}'>
                        <strong>${beer.beer_name}</strong>
                        <small>🏭 ${beer.brewery_name} • ${beer.style || 'Unknown style'}</small>
                    </div>
                `).join('');
                
                dropdown.innerHTML += `
                    <div class="suggestion-item new-beer" data-action="create-new-beer" data-beer="${query}">
                        <strong>➕ "${query}" not found - add as new beer</strong>
                    </div>
                `;
            } else {
                dropdown.innerHTML = `
                    <div class="suggestion-item new-beer" data-action="create-new-beer" data-beer="${query}">
                        <strong>➕ Add "${query}" as new beer</strong>
                        <small>We'll help you add the brewery next</small>
                    </div>
                `;
            }
            
            dropdown.style.display = 'block';
        } catch (error) {
            console.error('Error searching beers:', error);
            // Fallback - allow adding as new
            dropdown.innerHTML = `
                <div class="suggestion-item new-beer" data-action="create-new-beer" data-beer="${query}">
                    <strong>➕ Add "${query}" as new beer</strong>
                </div>
            `;
            dropdown.style.display = 'block';
        }
    },
    
    // Search brewery's beers
    async searchBreweryBeers(query) {
        const dropdown = document.getElementById('beerNameDropdown');
        
        try {
            const response = await fetch(`/api/brewery/${encodeURIComponent(this.selectedBrewery)}/beers?q=${encodeURIComponent(query)}`);
            const beers = await response.json();
            
            if (beers.length > 0) {
                dropdown.innerHTML = beers.map(beer => `
                    <div class="suggestion-item" data-action="select-brewery-beer" data-beer='${JSON.stringify(beer)}'>
                        <strong>${beer.beer_name}</strong>
                        <small>${beer.style || 'Unknown'} • ${beer.abv || '?'}% ABV</small>
                    </div>
                `).join('');
            } else if (query) {
                dropdown.innerHTML = `
                    <div class="suggestion-item new-beer" data-action="add-brewery-beer" data-beer="${query}">
                        <strong>➕ Add "${query}" to ${this.selectedBrewery}</strong>
                    </div>
                `;
            }
            
            dropdown.style.display = beers.length > 0 || query ? 'block' : 'none';
        } catch (error) {
            console.error('Error loading brewery beers:', error);
        }
    },
    
    // Handle suggestion click
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
                this.createNewBeerNoBrewery(item.dataset.beer);
                break;
            case 'select-brewery-beer':
                this.selectBreweryBeer(JSON.parse(item.dataset.beer));
                break;
            case 'add-brewery-beer':
                this.addNewBreweryBeer(item.dataset.beer);
                break;
        }
    },
    
    // Select existing brewery
    selectBrewery(breweryName) {
        this.selectedBrewery = breweryName;
        this.isNewBrewery = false;
        
        document.getElementById('reportBrewery').value = breweryName;
        document.getElementById('breweryDropdown').style.display = 'none';
        
        // Move to beer details
        this.showStep('beer-details');
        this.updateProgress('beer');
        
        // Show brewery confirmed
        document.getElementById('breweryConfirmed').style.display = 'block';
        document.getElementById('confirmedBreweryName').textContent = breweryName;
        
        // Load brewery's beers
        this.loadBreweryBeers();
        
        document.getElementById('reportBeerName').focus();
    },
    
    // Create new brewery
    createNewBrewery(breweryName) {
        this.selectedBrewery = breweryName;
        this.isNewBrewery = true;
        
        document.getElementById('reportBrewery').value = breweryName;
        document.getElementById('breweryDropdown').style.display = 'none';
        
        // Show alert
        document.getElementById('newItemAlert').style.display = 'block';
        
        // Move to beer details
        this.showStep('beer-details');
        this.updateProgress('beer');
        
        document.getElementById('breweryConfirmed').style.display = 'block';
        document.getElementById('confirmedBreweryName').textContent = breweryName + ' (NEW)';
        
        document.getElementById('reportBeerName').focus();
    },
    
    // Select found beer (from global search)
    selectFoundBeer(beer) {
        this.selectedBeer = beer;
        this.selectedBrewery = beer.brewery_name;
        
        document.getElementById('beerSearchDropdown').style.display = 'none';
        
        // Show success message
        this.showToast(`✅ Found it! ${beer.beer_name} by ${beer.brewery_name}`);
        
        // Move to beer details with pre-filled data
        this.showStep('beer-details');
        this.updateProgress('beer');
        
        document.getElementById('breweryConfirmed').style.display = 'block';
        document.getElementById('confirmedBreweryName').textContent = beer.brewery_name;
        
        document.getElementById('reportBeerName').value = beer.beer_name;
        document.getElementById('reportBeerStyle').value = beer.style || '';
        document.getElementById('reportBeerABV').value = beer.abv || '';
        
        // Show submit button
        document.getElementById('formActions').style.display = 'block';
    },
    
    // Load brewery's existing beers
    async loadBreweryBeers() {
        try {
            const response = await fetch(`/api/brewery/${encodeURIComponent(this.selectedBrewery)}/beers`);
            const beers = await response.json();
            
            if (beers.length > 0) {
                this.showToast(`🍺 ${this.selectedBrewery} has ${beers.length} beers in our database`);
            } else {
                this.showToast(`🆕 You're adding the first ${this.selectedBrewery} beer!`);
            }
        } catch (error) {
            console.error('Error loading brewery beers:', error);
        }
    },
    
    // Show/hide steps
    showStep(stepName) {
        document.querySelectorAll('.cascade-step').forEach(step => {
            step.style.display = 'none';
        });
        
        document.getElementById(`step-${stepName}`).style.display = 'block';
        
        // Show submit button when on beer details
        if (stepName === 'beer-details') {
            document.getElementById('formActions').style.display = 'block';
        }
    },
    
    // Update progress indicator
    updateProgress(activeStep) {
        const steps = ['format', 'brewery', 'beer'];
        const activeIndex = steps.indexOf(activeStep);
        
        document.querySelectorAll('.progress-step').forEach((step, index) => {
            if (index < activeIndex) {
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (index === activeIndex) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });
    },
    
    // Toggle optional details
    toggleOptionalDetails() {
        const details = document.getElementById('optionalDetails');
        const button = document.querySelector('.toggle-details');
        
        if (details.style.display === 'none' || !details.style.display) {
            details.style.display = 'block';
            button.querySelector('.toggle-text').textContent = '- Hide details';
        } else {
            details.style.display = 'none';
            button.querySelector('.toggle-text').textContent = '+ Add more details';
        }
    },
    
    // Handle form submission
    async handleSubmit(e) {
        e.preventDefault();
        
        // Collect all data
        const formData = {
            format: this.selectedFormat,
            brewery_name: this.selectedBrewery || document.getElementById('reportBrewery').value,
            beer_name: document.getElementById('reportBeerName').value,
            beer_style: document.getElementById('reportBeerStyle').value,
            beer_abv: document.getElementById('reportBeerABV').value,
            venue_id: window.App?.getState('currentVenue')?.venue_id,
            user_id: parseInt(localStorage.getItem('user_id')),
            is_new_brewery: this.isNewBrewery,
            is_new_beer: this.isNewBeer
        };
        
        console.log('Submitting:', formData);
        
        // Call your existing submit function
        if (window.FormModule) {
            window.FormModule.handleReportSubmission(e);
        } else {
            // Direct submit
            try {
                const response = await fetch('/api/submit_beer_update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                if (result.success) {
                    this.showToast('🎉 Beer reported successfully!');
                    this.reset();
                    // Close modal
                    document.getElementById('reportModal').style.display = 'none';
                }
            } catch (error) {
                console.error('Submit error:', error);
                this.showToast('❌ Failed to submit', 'error');
            }
        }
    },
    
    // Helper: Show toast
    showToast(message, type = 'success') {
        if (window.showSuccessToast && type === 'success') {
            window.showSuccessToast(message);
        } else if (window.showErrorToast && type === 'error') {
            window.showErrorToast(message);
        } else {
            console.log(message);
        }
    }
};

// Helper: Debounce function
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

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    CascadeForm.init();
});

// Export for use in other modules
window.CascadeForm = CascadeForm;
