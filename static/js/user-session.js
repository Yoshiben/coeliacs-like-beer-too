// ================================================================================
// USER-SESSION.JS - Complete User Management with Passcode Authentication
// Handles: UUID, nickname, passcode auth, points, achievements, multi-device sync
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
        initialized: false,
        isAuthenticated: false
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
        
        // Check for existing user on this device
        const userStatus = await checkDeviceUser();
        
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
    
    const checkDeviceUser = async () => {
        try {
            // First check if device UUID has an account
            const response = await fetch(`/api/user/check-device/${state.uuid}`);
            const deviceData = await response.json();
            
            if (deviceData.has_account) {
                // This device has created an account before
                // Check if we have stored auth
                const storedAuth = localStorage.getItem('userAuth');
                
                if (storedAuth) {
                    // Try to auto-authenticate
                    const authData = JSON.parse(storedAuth);
                    
                    // Verify the stored auth is still valid
                    const userResponse = await fetch(`/api/user/get/${state.uuid}`);
                    
                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        
                        // Populate state
                        state.userId = userData.user_id;
                        state.nickname = userData.nickname;
                        state.avatarEmoji = userData.avatar_emoji || '🍺';
                        state.points = userData.points || 0;
                        state.level = userData.level || 1;
                        state.badges = userData.badges || [];
                        state.isAuthenticated = true;
                        
                        updateLastActive();
                        
                        return { 
                            status: 'returning-user',
                            user: getUserData()
                        };
                    }
                }
                
                // Device has account but no stored auth
                return { 
                    status: 'device-has-account',
                    nickname: deviceData.nickname
                };
            } else {
                // New user or signed in from different device
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
            
            const userData = await response.json();
            
            if (!response.ok) {
                // Handle different error types
                if (response.status === 409 && userData.error === 'account_exists') {
                    return {
                        success: false,
                        error: 'account_exists',
                        existing_nickname: userData.existing_nickname
                    };
                }
                
                throw new Error(userData.error || 'Failed to create user');
            }
            
            // Update state with new user data
            state.userId = userData.user_id;
            state.nickname = userData.nickname;
            state.avatarEmoji = avatarEmoji;
            state.points = userData.points || 10;
            state.level = 1;
            state.badges = ['welcome'];
            state.isAuthenticated = true;
            
            // Mark welcome as seen
            localStorage.setItem('hasSeenWelcome', 'true');
            localStorage.setItem('userNickname', nickname);
            
            updateGlobalState();
            
            return {
                success: true,
                user: getUserData(),
                passcode: userData.passcode,  // Return passcode for display
                nickname: userData.nickname,
                points: userData.points
            };
            
        } catch (error) {
            console.error('Error creating user:', error);
            return {
                success: false,
                error: error.message
            };
        }
    };
    
    const signIn = async (nickname, passcode) => {
        try {
            const response = await fetch('/api/user/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname: nickname,
                    passcode: passcode,
                    uuid: state.uuid  // Link this device to the account
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                return {
                    success: false,
                    error: result.error || 'Sign in failed'
                };
            }
            
            // Update state with user data
            state.userId = result.user.user_id;
            state.nickname = result.user.nickname;
            state.avatarEmoji = result.user.avatar_emoji || '🍺';
            state.points = result.user.points || 0;
            state.level = result.user.level || 1;
            state.badges = result.user.badges || [];
            state.stats = {
                beersReported: result.user.beers_reported || 0,
                venuesAdded: result.user.venues_added || 0,
                statusesUpdated: result.user.statuses_updated || 0
            };
            state.isAuthenticated = true;
            
            // Store nickname locally
            localStorage.setItem('userNickname', nickname);
            localStorage.setItem('hasSeenWelcome', 'true');
            
            updateGlobalState();
            
            return {
                success: true,
                user: getUserData(),
                message: result.message
            };
            
        } catch (error) {
            console.error('Error signing in:', error);
            return {
                success: false,
                error: 'Network error. Please try again.'
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
        if (!state.userId || !state.isAuthenticated) return;
        
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
        window.App?.setState('isAuthenticated', state.isAuthenticated);
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
        isNewUser: state.isNewUser,
        isAuthenticated: state.isAuthenticated
    });
    
    const getStatus = () => {
        if (!state.initialized) return { status: 'not-initialized' };
        if (!state.isAuthenticated) return { status: 'anonymous' };
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
        state.isAuthenticated = false;
        
        // Clear stored auth
        localStorage.removeItem('userNickname');
        localStorage.removeItem('userAuth');
        
        updateGlobalState();
        
        return { status: 'logged-out' };
    };
    
    const changePasscode = async (currentPasscode) => {
        if (!state.nickname || !state.isAuthenticated) {
            return { success: false, error: 'Not authenticated' };
        }
        
        try {
            const response = await fetch('/api/user/reset-passcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname: state.nickname,
                    current_passcode: currentPasscode
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                return {
                    success: false,
                    error: result.error || 'Failed to reset passcode'
                };
            }
            
            return {
                success: true,
                new_passcode: result.new_passcode,
                message: result.message
            };
            
        } catch (error) {
            console.error('Error resetting passcode:', error);
            return {
                success: false,
                error: 'Network error. Please try again.'
            };
        }
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        verifyAge,
        createUser,
        signIn,
        checkNicknameAvailability,
        awardPoints,
        getUserData,
        getStatus,
        logout,
        changePasscode,
        
        // Quick getters
        get nickname() { return state.nickname; },
        get points() { return state.points; },
        get uuid() { return state.uuid; },
        get isAuthenticated() { return state.isAuthenticated; }
    };
})();
