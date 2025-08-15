// ================================================================================
// COMMUNITY-HUB.JS - Community & Gamification System
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
        NEW_VENUE: 25,
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
    
    // ================================
    // MODULE GETTERS
    // ================================
    const modules = {
        get api() { return window.App?.getModule('api'); },
        get modalManager() { return window.App?.getModule('modalManager'); },
        get helpers() { return window.App?.getModule('helpers'); },
        get tracking() { return window.App?.getModule('tracking'); }
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
    // MISSING FUNCTIONS TO ADD
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
        modules.helpers?.showSuccessToast(`🎉 Level ${level} reached!`);
    };
    
    const getLevelName = (level) => {
        const names = ['Newbie', 'Explorer', 'Regular', 'Enthusiast', 'Expert', 'Master', 'Legend', 'Mythic'];
        return names[level - 1] || 'Unknown';
    };
    
    const renderLevelProgress = () => {
        if (!state.userProfile) return '';
        
        const currentLevel = state.userProfile.level;
        const thresholds = [0, 100, 250, 500, 1000, 2000, 5000, 10000];
        const currentThreshold = thresholds[currentLevel - 1];
        const nextThreshold = thresholds[currentLevel] || 10000;
        const progress = ((state.userProfile.points - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
        
        return `
            <div class="level-banner">
                <div class="level-header">
                    <div class="level-title">Level ${currentLevel}: ${getLevelName(currentLevel)}</div>
                    <div class="level-badge">Next: ${getLevelName(currentLevel + 1)}</div>
                </div>
                <div class="level-progress">
                    <div class="level-fill" style="width: ${progress}%"></div>
                </div>
                <div class="level-text">${nextThreshold - state.userProfile.points} points to next level</div>
            </div>
        `;
    };
    
    const renderOnboarding = (container) => {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <h2>👋 Welcome to the Community Hub!</h2>
                <p>Set a nickname to start tracking your contributions</p>
                <button class="btn btn-primary" data-action="save-nickname">Set Nickname</button>
            </div>
        `;
    };
    
    const renderRecentAchievements = () => {
        if (!state.userProfile || state.userProfile.achievements.length === 0) {
            return '<p style="padding: 1rem; text-align: center; color: var(--text-secondary);">No achievements yet - keep contributing!</p>';
        }
        
        return `
            <div class="achievements-grid">
                ${state.userProfile.achievements.map(id => {
                    const achievement = ACHIEVEMENTS[id.toUpperCase()];
                    return achievement ? `
                        <div class="achievement-badge">
                            <span>${achievement.icon}</span>
                            <span>${achievement.name}</span>
                        </div>
                    ` : '';
                }).join('')}
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
                    ${state.leaderboard.map((user, index) => `
                        <div class="leader-row ${user.nickname === state.userProfile?.nickname ? 'you' : ''}">
                            <div class="rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">${index + 1}</div>
                            <div class="leader-info">
                                <div class="leader-name">${user.nickname} ${user.nickname === state.userProfile?.nickname ? '(You)' : ''}</div>
                                <div class="leader-stats">
                                    ${user.beer_reports > 0 ? `🍺 ${user.beer_reports} beers` : ''}
                                    ${user.status_updates > 0 ? `✅ ${user.status_updates} updates` : ''}
                                    ${user.venues_touched > 0 ? `📍 ${user.venues_touched} venues` : ''}
                                </div>
                            </div>
                            <div class="leader-points">${user.points} pts</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };
    
    const renderBreweriesTab = () => {
        return `
            <div class="breweries-section">
                <div class="breweries-header">
                    <div class="breweries-title">🤝 Partner Breweries</div>
                    <div class="breweries-subtitle">Support the breweries that support our community</div>
                </div>
                <div class="brewery-cards">
                    <div class="brewery-card">
                        <div class="brewery-logo">🌾</div>
                        <div class="brewery-name">Coming Soon!</div>
                        <div class="brewery-meta">We're partnering with GF breweries</div>
                    </div>
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
        // More spread out levels
        const thresholds = [
            0,      // Level 1: 0
            50,     // Level 2: 50
            150,    // Level 3: 150
            300,    // Level 4: 300
            500,    // Level 5: 500
            800,    // Level 6: 800
            1200,   // Level 7: 1200
            1700,   // Level 8: 1700
            2500,   // Level 9: 2500
            3500,   // Level 10: 3500
            5000,   // Level 11: 5000
            7500,   // Level 12: 7500
            10000   // Level 13: 10000
        ];
        
        for (let i = thresholds.length - 1; i >= 0; i--) {
            if (points >= thresholds[i]) {
                return i + 1;
            }
        }
        return 1;
    };
    
    // Also update calculatePointsToNext and calculateProgress to use the same thresholds
    const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2500, 3500, 5000, 7500, 10000];
    
    const calculateProgress = () => {
        if (!state.userProfile) return 0;
        
        const currentLevel = state.userProfile.level;
        const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1] || 0;
        const nextThreshold = LEVEL_THRESHOLDS[currentLevel] || 10000;
        
        const progress = ((state.userProfile.points - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
        return Math.min(Math.max(progress, 0), 100);
    };
    
    // ================================
    // ACHIEVEMENTS
    // ================================
    const checkForAchievements = () => {
        if (!state.userProfile) return;
        
        const updates = state.userProfile.updates;
        const totalUpdates = updates.venues + updates.beers + updates.statuses;
        
        // Check each achievement
        Object.values(ACHIEVEMENTS).forEach(achievement => {
            if (state.userProfile.achievements.includes(achievement.id)) return;
            
            let earned = false;
            
            switch(achievement.id) {
                case 'first_update':
                    earned = totalUpdates >= 1;
                    break;
                case 'ten_updates':
                    earned = totalUpdates >= 10;
                    break;
                case 'fifty_updates':
                    earned = totalUpdates >= 50;
                    break;
                case 'hundred_updates':
                    earned = totalUpdates >= 100;
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
    const renderHub = () => {
        const container = document.getElementById('communityHubContent');
        if (!container) return;
        
        if (!state.userProfile) {
            renderOnboarding(container);
            return;
        }
        
        container.innerHTML = `
            <!-- Level Banner -->
            <div class="level-banner">
                <div class="floating-beer">🍺</div>
                <div class="floating-beer">🍺</div>
                <div class="floating-beer">🍺</div>
                <div class="level-content">
                    <div class="level-user-info">
                        <span class="username">${state.userProfile.nickname}</span>
                        <button class="change-nickname-btn" data-action="change-nickname">✏️</button>
                    </div>
                    
                    <div class="level-header">
                        <div class="level-title">Level ${state.userProfile.level}: ${getLevelName(state.userProfile.level)}</div>
                        <div class="level-stats">
                            <span class="stat-bubble">${state.userProfile.points} pts</span>
                            <span class="stat-bubble">${getTotalUpdates()} updates</span>
                        </div>
                    </div>
                    <div class="level-progress">
                        <div class="level-fill" style="width: ${calculateProgress()}%"></div>
                    </div>
                    <div class="level-text">${calculatePointsToNext()} points to next level</div>
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

    const renderBadgesTab = () => {
        const allBadges = [
            { id: 'first_steps', name: 'First Steps', icon: '👶', description: 'Make your first contribution', earned: state.userProfile.achievements.includes('first_update') },
            { id: 'regular', name: 'Regular', icon: '⭐', description: '10 contributions', earned: state.userProfile.achievements.includes('ten_updates') },
            { id: 'hero', name: 'Local Hero', icon: '🦸', description: '50 contributions', earned: state.userProfile.achievements.includes('fifty_updates') },
            { id: 'legend', name: 'GF Legend', icon: '👑', description: '100 contributions', earned: state.userProfile.achievements.includes('hundred_updates') },
            { id: 'explorer', name: 'Explorer', icon: '🗺️', description: 'Update 25 different venues', earned: false },
            { id: 'nightowl', name: 'Night Owl', icon: '🦉', description: 'Update after midnight', earned: false },
            { id: 'early_bird', name: 'Early Bird', icon: '🐦', description: 'Update before 6am', earned: false },
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
    
    // Update renderTabContent to include badges
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

    const getTotalUpdates = () => {
        if (!state.userProfile) return 0;
        const updates = state.userProfile.updates;
        return updates.venues + updates.beers + updates.statuses;
    };

    
    
    
    const calculatePointsToNext = () => {
        if (!state.userProfile) return 0;
        
        const thresholds = [0, 100, 250, 500, 1000, 2000, 5000, 10000];
        const nextThreshold = thresholds[state.userProfile.level] || 10000;
        
        return Math.max(0, nextThreshold - state.userProfile.points);
    };
    
    const loadUserStats = async () => {
        if (!state.userProfile?.nickname) return;
        
        console.log('📊 Loading stats for:', state.userProfile.nickname);
        
        try {
            const response = await fetch(`/api/community/my-stats/${encodeURIComponent(state.userProfile.nickname)}`);
            const data = await response.json();
            
            console.log('📊 Raw stats response:', data);
            
            if (data.success) {
                // Update the profile with real data - CHECK THESE PROPERTY NAMES!
                state.userProfile.updates = {
                    venues: data.stats.venues_updated || 0,
                    beers: data.stats.beers_reported || 0,
                    statuses: data.stats.status_updates || 0
                };
                state.userProfile.points = data.stats.points || 0;
                
                console.log('📊 Updated profile:', state.userProfile);
                
                // Recalculate level based on real points
                state.userProfile.level = calculateLevel(data.stats.points);
                
                // Save and re-render
                saveUserProfile();
                
                // Force re-render of everything
                renderHub();
                
                console.log('✅ Stats loaded and rendered');
            }
        } catch (error) {
            console.error('Failed to load user stats:', error);
        }
    };
    
    // Update the open function to load real stats
    const open = () => {
        console.log('🏆 Opening Community Hub');
        
        // Clean up any lingering toasts
        document.querySelectorAll('.toast').forEach(toast => {
            toast.remove();
        });

        // Also hide the loading toast if it's stuck
        const loadingToast = document.getElementById('loadingToast');
        if (loadingToast) {
            loadingToast.style.display = 'none';
        }
        
        modules.modalManager?.open('communityHubOverlay', {
            onOpen: () => {
                renderHub();
                loadUserStats();  // Load real user stats!
                loadLeaderboard();
            }
        });
    };
    
    // Update renderImpactTab to show real numbers
    const renderImpactTab = () => {
        const updates = state.userProfile.updates;
        
        // Find user's rank from leaderboard
        let userRank = '?';
        if (state.leaderboard && state.leaderboard.length > 0) {
            const rankIndex = state.leaderboard.findIndex(user => 
                user.nickname === state.userProfile.nickname
            );
            if (rankIndex !== -1) {
                userRank = rankIndex + 1;
            }
        }
        
        return `
            <div class="impact-grid">
                <div class="impact-card" data-action="view-impact-details" data-type="venues">
                    <div class="impact-icon">📍</div>
                    <div class="impact-number">${updates.venues || 0}</div>
                    <div class="impact-label">Venues Updated</div>
                </div>
                <div class="impact-card" data-action="view-impact-details" data-type="beers">
                    <div class="impact-icon">🍺</div>
                    <div class="impact-number">${updates.beers || 0}</div>
                    <div class="impact-label">Beers Reported</div>
                </div>
                <div class="impact-card" data-action="view-impact-details" data-type="statuses">
                    <div class="impact-icon">✅</div>
                    <div class="impact-number">${updates.statuses || 0}</div>
                    <div class="impact-label">Status Updates</div>
                </div>
                <div class="impact-card" data-action="switch-to-leaderboard">
                    <div class="impact-icon">🏆</div>
                    <div class="impact-number">#${userRank}</div>
                    <div class="impact-label">Your Rank</div>
                </div>
            </div>
        `;
};
    
    // ================================
    // LEADERBOARD
    // ================================
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
                
                // Re-render current tab (could be impact OR leaderboard)
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
        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-text">
                    <div class="achievement-title">${achievement.name}!</div>
                    <div class="achievement-desc">+${achievement.points} points</div>
                </div>
                <button class="close-achievement" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        setTimeout(() => popup.remove(), 5000);
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        init,
        open,
        addPoints,
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
