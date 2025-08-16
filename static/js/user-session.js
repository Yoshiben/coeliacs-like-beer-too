// ================================================================================
// USER-SESSION.JS - Complete User Management System
// Handles: UUID, nickname, points, achievements, session state
// ================================================================================

export const UserSession = (() => {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        uuid: null,
        userId: null,
        nickname: null,
        avatarEmoji: '🍺',
        points: 0,
        level: 1,
        badges: [],
        stats: {
            beersReported: 0,
            venuesAdded: 0,
            statusesUpdated: 0
        },
        isNewUser: false,
        initialized: false
    };
    
    // ================================
    // CORE FUNCTIONS
    // ================================
    
    const init = async () => {
        if (state.initialized) return getStatus();
        
        console.log('🔧 Initializing UserSession...');
        
        // Get or create UUID
        state.uuid = getOrCreateUUID();
        
        // Check age verification
        const ageStatus = checkAgeVerification();
        if (ageStatus !== 'verified') {
            return { status: 'need-age-verification' };
        }
        
        // Check for existing user
        const userStatus = await checkExistingUser();
        
        state.initialized = true;
        
        // Store in global state
        updateGlobalState();
        
        return userStatus;
    };
    
    const getOrCreateUUID = () => {
        let uuid = localStorage.getItem('userUUID');
        if (!uuid) {
            uuid = generateUUID();
            localStorage.setItem('userUUID', uuid);
            state.isNewUser = true;
        }
        return uuid;
    };
    
    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };
    
    const checkAgeVerification = () => {
        const ageVerified = localStorage.getItem('ageVerified');
        if (!ageVerified) return 'not-verified';
        
        const verifiedDate = new Date(ageVerified);
        const daysSince = (Date.now() - verifiedDate) / (1000 * 60 * 60 * 24);
        
        // Re-verify every 30 days
        if (daysSince > 30) {
            localStorage.removeItem('ageVerified');
            return 'expired';
        }
        
        return 'verified';
    };
    
    const checkExistingUser = async () => {
        try {
            const response = await fetch(`/api/user/get/${state.uuid}`);
            
            if (response.ok) {
                const userData = await response.json();
                
                // Populate state
                state.userId = userData.user_id;
                state.nickname = userData.nickname;
                state.avatarEmoji = userData.avatar_emoji;
                state.points = userData.points;
                state.level = userData.level;
                state.badges = userData.badges || [];
                state.stats = {
                    beersReported: userData.beers_reported,
                    venuesAdded: userData.venues_added,
                    statusesUpdated: userData.statuses_updated
                };
                
                // Update last active
                updateLastActive();
                
                return { 
                    status: 'returning-user',
                    user: getUserData()
                };
            } else if (response.status === 404) {
                // New user
                const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
                
                if (!hasSeenWelcome) {
                    return { status: 'need-onboarding' };
                } else {
                    return { status: 'anonymous' };
                }
            }
        } catch (error) {
            console.error('Error checking user:', error);
            return { status: 'anonymous' };
        }
    };
    
    const verifyAge = () => {
        localStorage.setItem('ageVerified', new Date().toISOString());
        console.log('✅ Age verified');
    };
    
    const createUser = async (nickname, avatarEmoji = '🍺') => {
        try {
            const response = await fetch('/api/user/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uuid: state.uuid,
                    nickname: nickname,
                    avatar_emoji: avatarEmoji
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create user');
            }
            
            const userData = await response.json();
            
            // Update state
            state.userId = userData.user_id;
            state.nickname = userData.nickname;
            state.avatarEmoji = avatarEmoji;
            state.points = userData.points || 10; // Welcome bonus!
            state.level = 1;
            state.badges = ['welcome'];
            
            // Mark welcome as seen
            localStorage.setItem('hasSeenWelcome', 'true');
            localStorage.setItem('userNickname', nickname);
            
            updateGlobalState();
            
            return {
                success: true,
                user: getUserData()
            };
            
        } catch (error) {
            console.error('Error creating user:', error);
            return {
                success: false,
                error: error.message
            };
        }
    };
    
    const checkNicknameAvailability = async (nickname) => {
        try {
            const response = await fetch(`/api/user/check-nickname?nickname=${encodeURIComponent(nickname)}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking nickname:', error);
            return { available: false, error: 'Network error' };
        }
    };
    
    const updateLastActive = async () => {
        if (!state.userId) return;
        
        try {
            await fetch(`/api/user/update-active/${state.uuid}`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Error updating last active:', error);
        }
    };
    
    const awardPoints = async (points, reason) => {
        if (!state.userId) return;
        
        state.points += points;
        updateGlobalState();
        
        // Show notification
        showPointsNotification(points, reason);
        
        // Update backend
        try {
            await fetch('/api/user/award-points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uuid: state.uuid,
                    points: points,
                    reason: reason
                })
            });
        } catch (error) {
            console.error('Error awarding points:', error);
        }
    };
    
    const showPointsNotification = (points, reason) => {
        const notification = document.createElement('div');
        notification.className = 'points-notification';
        notification.innerHTML = `
            <div class="points-animation">
                +${points} points
            </div>
            <div class="points-reason">${reason}</div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    };
    
    const updateGlobalState = () => {
        window.App?.setState('userUUID', state.uuid);
        window.App?.setState('userNickname', state.nickname);
        window.App?.setState('userPoints', state.points);
        window.App?.setState('userLevel', state.level);
        window.App?.setState('userBadges', state.badges);
    };
    
    const getUserData = () => ({
        uuid: state.uuid,
        userId: state.userId,
        nickname: state.nickname,
        avatarEmoji: state.avatarEmoji,
        points: state.points,
        level: state.level,
        badges: state.badges,
        stats: state.stats,
        isNewUser: state.isNewUser
    });
    
    const getStatus = () => {
        if (!state.initialized) return { status: 'not-initialized' };
        if (!state.nickname) return { status: 'anonymous' };
        return { status: 'authenticated', user: getUserData() };
    };
    
    const logout = () => {
        // Clear user data but keep UUID
        state.nickname = null;
        state.userId = null;
        state.points = 0;
        state.level = 1;
        state.badges = [];
        state.stats = {
            beersReported: 0,
            venuesAdded: 0,
            statusesUpdated: 0
        };
        
        localStorage.removeItem('userNickname');
        updateGlobalState();
        
        return { status: 'logged-out' };
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        verifyAge,
        createUser,
        checkNicknameAvailability,
        awardPoints,
        getUserData,
        getStatus,
        logout,
        
        // Quick getters
        get nickname() { return state.nickname; },
        get points() { return state.points; },
        get uuid() { return state.uuid; },
        get isAuthenticated() { return !!state.nickname; }
    };
})();
