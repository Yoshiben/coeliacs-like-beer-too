// ================================================================================
// COMMUNITY-HUB.JS - Simplified Version Using API as Single Source of Truth
// ================================================================================

import { Constants } from './constants.js';

export const CommunityHubModule = (() => {
    'use strict';
    
    // ================================
    // STATE
    // ================================
    const state = {
        userProfile: null,
        leaderboard: [],
        currentView: 'impact'
    };
    
    // Level thresholds matching your SQL view
    const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2500, 3500, 5000, 7500, 10000];
    
    const LEVEL_NAMES = ['Newbie', 'Explorer', 'Regular', 'Enthusiast', 'Expert', 'Master', 'Legend', 'Mythic', 'Titan', 'Oracle', 'Sage', 'Elder', 'Immortal'];
    
    // ================================
    // MODULES
    // ================================
    const modules = {
        get modalManager() { return window.App?.getModule('modalManager'); },
        get toast() { return window.App?.getModule('toast'); },
        get nav() { return window.App?.getModule('nav'); }
    };
    
    // ================================
    // INITIALIZATION
    // ================================
    const init = () => {
        console.log('🏆 Community Hub initialized');
    };
    
    // ================================
    // API CALLS
    // ================================
    const loadUserStats = async () => {
        const nickname = window.App.getState('userNickname') || localStorage.getItem('userNickname');
        if (!nickname) return;
        
        try {
            const response = await fetch(`/api/community/my-stats/${encodeURIComponent(nickname)}`);
            const data = await response.json();
            
            if (data.success) {
                state.userProfile = {
                    nickname: nickname,
                    points: data.stats.points || 0,
                    level: data.stats.level || 1,
                    updates: {
                        beers: data.stats.beers_reported || 0,
                        statuses: data.stats.status_updates || 0,
                        venues: data.stats.venues_updated || 0,
                        venues_added: data.stats.venues_added || 0,
                        confirmations: data.stats.status_confirmations || 0
                    }
                };
            }
        } catch (error) {
            console.error('Failed to load user stats:', error);
        }
    };
    
    const loadLeaderboard = async () => {
        try {
            const response = await fetch('/api/community/leaderboard');
            const data = await response.json();
            
            if (data.success) {
                state.leaderboard = data.leaderboard || [];
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    };
    
    // ================================
    // CALCULATIONS
    // ================================
    const getLevelName = (level) => LEVEL_NAMES[level - 1] || 'Unknown';
    
    const calculateProgress = () => {
        if (!state.userProfile) return 0;
        
        const level = state.userProfile.level;
        const points = state.userProfile.points;
        const currentThreshold = LEVEL_THRESHOLDS[level - 1];
        const nextThreshold = LEVEL_THRESHOLDS[level] || 99999;
        
        return ((points - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    };
    
    const calculatePointsToNext = () => {
        if (!state.userProfile) return 0;
        
        const level = state.userProfile.level;
        const points = state.userProfile.points;
        const nextThreshold = LEVEL_THRESHOLDS[level] || 99999;
        
        return Math.max(0, nextThreshold - points);
    };
    
    const getUserRank = () => {
        if (!state.userProfile || !state.leaderboard.length) return '?';
        
        const index = state.leaderboard.findIndex(u => 
            u.nickname === state.userProfile.nickname
        );
        return index === -1 ? '?' : index + 1;
    };
    
    // ================================
    // RENDERING
    // ================================
    const renderHub = () => {
        const container = document.getElementById('communityHubContent');
        if (!container) return;
        
        if (!state.userProfile) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <h2>👋 Welcome to the Community Hub!</h2>
                    <p>Set a nickname to start tracking your contributions</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="level-banner">
                <div class="floating-beer">🍺</div>
                <div class="floating-beer">🍺</div>
                <div class="floating-beer">🍺</div>
                <div class="level-content">
                    <div class="level-user-info">
                        <span class="username">${state.userProfile.nickname}</span>
                    </div>
                    
                    <div class="level-header">
                        <div class="level-title">Level ${state.userProfile.level}: ${getLevelName(state.userProfile.level)}</div>
                        <div class="level-stats">
                            <span class="stat-bubble">${state.userProfile.points} pts</span>
                            <span class="stat-bubble">${state.userProfile.updates.venues} venues</span>
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
            case 'impact': return renderImpactTab();
            case 'leaderboard': return renderLeaderboardTab();
            case 'challenges': return renderChallengesTab();
            case 'badges': return renderBadgesTab();
            default: return renderImpactTab();
        }
    };

    const renderChallengesTab = () => `
        <div class="challenges-section">
            <h3>🎯 Weekly Challenges</h3>
            <p style="padding: 1rem; text-align: center;">Coming soon!</p>
        </div>
    `;
    
    const renderBadgesTab = () => {
        const updates = state.userProfile.updates;
        const totalUpdates = updates.beers + updates.statuses + updates.venues;
        
        const badges = [
            { id: 'first_steps', name: 'First Steps', icon: '👶', description: 'Make your first update', earned: totalUpdates >= 1 },
            { id: 'regular', name: 'Regular', icon: '⭐', description: 'Make 10 updates', earned: totalUpdates >= 10 },
            { id: 'explorer', name: 'Explorer', icon: '🗺️', description: 'Update 25 venues', earned: updates.venues >= 25 },
            { id: 'beer_hunter', name: 'Beer Hunter', icon: '🍺', description: 'Report 50 beers', earned: updates.beers >= 50 },
            { id: 'status_hero', name: 'Status Hero', icon: '✅', description: '100 status updates', earned: updates.statuses >= 100 },
            { id: 'legend', name: 'GF Legend', icon: '👑', description: 'Reach level 10', earned: state.userProfile.level >= 10 },
            { id: 'community_champion', name: 'Champion', icon: '🏆', description: 'Top 10 leaderboard', earned: getUserRank() <= 10 }
        ];
        
        return `
            <div class="badges-section">
                <h3>🏅 Your Badge Collection</h3>
                <div class="badges-grid">
                    ${badges.map(badge => `
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
    
    const switchTab = (tabName) => {
        state.currentView = tabName;
        document.getElementById('hubTabContent').innerHTML = renderTabContent();
        
        document.querySelectorAll('[data-hub-tab]').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.hubTab === tabName);
        });
    };
    
    const renderImpactTab = () => {
        const updates = state.userProfile.updates;
        
        return `
            <div class="impact-grid">
                <div class="impact-card">
                    <div class="impact-icon">🍺</div>
                    <div class="impact-number">${updates.beers}</div>
                    <div class="impact-label">Beers</div>
                </div>
                <div class="impact-card">
                    <div class="impact-icon">✅</div>
                    <div class="impact-number">${updates.statuses}</div>
                    <div class="impact-label">Updates</div>
                </div>
                <div class="impact-card">
                    <div class="impact-icon">📍</div>
                    <div class="impact-number">${updates.venues}</div>
                    <div class="impact-label">Venues</div>
                </div>
                <div class="impact-card">
                    <div class="impact-icon">🏆</div>
                    <div class="impact-number">#${getUserRank()}</div>
                    <div class="impact-label">Rank</div>
                </div>
            </div>
        `;
    };
    
    const renderLeaderboardTab = () => `
        <div class="leaderboard-section">
            <div class="leaderboard-header">
                <div class="leaderboard-title">🏆 Community Champions</div>
            </div>
            <div class="leaderboard-list">
                ${state.leaderboard.map((user, index) => `
                    <div class="leader-row ${user.nickname === state.userProfile?.nickname ? 'you' : ''}">
                        <div class="rank ${index < 3 ? ['gold','silver','bronze'][index] : ''}">${index + 1}</div>
                        <div class="leader-info">
                            <div class="leader-name">${user.nickname} ${user.nickname === state.userProfile?.nickname ? '(You)' : ''}</div>
                            <div class="leader-stats">
                                🍺 ${user.beer_reports} ✅ ${user.status_updates} 📍 ${user.venues_touched}
                            </div>
                        </div>
                        <div class="leader-points">${user.points} pts</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // ================================
    // PUBLIC API
    // ================================
    const open = () => {
        modules.modalManager?.open('communityHubOverlay', {
            onOpen: async () => {
                renderHub(); // Show loading state
                await Promise.all([loadUserStats(), loadLeaderboard()]);
                renderHub(); // Re-render with data
            }
        });
    };
    
    return {
        init,
        open,
        close: () => modules.modalManager?.close('communityHubOverlay'),
        refresh: async () => {
            await Promise.all([loadUserStats(), loadLeaderboard()]);
            renderHub();
        }
    };
})();
