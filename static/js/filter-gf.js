// ================================================================================
// FILTER-GF.JS - Centralized GF/All Filter Management
// Single source of truth for filter state across all views
// ================================================================================

export const FilterStateManager = (() => {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        currentFilter: 'gf', // 'gf' or 'all'
        subscribers: new Set()
    };
    
    // ================================
    // CORE FUNCTIONS
    // ================================
    const setFilter = (filterMode) => {
        if (filterMode !== 'gf' && filterMode !== 'all') return;
        
        const oldMode = state.currentFilter;
        state.currentFilter = filterMode;
        
        // Store in app state
        window.App.setState('gfOnlyFilter', filterMode === 'gf');
        
        // Notify all subscribers
        notifySubscribers(filterMode, oldMode);
    };
    
    const getFilter = () => state.currentFilter;
    const isGFOnly = () => state.currentFilter === 'gf';
    
    // ================================
    // SUBSCRIPTION SYSTEM
    // ================================
    const subscribe = (callback) => {
        state.subscribers.add(callback);
        // Return unsubscribe function
        return () => state.subscribers.delete(callback);
    };
    
    const notifySubscribers = (newMode, oldMode) => {
        state.subscribers.forEach(callback => {
            try {
                callback(newMode, oldMode);
            } catch (error) {
                console.error('Filter subscriber error:', error);
            }
        });
    };
    
    // ================================
    // FILTER HELPERS
    // ================================
    const filterPubs = (pubs) => {
        if (!isGFOnly()) return pubs;
        
        return pubs.filter(pub => {
            const status = pub.gf_status || 'unknown';
            return status === 'always' || 
                   status === 'currently' || 
                   status === 'always_tap_cask' || 
                   status === 'always_bottle_can';
        });
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        // Load saved preference
        const savedFilter = window.App.getState('gfOnlyFilter');
        state.currentFilter = savedFilter === false ? 'all' : 'gf';
        
        // Subscribe different modules
        subscribeModules();
    };
    
    const subscribeModules = () => {
        // Map module subscription
        subscribe((newMode) => {
            const currentView = window.App.getState('currentView');
            if (currentView === 'map') {
                const mapModule = window.App.getModule('map');
                mapModule?.updateMapDisplay?.(newMode === 'gf');
            }
        });
        
        // Results module subscription - FIXED
        subscribe((newMode) => {
            const currentView = window.App.getState('currentView');
            if (currentView === 'results') {
                const searchModule = window.App.getModule('search');
                const lastSearch = window.App.getState('lastSearch');
                
                if (!lastSearch) return;
                
                console.log('🔄 Filter changed, re-running search with:', newMode);
                
                // Re-run the last search with new filter setting
                if (lastSearch.type === 'nearby' && lastSearch.radius) {
                    // Re-run nearby search with new filter
                    searchModule?.searchNearbyWithDistance?.(lastSearch.radius);
                } else if (lastSearch.type === 'name' && lastSearch.query) {
                    // Re-run name search
                    searchModule?.searchByName?.();
                } else if (lastSearch.type === 'area' && lastSearch.query) {
                    // Re-run area search
                    searchModule?.searchByArea?.();
                } else if (lastSearch.type === 'beer' && lastSearch.query) {
                    // Re-run beer search
                    searchModule?.searchByBeer?.();
                }
            }
        });
    };
    
    const getResultsTitle = (count) => {
        const lastSearch = window.App.getState('lastSearch');
        let title = `${count} pubs`;
        
        if (lastSearch?.type === 'nearby') {
            title = `${count} pubs within ${lastSearch.radius}km`;
        } else if (lastSearch?.query) {
            title = `${count} pubs for "${lastSearch.query}"`;
        }
        
        if (isGFOnly()) title += ' (GF only)';
        return title;
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        setFilter,
        getFilter,
        isGFOnly,
        subscribe,
        filterPubs
    };
})();
