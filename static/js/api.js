// ================================================================================
// API.JS - Complete Refactor with STATE_KEYS
// Handles: All backend communication, error handling, response parsing
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const APIModule = (function() {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        pendingRequests: new Map(),
        requestCache: new Map(),
        cacheTimeout: 300000, // 5 minutes
        retryQueue: []
    };
    
    const config = {
        timeout: Constants.UI.TIMEOUTS.API_REQUEST,
        retryAttempts: 2,
        retryDelay: 1000,
        headers: {
            'Content-Type': 'application/json',
            'X-App-Version': Constants.VERSION || '1.0.0'
        }
    };
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get helpers() { return window.App?.getModule('helpers'); },
        get tracking() { return window.App?.getModule('tracking'); }
    };
    
    // ================================
    // CORE FETCH WRAPPER
    // ================================
    const fetchWithTimeout = async (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        // Check cache first
        const cacheKey = `${options.method || 'GET'}_${url}`;
        if (options.method === 'GET' && state.requestCache.has(cacheKey)) {
            const cached = state.requestCache.get(cacheKey);
            if (Date.now() - cached.timestamp < state.cacheTimeout) {
                clearTimeout(timeoutId);
                console.log('📦 Using cached response for:', url);
                return cached.response.clone();
            }
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...config.headers,
                    ...options.headers
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Cache GET requests
            if (options.method === 'GET' && response.ok) {
                state.requestCache.set(cacheKey, {
                    response: response.clone(),
                    timestamp: Date.now()
                });
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    };
    
    // ================================
    // ERROR HANDLING
    // ================================
    const handleAPIError = (error, endpoint, context = {}) => {
        console.error(`❌ API Error [${endpoint}]:`, error);
        
        // Track error
        modules.tracking?.trackError('api_error', `${endpoint}: ${error.message}`);
        
        // Determine user-friendly message
        let userMessage = Constants.ERRORS.GENERIC;
        
        if (error.message.includes('timeout')) {
            userMessage = Constants.ERRORS.NETWORK;
        } else if (error.message.includes('404')) {
            userMessage = Constants.ERRORS.NO_RESULTS;
        }
        
        // Store error in state for debugging
        window.App.setState('lastAPIError', {
            endpoint,
            error: error.message,
            timestamp: Date.now(),
            context
        });
        
        return {
            success: false,
            error: userMessage,
            originalError: error.message
        };
    };
    
    // ================================
    // REQUEST DEDUPLICATION
    // ================================
    const deduplicatedFetch = async (key, fetchFunction) => {
        // Check if identical request is pending
        if (state.pendingRequests.has(key)) {
            console.log('🔄 Reusing pending request:', key);
            return state.pendingRequests.get(key);
        }
        
        // Create and store promise
        const promise = fetchFunction();
        state.pendingRequests.set(key, promise);
        
        try {
            const result = await promise;
            state.pendingRequests.delete(key);
            return result;
        } catch (error) {
            state.pendingRequests.delete(key);
            throw error;
        }
    };
    
    // ================================
    // STATS API
    // ================================
    const getStats = async () => {
        const cacheKey = 'stats';
        
        return deduplicatedFetch(cacheKey, async () => {
            try {
                const response = await fetchWithTimeout(Constants.API.STATS);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const stats = await response.json();
                
                // Update global state
                window.App.setState('stats', stats);
                
                return stats;
            } catch (error) {
                console.error('API: Error fetching stats:', error);
                
                // Return cached stats from state if available
                const cachedStats = window.App.getState('stats');
                if (cachedStats) return cachedStats;
                
                // Return fallback data
                return {
                    total_pubs: Constants.DEFAULTS.TOTAL_PUBS,
                    gf_pubs: Constants.DEFAULTS.GF_PUBS
                };
            }
        });
    };
    
    // ================================
    // SEARCH APIS
    // ================================
    const searchPubs = async (params) => {
        const { query, searchType = 'all', page = 1, pubId = null, gfOnly = false } = params;
        
        try {
            let url;
            if (pubId) {
                url = `${Constants.API.SEARCH}?pub_id=${pubId}`;
            } else {
                const searchParams = new URLSearchParams({
                    query: query || '',
                    search_type: searchType,
                    page: page.toString(),
                    gf_only: gfOnly.toString()
                });
                url = `${Constants.API.SEARCH}?${searchParams}`;
            }
            
            console.log('🔍 API: Searching pubs:', url);
            
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            // Update search state
            window.App.setState(STATE_KEYS.SEARCH_RESULTS, data.pubs || data);
            
            return data;
        } catch (error) {
            return handleAPIError(error, 'searchPubs', params);
        }
    };
    
    const findNearbyPubs = async (lat, lng, radius = 5, gfOnly = false) => {
        const cacheKey = `nearby_${lat}_${lng}_${radius}_${gfOnly}`;
        
        return deduplicatedFetch(cacheKey, async () => {
            try {
                const params = new URLSearchParams({
                    lat: lat.toString(),
                    lng: lng.toString(),
                    radius: radius.toString(),
                    gf_only: gfOnly.toString()
                });
                
                const url = `${Constants.API.NEARBY}?${params}`;
                console.log('📍 API: Finding nearby pubs:', url);
                
                const response = await fetchWithTimeout(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                
                // Ensure we always return an array
                let pubs = [];
                if (Array.isArray(data)) {
                    pubs = data;
                } else if (data.pubs && Array.isArray(data.pubs)) {
                    pubs = data.pubs;
                } else if (data.success === false) {
                    // API error response
                    throw new Error(data.error || 'Failed to load pubs');
                }
                
                // Update state
                window.App.setState(STATE_KEYS.SEARCH_RESULTS, pubs);
                
                return pubs;
            } catch (error) {
                const errorResult = handleAPIError(error, 'findNearbyPubs', { lat, lng, radius });
                // Ensure we return an empty array on error, not an error object
                return [];
            }
        });
    };
    
    // ================================
    // GEOCODING
    // ================================
    const geocodePostcode = async (postcode) => {
        const cacheKey = `geocode_${postcode}`;
        
        return deduplicatedFetch(cacheKey, async () => {
            try {
                const params = new URLSearchParams({
                    format: 'json',
                    q: postcode,
                    countrycodes: 'gb',
                    limit: '1'
                });
                
                const url = `${Constants.EXTERNAL.GEOCODING_API}?${params}`;
                console.log('🌍 API: Geocoding postcode:', postcode);
                
                const response = await fetchWithTimeout(url);
                const data = await response.json();
                
                if (!data || data.length === 0) {
                    throw new Error('Postcode not found');
                }
                
                const result = {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    display_name: data[0].display_name
                };
                
                return result;
            } catch (error) {
                return handleAPIError(error, 'geocodePostcode', { postcode });
            }
        });
    };
    
    // ================================
    // AUTOCOMPLETE
    // ================================
    const getPubSuggestions = async (query, searchType = 'all', gfOnly = false) => {
        if (!query || query.length < Constants.SEARCH.MIN_QUERY_LENGTH) return [];
        
        try {
            const params = new URLSearchParams({
                q: query,
                search_type: searchType,
                gf_only: gfOnly.toString()
            });
            
            const response = await fetchWithTimeout(`${Constants.API.AUTOCOMPLETE}?${params}`);
            return await response.json();
        } catch (error) {
            console.error('API: Autocomplete error:', error);
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
            
            const response = await fetchWithTimeout(url);
            const breweries = await response.json();
            
            // Store in state for form module
            window.App.setState('availableBreweries', breweries);
            
            return breweries;
        } catch (error) {
            console.error('API: Brewery fetch error:', error);
            return [];
        }
    };
    
    const getBreweryBeers = async (brewery, query = '') => {
        try {
            const baseUrl = Constants.API.BREWERY_BEERS.replace(':brewery', encodeURIComponent(brewery));
            const url = query ? `${baseUrl}?q=${encodeURIComponent(query)}` : baseUrl;
            
            const response = await fetchWithTimeout(url);
            return await response.json();
        } catch (error) {
            console.error('API: Beer fetch error:', error);
            return [];
        }
    };
    
    // ================================
    // SUBMISSION APIs
    // ================================
    const submitBeerReport = async (reportData) => {
        try {
            // ADD THIS DEBUG LOGGING:
            console.log('🔍 DEBUG - Raw report data:', reportData);
            console.log('🔍 DEBUG - Data types:', {
                pub_id: typeof reportData.pub_id,
                beer_abv: typeof reportData.beer_abv,
                pub_id_value: reportData.pub_id
            });
            // Validate required fields
            const requiredFields = ['pub_id', 'beer_format', 'brewery', 'beer_name'];
            const missingFields = requiredFields.filter(field => !reportData[field] && !reportData.pub_name);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }
            
            // Build payload
            const payload = {
                ...reportData,
                submitted_at: new Date().toISOString(),
                user_agent: navigator.userAgent,
                session_id: window.App.getState('sessionId') || 'anonymous'
            };
            
            console.log('📝 API: Submitting beer report:', payload);
            
            const response = await fetchWithTimeout(Constants.API.SUBMIT_BEER, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            // Track submission
            modules.tracking?.trackFormSubmission('beer_report', {
                tier: result.tier,
                status: result.status,
                brewery: reportData.brewery
            });
            
            return result;
        } catch (error) {
            return handleAPIError(error, 'submitBeerReport', reportData);
        }
    };
    
    const updateGFStatus = async (pubId, status) => {
        try {
            const validStatuses = ['always', 'currently', 'not_currently', 'unknown'];
            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }
            
            const response = await fetchWithTimeout(Constants.API.UPDATE_GF_STATUS, {
                method: 'POST',
                body: JSON.stringify({ pub_id: pubId, status })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            // Update current pub state
            const currentPub = window.App.getState(STATE_KEYS.CURRENT_PUB);
            if (currentPub && currentPub.pub_id === pubId) {
                window.App.setState(STATE_KEYS.CURRENT_PUB, {
                    ...currentPub,
                    gf_status: status
                });
            }
            
            // Track update
            modules.tracking?.trackEvent('gf_status_updated', 'User Action', status);
            
            return result;
        } catch (error) {
            return handleAPIError(error, 'updateGFStatus', { pubId, status });
        }
    };
    
    // ================================
    // MAP DATA API
    // ================================
    const getAllPubsForMap = async () => {
        const cacheKey = 'all_pubs_map';
        
        // Check if we have cached data in state
        const cachedPubs = window.App.getState(STATE_KEYS.MAP_DATA.ALL_PUBS);
        if (cachedPubs && cachedPubs.length > 0) {
            console.log('📦 Using cached pub data');
            return { success: true, pubs: cachedPubs };
        }
        
        return deduplicatedFetch(cacheKey, async () => {
            try {
                const response = await fetchWithTimeout(Constants.API.ALL_PUBS);
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.error || 'Failed to load pubs');
                }
                
                // Store in state
                window.App.setState(STATE_KEYS.MAP_DATA.ALL_PUBS, data.pubs || []);
                
                return data;
            } catch (error) {
                return handleAPIError(error, 'getAllPubsForMap');
            }
        });
    };
    
    // ================================
    // ADMIN APIs
    // ================================
    const admin = {
        getValidationStats: async (token) => {
            try {
                const response = await fetchWithTimeout(Constants.API.ADMIN.VALIDATION_STATS, {
                    headers: { 'Authorization': token }
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                return handleAPIError(error, 'admin.getValidationStats');
            }
        },
        
        getPendingReviews: async (token) => {
            try {
                const response = await fetchWithTimeout(Constants.API.ADMIN.PENDING_REVIEWS, {
                    headers: { 'Authorization': token }
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                return handleAPIError(error, 'admin.getPendingReviews');
            }
        },
        
        getSoftValidationQueue: async (token) => {
            try {
                const response = await fetchWithTimeout(Constants.API.ADMIN.SOFT_VALIDATION, {
                    headers: { 'Authorization': token }
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                return handleAPIError(error, 'admin.getSoftValidationQueue');
            }
        },
        
        getRecentSubmissions: async (token) => {
            try {
                const response = await fetchWithTimeout(Constants.API.ADMIN.RECENT_SUBMISSIONS, {
                    headers: { 'Authorization': token }
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                return handleAPIError(error, 'admin.getRecentSubmissions');
            }
        },
        
        approveSubmission: async (token, submissionId, notes = '') => {
            try {
                const response = await fetchWithTimeout(Constants.API.ADMIN.APPROVE, {
                    method: 'POST',
                    headers: { 'Authorization': token },
                    body: JSON.stringify({ 
                        submission_id: submissionId, 
                        admin_notes: notes 
                    })
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                return handleAPIError(error, 'admin.approveSubmission', { submissionId });
            }
        },
        
        rejectSubmission: async (token, submissionId, notes) => {
            try {
                const response = await fetchWithTimeout(Constants.API.ADMIN.REJECT, {
                    method: 'POST',
                    headers: { 'Authorization': token },
                    body: JSON.stringify({ 
                        submission_id: submissionId, 
                        admin_notes: notes 
                    })
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                return handleAPIError(error, 'admin.rejectSubmission', { submissionId });
            }
        },
        
        approveSoftValidation: async (token, submissionId) => {
            try {
                const response = await fetchWithTimeout(Constants.API.ADMIN.APPROVE_SOFT, {
                    method: 'POST',
                    headers: { 'Authorization': token },
                    body: JSON.stringify({ submission_id: submissionId })
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                return handleAPIError(error, 'admin.approveSoftValidation', { submissionId });
            }
        }
    };
    
    // ================================
    // CACHE MANAGEMENT
    // ================================
    const clearCache = (pattern = null) => {
        if (pattern) {
            // Clear specific cache entries matching pattern
            for (const [key] of state.requestCache) {
                if (key.includes(pattern)) {
                    state.requestCache.delete(key);
                }
            }
        } else {
            // Clear all cache
            state.requestCache.clear();
        }
        
        console.log('🧹 Cache cleared:', pattern || 'all');
    };
    
    const getCacheStats = () => {
        return {
            size: state.requestCache.size,
            entries: Array.from(state.requestCache.keys()),
            totalSize: JSON.stringify([...state.requestCache]).length
        };
    };
    
    // ================================
    // RETRY MECHANISM
    // ================================
    const retryFailedRequest = async (request, attempt = 1) => {
        if (attempt > config.retryAttempts) {
            throw new Error(`Max retry attempts (${config.retryAttempts}) exceeded`);
        }
        
        try {
            return await request();
        } catch (error) {
            console.warn(`🔄 Retry attempt ${attempt}/${config.retryAttempts}:`, error.message);
            
            // Wait before retry
            await new Promise(resolve => 
                setTimeout(resolve, config.retryDelay * attempt)
            );
            
            return retryFailedRequest(request, attempt + 1);
        }
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        // Core methods
        getStats,
        searchPubs,
        findNearbyPubs,
        geocodePostcode,
        
        // Autocomplete
        getPubSuggestions,
        
        // Brewery & Beer
        getBreweries,
        getBreweryBeers,
        
        // Submissions
        submitBeerReport,
        updateGFStatus,
        
        // Map data
        getAllPubsForMap,
        
        // Admin namespace
        admin,
        
        // Cache management
        clearCache,
        getCacheStats,
        
        // Utilities
        retryFailedRequest
    };
})();

// DO NOT add window.APIModule here - let main.js handle registration
