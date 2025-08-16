// ================================================================================
// ONBOARDING.JS - Complete Onboarding Flow
// Handles: Age gate, welcome, nickname selection, community intro
// ================================================================================

import { UserSession } from './user-session.js';

export const OnboardingFlow = (() => {
    'use strict';
    
    const state = {
        currentStep: null,
        nickname: '',
        avatarEmoji: '🍺',
        nicknameCheckTimeout: null
    };
    
    // ================================
    // FLOW CONTROL
    // ================================
    
    const start = async () => {
        console.log('🚀 Starting onboarding flow...');
        
        const userStatus = await UserSession.init();
        console.log('User status:', userStatus);
        
        switch (userStatus.status) {
            case 'need-age-verification':
                showAgeGate();
                break;
                
            case 'need-onboarding':
                showWelcome();
                break;
                
            case 'returning-user':
                showWelcomeBack(userStatus.user);
                break;
                
            case 'anonymous':
                // User skipped nickname before
                console.log('Anonymous user');
                break;
                
            default:
                console.log('Ready to use app');
        }
    };
    
    // ================================
    // AGE GATE
    // ================================
    
    const showAgeGate = () => {
        const modal = createModal('ageGate', `
            <div class="age-gate-content">
                <div class="age-gate-logo">
                    <span class="logo-emoji">🍺</span>
                    <h1>Coeliacs Like Beer Too!</h1>
                </div>
                
                <div class="age-gate-message">
                    <h2>Hold up there, beer lover!</h2>
                    <p>This site contains content about alcoholic beverages.</p>
                    <p class="age-question">Are you 18 or over?</p>
                </div>
                
                <div class="age-gate-buttons">
                    <button class="btn btn-primary btn-large" onclick="OnboardingFlow.confirmAge()">
                        ✅ Yes, I'm 18 or over
                    </button>
                    <button class="btn btn-secondary" onclick="OnboardingFlow.underAge()">
                        ❌ Not yet
                    </button>
                </div>
                
                <div class="age-gate-legal">
                    <p>By entering this site you agree to our 
                       <a href="/terms" target="_blank">Terms</a> and 
                       <a href="/privacy" target="_blank">Privacy Policy</a>
                    </p>
                </div>
            </div>
        `, false); // Cannot close
        
        document.body.appendChild(modal);
    };
    
    const confirmAge = () => {
        UserSession.verifyAge();
        closeModal('ageGate');
        showWelcome();
    };
    
    const underAge = () => {
        window.location.href = 'https://www.google.com/search?q=best+non-alcoholic+drinks';
    };
    
    // ================================
    // WELCOME SCREEN
    // ================================
    
    const showWelcome = () => {
        const modal = createModal('welcome', `
            <div class="welcome-content">
                <button class="skip-btn" onclick="OnboardingFlow.skipWelcome()">Skip →</button>
                
                <div class="welcome-hero">
                    <span class="welcome-emoji">🎉</span>
                    <h1>Welcome to the UK's Biggest<br>GF Beer Community!</h1>
                </div>
                
                <div class="founder-section">
                    <div class="founder-message">
                        <p><strong>Hi there! I'm Ben, the founder of Coeliacs Like Beer Too!, and fellow coeliac.</strong></p>
                        <p>I decided to build this after one too many disappointing pub visits without gluten free options or where staff thought Corona was gluten free 😡.</p>
                        <p>Now, with YOUR help, we're mapping every venue serving GF in the UK! 🗺️</p>
                    </div>
                </div>
                
                <div class="stats-showcase">
                    <div class="stat-item">
                        <span class="stat-number">67,000+</span>
                        <span class="stat-label">Venues</span>
                    </div>
                    <div class="stat-item featured">
                        <span class="stat-number">32</span>
                        <span class="stat-label">With GF Beer</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">3+</span>
                        <span class="stat-label">Contributors</span>
                    </div>
                </div>
                
                <div class="features-grid">
                    <div class="feature-item">
                        <span class="feature-emoji">📍</span>
                        <span class="feature-text">Find GF beer near you</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-emoji">🍺</span>
                        <span class="feature-text">Report your finds</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-emoji">🏆</span>
                        <span class="feature-text">Earn points & badges</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-emoji">💪</span>
                        <span class="feature-text">Help the community</span>
                    </div>
                </div>
                
                <button class="btn btn-primary btn-hero" onclick="OnboardingFlow.showNicknameSelection()">
                    Join the Community! →
                </button>
            </div>
        `);
        
        document.body.appendChild(modal);
    };
    
    const skipWelcome = () => {
        localStorage.setItem('hasSeenWelcome', 'true');
        closeModal('welcome');
    };
    
    // ================================
    // NICKNAME SELECTION
    // ================================
    
    const showNicknameSelection = () => {
        closeModal('welcome');
        
        const modal = createModal('nickname', `
            <div class="nickname-content">
                <div class="nickname-header">
                    <h2>Choose Your Beer Name! 🍻</h2>
                    <p>This is how you'll be known in the community</p>
                </div>
                
                <div class="nickname-form">
                    <div class="input-group">
                        <input type="text" 
                               id="nicknameInput" 
                               placeholder="e.g. HopHunter, GFBeerGuru, MaltMaster..."
                               maxlength="30"
                               oninput="OnboardingFlow.checkNickname(this.value)">
                        <div class="input-status" id="nicknameStatus"></div>
                    </div>
                    
                    <div class="suggestions-section">
                        <p>Need inspiration? Try these:</p>
                        <div class="suggestion-chips">
                            <button class="chip" onclick="OnboardingFlow.generateRandom()">
                                🎲 Random
                            </button>
                            <button class="chip" onclick="OnboardingFlow.useNickname('BeerExplorer')">
                                BeerExplorer
                            </button>
                            <button class="chip" onclick="OnboardingFlow.useNickname('HopHunter')">
                                HopHunter
                            </button>
                            <button class="chip" onclick="OnboardingFlow.useNickname('GFGuru')">
                                GFGuru
                            </button>
                        </div>
                    </div>
                    
                    <div class="avatar-section">
                        <p>Choose your avatar:</p>
                        <div class="avatar-grid">
                            ${['🍺', '🍻', '⭐', '🎯', '🚀', '💪', '🏆', '🦄', '🎨', '🌟'].map(emoji => 
                                `<button class="avatar-option ${emoji === '🍺' ? 'active' : ''}" 
                                         onclick="OnboardingFlow.selectAvatar('${emoji}')">${emoji}</button>`
                            ).join('')}
                        </div>
                    </div>
                    
                    <div class="privacy-section">
                        <div class="privacy-item">✅ No email required</div>
                        <div class="privacy-item">✅ No personal data</div>
                        <div class="privacy-item">✅ Delete anytime</div>
                        <div class="privacy-item">✅ Just for fun!</div>
                    </div>
                </div>
                
                <div class="nickname-actions">
                    <button class="btn btn-secondary" onclick="OnboardingFlow.skipNickname()">
                        Skip for now
                    </button>
                    <button class="btn btn-primary" id="saveNicknameBtn" onclick="OnboardingFlow.saveNickname()" disabled>
                        Create Account!
                    </button>
                </div>
            </div>
        `);
        
        document.body.appendChild(modal);
    };
    
    const checkNickname = (value) => {
        clearTimeout(state.nicknameCheckTimeout);
        state.nickname = value;
        
        const statusEl = document.getElementById('nicknameStatus');
        const saveBtn = document.getElementById('saveNicknameBtn');
        
        if (value.length < 3) {
            statusEl.innerHTML = '<span class="status-error">Too short (min 3 chars)</span>';
            saveBtn.disabled = true;
            return;
        }
        
        if (value.length > 30) {
            statusEl.innerHTML = '<span class="status-error">Too long (max 30 chars)</span>';
            saveBtn.disabled = true;
            return;
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
            statusEl.innerHTML = '<span class="status-error">Only letters, numbers, _ and -</span>';
            saveBtn.disabled = true;
            return;
        }
        
        statusEl.innerHTML = '<span class="status-checking">Checking...</span>';
        
        state.nicknameCheckTimeout = setTimeout(async () => {
            const result = await UserSession.checkNicknameAvailability(value);
            
            if (result.available) {
                statusEl.innerHTML = '<span class="status-success">✅ Available!</span>';
                saveBtn.disabled = false;
            } else {
                statusEl.innerHTML = '<span class="status-error">❌ Already taken</span>';
                saveBtn.disabled = true;
                
                if (result.suggestions) {
                    showSuggestions(result.suggestions);
                }
            }
        }, 500);
    };

    // Add this function after checkNickname:

    const showSuggestions = (suggestions) => {
        // Find or create suggestions container
        let suggestionsContainer = document.getElementById('nicknameSuggestions');
        
        if (!suggestionsContainer) {
            // Create it if it doesn't exist
            const inputGroup = document.querySelector('.input-group');
            suggestionsContainer = document.createElement('div');
            suggestionsContainer.id = 'nicknameSuggestions';
            suggestionsContainer.className = 'nickname-suggestions-box';
            inputGroup.appendChild(suggestionsContainer);
        }
        
        // Display the suggestions
        suggestionsContainer.innerHTML = `
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.5rem 0;">
                That name is taken! Try one of these:
            </p>
            <div class="suggestion-chips">
                ${suggestions.map(suggestion => 
                    `<button class="chip" onclick="OnboardingFlow.useNickname('${suggestion}')">
                        ${suggestion}
                    </button>`
                ).join('')}
            </div>
        `;
        
        suggestionsContainer.style.display = 'block';
    };
    
    const generateRandom = () => {
        const prefixes = ['Beer', 'Hop', 'Malt', 'GF', 'Gluten', 'Free', 'Craft', 'Brew'];
        const suffixes = ['Hunter', 'Explorer', 'Master', 'Guru', 'Seeker', 'Finder', 'Champion'];
        const random = Math.floor(Math.random() * 99);
        
        const nickname = `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}${random}`;
        
        // THIS IS THE FIX - directly set value and trigger input event
        const nicknameInput = document.getElementById('nicknameInput');
        if (nicknameInput) {
            nicknameInput.value = nickname;
            // Manually trigger the check
            OnboardingFlow.checkNickname(nickname);
        }
    };
    
    const useNickname = (nickname) => {
        document.getElementById('nicknameInput').value = nickname;
        checkNickname(nickname);
    };
    
    const selectAvatar = (emoji) => {
        state.avatarEmoji = emoji;
        
        document.querySelectorAll('.avatar-option').forEach(btn => {
            btn.classList.remove('active');
        });
        
        event.target.classList.add('active');
    };
    
    const saveNickname = async () => {
        const saveBtn = document.getElementById('saveNicknameBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Creating account...';
        
        const result = await UserSession.createUser(state.nickname, state.avatarEmoji);
        
        if (result.success) {
            // Force remove the nickname modal RIGHT NOW
            const nicknameModal = document.getElementById('nicknameModal');
            if (nicknameModal) {
                nicknameModal.style.display = 'none';
                nicknameModal.remove();
            }
            
            // Also remove by class just in case
            document.querySelectorAll('.onboarding-modal').forEach(m => {
                if (m.querySelector('#nicknameInput')) {
                    m.remove();
                }
            });
            
            showCommunityBenefits(result.user);
        } else {
            alert(`Error: ${result.error}`);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Create Account!';
        }
    };
    
    const skipNickname = () => {
        localStorage.setItem('hasSeenWelcome', 'true');
        closeModal('nickname');
    };
    
    // ================================
    // COMMUNITY BENEFITS
    // ================================
    
    const showCommunityBenefits = (user) => {
        const modal = createModal('benefits', `
            <div class="benefits-content">
                <div class="success-header">
                    <div class="avatar-display">${user.avatarEmoji}</div>
                    <h2>Welcome, ${user.nickname}! 🎉</h2>
                    <p>You're now part of the GF beer revolution!</p>
                </div>
                
                <div class="welcome-bonus">
                    <div class="bonus-icon">🎁</div>
                    <div class="bonus-text">
                        <strong>Welcome Bonus!</strong>
                        <span>+10 points to get you started</span>
                    </div>
                </div>
                
                <div class="benefits-grid">
                    <div class="benefit">
                        <span class="benefit-icon">🏆</span>
                        <strong>Earn Points</strong>
                        <small>Get points for every contribution</small>
                    </div>
                    <div class="benefit">
                        <span class="benefit-icon">🎖️</span>
                        <strong>Unlock Badges</strong>
                        <small>Show off your achievements</small>
                    </div>
                    <div class="benefit">
                        <span class="benefit-icon">📊</span>
                        <strong>Track Impact</strong>
                        <small>See how many you've helped</small>
                    </div>
                    <div class="benefit">
                        <span class="benefit-icon">🎁</span>
                        <strong>Win Prizes</strong>
                        <small>Monthly rewards for top contributors!</small>
                    </div>
                </div>
                
                <div class="first-badge">
                    <p>You've earned your first badge!</p>
                    <div class="badge-showcase">
                        <span class="badge-icon">👋</span>
                        <div class="badge-info">
                            <strong>Welcome to the Club</strong>
                            <small>Joined the GF beer community</small>
                        </div>
                    </div>
                </div>
                
                <button class="btn btn-primary btn-hero" onclick="OnboardingFlow.finishOnboarding()">
                    Start Finding GF Beer! 🍺
                </button>
            </div>
        `);
        
        document.body.appendChild(modal);
    };
    
    const showWelcomeBack = (user) => {
        const toast = document.createElement('div');
        toast.className = 'welcome-back-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-avatar">${user.avatarEmoji}</span>
                <div class="toast-text">
                    <strong>Welcome back, ${user.nickname}!</strong>
                    <small>${user.points} points • Level ${user.level}</small>
                </div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    };
    
    const finishOnboarding = () => {
        // Nuclear option - remove ALL onboarding modals
        ['ageGateModal', 'welcomeModal', 'nicknameModal', 'benefitsModal'].forEach(id => {
            const modal = document.getElementById(id);
            if (modal) {
                modal.remove();
            }
        });
        
        // Also try class-based removal
        document.querySelectorAll('.onboarding-modal').forEach(modal => {
            modal.remove();
        });
        
        // Trigger any post-onboarding actions
        window.dispatchEvent(new Event('onboardingComplete'));
    };
    
    // ================================
    // MODAL HELPERS
    // ================================
    
    const createModal = (id, content, closeable = true) => {
        const modal = document.createElement('div');
        modal.id = `${id}Modal`;
        modal.className = 'onboarding-modal';
        modal.innerHTML = `
            <div class="onboarding-modal-content">
                ${closeable ? '<button class="modal-close" onclick="OnboardingFlow.closeModal(\'' + id + '\')">&times;</button>' : ''}
                ${content}
            </div>
        `;
        
        if (!closeable) {
            modal.style.pointerEvents = 'auto';
            modal.onclick = (e) => e.stopPropagation();
        }
        
        return modal;
    };
    
    const closeModal = (id) => {
        const modal = document.getElementById(`${id}Modal`);
        if (modal) {
            modal.remove();  // Just remove it completely
        }
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        start,
        confirmAge,
        underAge,
        showNicknameSelection,
        checkNickname,
        generateRandom,
        useNickname,
        selectAvatar,
        saveNickname,
        skipNickname,
        skipWelcome,
        finishOnboarding,
        closeModal
    };
})();

// Make available globally for onclick handlers
window.OnboardingFlow = OnboardingFlow;
