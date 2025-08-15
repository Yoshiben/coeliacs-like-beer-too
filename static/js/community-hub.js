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
        // Level thresholds
        const thresholds = [0, 100, 250, 500, 1000, 2000, 5000, 10000];
        
        for (let i = thresholds.length - 1; i >= 0; i--) {
            if (points >= thresholds[i]) {
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
    const open = () => {
        console.log('🏆 Opening Community Hub');
        
        modules.modalManager?.open('communityHubOverlay', {
            onOpen: () => {
                renderHub();
                loadLeaderboard();
            }
        });
    };
    
    const renderHub = () => {
        const container = document.getElementById('communityHubContent');
        if (!container) return;
        
        if (!state.userProfile) {
            renderOnboarding(container);
            return;
        }
        
        container.innerHTML = `
            <!-- Header -->
            <div class="community-header">
                <div class="header-content">
                    <div class="user-summary">
                        <div class="user-greeting">👋 Hey, ${state.userProfile.nickname}!</div>
                        <div class="user-stats">
                            <div class="stat-item">
                                <span class="stat-value">${state.userProfile.points}</span>
                                <span class="stat-label">points</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">Level ${state.userProfile.level}</span>
                                <span class="stat-label">${getLevelName(state.userProfile.level)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Level Progress -->
            ${renderLevelProgress()}
            
            <!-- Tabs -->
            <div class="section-tabs">
                <button class="tab ${state.currentView === 'impact' ? 'active' : ''}" 
                        data-hub-tab="impact">📊 My Impact</button>
                <button class="tab ${state.currentView === 'leaderboard' ? 'active' : ''}" 
                        data-hub-tab="leaderboard">🏆 Leaderboard</button>
                <button class="tab ${state.currentView === 'breweries' ? 'active' : ''}" 
                        data-hub-tab="breweries">🍺 Breweries</button>
                <button class="tab ${state.currentView === 'challenges' ? 'active' : ''}" 
                        data-hub-tab="challenges">🎯 Challenges</button>
            </div>
            
            <!-- Dynamic Content Area -->
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
            case 'breweries':
                return renderBreweriesTab();
            case 'challenges':
                return renderChallengesTab();
            default:
                return renderImpactTab();
        }
    };
    
    const renderImpactTab = () => {
        const updates = state.userProfile.updates;
        
        return `
            <div class="impact-grid">
                <div class="impact-card" data-action="view-impact-details" data-type="venues">
                    <div class="impact-icon">📍</div>
                    <div class="impact-number">${updates.venues}</div>
                    <div class="impact-label">Venues Updated</div>
                </div>
                <div class="impact-card" data-action="view-impact-details" data-type="beers">
                    <div class="impact-icon">🍺</div>
                    <div class="impact-number">${updates.beers}</div>
                    <div class="impact-label">Beers Reported</div>
                </div>
                <div class="impact-card" data-action="view-impact-details" data-type="statuses">
                    <div class="impact-icon">✅</div>
                    <div class="impact-number">${updates.statuses}</div>
                    <div class="impact-label">Status Updates</div>
                </div>
                <div class="impact-card">
                    <div class="impact-icon">🏆</div>
                    <div class="impact-number">${state.userProfile.achievements.length}</div>
                    <div class="impact-label">Achievements</div>
                </div>
            </div>
            
            ${renderRecentAchievements()}
        `;
    };
    
    // ================================
    // LEADERBOARD
    // ================================
    const loadLeaderboard = async () => {
        try {
            const response = await fetch('/api/community/leaderboard');
            const data = await response.json();
            
            if (data.success) {
                state.leaderboard = data.leaderboard;
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            // Use mock data for now
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
