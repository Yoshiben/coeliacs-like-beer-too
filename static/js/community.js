// ================================================================================
// COMMUNITY.JS - Community Homepage Features
// Handles: Feed updates, trending, quick actions, user interactions
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
        pubOfMonth: null,
        refreshInterval: null,
        lastRefresh: null
    };
    
    const config = {
        refreshInterval: 300000, // 5 minutes
        animationDuration: 300
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get api() { return window.App?.getModule('api'); },
        get search() { return window.App?.getModule('search'); },
        get modal() { return window.App?.getModule('modal'); },
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
            // In parallel, load all community data
            const [pubOfMonth, latestFinds, trending] = await Promise.all([
                loadPubOfMonth(),
                loadLatestFinds(),
                loadTrending()
            ]);
            
            // Update state
            state.pubOfMonth = pubOfMonth;
            state.feedItems = latestFinds;
            state.trendingItems = trending;
            state.lastRefresh = Date.now();
            
            // Update UI
            updateCommunityUI();
            
        } catch (error) {
            console.error('❌ Error loading community data:', error);
        }
    };
    
    const loadPubOfMonth = async () => {
        // TODO: Add API endpoint for pub of month
        // For now, return mock data
        return {
            pub_id: 12345,
            name: 'The Botanist Sheffield',
            description: '6 dedicated GF taps including Bellfield, Jump Ship & Brass Castle!',
            address: 'Sheffield City Centre',
            gf_status: 'always',
            photo_url: ''
        };
    };
    
    const loadLatestFinds = async () => {
        // TODO: Add API endpoint for community finds
        // For now, return mock data
        return [
            {
                id: 1,
                user: 'Sarah M.',
                time: '2 hours ago',
                type: 'pub_find',
                content: 'Just found <strong>Vagabond Pale Ale</strong> on tap at <strong>The Old Bell</strong>!',
                location: 'Leeds',
                pub_id: 23456,
                thanks_count: 12
            },
            {
                id: 2,
                user: 'Mike R.',
                time: '5 hours ago',
                type: 'shop_find',
                content: 'New GF section at <strong>Tesco Express</strong> - spotted Heart & Soul lager!',
                location: 'Manchester',
                // photo_url: '/static/images/tesco-gf-beer.jpg',
                thanks_count: 24
            },
            {
                id: 3,
                type: 'brewery_alert',
                content: '<strong>Jump Ship Brewing</strong> just launched 3 new GF beers! Now available in selected Wetherspoons.',
                special: true
            }
        ];
    };
    
    const loadTrending = async () => {
        // TODO: Add API endpoint for trending
        // For now, return mock data
        return [
            {
                rank: 1,
                name: 'Brass Castle - Haze',
                report_count: 18,
                hot: true
            },
            {
                rank: 2,
                name: 'Bellfield - Lawless',
                report_count: 15
            },
            {
                rank: 3,
                name: 'Vagabond - American Pale Ale',
                report_count: 12
            }
        ];
    };
    
    // ================================
    // UI UPDATES
    // ================================
    const updateCommunityUI = () => {
        updatePubOfMonth();
        updateLatestFinds();
        updateTrending();
        updateStats();
    };
    
    const updatePubOfMonth = () => {
        if (!state.pubOfMonth) return;
        
        const pub = state.pubOfMonth;
        const container = document.querySelector('.featured-content');
        if (!container) return;
        
        container.innerHTML = `
            <h2>${modules.helpers?.escapeHtml(pub.name)}</h2>
            <p>${modules.helpers?.escapeHtml(pub.description)}</p>
            <div class="featured-stats">
                <span>📍 ${modules.helpers?.escapeHtml(pub.address)}</span>
                <span>🍺 Always GF Available</span>
            </div>
            <button class="btn-featured" data-action="view-pub" data-pub-id="${pub.pub_id}">
                View Details
            </button>
        `;
        
        // Update image if exists
        const imageEl = document.querySelector('.featured-image img');
        if (imageEl && pub.photo_url) {
            imageEl.src = pub.photo_url;
            imageEl.alt = `GF beer at ${pub.name}`;
        }
    };
    
    const updateLatestFinds = () => {
        const container = document.querySelector('.finds-grid');
        if (!container || !state.feedItems.length) return;
        
        container.innerHTML = state.feedItems.map(item => {
            if (item.special) {
                return createSpecialFindCard(item);
            }
            return createFindCard(item);
        }).join('');
    };
    
    const createFindCard = (item) => {
        const helpers = modules.helpers;
        return `
            <div class="find-card" data-find-id="${item.id}">
                <div class="find-header">
                    <span class="find-user">${helpers?.escapeHtml(item.user)}</span>
                    <span class="find-time">${helpers?.escapeHtml(item.time)}</span>
                </div>
                <div class="find-content">
                    <p>${item.content}</p>
                    <div class="find-location">📍 ${helpers?.escapeHtml(item.location)}</div>
                </div>
                ${item.photo_url ? `
                    <div class="find-photo">
                        <img src="${item.photo_url}" alt="GF beer find">
                    </div>
                ` : ''}
                <div class="find-actions">
                    ${item.pub_id ? `
                        <button class="btn-small-outline" data-action="view-pub" data-pub-id="${item.pub_id}">
                            View Pub
                        </button>
                    ` : ''}
                    <button class="btn-small-text" data-action="thanks" data-find-id="${item.id}">
                        🙌 Thanks! (${item.thanks_count || 0})
                    </button>
                </div>
            </div>
        `;
    };
    
    const createSpecialFindCard = (item) => {
        return `
            <div class="find-card highlight">
                <div class="find-header">
                    <span class="find-brewery">🎉 New Brewery Alert!</span>
                </div>
                <div class="find-content">
                    <p>${item.content}</p>
                </div>
                <div class="find-actions">
                    <button class="btn-small-primary" data-action="find-stockists">
                        Find Stockists
                    </button>
                </div>
            </div>
        `;
    };
    
    const updateTrending = () => {
        const container = document.querySelector('.trending-list');
        if (!container || !state.trendingItems.length) return;
        
        container.innerHTML = state.trendingItems.map(item => `
            <div class="trending-item">
                <span class="trending-rank">${item.rank}</span>
                <div class="trending-content">
                    <strong>${modules.helpers?.escapeHtml(item.name)}</strong>
                    <small>Reported ${item.report_count} times</small>
                </div>
                ${item.hot ? '<span class="trending-badge">🔥</span>' : ''}
            </div>
        `).join('');
    };
    
    const updateStats = async () => {
        try {
            const stats = await modules.api?.getStats();
            if (stats) {
                modules.helpers?.animateNumber('totalPubs', Math.floor(stats.total_pubs / 1000) + 'k+');
                modules.helpers?.animateNumber('gfPubs', (stats.gf_pubs / 1000).toFixed(1) + 'k+');
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    };
    
    // ================================
    // QUICK NEARBY
    // ================================
    const initializeQuickNearby = () => {
        // The action handler will be in main.js
        console.log('✅ Quick nearby button ready');
    };
    
    const handleQuickNearby = async () => {
        console.log('📍 Quick nearby search triggered');
        
        modules.helpers?.showLoadingToast('Finding GF beer near you...');
        
        try {
            // Try to get location
            const searchModule = modules.search;
            if (!searchModule) {
                throw new Error('Search module not loaded');
            }
            
            // Use existing location search flow with fixed 5km radius
            await searchModule.searchNearbyWithDistance(5);
            
            modules.tracking?.trackEvent('quick_nearby', 'Community', 'homepage');
            
        } catch (error) {
            console.error('❌ Quick nearby error:', error);
            modules.helpers?.hideLoadingToast();
            modules.helpers?.showToast('Could not get location. Try searching by area instead.', 'error');
            
            // Open area search as fallback
            modules.modal?.open('areaModal');
        }
    };
    
    // ================================
    // THANKS SYSTEM
    // ================================
    const initializeThanksButtons = () => {
        // Track thanked items in session
        const thankedItems = new Set(
            JSON.parse(sessionStorage.getItem('thankedFinds') || '[]')
        );
        
        window.App.setState('thankedFinds', thankedItems);
    };
    
    const handleThanks = (findId) => {
        const thankedItems = window.App.getState('thankedFinds') || new Set();
        
        if (thankedItems.has(findId)) {
            modules.helpers?.showToast('You already thanked this find!', 'info');
            return;
        }
        
        // Add to thanked items
        thankedItems.add(findId);
        window.App.setState('thankedFinds', thankedItems);
        sessionStorage.setItem('thankedFinds', JSON.stringify([...thankedItems]));
        
        // Update UI
        const button = document.querySelector(`[data-action="thanks"][data-find-id="${findId}"]`);
        if (button) {
            const match = button.textContent.match(/\((\d+)\)/);
            const currentCount = match ? parseInt(match[1]) : 0;
            button.textContent = `🙌 Thanks! (${currentCount + 1})`;
            button.disabled = true;
            button.style.opacity = '0.6';
        }
        
        modules.helpers?.showToast('Thanks recorded! 🙌', 'success');
        modules.tracking?.trackEvent('thanks_given', 'Community', `find_${findId}`);
        
        // TODO: Send to API when backend ready
    };
    
    // ================================
    // QUICK ACTIONS
    // ================================
    const handleQuickAction = (action) => {
        const actions = {
            'browse-breweries': () => {
                window.location.href = '/breweries';
            },
            'new-to-gf': () => {
                modules.modal?.open('gfInfoModal');
            },
            'add-find': () => {
                modules.modal?.openReportModal();
            },
            'saved-pubs': () => {
                modules.helpers?.showToast('Saved pubs coming soon! 🚀', 'info');
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
