// ================================================================================
// ONBOARDING.JS - Complete Onboarding Flow with Passcode Authentication
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
                // Check if this device has the user's passcode stored
                const hasStoredAuth = localStorage.getItem('userAuth');
                if (hasStoredAuth) {
                    showWelcomeBack(userStatus.user);
                } else {
                    // Device not linked - show sign in
                    showSignInPrompt();
                }
                break;
                
            case 'device-has-account':
                // This device created an account but may need to sign in again
                showSignInPrompt();
                break;
                
            case 'anonymous':
                console.log('Anonymous user');
                break;
                
            default:
                console.log('Ready to use app');
        }
    };
    
    // ================================
    // AGE GATE (unchanged)
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
        `, false);
        
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
    // SIGN IN PROMPT (NEW)
    // ================================
    
    const showSignInPrompt = () => {
        const modal = createModal('signInPrompt', `
            <div class="signin-prompt-content">
                <div class="signin-header">
                    <span class="signin-emoji">🔐</span>
                    <h2>Welcome Back!</h2>
                    <p>Sign in to access your account or create a new one</p>
                </div>
                
                <div class="signin-options">
                    <button class="btn btn-primary btn-large" onclick="OnboardingFlow.showSignIn()">
                        🔑 I have an account
                    </button>
                    <button class="btn btn-success btn-large" onclick="OnboardingFlow.showWelcome()">
                        ✨ Create new account
                    </button>
                    <button class="btn btn-outline" onclick="OnboardingFlow.skipSignIn()">
                        Skip for now →
                    </button>
                </div>
                
                <div class="signin-benefits">
                    <p>With an account you can:</p>
                    <ul>
                        <li>✅ Track your contributions</li>
                        <li>🏆 Earn points and badges</li>
                        <li>📱 Sync across devices</li>
                        <li>💾 Save your favorite venues</li>
                    </ul>
                </div>
            </div>
        `);
        
        document.body.appendChild(modal);
    };
    
    // ================================
    // SIGN IN MODAL (NEW)
    // ================================
    
    const showSignIn = () => {
        closeModal('signInPrompt');
        
        const modal = createModal('signIn', `
            <div class="signin-content">
                <div class="signin-header">
                    <h2>🔑 Sign In</h2>
                    <p>Enter your nickname and passcode</p>
                </div>
                
                <div class="signin-form">
                    <div class="input-group">
                        <label>Nickname</label>
                        <input type="text" 
                               id="signInNickname" 
                               placeholder="Your nickname..."
                               maxlength="30">
                    </div>
                    
                    <div class="input-group">
                        <label>Passcode</label>
                        <input type="text" 
                               id="signInPasscode" 
                               placeholder="6-character code"
                               maxlength="6"
                               style="text-transform: uppercase; letter-spacing: 0.2em; font-family: monospace;">
                        <small>Enter the 6-character passcode you received when creating your account</small>
                    </div>
                    
                    <div id="signInError" class="error-message" style="display: none;">
                        <span class="error-icon">⚠️</span>
                        <span class="error-text"></span>
                    </div>
                </div>
                
                <div class="signin-actions">
                    <button class="btn btn-secondary" onclick="OnboardingFlow.showSignInPrompt()">
                        ← Back
                    </button>
                    <button class="btn btn-primary" id="signInBtn" onclick="OnboardingFlow.performSignIn()">
                        Sign In
                    </button>
                </div>
                
                <div class="signin-help">
                    <p>Lost your passcode?</p>
                    <small>Unfortunately, without email we can't recover it. You'll need to create a new account.</small>
                </div>
            </div>
        `);
        
        document.body.appendChild(modal);
        
        // Auto-focus nickname field
        setTimeout(() => {
            document.getElementById('signInNickname')?.focus();
        }, 100);
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
        
        // Show loading
        if (signInBtn) {
            signInBtn.disabled = true;
            signInBtn.textContent = 'Signing in...';
        }
        
        try {
            const result = await UserSession.signIn(nickname, passcode);
            
            if (result.success) {
                // Store auth locally for this device
                localStorage.setItem('userAuth', JSON.stringify({
                    nickname: nickname,
                    timestamp: Date.now()
                }));
                
                // Close ALL possible modals
                ['signIn', 'nickname', 'signInPrompt', 'welcome'].forEach(id => {
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
    
    const skipSignIn = () => {
        localStorage.setItem('hasSeenWelcome', 'true');
        closeModal('signInPrompt');
    };
    
    // ================================
    // WELCOME SCREEN (mostly unchanged)
    // ================================
    
    const showWelcome = () => {
        // Close any existing modals first
        ['signInPrompt', 'signIn'].forEach(id => {
            const modal = document.getElementById(`${id}Modal`);
            if (modal) modal.remove();
        });
        
        const modal = createModal('welcome', `
            <div class="welcome-content">
                <button class="skip-btn" onclick="OnboardingFlow.skipWelcome()">Skip →</button>
                
                <div class="welcome-hero">
                    <span class="welcome-emoji">🎉</span>
                    <h1>Welcome to the UK's Biggest<br>GF Beer Community!</h1>
                </div>
                
                <div class="founder-section">
                    <div class="founder-message">
                        <p><strong>Hi there! I'm Ben, the founder of Coeliacs Like Beer Too, and fellow coeliac.</strong></p>
                        <p>I decided to build this web-app after one too many disappointing pub visits with no gf beer, or someone told me Corona was gluten free 😡.</p>
                        <p>Now, with YOUR help, we're mapping every venue serving GF in the UK! 🗺️</p>
                    </div>
                </div>
                
                <div class="stats-showcase">
                    <div class="stat-item">
                        <span class="stat-number">67,000+</span>
                        <span class="stat-label">Venues</span>
                    </div>
                    <div class="stat-item featured">
                        <span class="stat-number">50+</span>
                        <span class="stat-label">With GF Beer</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">Growing</span>
                        <span class="stat-label">Community</span>
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
    
    // ================================
    // NICKNAME SELECTION (updated with passcode handling)
    // ================================
    
    const saveNickname = async () => {
        const saveBtn = document.getElementById('saveNicknameBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Creating account...';
        
        const result = await UserSession.createUser(state.nickname, state.avatarEmoji);
        
        if (result.success) {
            // Store the passcode in state
            state.passcode = result.passcode;
            
            // Store auth locally
            localStorage.setItem('userAuth', JSON.stringify({
                nickname: state.nickname,
                timestamp: Date.now()
            }));
            
            // Remove nickname modal
            closeModal('nickname');
            
            // Show passcode display
            showPasscodeDisplay(result);
        } else if (result.error === 'account_exists') {
            // This device already has an account
            alert(`This device already has an account: ${result.existing_nickname}. Please sign in instead.`);
            closeModal('nickname');
            showSignInPrompt();
        } else {
            alert(`Error: ${result.error}`);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Create Account!';
        }
    };
    
    // ================================
    // PASSCODE DISPLAY (NEW)
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
        `, false); // Can't close without confirming
        
        document.body.appendChild(modal);
        
        // Enable continue button when checkbox is checked
        document.getElementById('passcodeConfirmCheck')?.addEventListener('change', (e) => {
            const continueBtn = document.getElementById('continueFromPasscode');
            if (continueBtn) {
                continueBtn.disabled = !e.target.checked;
            }
        });
    };
    
    const copyPasscode = () => {
        const passcodeEl = document.getElementById('passcodeValue');
        if (passcodeEl) {
            navigator.clipboard.writeText(passcodeEl.textContent)
                .then(() => {
                    // Show toast or feedback
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
            // Fallback - copy to clipboard
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
    
    // ================================
    // WELCOME BACK TOAST (updated)
    // ================================
    
    const showWelcomeBack = (user) => {
        // Check frequency preference
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
                    shouldShow = false; // Never show
                    break;
                case 'session':
                    // Show once per session (default)
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
                    <span class="toast-avatar">${user.avatarEmoji}</span>
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
            
            // Mark as shown
            localStorage.setItem('lastWelcomeShown', now.toString());
            sessionStorage.setItem('welcomeShown', 'true');
        }
    };
    
    // ================================
    // REST OF THE CODE (mostly unchanged)
    // ================================
    
    const skipWelcome = () => {
        localStorage.setItem('hasSeenWelcome', 'true');
        closeModal('welcome');
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
                
                // Show sign-in option for taken nicknames
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
    
    // Add new function to handle sign-in prompt from nickname screen
    const promptSignIn = (nickname) => {
        // Store the nickname for sign-in
        state.attemptedNickname = nickname;
        
        // Close nickname modal
        closeModal('nickname');
        
        // Show sign-in modal with nickname pre-filled
        showSignInWithNickname(nickname);
    };
    
    // New sign-in modal with pre-filled nickname
    const showSignInWithNickname = (nickname) => {
        const modal = createModal('signIn', `
            <div class="signin-content">
                <div class="signin-header">
                    <h2>🔑 Welcome back, ${nickname}!</h2>
                    <p>Enter your passcode to sign in</p>
                </div>
                
                <div class="signin-form">
                    <div class="input-group">
                        <label>Nickname</label>
                        <input type="text" 
                               id="signInNickname" 
                               value="${nickname}"
                               readonly
                               style="background: #f5f5f5; cursor: not-allowed;">
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
        
        // Auto-focus passcode field
        setTimeout(() => {
            document.getElementById('signInPasscode')?.focus();
        }, 100);
    };
    
    // Add function to go back to nickname selection
    const backToNickname = () => {
        closeModal('signIn');
        OnboardingFlow.showNicknameSelection();  // ✅ This works!
        
        // Re-populate the attempted nickname if it exists
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
    
    // Add function to clear the options box
    const clearNicknameOptions = () => {
        const optionsContainer = document.getElementById('nicknameOptions');
        if (optionsContainer) {
            optionsContainer.style.display = 'none';
        }
        
        // Clear the input
        const input = document.getElementById('nicknameInput');
        if (input) {
            input.value = '';
            input.focus();
        }
        
        // Clear status
        const statusEl = document.getElementById('nicknameStatus');
        if (statusEl) {
            statusEl.innerHTML = '';
        }
    };

    const showSuggestions = (suggestions) => {
        let suggestionsContainer = document.getElementById('nicknameSuggestions');
        
        if (!suggestionsContainer) {
            const inputGroup = document.querySelector('.input-group');
            suggestionsContainer = document.createElement('div');
            suggestionsContainer.id = 'nicknameSuggestions';
            suggestionsContainer.className = 'nickname-suggestions-box';
            inputGroup.appendChild(suggestionsContainer);
        }
        
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
    
    const skipNickname = () => {
        localStorage.setItem('hasSeenWelcome', 'true');
        closeModal('nickname');
    };
    
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
    
    const finishOnboarding = () => {
        // Remove ALL onboarding modals
        ['ageGate', 'welcome', 'nickname', 'benefits', 'passcodeDisplay', 'signIn', 'signInPrompt'].forEach(id => {
            const modal = document.getElementById(`${id}Modal`);
            if (modal) modal.remove();
        });
        
        document.querySelectorAll('.onboarding-modal').forEach(modal => {
            modal.remove();
        });
        
        window.dispatchEvent(new Event('onboardingComplete'));
    };

    const showNicknameSelection = () => {
        closeModal('welcome');
        
        const modal = createModal('nickname', `
            <div class="nickname-content">
                <button class="skip-btn" onclick="OnboardingFlow.skipNickname()">Skip →</button>
                
                <div class="nickname-header">
                    <span class="welcome-emoji">🍻</span>
                    <h2>Choose Your Nickname!</h2>
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
                        <div class="privacy-item">✅ Secure passcode access</div>
                        <div class="privacy-item">✅ Sync across devices!</div>
                    </div>
                </div>
                
                <div class="nickname-actions">
                    <button class="btn btn-primary" id="saveNicknameBtn" onclick="OnboardingFlow.saveNickname()" disabled>
                        Create Account!
                    </button>
                </div>
            </div>
        `);
        
        document.body.appendChild(modal);
    };
    
    const createModal = (id, content, closeable = true) => {
        const modal = document.createElement('div');
        modal.id = `${id}Modal`;
        modal.className = 'onboarding-modal';
        modal.innerHTML = `
            <div class="onboarding-modal-content">
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
        showSignInPrompt,
        showSignIn,
        performSignIn,
        skipSignIn,
        showNicknameSelection,
        checkNickname,
        generateRandom,
        useNickname,
        selectAvatar,
        saveNickname,
        skipNickname,
        skipWelcome,
        copyPasscode,
        downloadPasscode,
        sharePasscode,
        confirmPasscodeSaved,
        finishOnboarding,
        closeModal,
        promptSignIn,
        showSignInWithNickname,
        backToNickname,
        clearNicknameOptions,
        showNicknameSelection 
    };
})();

// Make available globally for onclick handlers
window.OnboardingFlow = OnboardingFlow;
