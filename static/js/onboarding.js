// ================================================================================
// ONBOARDING.JS - Updated with new modal class names
// Handles: Age gate, welcome, nickname selection, passcode display, sign-in
// ================================================================================

import { UserSession } from './user-session.js';

export const OnboardingFlow = (() => {
    'use strict';
    
    const state = {
        currentStep: null,
        nickname: '',
        avatarEmoji: '🍺',
        nicknameCheckTimeout: null,
        passcode: null,
        isReturningUser: false
    };
    
    // ================================
    // FLOW CONTROL
    // ================================
    
    const start = async () => {
        console.log('🚀 Starting onboarding flow...');
        
        const existingNickname = localStorage.getItem('userNickname');
        if (existingNickname) {
            console.log('✅ Existing user found:', existingNickname);
            
            // Just check age verification for existing users
            const ageVerified = localStorage.getItem('ageVerified');
            if (!ageVerified) {
                showAgeGate();
                return;
            }
            
            // User exists and age verified - we're done!
            return { status: 'existing-user', nickname: existingNickname };
        }
        
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
                
            case 'device-has-account':
                // Go straight to sign in with pre-filled nickname
                showSignInWithNickname(userStatus.existingNickname || '');
                break;
                
            case 'anonymous':
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
        const modal = document.getElementById('ageGateModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
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
        closeModal('ageGate');
        const modal = document.getElementById('welcomeModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    };
    
    const skipWelcome = () => {
        localStorage.setItem('hasSeenWelcome', 'true');
        closeModal('welcome');
        // Trigger onboarding complete event when skipping
        window.dispatchEvent(new Event('onboardingComplete'));
    };
    
    const skipNickname = () => {
        localStorage.setItem('hasSeenWelcome', 'true');
        closeModal('nickname');
        // Trigger onboarding complete event when skipping
        window.dispatchEvent(new Event('onboardingComplete'));
    };
    
    // ================================
    // NICKNAME SELECTION
    // ================================
    
    const showNicknameSelection = () => {
        closeModal('welcome');
        const modal = document.getElementById('nicknameModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            // Populate avatar grid if needed
            populateAvatarGrid();
        }
    };
    
    const populateAvatarGrid = () => {
        // Implementation for avatar grid if needed
        console.log('Avatar grid populated');
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
                showNicknameOptions(value, result.suggestions);
            }
        }, 500);
    };
    
    const showNicknameOptions = (nickname, suggestions) => {
        let optionsContainer = document.getElementById('nicknameOptions');
        
        if (!optionsContainer) {
            const inputGroup = document.querySelector('.input-group');
            optionsContainer = document.createElement('div');
            optionsContainer.id = 'nicknameOptions';
            optionsContainer.className = 'nickname-options-box';
            inputGroup.appendChild(optionsContainer);
        }
        
        optionsContainer.innerHTML = `
            <div class="nickname-taken-prompt">
                <p class="taken-message">
                    <strong>${nickname}</strong> is already taken!
                </p>
                
                <div class="taken-actions">
                    <button class="btn btn-primary btn-sm" onclick="OnboardingFlow.promptSignIn('${nickname}')">
                        🔑 This is me - Sign in
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="OnboardingFlow.clearNicknameOptions()">
                        ❌ Not me - Try another
                    </button>
                </div>
                
                ${suggestions && suggestions.length > 0 ? `
                    <div class="suggestions-alternative">
                        <p>Or try one of these:</p>
                        <div class="suggestion-chips">
                            ${suggestions.map(suggestion => 
                                `<button class="chip" onclick="OnboardingFlow.useNickname('${suggestion}')">
                                    ${suggestion}
                                </button>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        optionsContainer.style.display = 'block';
    };
    
    const clearNicknameOptions = () => {
        const optionsContainer = document.getElementById('nicknameOptions');
        if (optionsContainer) {
            optionsContainer.style.display = 'none';
        }
        
        const input = document.getElementById('nicknameInput');
        if (input) {
            input.value = '';
            input.focus();
        }
        
        const statusEl = document.getElementById('nicknameStatus');
        if (statusEl) {
            statusEl.innerHTML = '';
        }
    };
    
    const generateRandom = () => {
        const prefixes = ['Beer', 'Hop', 'Malt', 'GF', 'Gluten', 'Free', 'Craft', 'Brew'];
        const suffixes = ['Hunter', 'Explorer', 'Master', 'Guru', 'Seeker', 'Finder', 'Champion'];
        const random = Math.floor(Math.random() * 99);
        
        const nickname = `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}${random}`;
        
        const nicknameInput = document.getElementById('nicknameInput');
        if (nicknameInput) {
            nicknameInput.value = nickname;
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
            state.passcode = result.passcode;
            
            localStorage.setItem('userAuth', JSON.stringify({
                nickname: state.nickname,
                timestamp: Date.now()
            }));
            
            closeModal('nickname');
            
            // Check if we should return to community hub
            const shouldReturnToCommunity = window.App?.getState('returnToCommunityAfterNickname');
            
            if (shouldReturnToCommunity) {
                window.App?.setState('returnToCommunityAfterNickname', false);
                showPasscodeDisplayForCommunity(result);
            } else {
                showPasscodeDisplay(result);
            }
        } else if (result.error === 'account_exists') {
            alert(`This device already has an account: ${result.existing_nickname}. Please sign in with your passcode.`);
            closeModal('nickname');
            showSignInWithNickname(result.existing_nickname);
        } else {
            alert(`Error: ${result.error}`);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Create Account!';
        }
    };
    
    // ================================
    // SIGN IN - Rest of the functions remain the same
    // ================================
    
    const promptSignIn = (nickname) => {
        state.attemptedNickname = nickname;
        closeModal('nickname');
        showSignInWithNickname(nickname);
    };
    
    const showSignInWithNickname = (nickname) => {
        const modal = createModal('signIn', `
            <div class="signin-content">
                <div class="signin-header">
                    <h2>🔑 Welcome back${nickname ? `, ${nickname}` : ''}!</h2>
                    <p>Enter your passcode to sign in</p>
                </div>
                
                <div class="signin-form">
                    <div class="input-group">
                        <label>Nickname</label>
                        <input type="text" 
                               id="signInNickname" 
                               value="${nickname}"
                               ${nickname ? 'readonly style="background: #f5f5f5; cursor: not-allowed;"' : ''}
                               placeholder="Your nickname..."
                               maxlength="30">
                    </div>
                    
                    <div class="input-group">
                        <label>Passcode</label>
                        <input type="text" 
                               id="signInPasscode" 
                               placeholder="Enter your 6-character code"
                               maxlength="6"
                               style="text-transform: uppercase; letter-spacing: 0.2em; font-family: monospace;"
                               autofocus>
                        <small>Enter the passcode you received when creating your account</small>
                    </div>
                    
                    <div id="signInError" class="error-message" style="display: none;">
                        <span class="error-icon">⚠️</span>
                        <span class="error-text"></span>
                    </div>
                </div>
                
                <div class="signin-actions">
                    <button class="btn btn-secondary" onclick="OnboardingFlow.backToNickname()">
                        ← Try Different Name
                    </button>
                    <button class="btn btn-primary" id="signInBtn" onclick="OnboardingFlow.performSignIn()">
                        Sign In
                    </button>
                </div>
                
                <div class="signin-help">
                    <p><strong>Lost your passcode?</strong></p>
                    <small>Unfortunately, we can't recover it. You'll need to create a new account with a different nickname.</small>
                </div>
            </div>
        `);
        
        document.body.appendChild(modal);
        
        setTimeout(() => {
            document.getElementById('signInPasscode')?.focus();
        }, 100);
    };
    
    const backToNickname = () => {
        closeModal('signIn');
        showNicknameSelection();
        
        if (state.attemptedNickname) {
            setTimeout(() => {
                const input = document.getElementById('nicknameInput');
                if (input) {
                    input.value = '';
                    input.focus();
                }
            }, 100);
        }
    };
    
    const performSignIn = async () => {
        const nickname = document.getElementById('signInNickname')?.value.trim();
        const passcode = document.getElementById('signInPasscode')?.value.trim().toUpperCase();
        const signInBtn = document.getElementById('signInBtn');
        const errorDiv = document.getElementById('signInError');
        const errorText = errorDiv?.querySelector('.error-text');
        
        if (!nickname || !passcode) {
            if (errorDiv && errorText) {
                errorText.textContent = 'Please enter both nickname and passcode';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        if (passcode.length !== 6) {
            if (errorDiv && errorText) {
                errorText.textContent = 'Passcode must be 6 characters';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        if (signInBtn) {
            signInBtn.disabled = true;
            signInBtn.textContent = 'Signing in...';
        }
        
        try {
            const result = await UserSession.signIn(nickname, passcode);
            
            if (result.success) {
                localStorage.setItem('userAuth', JSON.stringify({
                    nickname: nickname,
                    timestamp: Date.now()
                }));
                
                try {
                    const statsResponse = await fetch(`/api/get-user-id/${nickname}`);
                    if (statsResponse.ok) {
                        const userData = await statsResponse.json();
                        
                        localStorage.setItem('user_id', userData.user_id);
                        localStorage.setItem('userNickname', nickname);
                        
                        window.App.setState('userId', userData.user_id);
                        window.App.setState('userPoints', userData.points || 0);
                        window.App.setState('userLevel', userData.level || 1);
                        
                        console.log('Loaded user stats:', userData);
                    }
                } catch (statsError) {
                    console.error('Failed to load user stats:', statsError);
                }
                
                ['signIn', 'nickname', 'welcome'].forEach(id => {
                    closeModal(id);
                });
                
                showWelcomeBack(result.user);
            } else {
                if (errorDiv && errorText) {
                    errorText.textContent = result.error || 'Sign in failed';
                    errorDiv.style.display = 'block';
                }
                
                if (signInBtn) {
                    signInBtn.disabled = false;
                    signInBtn.textContent = 'Sign In';
                }
            }
        } catch (error) {
            console.error('Sign in error:', error);
            if (errorDiv && errorText) {
                errorText.textContent = 'Sign in failed. Please try again.';
                errorDiv.style.display = 'block';
            }
            
            if (signInBtn) {
                signInBtn.disabled = false;
                signInBtn.textContent = 'Sign In';
            }
        }
    };
    
    // ================================
    // PASSCODE DISPLAY
    // ================================
    
    const showPasscodeDisplay = (result) => {
        const modal = createModal('passcodeDisplay', `
            <div class="passcode-display-content">
                <div class="passcode-header">
                    <div class="success-icon">🎉</div>
                    <h2>Account Created!</h2>
                    <p>Welcome, ${result.nickname}!</p>
                </div>
                
                <div class="passcode-section">
                    <h3>🔐 Your Secret Passcode</h3>
                    <div class="passcode-display">
                        <code id="passcodeValue">${result.passcode}</code>
                        <button class="btn btn-sm btn-outline" onclick="OnboardingFlow.copyPasscode()">
                            📋 Copy
                        </button>
                    </div>
                    
                    <div class="passcode-warning">
                        <p><strong>⚠️ IMPORTANT: Save this passcode!</strong></p>
                        <p>You'll need it to sign in on other devices or if you clear your browser data.</p>
                        <p style="color: var(--color-error);">We cannot recover lost passcodes!</p>
                    </div>
                    
                    <div class="passcode-actions">
                        <button class="btn btn-outline" onclick="OnboardingFlow.downloadPasscode('${result.nickname}', '${result.passcode}')">
                            💾 Download as Text File
                        </button>
                        <button class="btn btn-outline" onclick="OnboardingFlow.sharePasscode('${result.nickname}', '${result.passcode}')">
                            📤 Share to Myself
                        </button>
                    </div>
                </div>
                
                <div class="passcode-confirm">
                    <label class="checkbox-label">
                        <input type="checkbox" id="passcodeConfirmCheck">
                        <span>I've saved my passcode somewhere safe</span>
                    </label>
                </div>
                
                <button class="btn btn-primary btn-hero" id="continueFromPasscode" onclick="OnboardingFlow.confirmPasscodeSaved()" disabled>
                    Continue to Community Benefits →
                </button>
            </div>
        `, false);
        
        document.body.appendChild(modal);
        
        document.getElementById('passcodeConfirmCheck')?.addEventListener('change', (e) => {
            const continueBtn = document.getElementById('continueFromPasscode');
            if (continueBtn) {
                continueBtn.disabled = !e.target.checked;
            }
        });
    };
    
    const showPasscodeDisplayForCommunity = (result) => {
        const modal = createModal('passcodeDisplay', `
            <div class="passcode-display-content">
                <div class="passcode-header">
                    <div class="success-icon">🎉</div>
                    <h2>Account Created!</h2>
                    <p>Welcome, ${result.nickname}!</p>
                </div>
                
                <div class="passcode-section">
                    <h3>🔐 Your Secret Passcode</h3>
                    <div class="passcode-display">
                        <code id="passcodeValue">${result.passcode}</code>
                        <button class="btn btn-sm btn-outline" onclick="OnboardingFlow.copyPasscode()">
                            📋 Copy
                        </button>
                    </div>
                    
                    <div class="passcode-warning">
                        <p><strong>⚠️ IMPORTANT: Save this passcode!</strong></p>
                        <p>You'll need it to sign in on other devices or if you clear your browser data.</p>
                        <p style="color: var(--color-error);">We cannot recover lost passcodes!</p>
                    </div>
                    
                    <div class="passcode-actions">
                        <button class="btn btn-outline" onclick="OnboardingFlow.downloadPasscode('${result.nickname}', '${result.passcode}')">
                            💾 Download as Text File
                        </button>
                        <button class="btn btn-outline" onclick="OnboardingFlow.sharePasscode('${result.nickname}', '${result.passcode}')">
                            📤 Share to Myself
                        </button>
                    </div>
                </div>
                
                <div class="passcode-confirm">
                    <label class="checkbox-label">
                        <input type="checkbox" id="passcodeConfirmCheck">
                        <span>I've saved my passcode somewhere safe</span>
                    </label>
                </div>
                
                <button class="btn btn-primary btn-hero" id="continueFromPasscode" onclick="OnboardingFlow.confirmPasscodeSavedAndReturnToCommunity()" disabled>
                    Continue to Community Hub →
                </button>
            </div>
        `, false);
        
        document.body.appendChild(modal);
        
        document.getElementById('passcodeConfirmCheck')?.addEventListener('change', (e) => {
            const continueBtn = document.getElementById('continueFromPasscode');
            if (continueBtn) {
                continueBtn.disabled = !e.target.checked;
            }
        });
    };
    
    // Copy, download, share passcode functions remain the same
    const copyPasscode = () => {
        const passcodeEl = document.getElementById('passcodeValue');
        if (passcodeEl) {
            navigator.clipboard.writeText(passcodeEl.textContent)
                .then(() => {
                    const btn = event.target;
                    const originalText = btn.textContent;
                    btn.textContent = '✅ Copied!';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                    alert('Failed to copy. Please select and copy manually.');
                });
        }
    };
    
    const downloadPasscode = (nickname, passcode) => {
        const content = `Coeliacs Like Beer Too! - Account Details
========================================

Nickname: ${nickname}
Passcode: ${passcode}

IMPORTANT: Keep this file safe!
You'll need this passcode to sign in on other devices.

Website: https://coeliacslikebeer.co.uk

Thank you for joining our community!
`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CLB_Account_${nickname}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };
    
    const sharePasscode = (nickname, passcode) => {
        const text = `My Coeliacs Like Beer Too! Account:\n\nNickname: ${nickname}\nPasscode: ${passcode}\n\nSave this for signing in on other devices!`;
        
        if (navigator.share) {
            navigator.share({
                title: 'CLB Account Details',
                text: text
            }).catch(err => console.log('Share cancelled:', err));
        } else {
            navigator.clipboard.writeText(text)
                .then(() => alert('Account details copied to clipboard!'))
                .catch(() => alert('Please copy your passcode manually'));
        }
    };
    
    const confirmPasscodeSaved = () => {
        const user = {
            nickname: state.nickname,
            avatarEmoji: state.avatarEmoji,
            points: 10
        };
        
        closeModal('passcodeDisplay');
        showCommunityBenefits(user);
    };
    
    const confirmPasscodeSavedAndReturnToCommunity = () => {
        closeModal('passcodeDisplay');
        
        localStorage.setItem('userNickname', state.nickname);
        window.App?.setState('userNickname', state.nickname);
        
        setTimeout(() => {
            const communityHub = window.App?.getModule('communityHub');
            if (communityHub) {
                communityHub.open();
            }
        }, 500);
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
                        <span class="benefit-icon">📱</span>
                        <strong>Sync Devices</strong>
                        <small>Access your account anywhere!</small>
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
    
    // ================================
    // WELCOME BACK TOAST
    // ================================
    
    const showWelcomeBack = async (user) => {
        // Load user stats
        try {
            const nickname = user.nickname || localStorage.getItem('userNickname');
            if (nickname) {
                const response = await fetch(`/api/get-user-id/${nickname}`);
                if (response.ok) {
                    const userData = await response.json();
                    user.points = userData.points || 0;
                    user.level = userData.level || 1;
                    
                    // Update app state
                    window.App?.setState('userPoints', user.points);
                    window.App?.setState('userLevel', user.level);
                }
            }
        } catch (error) {
            console.error('Failed to load user stats for toast:', error);
        }
        
        const welcomeFrequency = localStorage.getItem('welcomeFrequency') || 'session';
        const lastWelcome = localStorage.getItem('lastWelcomeShown');
        const now = Date.now();
        
        let shouldShow = false;
        
        if (!lastWelcome) {
            shouldShow = true;
        } else {
            const hoursSince = (now - parseInt(lastWelcome)) / (1000 * 60 * 60);
            
            switch(welcomeFrequency) {
                case 'always':
                    shouldShow = false;
                    break;
                case 'session':
                    shouldShow = !sessionStorage.getItem('welcomeShown');
                    break;
                case 'daily':
                    shouldShow = hoursSince > 24;
                    break;
                case 'weekly':
                    shouldShow = hoursSince > 168;
                    break;
            }
        }
        
        if (shouldShow) {
            const toast = document.createElement('div');
            toast.className = 'welcome-back-toast';
            toast.innerHTML = `
                <div class="toast-content">
                    <span class="toast-avatar">${user.avatarEmoji || '🍺'}</span>
                    <div class="toast-text">
                        <strong>Welcome back, ${user.nickname}!</strong>
                        <small>${user.points || 0} points • Level ${user.level || 1}</small>
                    </div>
                </div>
            `;
            
            document.body.appendChild(toast);
            
            setTimeout(() => toast.classList.add('show'), 100);
            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 500);
            }, 3000);
            
            localStorage.setItem('lastWelcomeShown', now.toString());
            sessionStorage.setItem('welcomeShown', 'true');
        }
    };
    
    // ================================
    // FINISH
    // ================================
    
    const finishOnboarding = () => {
        // Remove all onboarding modals
        ['ageGate', 'welcome', 'nickname', 'benefits', 'passcodeDisplay', 'signIn'].forEach(id => {
            const modal = document.getElementById(`${id}Modal`);
            if (modal) modal.remove();
        });
        
        // UPDATED: Use the new class names
        document.querySelectorAll('.modal-overlay.onboarding-specific').forEach(modal => {
            modal.remove();
        });
        
        window.dispatchEvent(new Event('onboardingComplete'));
    };
    
    // ================================
    // UTILITIES  - UPDATED WITH NEW CLASS NAMES
    // ================================
    
    const createModal = (id, content, closeable = true) => {
        const modal = document.createElement('div');
        modal.id = `${id}Modal`;
        // UPDATED: Use new class names
        modal.className = 'modal-overlay onboarding-specific';
        modal.innerHTML = `
            <div class="modal-container ${id}-container">
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
            modal.remove();
        }
    };
    
    // ================================
    // PUBLIC API
    // ================================
    return {
        start,
        confirmAge,
        underAge,
        showWelcome,
        skipWelcome,
        showNicknameSelection,
        checkNickname,
        generateRandom,
        useNickname,
        selectAvatar,
        saveNickname,
        skipNickname,
        promptSignIn,
        showSignInWithNickname,
        backToNickname,
        performSignIn,
        clearNicknameOptions,
        copyPasscode,
        downloadPasscode,
        sharePasscode,
        confirmPasscodeSaved,
        confirmPasscodeSavedAndReturnToCommunity,
        showPasscodeDisplayForCommunity,
        finishOnboarding,
        closeModal
    };
})();

// Make available globally for onclick handlers
window.OnboardingFlow = OnboardingFlow;
