// ================================================================================
// COMMUNITY.JS - Community Homepage Features (Rebuilt - No Inline HTML/CSS)
// Handles: Feed updates, trending, quick actions, user interactions
// Ready for real data integration
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const CommunityModule = (() => {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        feedItems: [],
        trendingItems: [],
        venueOfMonth: null,
        refreshInterval: null,
        lastRefresh: null
    };
    
    const config = {
        refreshInterval: 300000, // 5 minutes
        animationDuration: 300,
        // API endpoints for when ready
        endpoints: {
            venueOfMonth: '/api/community/venue-of-month',
            recentFinds: '/api/community/recent-finds',
            trending: '/api/community/trending',
            stats: '/api/stats'
        }
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get api() { return window.App?.getModule('api'); },
        get search() { return window.App?.getModule('search'); },
        get modal() { return window.App?.getModule('modal'); },
        get modalManager() { return window.App?.getModule('modalManager'); },
        get tracking() { return window.App?.getModule('tracking'); },
        get helpers() { return window.App?.getModule('helpers'); }
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🏠 Initializing Community Module');
        
        // Load initial data
        loadCommunityData();
        
        // Set up refresh interval
        state.refreshInterval = setInterval(loadCommunityData, config.refreshInterval);
        
        // Initialize UI components
        initializeQuickNearby();
        initializeThanksButtons();
        
        console.log('✅ Community Module initialized');
    };
    
    // ================================
    // DATA LOADING
    // ================================
    const loadCommunityData = async () => {
        try {
            // For now, load mock data. When ready, uncomment the API calls
            const [venueOfMonth, latestFinds, trending] = await Promise.all([
                loadVenueOfMonth(),
                loadLatestFinds(),
                loadTrending()
            ]);
            
            // Update state
            state.venueOfMonth = venueOfMonth;
            state.feedItems = latestFinds;
            state.trendingItems = trending;
            state.lastRefresh = Date.now();
            
            // Update UI
            updateCommunityUI();
            
        } catch (error) {
            console.error('❌ Critical error loading community data:', error);
            showFallbackUI();
        }
    };
    
    // ================================
    // DATA FETCHING (Ready for API integration)
    // ================================
    const loadVenueOfMonth = async () => {
        // READY FOR REAL DATA:
        // const response = await fetch(config.endpoints.venueOfMonth);
        // return await response.json();
        
        // Mock data for now
        return {
            venue_id: 19684,
            name: 'Dukes',
            description: 'Lovely community bar with 2 dedicated gluten free taps: Thornbridge - Lukas & Left Handed Giant - Sky Above. Check them out!',
            address: 'Halifax',
            gf_status: 'always_tap_cask',
        };
    };
    
    const loadLatestFinds = async () => {
        // READY FOR REAL DATA:
        // const response = await fetch(config.endpoints.recentFinds);
        // return await response.json();
        
        // Mock data structure matching what API would return
        return [
            {
                id: 1,
                user_name: 'Sarah M.',
                created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                type: 'beer_report',
                venue_id: 23456,
                venue_name: 'The Old Bell',
                location: 'Leeds',
                beer_name: 'Vagabond Pale Ale',
                beer_format: 'tap',
                thanks_count: 12,
                user_id: 'anon_123'
            },
            {
                id: 2,
                user_name: 'Mike R.',
                created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                type: 'shop_report',
                shop_name: 'Tesco Express',
                location: 'Manchester',
                beer_name: 'Heart & Soul lager',
                // photo_url: '/static/images/tesco-gf-beer.jpg',
                thanks_count: 24,
                user_id: 'anon_456'
            },
            {
                id: 3,
                type: 'brewery_announcement',
                brewery_name: 'Jump Ship Brewing',
                announcement: '3 new GF beers launched',
                venues: 'selected Wetherspoons',
                created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                special: true
            }
        ];
    };

    const loadTrending = async () => {
        try {
            const response = await fetch('/api/community/trending');
            const data = await response.json();
            
            if (data.success) {
                return data.trending;
            } else {
                console.error('Failed to load trending data');
                return getMockTrendingData(); // Fallback to mock
            }
        } catch (error) {
            console.error('Error loading trending:', error);
            return getMockTrendingData(); // Fallback to mock
        }
    };
    
    const getMockTrendingData  = async () => {
        
        return [
            {
                rank: 1,
                beer_name: 'Brass Castle - Haze',
                brewery: 'Brass Castle',
                report_count: 18,
                hot: true,
                trend: 'up'
            },
            {
                rank: 2,
                beer_name: 'Bellfield - Lawless',
                brewery: 'Bellfield',
                report_count: 15,
                trend: 'stable'
            },
            {
                rank: 3,
                beer_name: 'Vagabond - American Pale Ale',
                brewery: 'Vagabond',
                report_count: 12,
                trend: 'up'
            }
        ];
    };
    
    // ================================
    // UI UPDATES
    // ================================
    const updateCommunityUI = () => {
        updateVenueOfMonth();
        updateLatestFinds();
        updateTrending();
        updateStats();
    };
    
    const updateVenueOfMonth = () => {
        if (!state.venueOfMonth) return;
        
        const container = document.querySelector('.featured-content');
        if (!container) return;
        
        // Clear and rebuild with DOM methods
        container.innerHTML = '';
        
        const title = document.createElement('h2');
        title.textContent = state.venueOfMonth.name;
        container.appendChild(title);
        
        const description = document.createElement('p');
        description.textContent = state.venueOfMonth.description;
        container.appendChild(description);
        
        const stats = document.createElement('div');
        stats.className = 'featured-stats';
        
        const locationSpan = document.createElement('span');
        locationSpan.textContent = `📍 ${state.venueOfMonth.address}`;
        stats.appendChild(locationSpan);
        
        const statusSpan = document.createElement('span');
        statusSpan.textContent = '🍺 Always GF Available';
        stats.appendChild(statusSpan);
        
        container.appendChild(stats);
        
        const button = document.createElement('button');
        button.className = 'btn btn-featured';
        button.textContent = 'View Details';
        button.dataset.action = 'view-venue';
        button.dataset.venueId = state.venueOfMonth.venue_id;
        container.appendChild(button);
    };
    
    const updateLatestFinds = () => {
        const container = document.querySelector('.finds-grid');
        if (!container || !state.feedItems.length) return;
        
        container.innerHTML = '';
        
        state.feedItems.forEach(item => {
            const card = item.special ? 
                createSpecialFindCard(item) : 
                createFindCard(item);
            container.appendChild(card);
        });
    };
    
    const createFindCard = (item) => {
        const card = document.createElement('div');
        card.className = 'card find-card';
        card.dataset.findId = item.id;
        
        // Header
        const header = document.createElement('div');
        header.className = 'find-header';
        
        const user = document.createElement('span');
        user.className = 'find-user';
        user.textContent = item.user_name;
        header.appendChild(user);
        
        const time = document.createElement('span');
        time.className = 'find-time';
        time.textContent = formatTimeAgo(item.created_at);
        header.appendChild(time);
        
        card.appendChild(header);
        
        // Content
        const content = document.createElement('div');
        content.className = 'find-content';
        
        const contentP = document.createElement('p');
        contentP.textContent = formatFindContent(item);
        content.appendChild(contentP);
        
        const location = document.createElement('div');
        location.className = 'find-location';
        location.textContent = `📍 ${item.location}`;
        content.appendChild(location);
        
        card.appendChild(content);
        
        // Photo if exists
        if (item.photo_url) {
            const photoDiv = document.createElement('div');
            photoDiv.className = 'find-photo';
            
            const img = document.createElement('img');
            img.src = item.photo_url;
            img.alt = 'GF beer find';
            photoDiv.appendChild(img);
            
            card.appendChild(photoDiv);
        }
        
        // Actions
        const actions = document.createElement('div');
        actions.className = 'find-actions';
        
        if (item.venue_id) {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn btn-small-outline';
            viewBtn.textContent = 'View Venue';
            viewBtn.dataset.action = 'view-venue';
            viewBtn.dataset.venueId = item.venue_id;
            actions.appendChild(viewBtn);
        }
        
        const thanksBtn = document.createElement('button');
        thanksBtn.className = 'btn btn-small-text';
        thanksBtn.textContent = `🙌 Thanks! (${item.thanks_count || 0})`;
        thanksBtn.dataset.action = 'thanks';
        thanksBtn.dataset.findId = item.id;
        
        // Check if already thanked
        const thankedItems = window.App.getState('thankedFinds') || new Set();
        if (thankedItems.has(item.id)) {
            thanksBtn.disabled = true;
            thanksBtn.style.opacity = '0.6';
        }
        
        actions.appendChild(thanksBtn);
        card.appendChild(actions);
        
        return card;
    };
    
    const createSpecialFindCard = (item) => {
        const card = document.createElement('div');
        card.className = 'card find-card highlight';
        
        const header = document.createElement('div');
        header.className = 'find-header';
        
        const brewery = document.createElement('span');
        brewery.className = 'find-brewery';
        brewery.textContent = '🎉 New Brewery Alert!';
        header.appendChild(brewery);
        
        card.appendChild(header);
        
        const content = document.createElement('div');
        content.className = 'find-content';
        
        const contentP = document.createElement('p');
        contentP.textContent = `${item.brewery_name} ${item.announcement}! Now available in ${item.venues}.`;
        content.appendChild(contentP);
        
        card.appendChild(content);
        
        const actions = document.createElement('div');
        actions.className = 'find-actions';
        
        const findBtn = document.createElement('button');
        findBtn.className = 'btn btn-small-primary';
        findBtn.textContent = 'Find Stockists';
        findBtn.dataset.action = 'find-stockists';
        
        actions.appendChild(findBtn);
        card.appendChild(actions);
        
        return card;
    };
    
    const updateTrending = () => {
        const container = document.querySelector('.trending-list');
        if (!container || !state.trendingItems.length) return;
        
        container.innerHTML = '';
        
        state.trendingItems.forEach(item => {
            const trendingDiv = document.createElement('div');
            trendingDiv.className = 'trending-item';
            
            const rank = document.createElement('span');
            rank.className = 'trending-rank';
            rank.textContent = item.rank;
            trendingDiv.appendChild(rank);
            
            const content = document.createElement('div');
            content.className = 'trending-content';
            
            const name = document.createElement('strong');
            name.textContent = item.beer_name;
            content.appendChild(name);
            
            const count = document.createElement('small');
            count.textContent = `Reported ${item.report_count} times`;
            content.appendChild(count);
            
            trendingDiv.appendChild(content);
            
            if (item.hot) {
                const badge = document.createElement('span');
                badge.className = 'trending-badge';
                badge.textContent = '🔥';
                trendingDiv.appendChild(badge);
            }
            
            container.appendChild(trendingDiv);
        });
    };
    
    const updateStats = async () => {
        try {
            const stats = await modules.api?.getStats();
            if (stats) {
                if (stats.total_venues && modules.helpers) {
                    modules.helpers.animateNumber('totalVenues', stats.total_venues);
                }
                if (stats.gf_venues && modules.helpers) {
                    modules.helpers.animateNumber('gfVenues', stats.gf_venues);
                }
                // ADD THIS for monthly stats
                if (stats.gf_venues_this_month && modules.helpers) {
                    modules.helpers.animateNumber('monthlyFinds', stats.gf_venues_this_month);
                }
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    };
    
    // ================================
    // HELPER FUNCTIONS
    // ================================
    const formatTimeAgo = (isoString) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };
    
    const formatFindContent = (item) => {
        switch(item.type) {
            case 'beer_report':
                return `Just found ${item.beer_name} on ${item.beer_format} at ${item.venue_name}!`;
            case 'shop_report':
                return `New GF section at ${item.shop_name} - spotted ${item.beer_name}!`;
            default:
                return 'New GF beer find!';
        }
    };
    
    const showFallbackUI = () => {
        const communityFeed = document.querySelector('.community-feed');
        if (communityFeed && !communityFeed.querySelector('.fallback-message')) {
            const fallback = document.createElement('div');
            fallback.className = 'fallback-message';
            
            const message = document.createElement('p');
            message.className = 'fallback-text';
            message.textContent = 'Community updates temporarily unavailable. ';
            
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = 'Refresh page';
            link.onclick = (e) => {
                e.preventDefault();
                location.reload();
            };
            
            message.appendChild(link);
            fallback.appendChild(message);
            communityFeed.insertBefore(fallback, communityFeed.firstChild);
        }
    };
    
    // ================================
    // QUICK NEARBY
    // ================================
    const initializeQuickNearby = () => {
        console.log('✅ Quick nearby button ready');
    };
    
    const handleQuickNearby = async () => {
        console.log('📍 Quick nearby search triggered');
        
        if (modules.modalManager) {
            modules.modalManager.closeAll();
        }
        
        // DON'T show a loading toast here - let the search module handle it
        // The search module already shows its own loading states
        
        try {
            const searchModule = modules.search;
            if (!searchModule) {
                throw new Error('Search module not loaded');
            }
            
            // Just call the search - it handles its own loading UI
            await searchModule.searchNearbyWithDistance(5);
            
            modules.tracking?.trackEvent('quick_nearby', 'Community', 'homepage');
            
        } catch (error) {
            console.error('❌ Quick nearby error:', error);
            modules.helpers?.showToast('Could not get location. Try searching by area instead.', 'error');
            
            if (modules.modalManager) {
                modules.modalManager.open('areaModal');
            }
        }
    };
    
    // ================================
    // THANKS SYSTEM
    // ================================
    const initializeThanksButtons = () => {
        const thankedItems = new Set(
            JSON.parse(sessionStorage.getItem('thankedFinds') || '[]')
        );
        
        window.App.setState('thankedFinds', thankedItems);
    };
    
    const handleThanks = async (findId) => {
        const thankedItems = window.App.getState('thankedFinds') || new Set();
        
        if (thankedItems.has(findId)) {
            modules.helpers?.showToast('You already thanked this find!', 'info');
            return;
        }
        
        // Add to thanked items
        thankedItems.add(findId);
        window.App.setState('thankedFinds', thankedItems);
        
        // IMPROVE: Store in localStorage too
        localStorage.setItem('thankedFinds', JSON.stringify([...thankedItems]));
        
        // Also store the count
        const thanksCounts = JSON.parse(localStorage.getItem('thanksCounts') || '{}');
        thanksCounts[findId] = (thanksCounts[findId] || 0) + 1;
        localStorage.setItem('thanksCounts', JSON.stringify(thanksCounts));
        
        // Update UI with persisted count
        const button = document.querySelector(`[data-action="thanks"][data-find-id="${findId}"]`);
        if (button) {
            button.textContent = `🙌 Thanks! (${thanksCounts[findId]})`;
            button.disabled = true;
            button.style.opacity = '0.6';
        }
        
        modules.helpers?.showToast('Thanks recorded! 🙌', 'success');
        modules.tracking?.trackEvent('thanks_given', 'Community', `find_${findId}`);
        
        // READY FOR REAL DATA:
        // try {
        //     await fetch(`/api/community/thanks/${findId}`, { method: 'POST' });
        // } catch (error) {
        //     console.error('Error recording thanks:', error);
        // }
    };
    
    // ================================
    // QUICK ACTIONS
    // ================================
    const handleQuickAction = (action) => {
        const actions = {
            'browse-breweries': () => {
                const breweries = window.App?.getModule('breweries');
                breweries?.openBreweries();
            },
            'new-to-gf': () => {
                modules.modalManager?.open('gfInfoOverlay');
            },
            'add-find': () => {
                modules.modal?.openReportModal();
            },
            'saved-venues': () => {
                modules.helpers?.showToast('Saved venues coming soon! 🚀', 'info');
            },
            'find-stockists': () => {
                modules.helpers?.showToast('Stockist finder coming soon! 🚀', 'info');
            }
        };
        
        const handler = actions[action];
        if (handler) {
            handler();
            modules.tracking?.trackEvent('quick_action', 'Community', action);
        }
    };
    
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
        handleQuickNearby,
        handleThanks,
        handleQuickAction,
        loadCommunityData,
        
        // Expose for debugging
        getState: () => state
    };
})();

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', CommunityModule.init);
} else {
    CommunityModule.init();
}
