// ================================================================================
// HOME-PAGE.JS - Unified Community Homepage
// Combines community feed, recent finds, trending, and quick actions
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const HomePageModule = (() => {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        recentFinds: [],
        trendingBeers: [],
        venueOfMonth: null,
        stats: {},
        lastRefresh: null,
        refreshInterval: null
    };
    
    const config = {
        refreshInterval: 5 * 60 * 1000, // 5 minutes
        endpoints: {
            recentFinds: '/api/recent-finds',
            trending: '/api/community/trending',
            venueOfMonth: '/api/community/venue-of-month',
            stats: '/api/stats'
        }
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get api() { return window.App?.getModule('api'); },
        get search() { return window.App?.getModule('search'); },
        get modalManager() { return window.App?.getModule('modalManager'); },
        get tracking() { return window.App?.getModule('tracking'); },
        get toast() { return window.App?.getModule('toast'); },
        get venue() { return window.App?.getModule('venue'); }
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🏠 Initializing Home Page Module');
        
        // Load all homepage data
        loadHomePageData();
        
        // Set up auto-refresh
        state.refreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                loadHomePageData();
            }
        }, config.refreshInterval);
        
        // Initialize thanks tracking
        initializeThanksTracking();
        
        console.log('✅ Home Page Module initialized');
    };
    
    // ================================
    // DATA LOADING
    // ================================
    const loadHomePageData = async () => {
        try {
            // Load all sections in parallel
            const [recentFinds, trending, venueOfMonth, stats] = await Promise.all([
                fetchRecentFinds(),
                fetchTrending(),
                fetchVenueOfMonth(),
                fetchStats()
            ]);
            
            // Update state
            state.recentFinds = recentFinds;
            state.trendingBeers = trending;
            state.venueOfMonth = venueOfMonth;
            state.stats = stats;
            state.lastRefresh = Date.now();
            
            // Update UI
            renderRecentFinds();
            renderTrending();
            renderVenueOfMonth();
            renderStats();
            
        } catch (error) {
            console.error('❌ Error loading homepage data:', error);
        }
    };
    
    // ================================
    // API CALLS
    // ================================
    const fetchRecentFinds = async () => {
        try {
            const response = await fetch(config.endpoints.recentFinds);
            const data = await response.json();
            return data.success ? data.finds : getMockRecentFinds();
        } catch (error) {
            console.error('Error fetching recent finds:', error);
            return getMockRecentFinds();
        }
    };
    
    const fetchTrending = async () => {
        try {
            const response = await fetch(config.endpoints.trending);
            const data = await response.json();
            
            if (data.success) {
                // Store the time period for display
                const headerEl = document.querySelector('.trending-section h2');
                if (headerEl) {
                    headerEl.textContent = data.time_period === 'all_time' ? 
                        '🏆 Top Beers All Time' : '📈 Trending This Week';
                }
                return data.trending;
            }
            return getMockTrending();
        } catch (error) {
            console.error('Error fetching trending:', error);
            return getMockTrending();
        }
    };
    
    const fetchVenueOfMonth = async () => {
        try {
            const response = await fetch(config.endpoints.venueOfMonth);
            const data = await response.json();
            return data.success ? data.venue : getMockVenueOfMonth();
        } catch (error) {
            console.error('Error fetching venue of month:', error);
            return getMockVenueOfMonth();
        }
    };
    
    const fetchStats = async () => {
        try {
            return await modules.api?.getStats() || {};
        } catch (error) {
            console.error('Error fetching stats:', error);
            return {};
        }
    };
    
    // ================================
    // RENDERING
    // ================================
    const renderRecentFinds = () => {
        const container = document.querySelector('.finds-grid, #recentFindsList');
        if (!container || !state.recentFinds.length) return;
        
        container.innerHTML = '';
        
        state.recentFinds.forEach(find => {
            const card = createFindCard(find);
            container.appendChild(card);
        });
    };
    
    const createFindCard = (find) => {
        const card = document.createElement('div');
        card.className = 'card find-card';
        card.dataset.findId = find.id;
        
        // Check if already thanked
        const thankedItems = getThankedItems();
        const thanked = thankedItems.has(find.id);
        
        card.innerHTML = `
            <div class="find-header">
                <span class="find-user">${find.user_name}</span>
                <span class="find-time">${find.time_ago}</span>
            </div>
            <div class="find-content">
                <p>${formatFindDescription(find)}</p>
                <div class="find-location">📍 ${find.location}</div>
            </div>
            <div class="find-actions">
                ${find.venue_id ? `
                    <button class="btn btn-small-outline" data-action="view-venue" data-venue-id="${find.venue_id}">
                        View Venue
                    </button>
                ` : ''}
                <button class="btn btn-small-text" data-action="thanks" data-find-id="${find.id}" 
                        ${thanked ? 'disabled' : ''}>
                    🙌 Thanks! (${find.times_reported || 0})
                </button>
            </div>
        `;
        
        return card;
    };
    
    const renderTrending = () => {
        const container = document.querySelector('.trending-list');
        if (!container || !state.trendingBeers.length) return;
        
        container.innerHTML = state.trendingBeers.map((beer, index) => `
            <div class="trending-item">
                <span class="trending-rank">${index + 1}</span>
                <div class="trending-content">
                    <strong>${beer.beer_name}</strong>
                    <small>Reported ${beer.report_count} times</small>
                </div>
                ${beer.hot ? '<span class="trending-badge">🔥</span>' : ''}
            </div>
        `).join('');
    };
    
    const renderVenueOfMonth = () => {
        const container = document.querySelector('.featured-content');
        if (!container || !state.venueOfMonth) return;
        
        const venue = state.venueOfMonth;
        container.innerHTML = `
            <h2>${venue.name}</h2>
            <p>${venue.description}</p>
            <div class="featured-stats">
                <span>📍 ${venue.address}</span>
                <span>🍺 Always GF Available</span>
            </div>
            <button class="btn btn-featured" data-action="view-venue" data-venue-id="${venue.venue_id}">
                View Details
            </button>
        `;
    };
    
    const renderStats = () => {
        if (state.stats.total_venues) {
            animateNumber('totalVenues', state.stats.total_venues);
        }
        if (state.stats.gf_venues) {
            animateNumber('gfVenues', state.stats.gf_venues);
        }
        if (state.stats.gf_venues_this_month) {
            animateNumber('monthlyFinds', state.stats.gf_venues_this_month);
        }
    };
    
    // ================================
    // THANKS SYSTEM
    // ================================
    const initializeThanksTracking = () => {
        // Load from localStorage for persistence
        const thanked = JSON.parse(localStorage.getItem('thankedFinds') || '[]');
        window.App.setState('thankedFinds', new Set(thanked));
    };
    
    const getThankedItems = () => {
        return window.App.getState('thankedFinds') || new Set();
    };
    
    const handleThanks = async (findId) => {
        const thankedItems = getThankedItems();
        
        if (thankedItems.has(findId)) {
            modules.toast?.info('You already thanked this find!');
            return;
        }
        
        // Add to thanked set
        thankedItems.add(findId);
        window.App.setState('thankedFinds', thankedItems);
        localStorage.setItem('thankedFinds', JSON.stringify([...thankedItems]));
        
        // Update UI
        const button = document.querySelector(`[data-action="thanks"][data-find-id="${findId}"]`);
        if (button) {
            const currentCount = parseInt(button.textContent.match(/\d+/)?.[0] || 0);
            button.textContent = `🙌 Thanks! (${currentCount + 1})`;
            button.disabled = true;
        }
        
        modules.toast?.success('Thanks recorded! 🙌');
        modules.tracking?.trackEvent('thanks_given', 'Community', `find_${findId}`);
        
        // TODO: Send to API when ready
        // await fetch(`/api/community/thanks/${findId}`, { method: 'POST' });
    };
    
    // ================================
    // QUICK ACTIONS
    // ================================
    const handleQuickNearby = async () => {
        console.log('📍 Quick nearby search triggered');
        modules.modalManager?.closeAll();
        
        try {
            await modules.search?.searchNearbyWithDistance(5);
            modules.tracking?.trackEvent('quick_nearby', 'Homepage', 'quick_action');
        } catch (error) {
            console.error('❌ Quick nearby error:', error);
            modules.toast?.error('Could not get location. Try searching by area instead.');
            modules.modalManager?.open('areaModal');
        }
    };
    
    // ================================
    // HELPERS
    // ================================
    const formatFindDescription = (find) => {
        const formatIcons = {
            'tap': '🚰',
            'bottle': '🍺',
            'can': '🥫',
            'cask': '🛢️'
        };
        const icon = formatIcons[find.format?.toLowerCase()] || '🍺';
        
        return `Just found ${find.beer_description} ${icon} ${find.format} at ${find.venue_name}!`;
    };
    
    const animateNumber = (elementId, target) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const start = parseInt(element.textContent) || 0;
        const duration = 1000;
        const startTime = Date.now();
        
        const update = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.floor(start + (target - start) * progress);
            
            element.textContent = current.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        
        update();
    };
    
    // ================================
    // MOCK DATA
    // ================================
    // const getMockRecentFinds = () => [
    //     {
    //         id: 1,
    //         user_name: 'Sarah M.',
    //         venue_id: 23456,
    //         venue_name: 'The Old Bell',
    //         beer_description: 'Vagabond Pale Ale',
    //         format: 'tap',
    //         location: 'Leeds',
    //         time_ago: '2 hours ago',
    //         times_reported: 12
    //     }
    // ];
    
    // const getMockTrending = () => [
    //     {
    //         beer_name: 'Brass Castle - Haze',
    //         brewery: 'Brass Castle',
    //         report_count: 18,
    //         hot: true
    //     }
    // ];
    
    // const getMockVenueOfMonth = () => ({
    //     venue_id: 19684,
    //     name: 'Dukes',
    //     description: 'Lovely community bar with 2 dedicated gluten free taps!',
    //     address: 'Halifax',
    //     gf_status: 'always_tap_cask'
    // });
    
    // ================================
    // CLEANUP
    // ================================
    const cleanup = () => {
        if (state.refreshInterval) {
            clearInterval(state.refreshInterval);
            state.refreshInterval = null;
        }
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        cleanup,
        loadHomePageData,
        handleThanks,
        handleQuickNearby,
        getState: () => state
    };
})();

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', HomePageModule.init);
} else {
    HomePageModule.init();
}

// Cleanup on unload
window.addEventListener('beforeunload', HomePageModule.cleanup);
