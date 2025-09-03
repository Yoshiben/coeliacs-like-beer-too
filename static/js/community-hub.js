// ================================================================================
// COMMUNITY-HUB.JS - Community & Gamification System (FIXED)
// Handles: Points, badges, leaderboards, impact tracking, shop integration
// ================================================================================

import { Constants } from './constants.js';
const STATE_KEYS = Constants.STATE_KEYS;

export const CommunityHubModule = (() => {
    'use strict';
    
    // ================================
    // PRIVATE STATE
    // ================================
    const state = {
        userProfile: null,
        leaderboard: [],
        achievements: [],
        currentView: 'impact', // impact | leaderboard | breweries | challenges
        pointsAnimation: null
    };
    
    // Points configuration
    const POINTS_CONFIG = {
        VENUE_UPDATE: 10,
        BEER_REPORT: 15,
        STATUS_UPDATE: 5,
        STATUS_CONFIRM: 2,
        NEW_VENUE: 10,
        DAILY_STREAK: 5,
        MILESTONE_MULTIPLIER: 2
    };
    
    // Achievement definitions
    const ACHIEVEMENTS = {
        FIRST_UPDATE: { id: 'first_update', name: 'First Steps', icon: '👶', points: 10 },
        TEN_UPDATES: { id: 'ten_updates', name: 'Regular Contributor', icon: '⭐', points: 50 },
        FIFTY_UPDATES: { id: 'fifty_updates', name: 'Community Hero', icon: '🦸', points: 100 },
        HUNDRED_UPDATES: { id: 'hundred_updates', name: 'GF Legend', icon: '👑', points: 200 },
        WEEK_STREAK: { id: 'week_streak', name: 'Week Warrior', icon: '🔥', points: 30 },
        LOCAL_HERO: { id: 'local_hero', name: 'Local Hero', icon: '📍', points: 75 }
    };
    
    // Level thresholds
    const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2500, 3500, 5000, 7500, 10000];
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get api() { return window.App?.getModule('api'); },
        get modalManager() { return window.App?.getModule('modalManager'); },
        get helpers() { return window.App?.getModule('helpers'); },
        get tracking() { return window.App?.getModule('tracking'); },
        get toast() { return window.App?.getModule('toast'); }
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🏆 Initializing Community Hub...');
        
        loadUserProfile();
        setupEventListeners();
        checkForAchievements();
        
        console.log('✅ Community Hub initialized');
    };

    // ================================
    // HELPER FUNCTIONS
    // ================================
    const setupEventListeners = () => {
        // Just a placeholder for now - will add real listeners when needed
        console.log('✅ Community Hub event listeners setup');
    };
    
    const animatePointsChange = (oldPoints, newPoints) => {
        // Simple animation placeholder
        console.log(`Points: ${oldPoints} → ${newPoints}`);
    };
    
    const showLevelUpNotification = (level) => {
        modules.toast?.success(`🎉 Level ${level} reached!`);
    };
    
    const getLevelName = (level) => {
        const names = ['Newbie', 'Explorer', 'Regular', 'Enthusiast', 'Expert', 'Master', 'Legend', 'Mythic'];
        return names[level - 1] || 'Unknown';
    };
    
    const calculateProgress = () => {
        if (!state.userProfile) return 0;
        
        const currentLevel = state.userProfile.level;
        const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1] || 0;
        const nextThreshold = LEVEL_THRESHOLDS[currentLevel] || 10000;
        
        const progress = ((state.userProfile.points - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
        return Math.min(Math.max(progress, 0), 100);
    };
    
    const calculatePointsToNext = () => {
        if (!state.userProfile) return 0;
        
        const nextThreshold = LEVEL_THRESHOLDS[state.userProfile.level] || 10000;
        return Math.max(0, nextThreshold - state.userProfile.points);
    };
    
    const getTotalUpdates = () => {
        if (!state.userProfile) return 0;
        const updates = state.userProfile.updates;
        return updates.venues + updates.beers + updates.statuses;
    };
    
    // ================================
    // USER PROFILE MANAGEMENT
    // ================================
    const loadUserProfile = () => {
        // Get nickname from state or localStorage
        const nickname = window.App.getState('userNickname') || 
                        localStorage.getItem('userNickname');
        
        if (!nickname) {
            state.userProfile = null;
            return;
        }
        
        // Load stats from localStorage
        const savedStats = localStorage.getItem(`communityStats_${nickname}`);
        
        if (savedStats) {
            state.userProfile = JSON.parse(savedStats);
        } else {
            // Create new profile
            state.userProfile = {
                nickname: nickname,
                points: 0,
                level: 1,
                updates: {
                    venues: 0,
                    beers: 0,
                    statuses: 0
                },
                achievements: [],
                joinedDate: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                streak: 0
            };
            saveUserProfile();
        }
        
        console.log('👤 User profile loaded:', state.userProfile);
    };
    
    const saveUserProfile = () => {
        if (!state.userProfile) return;
        
        localStorage.setItem(
            `communityStats_${state.userProfile.nickname}`,
            JSON.stringify(state.userProfile)
        );
    };
    
    // ================================
    // POINTS SYSTEM
    // ================================
    const addPoints = (action, metadata = {}) => {
        if (!state.userProfile) {
            console.log('No user profile for points');
            return;
        }
        
        let pointsToAdd = POINTS_CONFIG[action] || 0;
        
        // Apply multipliers
        if (metadata.firstTime) pointsToAdd *= 2;
        if (metadata.milestone) pointsToAdd *= POINTS_CONFIG.MILESTONE_MULTIPLIER;
        
        const oldPoints = state.userProfile.points;
        state.userProfile.points += pointsToAdd;
        
        // Check for level up
        const oldLevel = state.userProfile.level;
        state.userProfile.level = calculateLevel(state.userProfile.points);
        
        if (state.userProfile.level > oldLevel) {
            showLevelUpNotification(state.userProfile.level);
        }
        
        // Update UI with animation
        animatePointsChange(oldPoints, state.userProfile.points);
        
        // Save profile
        saveUserProfile();
        
        // Track event
        modules.tracking?.trackEvent('points_earned', 'Gamification', action, pointsToAdd);
        
        console.log(`🎯 Added ${pointsToAdd} points for ${action}`);
    };
    
    const calculateLevel = (points) => {
        for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
            if (points >= LEVEL_THRESHOLDS[i]) {
                return i + 1;
            }
        }
        return 1;
    };
    
    // ================================
    // ACHIEVEMENTS
    // ================================
    const checkForAchievements = () => {
        if (!state.userProfile) return;
        
        const updates = state.userProfile.updates;
        const venueCount = updates.venues || 0;
        
        // Check each achievement
        Object.values(ACHIEVEMENTS).forEach(achievement => {
            if (state.userProfile.achievements.includes(achievement.id)) return;
            
            let earned = false;
            
            switch(achievement.id) {
                case 'first_update':
                    earned = venueCount >= 1;
                    break;
                case 'ten_updates':
                    earned = venueCount >= 10;
                    break;
                case 'fifty_updates':
                    earned = venueCount >= 50;
                    break;
                case 'hundred_updates':
                    earned = venueCount >= 100;
                    break;
                case 'week_streak':
                    earned = state.userProfile.streak >= 7;
                    break;
                case 'local_hero':
                    earned = updates.venues >= 25;
                    break;
            }
            
            if (earned) {
                unlockAchievement(achievement);
            }
        });
    };
    
    const unlockAchievement = (achievement) => {
        state.userProfile.achievements.push(achievement.id);
        state.userProfile.points += achievement.points;
        
        saveUserProfile();
        showAchievementNotification(achievement);
        
        modules.tracking?.trackEvent('achievement_unlocked', 'Gamification', achievement.id);
    };
    
    // ================================
    // UI RENDERING
    // ================================
    const renderOnboarding = (container) => {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <h2>👋 Welcome to the Community Hub!</h2>
                <p>Set a nickname to start tracking your contributions</p>
                <button class="btn btn-primary" data-action="open-onboarding-nickname">Set Nickname</button>
            </div>
        `;
    };
    
    const renderHub = () => {
        const container = document.getElementById('communityHubContent');
        if (!container) return;
        
        if (!state.userProfile) {
            renderOnboarding(container);
            return;
        }
        
        container.innerHTML = `
            <!-- Combined Level Banner with Stats (no separate header) -->
            <div class="level-banner">
                <div class="floating-beer">🍺</div>
                <div class="floating-beer">🍺</div>
                <div class="floating-beer">🍺</div>
                <div class="level-content">
                    <!-- User info in top right -->
                    <div class="level-user-info">
                        <span class="username">${state.userProfile.nickname}</span>
                    </div>
                    
                    <div class="level-header">
                        <div class="level-title">Level ${state.userProfile.level}: ${getLevelName(state.userProfile.level)}</div>
                        <div class="level-stats">
                            <span class="stat-bubble">${state.userProfile.points} pts</span>
                            <span class="stat-bubble">${state.userProfile.updates.venues || 0} venues</span>
                        </div>
                    </div>
                    <div class="level-progress">
                        <div class="level-fill" style="width: ${calculateProgress()}%"></div>
                    </div>
                    <div class="level-text">${calculatePointsToNext()} points to next level • Keep going!</div>
                </div>
            </div>
            
            <div class="section-tabs">
                <button class="tab ${state.currentView === 'impact' ? 'active' : ''}" 
                        data-hub-tab="impact">📊 My Impact</button>
                <button class="tab ${state.currentView === 'leaderboard' ? 'active' : ''}" 
                        data-hub-tab="leaderboard">🏆 Leaderboard</button>
                <button class="tab ${state.currentView === 'challenges' ? 'active' : ''}" 
                        data-hub-tab="challenges">🎯 Challenges</button>
                <button class="tab ${state.currentView === 'badges' ? 'active' : ''}" 
                        data-hub-tab="badges">🏅 Badges</button>
            </div>

            <!-- Tab content area -->
            <div id="hubTabContent">
                ${renderTabContent()}
            </div>
        `;
        
        // Attach tab listeners
        container.querySelectorAll('[data-hub-tab]').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.hubTab));
        });
    };
    
    const renderTabContent = () => {
        switch(state.currentView) {
            case 'impact':
                return renderImpactTab();
            case 'leaderboard':
                return renderLeaderboardTab();
            case 'badges':
                return renderBadgesTab();
            case 'challenges':
                return renderChallengesTab();
            default:
                return renderImpactTab();
        }
    };
    
    const renderImpactTab = () => {
        // Use the data we already loaded
        const updates = state.userProfile.updates;
        
        // Find user's rank from leaderboard  
        let userRank = '?';
        const userIndex = state.leaderboard.findIndex(u => 
            u.nickname === state.userProfile.nickname
        );
        if (userIndex !== -1) {
            userRank = userIndex + 1;
        }
        
        return `
            <div class="impact-grid">
                <div class="impact-card">
                    <div class="impact-icon">📍</div>
                    <div class="impact-number">${updates.venues || 0}</div>
                    <div class="impact-label">Venues</div>
                </div>
                <div class="impact-card">
                    <div class="impact-icon">🍺</div>
                    <div class="impact-number">${updates.beers || 0}</div>
                    <div class="impact-label">Beers</div>
                </div>
                <div class="impact-card">
                    <div class="impact-icon">✅</div>
                    <div class="impact-number">${updates.statuses || 0}</div>
                    <div class="impact-label">Updates</div>
                </div>
                <div class="impact-card" data-action="switch-to-leaderboard">
                    <div class="impact-icon">🏆</div>
                    <div class="impact-number">#${userRank}</div>
                    <div class="impact-label">Rank</div>
                </div>
            </div>
        `;
    };
    
    const renderLeaderboardTab = () => {
        return `
            <div class="leaderboard-section">
                <div class="leaderboard-header">
                    <div class="leaderboard-title">🏆 Community Champions</div>
                </div>
                <div class="leaderboard-list">
                    ${state.leaderboard.map((user, index) => {
                        const isCurrentUser = user.nickname === state.userProfile?.nickname;
                        return `
                            <div class="leader-row ${isCurrentUser ? 'you' : ''}">
                                <div class="rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">${index + 1}</div>
                                <div class="leader-info">
                                    <div class="leader-name">${user.nickname} ${isCurrentUser ? '(You)' : ''}</div>
                                    <div class="leader-stats">
                                        ${user.beer_reports > 0 ? `🍺 ${user.beer_reports}` : ''}
                                        ${user.status_updates > 0 ? `✅ ${user.status_updates}` : ''}
                                        ${user.venues_touched > 0 ? `📍 ${user.venues_touched}` : ''}
                                    </div>
                                </div>
                                <div class="leader-points">${user.points} pts</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    };
    
    const renderBadgesTab = () => {
        const allBadges = [
            { id: 'first_steps', name: 'First Steps', icon: '👶', description: 'Update your first venue', earned: state.userProfile.achievements.includes('first_update') },
            { id: 'regular', name: 'Regular', icon: '⭐', description: 'Update 10 venues', earned: state.userProfile.achievements.includes('ten_updates') },
            { id: 'explorer', name: 'Explorer', icon: '🗺️', description: 'Update 25 venues', earned: state.userProfile.achievements.includes('fifty_updates') },
            { id: 'legend', name: 'GF Legend', icon: '👑', description: 'Update 50 venues', earned: state.userProfile.achievements.includes('hundred_updates') },
            { id: 'nightowl', name: 'Night Owl', icon: '🦉', description: 'Update after midnight', earned: false },
            { id: 'early_bird', name: 'Early Bird', icon: '🐦', description: 'Update before 6am', earned: false },
            { id: 'streak_week', name: 'Week Warrior', icon: '🔥', description: '7 day streak', earned: state.userProfile.achievements.includes('week_streak') },
        ];
        
        return `
            <div class="badges-section">
                <h3>🏅 Your Badge Collection</h3>
                <div class="badges-grid">
                    ${allBadges.map(badge => `
                        <div class="badge-card ${badge.earned ? 'earned' : 'locked'}">
                            <div class="badge-icon">${badge.icon}</div>
                            <div class="badge-name">${badge.name}</div>
                            <div class="badge-description">${badge.description}</div>
                            ${badge.earned ? '<div class="badge-status">✅ Earned</div>' : '<div class="badge-status">🔒 Locked</div>'}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };
    
    const renderChallengesTab = () => {
        return `
            <div class="challenges-section">
                <h3>🎯 Weekly Challenges</h3>
                <p style="padding: 1rem; text-align: center;">Coming soon!</p>
            </div>
        `;
    };
    
    const switchTab = (tabName) => {
        state.currentView = tabName;
        
        // Load leaderboard data when switching to that tab
        if (tabName === 'leaderboard' && state.leaderboard.length === 0) {
            loadLeaderboard();
        }
        
        const contentEl = document.getElementById('hubTabContent');
        if (contentEl) {
            contentEl.innerHTML = renderTabContent();
        }
        
        // Update active tab
        document.querySelectorAll('[data-hub-tab]').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.hubTab === tabName);
        });
    };
    
    const getMockLeaderboard = () => {
        return [
            { nickname: 'GlutenFreeGuru', updates: 142, points: 1847 },
            { nickname: 'CoeliacExplorer', updates: 98, points: 1523 },
            { nickname: 'BeerMapper', updates: 87, points: 1290 },
            { nickname: state.userProfile?.nickname || 'You', updates: 23, points: 452 }
        ];
    };
    
    // ================================
    // API CALLS
    // ================================
    const loadUserStats = async () => {
    if (!state.userProfile?.nickname) return;
    
    try {
        const response = await fetch(`/api/community/my-stats/${encodeURIComponent(state.userProfile.nickname)}`);
        const data = await response.json();
        
        if (data.success) {
            // Update everything from single source
            state.userProfile = {
                ...state.userProfile,
                points: data.stats.points,
                level: data.stats.level,
                updates: {
                    venues: data.stats.venues_updated,
                    beers: data.stats.beers_reported,
                    statuses: data.stats.status_updates,
                    confirmations: data.stats.status_confirmations
                }
            };
            
            saveUserProfile();
            renderHub();
        }
    } catch (error) {
        console.error('Failed to load user stats:', error);
    }
};
    
    const loadLeaderboard = async () => {
        console.log('📊 Loading leaderboard...');
        try {
            const response = await fetch('/api/community/leaderboard');
            console.log('Response status:', response.status);
            
            const data = await response.json();
            console.log('Leaderboard data:', data);
            
            if (data.success) {
                state.leaderboard = data.leaderboard;
                console.log('📊 Loaded real leaderboard:', state.leaderboard);
                
                // Re-render current tab
                const contentEl = document.getElementById('hubTabContent');
                if (contentEl) {
                    contentEl.innerHTML = renderTabContent();
                }
            } else {
                console.error('API returned success: false', data);
                state.leaderboard = getMockLeaderboard();
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            state.leaderboard = getMockLeaderboard();
        }
    };
    
    // ================================
    // NOTIFICATIONS
    // ================================
    const showAchievementNotification = (achievement) => {
        // Use toast module for achievement notifications
        modules.toast?.success(`${achievement.icon} ${achievement.name}! +${achievement.points} points`);
    };
    
    // ================================
    // MAIN OPEN FUNCTION
    // ================================
    const open = () => {
        modules.modalManager?.open('communityHubOverlay', {
            onOpen: async () => {
                renderHub();  // Show loading state
                
                // Load both in parallel
                await Promise.all([
                    loadUserStats(),
                    loadLeaderboard()
                ]);
                
                // Everything is loaded, render final state
                renderHub();
            }
        });
    };

    const close = () => {
        console.log('🏆 Closing Community Hub');
        
        // Reset to home context
        const navModule = window.App?.getModule('nav');
        if (navModule) {
            navModule.setPageContext('home');
        }
        
        modules.modalManager?.close('communityHubOverlay');
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        open,
        close,
        addPoints,
        switchTab,
        trackAction: (action, metadata) => {
            // Called when user performs actions
            if (!state.userProfile) return;
            
            // Update counts
            switch(action) {
                case 'VENUE_UPDATE':
                    state.userProfile.updates.venues++;
                    break;
                case 'BEER_REPORT':
                    state.userProfile.updates.beers++;
                    break;
                case 'STATUS_UPDATE':
                    state.userProfile.updates.statuses++;
                    break;
            }
            
            // Add points
            addPoints(action, metadata);
            
            // Check achievements
            checkForAchievements();
            
            // Save
            saveUserProfile();
        },
        getUserProfile: () => state.userProfile,
        isUserActive: () => !!state.userProfile
    };
})();
