// ================================================================================
// API.JS - Centralized API calls and data fetching
// Handles: All backend communication, error handling, response parsing
// ================================================================================

export const APIModule = (function() {
    'use strict';
    
    // Configuration
    const config = {
        timeout: 10000, // 10 seconds
        retryAttempts: 2,
        retryDelay: 1000
    };
    
    // Helper function for API calls with error handling
    const fetchWithTimeout = async (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    };
    
    // Get site statistics
    const getStats = async () => {
        try {
            const response = await fetchWithTimeout('/api/stats');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('API: Error fetching stats:', error);
            // Return fallback data
            return {
                total_pubs: 49841,
                gf_pubs: 1249
            };
        }
    };
    
    // Search for pubs
    const searchPubs = async (params) => {
        const { query, searchType = 'all', page = 1, pubId = null } = params;
        
        try {
            let url;
            if (pubId) {
                // Specific pub search
                url = `/search?pub_id=${pubId}`;
            } else {
                // Regular search
                url = `/search?query=${encodeURIComponent(query)}&search_type=${searchType}&page=${page}`;
            }
            
            console.log('API: Searching pubs:', url);
            
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            return data;
        } catch (error) {
            console.error('API: Search error:', error);
            throw error;
        }
    };
    
    // Find nearby pubs
    const findNearbyPubs = async (lat, lng, radius = 5, gfOnly = false) => {
        try {
            const url = `/nearby?lat=${lat}&lng=${lng}&radius=${radius}&gf_only=${gfOnly}`;
            console.log('API: Finding nearby pubs:', url);
            
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            return data.pubs || data;
        } catch (error) {
            console.error('API: Nearby search error:', error);
            throw error;
        }
    };
    
    // Geocode a postcode
    const geocodePostcode = async (postcode) => {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(postcode)}&countrycodes=gb&limit=1`;
            console.log('API: Geocoding postcode:', postcode);
            
            const response = await fetchWithTimeout(url);
            const data = await response.json();
            
            if (!data || data.length === 0) {
                throw new Error('Postcode not found');
            }
            
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                display_name: data[0].display_name
            };
        } catch (error) {
            console.error('API: Geocoding error:', error);
            throw error;
        }
    };
    
    // Get pub autocomplete suggestions
    const getPubSuggestions = async (query, searchType = 'all', gfOnly = false) => {
        if (!query || query.length < 2) return [];
        
        try {
            const url = `/autocomplete?q=${encodeURIComponent(query)}&search_type=${searchType}&gf_only=${gfOnly}`;
            const response = await fetchWithTimeout(url);
            return await response.json();
        } catch (error) {
            console.error('API: Autocomplete error:', error);
            return [];
        }
    };
    
    // Get breweries
    const getBreweries = async (query = '') => {
        try {
            const url = query ? 
                `/api/breweries?q=${encodeURIComponent(query)}` : 
                '/api/breweries';
            
            const response = await fetchWithTimeout(url);
            return await response.json();
        } catch (error) {
            console.error('API: Brewery fetch error:', error);
            return [];
        }
    };
    
    // Get beers for a brewery
    const getBreweryBeers = async (brewery, query = '') => {
        try {
            const url = query ?
                `/api/brewery/${encodeURIComponent(brewery)}/beers?q=${encodeURIComponent(query)}` :
                `/api/brewery/${encodeURIComponent(brewery)}/beers`;
            
            const response = await fetchWithTimeout(url);
            return await response.json();
        } catch (error) {
            console.error('API: Beer fetch error:', error);
            return [];
        }
    };
    
    // Submit beer report
    const submitBeerReport = async (reportData) => {
        try {
            // Transform data to match backend expectations
            // FIXED: Don't prefix with "new_" for known items
            const payload = {
                pub_id: reportData.pub_id || null,
                beer_format: reportData.beer_format,
                brewery: reportData.brewery,  // CHANGED: was new_brewery
                beer_name: reportData.beer_name,  // CHANGED: was new_beer_name
                beer_style: reportData.beer_style,  // CHANGED: was new_style
                beer_abv: reportData.beer_abv,  // CHANGED: was new_abv
                submitted_by_name: 'Anonymous',
                submitted_by_email: '',
                user_notes: reportData.notes || `${reportData.beer_format} - ${reportData.brewery} ${reportData.beer_name}`,
                photo_url: '',
                // Only use "new_" prefix for actual new pub fields
                new_pub_name: reportData.pub_name && !reportData.pub_id ? reportData.pub_name : null,
                new_address: reportData.address && !reportData.pub_id ? reportData.address : null,
                new_postcode: reportData.postcode && !reportData.pub_id ? reportData.postcode : null
            };
            
            console.log('API: Submitting beer report:', payload);
            
            const response = await fetchWithTimeout('/api/submit_beer_update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API: Submit report error:', error);
            throw error;
        }
    };

    // Enhanced beer search that gets pubs with beer details
    const searchPubsByBeer = async (query, searchType) => {
        try {
            console.log(`🍺 API: Searching pubs by beer - "${query}" (${searchType})`);
            
            // Use a broad search to get pubs with beer details
            const response = await fetchWithTimeout('/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    search_type: 'all',
                    include_beer_details: true,
                    page: 1,
                    per_page: 500 // Get more results for beer filtering
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            console.log(`🍺 API: Got ${data.pubs?.length || 0} pubs for beer filtering`);
            return data;
            
        } catch (error) {
            console.error('🍺 API: Beer search error:', error);
            
            // Fallback to regular search
            console.log('🍺 API: Falling back to regular search');
            return await searchPubs({
                query: query,
                searchType: 'all',
                page: 1
            });
        }
    };
    
    // Admin API calls (with auth token)
    const admin = {
        getValidationStats: async (token) => {
            try {
                const response = await fetchWithTimeout('/api/admin/validation-stats', {
                    headers: { 'Authorization': token }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('API: Admin stats error:', error);
                throw error;
            }
        },
        
        getPendingReviews: async (token) => {
            try {
                const response = await fetchWithTimeout('/api/admin/pending-manual-reviews', {
                    headers: { 'Authorization': token }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('API: Pending reviews error:', error);
                throw error;
            }
        },
        
        approveSubmission: async (token, submissionId, notes = '') => {
            try {
                const response = await fetchWithTimeout('/api/admin/approve-submission', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify({ 
                        submission_id: submissionId, 
                        admin_notes: notes 
                    })
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('API: Approve submission error:', error);
                throw error;
            }
        },
        
        rejectSubmission: async (token, submissionId, notes) => {
            try {
                const response = await fetchWithTimeout('/api/admin/reject-submission', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify({ 
                        submission_id: submissionId, 
                        admin_notes: notes 
                    })
                });
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('API: Reject submission error:', error);
                throw error;
            }
        }
    };
    
    // Public API
    return {
        getStats,
        searchPubs,
        searchPubsByBeer,
        findNearbyPubs,
        geocodePostcode,
        getPubSuggestions,
        getBreweries,
        getBreweryBeers,
        submitBeerReport,
        admin
    };
})();

// Make it globally available if needed
window.APIModule = APIModule;
