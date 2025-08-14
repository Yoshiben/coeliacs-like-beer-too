// ====================================================================
// RECENT FINDS MODULE - IIFE Pattern
// Handles fetching and displaying the latest community beer discoveries
// ====================================================================

const RecentFindsModule = (() => {
    'use strict';

    // ================================
    // PRIVATE STATE
    // ================================
    const STATE_KEYS = {
        RECENT_FINDS: 'recentFinds',
        LAST_FETCH: 'lastFetch',
        IS_LOADING: 'isLoading'
    };

    const CONFIG = {
        API_ENDPOINT: '/api/recent-finds',
        MAX_ITEMS: 2,
        CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
        RETRY_DELAY: 3000,
        AUTO_REFRESH_INTERVAL: 10 * 60 * 1000 // 10 minutes
    };

    const SELECTORS = {
        container: '#recentFinds',
        loading: '#recentFindsLoading',
        error: '#recentFindsError',
        empty: '#recentFindsEmpty',
        list: '#recentFindsList'
    };

    let state = {
        [STATE_KEYS.RECENT_FINDS]: [],
        [STATE_KEYS.LAST_FETCH]: null,
        [STATE_KEYS.IS_LOADING]: false
    };

    let elements = {};
    let refreshInterval = null;

    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get tracking() { return window.App?.getModule('tracking'); },
        get helpers() { return window.App?.getModule('helpers'); }
    };

    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        try {
            console.log('🔧 Initializing Recent Finds Module');
            
            cacheElements();
            if (isElementsValid()) {
                loadRecentFinds();
                setupAutoRefresh();
            } else {
                console.warn('⚠️ Recent Finds elements not found in DOM');
            }
            
            console.log('✅ Recent Finds Module initialized');
        } catch (error) {
            console.error('❌ Recent Finds initialization failed:', error);
        }
    };

    // ================================
    // DOM MANAGEMENT
    // ================================
    const cacheElements = () => {
        elements = {
            container: document.querySelector(SELECTORS.container),
            loading: document.querySelector(SELECTORS.loading),
            error: document.querySelector(SELECTORS.error),
            empty: document.querySelector(SELECTORS.empty),
            list: document.querySelector(SELECTORS.list)
        };
    };

    const isElementsValid = () => {
        return Object.values(elements).every(element => element !== null);
    };

    // ================================
    // DATA FETCHING
    // ================================
    const needsRefresh = () => {
        if (!state[STATE_KEYS.LAST_FETCH]) return true;
        return Date.now() - state[STATE_KEYS.LAST_FETCH] > CONFIG.CACHE_DURATION;
    };

    const loadRecentFinds = async () => {
        if (state[STATE_KEYS.IS_LOADING]) return;

        // Use cached data if still fresh
        if (!needsRefresh() && state[STATE_KEYS.RECENT_FINDS].length > 0) {
            renderFinds(state[STATE_KEYS.RECENT_FINDS]);
            return;
        }

        try {
            setState(STATE_KEYS.IS_LOADING, true);
            showLoading();

            const data = await fetchRecentFinds();
            setState(STATE_KEYS.RECENT_FINDS, data);
            setState(STATE_KEYS.LAST_FETCH, Date.now());
            
            renderFinds(data);
            
        } catch (error) {
            console.error('❌ Recent Finds: Failed to load data:', error);
            showError();
        } finally {
            setState(STATE_KEYS.IS_LOADING, false);
        }
    };

    const fetchRecentFinds = async () => {
        try {
            const response = await fetch(CONFIG.API_ENDPOINT, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'API returned error');
            }

            return data.finds || [];
            
        } catch (error) {
            console.error('❌ API Error:', error);
            
            // Return mock data for development/fallback
            return getMockData();
        }
    };

    const getMockData = () => {
        console.log('📝 Using mock data for Recent Finds');
        return [
            {
                id: 1,
                user_name: 'Sarah M.',
                venue_id: 23456,
                venue_name: 'The Old Bell',
                beer_description: 'Vagabond Pale Ale',
                format: 'tap',
                location: 'Leeds',
                time_ago: '2 hours ago',
                times_reported: 12
            },
            {
                id: 2,
                user_name: 'Mike R.',
                venue_id: 34567,
                venue_name: 'Scaredy Cats Cafe',
                beer_description: 'Left Handed Giant Nine Years Later',
                format: 'bottle',
                location: 'Cardiff',
                time_ago: '5 hours ago',
                times_reported: 24
            }
        ];
    };

    // ================================
    // UI RENDERING
    // ================================
    const renderFinds = (finds) => {
        if (!finds || finds.length === 0) {
            showEmpty();
            return;
        }

        hideStates();
        elements.list.style.display = 'block';
        elements.list.innerHTML = '';

        finds.forEach((find, index) => {
            const findElement = createFindElement(find);
            elements.list.appendChild(findElement);
        });

        console.log(`✅ Rendered ${finds.length} recent finds`);
    };

    const createFindElement = (find) => {
        const li = document.createElement('li');
        li.className = 'recent-find-item';
        li.dataset.findId = find.id;
        li.dataset.venueId = find.venue_id;

        // Format the beer format with appropriate icon
        const formatIcons = {
            'tap': '🚰',
            'bottle': '🍺',
            'can': '🥫',
            'cask': '🛢️'
        };
        const formatIcon = formatIcons[find.format?.toLowerCase()] || '🍺';

        li.innerHTML = `
            <div class="recent-find-content">
                <div class="recent-find-header">
                    <span class="recent-find-user">${escapeHtml(find.user_name)}</span>
                    <span class="recent-find-time">${escapeHtml(find.time_ago)}</span>
                </div>
                
                <div class="recent-find-beer">
                    Just found <strong>${escapeHtml(find.beer_description)}</strong> 
                    ${formatIcon} ${find.format} at <strong>${escapeHtml(find.venue_name)}</strong>
                </div>
                
                <div class="recent-find-location">
                    📍 ${escapeHtml(find.location)}
                </div>
                
                <div class="recent-find-actions">
                    <button class="btn btn-outline" data-action="view-venue" data-venue-id="${find.venue_id}">
                        View Venue
                    </button>
                    <button class="btn btn-text" data-action="thanks" data-find-id="${find.id}">
                        🙌 Thanks! (${find.times_reported || 0})
                    </button>
                </div>
            </div>
        `;

        // Add click handler for the whole item
        li.addEventListener('click', (e) => {
            // Don't trigger if clicking on buttons
            if (e.target.closest('button')) return;
            
            const venueId = find.venue_id;
            if (venueId) {
                handleVenueClick(venueId);
            }
        });

        return li;
    };

    // ================================
    // UI STATES
    // ================================
    const showLoading = () => {
        hideStates();
        elements.loading.style.display = 'block';
    };

    const showError = () => {
        hideStates();
        elements.error.style.display = 'block';
    };

    const showEmpty = () => {
        hideStates();
        elements.empty.style.display = 'block';
    };

    const hideStates = () => {
        elements.loading.style.display = 'none';
        elements.error.style.display = 'none';
        elements.empty.style.display = 'none';
        elements.list.style.display = 'none';
    };

    // ================================
    // EVENT HANDLERS
    // ================================
    const handleVenueClick = (venueId) => {
        console.log('🏠 Recent Find: Venue clicked:', venueId);
        
        // Get the search module and show venue details
        const searchModule = window.App?.getModule('search');
        if (searchModule?.showVenueDetails) {
            searchModule.showVenueDetails(venueId);
        } else {
            console.warn('⚠️ Search module not available');
        }

        // Track interaction
        modules.tracking?.trackEvent('recent_find_venue_click', 'Community', `venue_${venueId}`);
    };

    const handleThanksClick = (findId) => {
        console.log('🙌 Thanks clicked for find:', findId);
        
        // Use the community module's thanks handler if available
        const community = window.App?.getModule('community');
        if (community?.handleThanks) {
            community.handleThanks(parseInt(findId));
        } else {
            // Fallback thanks handler
            modules.helpers?.showToast?.('Thanks recorded! 🙌', 'success');
        }

        modules.tracking?.trackEvent('recent_find_thanks', 'Community', `find_${findId}`);
    };

    // ================================
    // AUTO REFRESH
    // ================================
    const setupAutoRefresh = () => {
        // Clear any existing interval
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }

        // Set up new interval
        refreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                loadRecentFinds();
            }
        }, CONFIG.AUTO_REFRESH_INTERVAL);
    };

    // ================================
    // UTILITIES
    // ================================
    const setState = (key, value) => {
        state[key] = value;
    };

    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    const cleanup = () => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    };

    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        loadRecentFinds,
        cleanup,
        
        // For integration with other modules
        handleVenueClick,
        handleThanksClick,
        
        // For debugging
        getState: () => state,
        forceRefresh: () => {
            setState(STATE_KEYS.LAST_FETCH, null);
            loadRecentFinds();
        }
    };
})();

// ================================
// INTEGRATION WITH MAIN APP
// ================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', RecentFindsModule.init);
} else {
    RecentFindsModule.init();
}

// Register with main app if available
if (window.App?.registerModule) {
    window.App.registerModule('recentFinds', RecentFindsModule);
}

// Cleanup on page unload
window.addEventListener('beforeunload', RecentFindsModule.cleanup);
