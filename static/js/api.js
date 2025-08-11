// ================================================================================
// API.JS - Simplified Version
// Handles: Backend communication, basic error handling
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const APIModule = (function() {
    'use strict';
    
    // ================================
    // SIMPLE FETCH WRAPPER
    // ================================
    const apiCall = async (url, options = {}) => {
        try {
            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`❌ API Error [${url}]:`, error);
            throw error;
        }
    };
    
    // ================================
    // STATS API
    // ================================
    const getStats = async () => {
        try {
            const stats = await apiCall(Constants.API.STATS);
            window.App.setState('stats', stats);
            return stats;
        } catch (error) {
            return {
                total_venues: 49841,
                gf_venues: 0,
                gf_venues_this_month: 0
            };
        }
    };
    
    // ================================
    // SEARCH APIS
    // ================================
    const searchVenues = async (params) => {
        const { query, searchType = 'all', page = 1, venueId = null, gfOnly = false } = params;
        
        let url;
        if (venueId) {
            url = `${Constants.API.SEARCH}?venue_id=${venueId}`;
        } else {
            const searchParams = new URLSearchParams({
                query: query || '',
                search_type: searchType,
                page: page.toString(),
                gf_only: gfOnly.toString()
            });
            url = `${Constants.API.SEARCH}?${searchParams}`;
        }
        
        const data = await apiCall(url);
        window.App.setState(STATE_KEYS.SEARCH_RESULTS, data.venues || data);
        return data;
    };
    
    const findNearbyVenues = async (lat, lng, radius = 5, gfOnly = false) => {
        const params = new URLSearchParams({
            lat: lat.toString(),
            lng: lng.toString(),
            radius: radius.toString(),
            gf_only: gfOnly.toString()
        });
        
        const venues = await apiCall(`${Constants.API.NEARBY}?${params}`);
        window.App.setState(STATE_KEYS.SEARCH_RESULTS, Array.isArray(venues) ? venues : []);
        return Array.isArray(venues) ? venues : [];
    };
    
    // ================================
    // GEOCODING
    // ================================
    const geocodePostcode = async (postcode) => {
        const params = new URLSearchParams({
            format: 'json',
            q: postcode,
            countrycodes: 'gb',
            limit: '1'
        });
        
        const data = await apiCall(`${Constants.EXTERNAL.GEOCODING_API}?${params}`);
        
        if (!data || data.length === 0) {
            throw new Error('Postcode not found');
        }
        
        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            display_name: data[0].display_name
        };
    };
    
    // ================================
    // AUTOCOMPLETE
    // ================================
    const getVenueSuggestions = async (query, searchType = 'all', gfOnly = false) => {
        if (!query || query.length < 2) return [];
        
        try {
            const params = new URLSearchParams({
                q: query,
                search_type: searchType,
                gf_only: gfOnly.toString()
            });
            
            return await apiCall(`${Constants.API.AUTOCOMPLETE}?${params}`);
        } catch (error) {
            return [];
        }
    };
    
    // ================================
    // BREWERY & BEER APIS
    // ================================
    const getBreweries = async (query = '') => {
        try {
            const url = query ? 
                `${Constants.API.BREWERIES}?q=${encodeURIComponent(query)}` : 
                Constants.API.BREWERIES;
            
            const breweries = await apiCall(url);
            window.App.setState('availableBreweries', breweries);
            return breweries;
        } catch (error) {
            return [];
        }
    };
    
    const getBreweryBeers = async (brewery, query = '') => {
        try {
            const baseUrl = Constants.API.BREWERY_BEERS.replace(':brewery', encodeURIComponent(brewery));
            const url = query ? `${baseUrl}?q=${encodeURIComponent(query)}` : baseUrl;
            return await apiCall(url);
        } catch (error) {
            return [];
        }
    };
    
    // ================================
    // SUBMISSION APIS
    // ================================
    const submitBeerReport = async (reportData) => {
        const payload = {
            ...reportData,
            submitted_at: new Date().toISOString(),
            submitted_by: window.App.getState('userNickname') || 'Anonymous'
        };
        
        return await apiCall(Constants.API.SUBMIT_BEER, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    };
    
    const updateGFStatus = async (venueId, status) => {
        const result = await apiCall(Constants.API.UPDATE_GF_STATUS, {
            method: 'POST',
            body: JSON.stringify({ venue_id: venueId, status })
        });
        
        // Update current venue state
        const currentVenue = window.App.getState(STATE_KEYS.CURRENT_VENUE);
        if (currentVenue && currentVenue.venue_id === venueId) {
            window.App.setState(STATE_KEYS.CURRENT_VENUE, {
                ...currentVenue,
                gf_status: status
            });
        }
        
        return result;
    };
    
    // ================================
    // MAP DATA API
    // ================================
    const getAllVenuesForMap = async () => {
        const cachedVenues = window.App.getState(STATE_KEYS.MAP_DATA.ALL_VENUES);
        if (cachedVenues && cachedVenues.length > 0) {
            return { success: true, venues: cachedVenues };
        }
        
        const data = await apiCall(Constants.API.ALL_VENUES);
        window.App.setState(STATE_KEYS.MAP_DATA.ALL_VENUES, data.venues || []);
        return data;
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        getStats,
        searchVenues,
        findNearbyVenues,
        geocodePostcode,
        getVenueSuggestions,
        getBreweries,
        getBreweryBeers,
        submitBeerReport,
        updateGFStatus,
        getAllVenuesForMap
    };
})();
