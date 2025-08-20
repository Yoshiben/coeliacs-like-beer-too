// ================================================================================
// COUNTRIES.JS - International Support Module
// Handles: Country selection, data, and localization
// ================================================================================

export const CountriesModule = (() => {
    'use strict';
    
    // ================================
    // COUNTRY DATA - EASILY EXPANDABLE!
    // ================================
    const COUNTRIES = {
        // Main countries (show first)
        'GB': { 
            name: 'United Kingdom', 
            flag: '🇬🇧', 
            drinkingAge: 18,
            currency: '£',
            center: [54.5, -2],
            zoom: 6
        },
        'IE': { 
            name: 'Ireland', 
            flag: '🇮🇪', 
            drinkingAge: 18,
            currency: '€',
            center: [53.5, -7.5],
            zoom: 7
        },
        
        // Europe
        'ES': { 
            name: 'Spain', 
            flag: '🇪🇸', 
            drinkingAge: 18,
            currency: '€',
            center: [40.4, -3.7],
            zoom: 6
        },
        'FR': { 
            name: 'France', 
            flag: '🇫🇷', 
            drinkingAge: 18,
            currency: '€',
            center: [46.5, 2.5],
            zoom: 6
        },
        'DE': { 
            name: 'Germany', 
            flag: '🇩🇪', 
            drinkingAge: 16, // for beer!
            currency: '€',
            center: [51.0, 10.5],
            zoom: 6
        },
        'IT': { 
            name: 'Italy', 
            flag: '🇮🇹', 
            drinkingAge: 18,
            currency: '€',
            center: [42.5, 12.5],
            zoom: 6
        },
        'NL': { 
            name: 'Netherlands', 
            flag: '🇳🇱', 
            drinkingAge: 18,
            currency: '€',
            center: [52.3, 5.5],
            zoom: 7
        },
        'BE': { 
            name: 'Belgium', 
            flag: '🇧🇪', 
            drinkingAge: 16, // for beer!
            currency: '€',
            center: [50.5, 4.5],
            zoom: 8
        },
        'PT': { 
            name: 'Portugal', 
            flag: '🇵🇹', 
            drinkingAge: 18,
            currency: '€',
            center: [39.5, -8],
            zoom: 7
        },
        
        // Nordic
        'NO': { 
            name: 'Norway', 
            flag: '🇳🇴', 
            drinkingAge: 18,
            currency: 'kr',
            center: [62, 10],
            zoom: 5
        },
        'SE': { 
            name: 'Sweden', 
            flag: '🇸🇪', 
            drinkingAge: 18,
            currency: 'kr',
            center: [62, 15],
            zoom: 5
        },
        'DK': { 
            name: 'Denmark', 
            flag: '🇩🇰', 
            drinkingAge: 16, // for beer!
            currency: 'kr',
            center: [56, 10],
            zoom: 7
        },
        'FI': { 
            name: 'Finland', 
            flag: '🇫🇮', 
            drinkingAge: 18,
            currency: '€',
            center: [64, 26],
            zoom: 5
        },
        'IS': { 
            name: 'Iceland', 
            flag: '🇮🇸', 
            drinkingAge: 20, // highest in Europe!
            currency: 'kr',
            center: [65, -18],
            zoom: 6
        },
        
        // Mediterranean
        'GR': { 
            name: 'Greece', 
            flag: '🇬🇷', 
            drinkingAge: 18,
            currency: '€',
            center: [39, 22],
            zoom: 6
        },
        'CY': { 
            name: 'Cyprus', 
            flag: '🇨🇾', 
            drinkingAge: 17,
            currency: '€',
            center: [35, 33],
            zoom: 8
        },
        'MT': { 
            name: 'Malta', 
            flag: '🇲🇹', 
            drinkingAge: 17,
            currency: '€',
            center: [35.9, 14.4],
            zoom: 10
        },
        
        // Eastern Europe
        'PL': { 
            name: 'Poland', 
            flag: '🇵🇱', 
            drinkingAge: 18,
            currency: 'zł',
            center: [52, 20],
            zoom: 6
        },
        'CZ': { 
            name: 'Czech Republic', 
            flag: '🇨🇿', 
            drinkingAge: 18,
            currency: 'Kč',
            center: [49.75, 15.5],
            zoom: 7
        },
        
        // Americas
        'US': { 
            name: 'United States', 
            flag: '🇺🇸', 
            drinkingAge: 21,
            currency: '$',
            center: [39.8, -98.6],
            zoom: 4
        },
        'CA': { 
            name: 'Canada', 
            flag: '🇨🇦', 
            drinkingAge: 19, // varies by province
            currency: '$',
            center: [56.1, -106.3],
            zoom: 4
        },
        'MX': { 
            name: 'Mexico', 
            flag: '🇲🇽', 
            drinkingAge: 18,
            currency: '$',
            center: [23.6, -102.5],
            zoom: 5
        },
        'AR': { 
            name: 'Argentina', 
            flag: '🇦🇷', 
            drinkingAge: 18,
            currency: '$',
            center: [-38.4, -63.6],
            zoom: 4
        },
        'BR': { 
            name: 'Brazil', 
            flag: '🇧🇷', 
            drinkingAge: 18,
            currency: 'R$',
            center: [-14.2, -51.9],
            zoom: 4
        },
        
        // Asia-Pacific
        'AU': { 
            name: 'Australia', 
            flag: '🇦🇺', 
            drinkingAge: 18,
            currency: '$',
            center: [-25.3, 133.8],
            zoom: 4
        },
        'NZ': { 
            name: 'New Zealand', 
            flag: '🇳🇿', 
            drinkingAge: 18,
            currency: '$',
            center: [-41.5, 172.5],
            zoom: 5
        },
        'JP': { 
            name: 'Japan', 
            flag: '🇯🇵', 
            drinkingAge: 20,
            currency: '¥',
            center: [36, 138],
            zoom: 5
        },
        'SG': { 
            name: 'Singapore', 
            flag: '🇸🇬', 
            drinkingAge: 18,
            currency: '$',
            center: [1.35, 103.8],
            zoom: 11
        },
        
        // Add more as needed!
        'OTHER': {
            name: 'Other Country',
            flag: '🌍',
            drinkingAge: 18,
            currency: '',
            center: [0, 0],
            zoom: 2
        }
    };
    
    // ================================
    // STATE
    // ================================
    let currentCountry = localStorage.getItem('selectedCountry') || 'GB';
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🌍 Initializing Countries Module');
        renderSelector();
        attachListeners();
        
        // Emit initial country
        window.App?.events?.emit('countryChanged', currentCountry);
    };
    
    // ================================
    // UI RENDERING
    // ================================
    const renderSelector = () => {
        // Check if we're in search overlay
        const searchHeader = document.querySelector('.search-header-title');
        if (searchHeader && !document.getElementById('countrySelector')) {
            const selector = document.createElement('div');
            selector.id = 'countrySelector';
            selector.className = 'country-selector';
            selector.innerHTML = createSelectorHTML();
            
            // Insert after the title
            searchHeader.parentNode.insertBefore(selector, searchHeader.nextSibling);
        }
        
        // Also add mini selector to nav bar for quick switching
        renderMiniSelector();
    };
    
    const renderMiniSelector = () => {
        const navRight = document.querySelector('.nav-right');
        if (navRight && !document.getElementById('miniCountrySelector')) {
            const mini = document.createElement('div');
            mini.id = 'miniCountrySelector';
            mini.className = 'mini-country-selector';
            mini.innerHTML = `
                <span class="country-flag-mini" data-action="toggle-country">
                    ${COUNTRIES[currentCountry].flag}
                </span>
            `;
            navRight.insertBefore(mini, navRight.firstChild);
        }
    };
    
    const createSelectorHTML = () => {
        const country = COUNTRIES[currentCountry];
        
        // Group countries by region for better UX
        const regions = {
            'Popular': ['GB', 'IE', 'US', 'ES'],
            'Europe': ['FR', 'DE', 'IT', 'NL', 'BE', 'PT', 'GR', 'CY'],
            'Nordic': ['NO', 'SE', 'DK', 'FI', 'IS'],
            'Americas': ['CA', 'MX', 'AR', 'BR'],
            'Asia-Pacific': ['AU', 'NZ', 'JP', 'SG'],
            'Other': ['OTHER']
        };
        
        let dropdownHTML = '';
        for (const [region, codes] of Object.entries(regions)) {
            if (codes.some(code => COUNTRIES[code])) {
                dropdownHTML += `<div class="country-region">${region}</div>`;
                codes.forEach(code => {
                    if (COUNTRIES[code]) {
                        dropdownHTML += `
                            <div class="country-option" data-country="${code}">
                                <span class="country-flag">${COUNTRIES[code].flag}</span>
                                <span class="country-name">${COUNTRIES[code].name}</span>
                                ${code === currentCountry ? '<span class="check">✓</span>' : ''}
                            </div>
                        `;
                    }
                });
            }
        }
        
        return `
            <div class="country-display" data-action="toggle-country-dropdown">
                <span class="country-flag">${country.flag}</span>
                <span class="country-name">${country.name}</span>
                <span class="dropdown-arrow">▼</span>
            </div>
            <div class="country-dropdown" id="countryDropdown" style="display: none;">
                ${dropdownHTML}
            </div>
        `;
    };
    
    // ================================
    // EVENT HANDLERS
    // ================================
    const attachListeners = () => {
        document.addEventListener('click', handleClick);
    };
    
    const handleClick = (e) => {
        // Toggle dropdown
        if (e.target.closest('[data-action="toggle-country-dropdown"]') || 
            e.target.closest('[data-action="toggle-country"]')) {
            toggleDropdown();
            return;
        }
        
        // Select country
        const option = e.target.closest('.country-option');
        if (option) {
            selectCountry(option.dataset.country);
            return;
        }
        
        // Close dropdown if clicking outside
        if (!e.target.closest('#countrySelector')) {
            closeDropdown();
        }
    };
    
    const toggleDropdown = () => {
        const dropdown = document.getElementById('countryDropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    };
    
    const closeDropdown = () => {
        const dropdown = document.getElementById('countryDropdown');
        if (dropdown) dropdown.style.display = 'none';
    };
    
    // ================================
    // COUNTRY SELECTION
    // ================================
    const selectCountry = (countryCode) => {
        if (!COUNTRIES[countryCode]) return;
        
        currentCountry = countryCode;
        localStorage.setItem('selectedCountry', countryCode);
        
        // Update main selector
        const display = document.querySelector('.country-display');
        if (display) {
            const country = COUNTRIES[countryCode];
            display.innerHTML = `
                <span class="country-flag">${country.flag}</span>
                <span class="country-name">${country.name}</span>
                <span class="dropdown-arrow">▼</span>
            `;
        }
        
        // Update mini selector
        const mini = document.querySelector('.country-flag-mini');
        if (mini) {
            mini.textContent = COUNTRIES[countryCode].flag;
        }
        
        // Recreate dropdown to update checkmarks
        const selector = document.getElementById('countrySelector');
        if (selector) {
            selector.innerHTML = createSelectorHTML();
        }
        
        closeDropdown();
        
        // Update map if it exists
        updateMapCenter(countryCode);
        
        // Notify other modules
        window.App?.events?.emit('countryChanged', countryCode);
        
        // Show toast
        const toast = window.App?.getModule('toast');
        if (toast) {
            toast.success(`Switched to ${COUNTRIES[countryCode].flag} ${COUNTRIES[countryCode].name}`);
        }
    };
    
    // ================================
    // MAP INTEGRATION
    // ================================
    const updateMapCenter = (countryCode) => {
        const country = COUNTRIES[countryCode];
        if (!country) return;
        
        const map = window.App?.getState('mapData.fullUKMapInstance');
        if (map) {
            map.setView(country.center, country.zoom);
        }
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        getCountry: () => currentCountry,
        getCountryData: (code) => COUNTRIES[code || currentCountry],
        getAllCountries: () => COUNTRIES,
        selectCountry,
        getCountryFlag: (code) => COUNTRIES[code]?.flag || '🌍',
        getCountryName: (code) => COUNTRIES[code]?.name || 'Unknown',
        renderSelector  // In case other modules need to re-render
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CountriesModule.init());
} else {
    CountriesModule.init();
}

// Register with main app
if (window.App?.registerModule) {
    window.App.registerModule('countries', CountriesModule);
}
