// ================================================================================
// ONBOARDING.JS - PROPERLY USING EXISTING HTML MODALS
// No more inline HTML - everything uses the modals from onboarding.html
// ================================================================================

import { UserSession } from './user-session.js';

// Make UserSession available to this module
console.log('🔍 UserSession available:', typeof UserSession);

export const OnboardingFlow = (() => {
    'use strict';
    
    const state = {
        currentStep: null,
        nickname: '',
        avatarEmoji: '🍺',
        nicknameCheckTimeout: null,
        passcode: null,
        isReturningUser: false,
        attemptedNickname: null
    };
    
    // ================================
    // FLOW CONTROL
    // ================================
    
    const start = async () => {
        console.log('🚀 Starting onboarding flow...');
        
        const existingNickname = localStorage.getItem('userNickname');
        if (existingNickname) {
            console.log('✅ Existing user found:', existingNickname);
            
            const ageVerified = localStorage.getItem('ageVerified');
            if (!ageVerified) {
                showAgeGate();
                return;
            }
            
            return { status: 'existing-user', nickname: existingNickname };
        }
        
        // Initialize UserSession first - this sets up the UUID
        const userStatus = await UserSession.init();
        console.log('User status:', userStatus);
        
        switch (userStatus.status) {
            case 'need-age-verification':
                console.log('📋 Need age verification - showing age gate');
                showAgeGate();
                break;
                
            case 'need-onboarding':
                console.log('👋 Need onboarding - showing welcome');
                showWelcome();
                break;
                
            case 'returning-user':
                console.log('🔄 Returning user');
                showWelcomeBack(userStatus.user);
                break;
                
            case 'device-has-account':
                console.log('📱 Device has account');
                showSignInWithNickname(userStatus.existingNickname || '');
                break;
                
            case 'anonymous':
                console.log('👤 Anonymous user - show welcome');
                showWelcome();
                break;
                
            default:
                console.log('✅ Ready to use app');
        }
    };
    
    // ================================
    // MODAL UTILITIES
    // ================================
    
    const showModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`❌ Modal ${modalId} not found!`);
            return null;
        }
        
        modal.style.display = 'flex';
        modal.classList.add('active');
        console.log(`✅ Showing modal: ${modalId}`);
        return modal;
    };
    
    const hideModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
            console.log(`✅ Hiding modal: ${modalId}`);
        }
    };
    
    // ================================
    // AGE GATE
    // ================================
    
    const showAgeGate = () => {
        console.log('🔍 Showing age gate...');
        showModal('ageGateModal');
    };
    
    const confirmAge = () => {
        console.log('✅ Age confirmed');
        localStorage.setItem('ageVerified', 'true');
        UserSession.verifyAge();
        hideModal('ageGateModal');
        
        // Check if we should show PWA prompt
        if (shouldShowPWAPrompt()) {
            showPWABenefits(); // Show benefits first
        } else {
            showWelcome();
        }
    };
    
    const underAge = () => {
        window.location.href = 'https://www.google.com/search?q=best+non-alcoholic+drinks';
    };


    // ================================
    // PWA PROMPT
    // ================================

    const shouldShowPWAPrompt = () => {
        // Already installed?
        const isStandalone = window.navigator.standalone || 
                            window.matchMedia('(display-mode: standalone)').matches;
        
        // Already shown this session?
        const alreadyShown = sessionStorage.getItem('pwa-prompt-shown');
        
        return !isStandalone && !alreadyShown;
    };
    
    const showPWABenefits = () => {
        sessionStorage.setItem('pwa-prompt-shown', 'true');
        showModal('pwa-benefits-modal');
    };
    
    const showInstallGuide = () => {
        hideModal('pwa-benefits-modal');
        
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        // Add debug info
        const debugInfo = {
            isIOS: isIOS,
            hasPrompt: !!window.pwaHandler?.deferredPrompt,
            userAgent: navigator.userAgent.substring(0, 50)
        };
        
        if (isIOS) {
            showModal('ios-install-guide');
        } else if (window.pwaHandler?.deferredPrompt) {
            showModal('android-install-guide');
        } else {
            // Show a debug modal or alert for Android
            alert(`Debug: No install prompt available\nUA: ${debugInfo.userAgent}`);
            showWelcome();
        }
    };
    
    const skipPWABenefits = () => {
        hideModal('pwa-benefits-modal');
        showWelcome();
    };
    
    const closeIOSGuide = () => {
        hideModal('ios-install-guide');
        showWelcome(); // Continue to signup
    };
    
    const closeAndroidGuide = () => {
        hideModal('android-install-guide');
        showWelcome(); // Continue to signup
    };

    
    // Show post-install modal
    const showPostInstallModal = () => {
        console.log('Showing post-install modal');
        hideAllModals();
        const modal = document.getElementById('postInstallModal');
        if (modal) {
            modal.classList.add('active');
        }
    };
    
    // Updated Android install with post-install modal
    const installAndroid = async () => {
        if (window.pwaHandler?.deferredPrompt) {
            try {
                await window.pwaHandler.deferredPrompt.prompt();
                const result = await window.pwaHandler.deferredPrompt.userChoice;
                
                if (result.outcome === 'accepted') {
                    console.log('PWA installed');
                    hideModal('android-install-guide');
                    
                    // Show post-install modal instead of welcome
                    setTimeout(() => {
                        showPostInstallModal();
                    }, 1500); // Give it a moment to install
                    
                } else {
                    console.log('PWA install cancelled');
                    // User cancelled, go straight to welcome
                    hideModal('android-install-guide');
                    showWelcome();
                }
                
                // Clear the prompt either way
                window.pwaHandler.deferredPrompt = null;
            } catch (error) {
                console.error('Install error:', error);
                hideModal('android-install-guide');
                showWelcome();
            }
        } else {
            // No prompt available, just continue
            hideModal('android-install-guide');
            showWelcome();
        }
    };
    
    // Handle "Got it" button - user will open app
    const handleUnderstoodBtn = () => {
        console.log('User will open app');
        
        // Hide modal
        hideModal('postInstallModal');
        
        // Mark that they installed
        localStorage.setItem('appInstalled', 'true');
        localStorage.setItem('appInstallTime', Date.now().toString());
        
        // End the flow here - they're going to the app
        // Maybe show a goodbye message
        showGoodbyeMessage();
    };
    
    // Handle continue in browser
    const handleContinueBrowser = () => {
        console.log('User continuing in browser');
        
        // Mark their choice
        localStorage.setItem('continuedInBrowser', 'true');
        
        // Hide post-install modal and continue to welcome
        hideModal('postInstallModal');
        showWelcome();
    };
    
    // Simple goodbye message
    const showGoodbyeMessage = () => {
        const message = document.createElement('div');
        message.className = 'goodbye-message';
        message.innerHTML = `
            <div class="goodbye-content">
                <span>👋</span>
                <p>See you in the app!</p>
            </div>
        `;
        document.body.appendChild(message);
        
        // Fade in
        setTimeout(() => message.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            message.classList.remove('show');
            setTimeout(() => message.remove(), 300);
        }, 3000);
    };
    
    // For iOS - show post-install after they complete the guide
    const handleIOSInstallComplete = () => {
        console.log('iOS install guide complete');
        hideModal('ios-install-guide');
        
        // Show the same post-install modal
        setTimeout(() => {
            showPostInstallModal();
        }, 500);
    };
    
    // Initialize post-install handlers
    const initPostInstallHandlers = () => {
        // Understood button
        const understoodBtn = document.getElementById('understoodBtn');
        if (understoodBtn) {
            understoodBtn.onclick = handleUnderstoodBtn;
        }
        
        // Continue in browser button
        const continueBrowserBtn = document.getElementById('continueBrowserBtn');
        if (continueBrowserBtn) {
            continueBrowserBtn.onclick = handleContinueBrowser;
        }
        
        // Update iOS guide continue button
        const iosContinueBtn = document.querySelector('#ios-install-guide .btn-primary');
        if (iosContinueBtn) {
            iosContinueBtn.onclick = handleIOSInstallComplete;
        }
    };

    
    
    // ================================
    // WELCOME SCREEN
    // ================================
    
    const showWelcome = () => {
        console.log('👋 Showing welcome modal...');
        hideModal('ageGateModal');
        showModal('welcomeModal');
    };
    
    const skipWelcome = () => {
        console.log('⏭️ Skipping welcome');
        localStorage.setItem('hasSeenWelcome', 'true');
        hideModal('welcomeModal');
        checkCookieConsent();
    };
    
    // ================================
    // NICKNAME SELECTION
    // ================================
    
    const showNicknameSelection = () => {
        console.log('📝 Showing nickname modal...');
        hideModal('welcomeModal');
        showModal('nicknameModal');
    };
    
    const skipNickname = () => {
        console.log('⏭️ Skipping nickname');
        localStorage.setItem('hasSeenWelcome', 'true');
        localStorage.setItem('skippedNickname', 'true');
        hideModal('nicknameModal');
        checkCookieConsent();
    };
    
    const checkNickname = (value) => {
        clearTimeout(state.nicknameCheckTimeout);
        state.nickname = value;
        
        const statusEl = document.getElementById('nicknameStatus');
        const saveBtn = document.getElementById('saveNicknameBtn');
        
        if (!statusEl || !saveBtn) {
            console.error('❌ Status element or save button not found');
            return;
        }
        
        if (value.length < 3) {
            statusEl.innerHTML = '<span style="color: #ef4444;">Too short (min 3 chars)</span>';
            saveBtn.disabled = true;
            return;
        }
        
        if (value.length > 30) {
            statusEl.innerHTML = '<span style="color: #ef4444;">Too long (max 30 chars)</span>';
            saveBtn.disabled = true;
            return;
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
            statusEl.innerHTML = '<span style="color: #ef4444;">Only letters, numbers, _ and -</span>';
            saveBtn.disabled = true;
            return;
        }
        
        statusEl.innerHTML = '<span style="color: #3b82f6;">Checking...</span>';
        
        state.nicknameCheckTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/user/check-nickname?nickname=${encodeURIComponent(value)}`);
                const result = await response.json();
                
                if (result.available) {
                    statusEl.innerHTML = '<span style="color: #10b981;">✅ Available!</span>';
                    saveBtn.disabled = false;
                } else {
                    statusEl.innerHTML = '<span style="color: #ef4444;">❌ Already taken</span>';
                    saveBtn.disabled = true;
                    showNicknameOptions(value, result.suggestions);
                }
            } catch (error) {
                console.error('Error checking nickname:', error);
                statusEl.innerHTML = '<span style="color: #10b981;">✅ Looks good!</span>';
                saveBtn.disabled = false;
            }
        }, 500);
    };
    
    const showNicknameOptions = (nickname, suggestions) => {
        let optionsContainer = document.getElementById('nicknameOptions');
        
        if (!optionsContainer) {
            console.error('❌ nicknameOptions container not found');
            return;
        }
        
        optionsContainer.innerHTML = `
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-top: 12px;">
                <p style="color: #dc2626; font-weight: 600; margin: 0 0 8px;">
                    "${nickname}" is already taken!
                </p>
                
                <div style="display: flex; gap: 8px; margin: 12px 0;">
                    <button class="btn btn-primary btn-sm" onclick="OnboardingFlow.promptSignIn('${nickname}')">
                        🔑 This is me - Sign in
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="OnboardingFlow.clearNicknameOptions()">
                        ❌ Not me - Try another
                    </button>
                </div>
                
                ${suggestions && suggestions.length > 0 ? `
                    <div style="margin-top: 12px;">
                        <p style="color: #6b7280; margin: 0 0 8px;">Or try one of these:</p>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
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
            optionsContainer.innerHTML = '';
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
        
        const saveBtn = document.getElementById('saveNicknameBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
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
            checkNickname(nickname);
        }
    };
    
    const useNickname = (nickname) => {
        const input = document.getElementById('nicknameInput');
        if (input) {
            input.value = nickname;
            checkNickname(nickname);
        }
    };
    
    const selectAvatar = (emoji) => {
        console.log('🎨 Selecting avatar:', emoji);
        state.avatarEmoji = emoji;
        
        // Remove active class from all
        document.querySelectorAll('.avatar-option').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active to the selected one
        const selectedBtn = document.querySelector(`.avatar-option[data-emoji="${emoji}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }
    };
    
    const saveNickname = async () => {
        console.log('💾 Saving nickname:', state.nickname);
        
        const saveBtn = document.getElementById('saveNicknameBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Creating account...';
        }
        
        try {
            // Use UserSession to create the user
            const result = await UserSession.createUser(state.nickname, state.avatarEmoji);
            
            console.log('📝 User creation result:', result);
            
            if (result.success) {
                state.passcode = result.passcode;
                
                // Store everything locally
                localStorage.setItem('userNickname', state.nickname);
                localStorage.setItem('userAvatar', state.avatarEmoji);
                localStorage.setItem('user_id', result.user?.userId || result.user_id);
                localStorage.setItem('hasSeenWelcome', 'true');
                
                if (window.App) {
                    window.App.setState('userNickname', state.nickname);
                    window.App.setState('userId', result.user?.userId || result.user_id);
                }
                
                hideModal('nicknameModal');
                
                // Check if we should return to community hub
                const shouldReturnToCommunity = window.App?.getState('returnToCommunityAfterNickname');
                
                if (shouldReturnToCommunity) {
                    window.App?.setState('returnToCommunityAfterNickname', false);
                    showPasscodeDisplayForCommunity(result);
                } else {
                    showPasscodeDisplay(result);
                }
            } else if (result.error === 'account_exists') {
                // This device already has an account
                alert(`This device already has an account: ${result.existing_nickname}. Please sign in with your passcode.`);
                hideModal('nicknameModal');
                showSignInWithNickname(result.existing_nickname);
            } else if (result.error === 'Nickname already taken') {
                // Nickname taken by someone else
                const statusEl = document.getElementById('nicknameStatus');
                if (statusEl) {
                    statusEl.innerHTML = '<span style="color: #ef4444;">❌ Already taken - try another</span>';
                }
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Create Account!';
                }
            } else {
                // Other error
                throw new Error(result.error || 'Failed to create account');
            }
        } catch (error) {
            console.error('❌ Error saving nickname:', error);
            alert(`Failed to create account: ${error.message}`);
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Create Account!';
            }
        }
    };
    
    // ================================
    // SIGN IN
    // ================================
    
    const promptSignIn = (nickname) => {
        console.log('🔐 Prompting sign in for:', nickname);
        state.attemptedNickname = nickname;
        hideModal('nicknameModal');
        showSignInWithNickname(nickname);
    };
    
    const showSignInWithNickname = (nickname) => {
        console.log('📝 Showing sign-in modal for:', nickname);
        
        const modal = showModal('signInModal');
        if (!modal) return;
        
        // Update the nickname field if provided
        const nicknameInput = document.getElementById('signInNickname');
        if (nicknameInput && nickname) {
            nicknameInput.value = nickname;
            nicknameInput.readOnly = true;
        }
        
        // Update the nickname display in header
        const nicknameDisplay = document.getElementById('signInNicknameDisplay');
        if (nicknameDisplay && nickname) {
            nicknameDisplay.textContent = nickname;
        } else if (nicknameDisplay) {
            nicknameDisplay.textContent = 'friend';
        }
        
        // Focus on passcode input
        setTimeout(() => {
            const passcodeInput = document.getElementById('signInPasscode');
            if (passcodeInput) {
                passcodeInput.focus();
            }
        }, 100);
    };
    
    const backToNickname = () => {
        hideModal('signInModal');
        showNicknameSelection();
        
        // Clear the attempted nickname
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
        const signInBtn = document.querySelector('#signInModal .btn-primary');
        const errorDiv = document.getElementById('signInError');
        const errorText = errorDiv?.querySelector('.error-text');
        
        if (!nickname || !passcode) {
            if (errorDiv && errorText) {
                errorText.textContent = 'Please enter both nickname and passcode';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        if (signInBtn) {
            signInBtn.disabled = true;
            signInBtn.textContent = 'Signing in...';
        }
        
        try {
            // Use UserSession to sign in
            const result = await UserSession.signIn(nickname, passcode);
            
            console.log('🔐 Sign in result:', result);
            
            if (result.success) {
                // Store user data locally
                localStorage.setItem('userNickname', nickname);
                localStorage.setItem('user_id', result.user?.userId || result.user?.user_id);
                localStorage.setItem('userAvatar', result.user?.avatarEmoji || '🍺');
                localStorage.setItem('hasSeenWelcome', 'true');
                
                if (window.App) {
                    window.App.setState('userNickname', nickname);
                    window.App.setState('userId', result.user?.userId || result.user?.user_id);
                }
                
                hideModal('signInModal');
                showWelcomeBack(result.user);
            } else {
                if (errorDiv && errorText) {
                    errorText.textContent = result.error || 'Invalid passcode';
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
        console.log('🔐 Showing passcode modal');
        
        const modal = showModal('passcodeModal');
        if (!modal) return;
        
        // Update the passcode value
        const passcodeEl = document.getElementById('passcodeValue');
        if (passcodeEl) {
            passcodeEl.textContent = result.passcode;
        }
        
        // Update the nickname in the header
        const headerEl = modal.querySelector('.passcode-header p');
        if (headerEl) {
            headerEl.textContent = `Welcome, ${result.nickname}!`;
        }
        
        // Reset the checkbox and button
        const checkbox = document.getElementById('passcodeConfirmCheck');
        const continueBtn = document.getElementById('continueFromPasscode');
        if (checkbox) checkbox.checked = false;
        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.onclick = () => confirmPasscodeSaved();
        }
    };
    
    const showPasscodeDisplayForCommunity = (result) => {
        console.log('🔐 Showing passcode modal for community return');
        
        const modal = showModal('passcodeModal');
        if (!modal) return;
        
        // Update the passcode value
        const passcodeEl = document.getElementById('passcodeValue');
        if (passcodeEl) {
            passcodeEl.textContent = result.passcode;
        }
        
        // Update the continue button text and action
        const continueBtn = document.getElementById('continueFromPasscode');
        if (continueBtn) {
            continueBtn.textContent = 'Continue to Community Hub →';
            continueBtn.onclick = () => confirmPasscodeSavedAndReturnToCommunity();
        }
    };
    
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
                });
        }
    };
    
    const downloadPasscode = () => {
        const passcode = document.getElementById('passcodeValue')?.textContent;
        const nickname = state.nickname || localStorage.getItem('userNickname');
        
        if (!passcode || !nickname) return;
        
        const content = `Coeliacs Like Beer Too! - Account Details
========================================

Nickname: ${nickname}
Passcode: ${passcode}

IMPORTANT: Keep this file safe!
You'll need this passcode to sign in on other devices.

Website: https://coeliacslikebeer.co.uk
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
    
    const emailPasscode = () => {
        const passcode = document.getElementById('passcodeValue')?.textContent;
        const nickname = state.nickname || localStorage.getItem('userNickname');
        
        if (!passcode || !nickname) return;
        
        const subject = 'Your Coeliacs Like Beer Too Account Details';
        const body = `Hi ${nickname},\n\nHere are your account details:\n\nNickname: ${nickname}\nPasscode: ${passcode}\n\nKeep this safe - you'll need it to sign in on other devices!\n\nWebsite: https://coeliacslikebeer.co.uk`;
        
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };
    
    const confirmPasscodeSaved = () => {
        hideModal('passcodeModal');
        showCommunityBenefits();
    };
    
    const confirmPasscodeSavedAndReturnToCommunity = () => {
        hideModal('passcodeModal');
        
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
    
    const showCommunityBenefits = () => {
        console.log('🎁 Showing benefits modal');
        
        const modal = showModal('benefitsModal');
        if (!modal) {
            // If benefits modal doesn't exist, just finish
            finishOnboarding();
            return;
        }
        
        // Update nickname and avatar display
        const nicknameEl = document.getElementById('userNicknameDisplay');
        const avatarEl = document.getElementById('userAvatarDisplay');
        
        if (nicknameEl) nicknameEl.textContent = state.nickname || localStorage.getItem('userNickname');
        if (avatarEl) avatarEl.textContent = state.avatarEmoji || localStorage.getItem('userAvatar') || '🍺';
    };
    
    const startExploring = () => {
        console.log('🚀 Starting exploration');
        hideModal('benefitsModal');
        checkCookieConsent();  // Check cookies instead of completing
    };
    
    // ================================
    // WELCOME BACK
    // ================================
    
    const showWelcomeBack = async (user) => {
        console.log('👋 Welcome back:', user);
        
        // Show a toast
        if (window.App?.getModule('toast')) {
            window.App.getModule('toast').success(`Welcome back, ${user.nickname}!`);
        }
        
        window.dispatchEvent(new Event('onboardingComplete'));
    };


    // ============================
    // COOKIE CONSENT FUNCTIONS
    // ============================
    
    const checkCookieConsent = () => {
        console.log('🍪 Checking cookie consent...');
        
        if (needsCookieConsent()) {
            console.log('🍪 Need cookie consent - showing modal');
            setTimeout(() => {
                showModal('cookieModal');
            }, 300);
        } else {
            console.log('✅ Cookie consent already given');
            completeOnboarding();
        }
    };
    
    const acceptAllCookies = () => {
        console.log('✅ acceptAllCookies FUNCTION CALLED');
        console.log('Accepting all cookies');
        
        // Set all toggles to checked
        document.getElementById('analyticsCookies').checked = true;
        document.getElementById('preferenceCookies').checked = true;
        
        // Save preferences
        setCookiePreferences(true, true);
        
        // Hide modal and complete onboarding
        hideModal('cookieModal');
        completeOnboarding ();
    };
    
    const acceptSelectedCookies = () => {
        console.log('Accepting selected cookies');
        
        // Get current toggle states
        const analytics = document.getElementById('analyticsCookies').checked;
        const preferences = document.getElementById('preferenceCookies').checked;
        
        // Save preferences
        setCookiePreferences(analytics, preferences);
        
        // Hide modal and complete onboarding
        hideModal('cookieModal');
        completeOnboarding ();
    };
    
    const essentialOnlyCookies = () => {
        console.log('Essential cookies only');
        
        // Uncheck all optional cookies
        document.getElementById('analyticsCookies').checked = false;
        document.getElementById('preferenceCookies').checked = false;
        
        // Save preferences
        setCookiePreferences(false, false);
        
        // Hide modal and complete onboarding
        hideModal('cookieModal');
        completeOnboarding ();
    };
    
    // Post-Install methods
    const postInstallGoToApp = () => {
        hideModal('postInstallModal');
        showGoodbyeMessage();
    };
    
    const postInstallContinueBrowser = () => {
        hideModal('postInstallModal');
        showWelcome();
    };
    
    // Show cookie modal after onboarding completes
    const showCookieConsent = () => {
        console.log('Showing cookie consent modal');
        hideAllModals();
        showModal('cookieModal');
    };
    
    // Handle cookie preferences
    const setCookiePreferences = (analytics, preferences) => {
        const cookiePrefs = {
            essential: true, // Always true
            analytics: analytics,
            preferences: preferences,
            timestamp: Date.now()
        };
        
        localStorage.setItem('cookieConsent', JSON.stringify(cookiePrefs));
        localStorage.setItem('cookieConsentDate', new Date().toISOString());
        
        // Initialize analytics if accepted
        if (analytics && window.gtag) {
            window.gtag('consent', 'update', {
                'analytics_storage': 'granted'
            });
        }
        
        console.log('Cookie preferences saved:', cookiePrefs);
    };
    
    // Check if we need to show cookie consent
    const needsCookieConsent = () => {
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) return true;
        
        // Optional: Re-ask after a year
        const consentDate = localStorage.getItem('cookieConsentDate');
        if (consentDate) {
            const daysSince = (Date.now() - new Date(consentDate).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince > 365) return true;
        }
        
        return false;
    };
    
    // Update your onboarding completion to show cookies
    const completeAccountSetup = () => {
        console.log('Account setup complete, checking cookie consent');
        
        // Hide current modal
        hideAllModals();
        
        // Check if we need cookie consent
        if (needsCookieConsent()) {
            setTimeout(() => {
                showCookieConsent();
            }, 500);
        } else {
            // Already have consent, finish
            onboardingComplete();
        }
    };
    
    // Final onboarding completion
    const completeOnboarding = () => {
        console.log('🎉 Onboarding fully complete!');
        
        // Hide ALL modals including benefits
        hideModal('benefitsModal'); // Add this
        hideAllModals();
        
        // Mark complete
        localStorage.setItem('onboardingComplete', 'true');
        localStorage.setItem('onboardingCompleteDate', new Date().toISOString());
        
        // Emit completion event
        if (window.App?.events) {
            console.log('📢 Emitting onboarding:complete event');
            window.App.events.emit('onboarding:complete');
        }
        
        // Reload after short delay
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    };
    
    // Simple success toast
    const showSuccessToast = (message) => {
        const toast = document.createElement('div');
        toast.className = 'success-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <span>✨</span>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    const hideAllModals = () => {
        hideModal('ageGateModal');
        hideModal('welcomeModal');
        hideModal('nicknameModal');
        hideModal('signInModal');
        hideModal('passcodeModal');
        hideModal('benefitsModal');
        hideModal('cookieModal');
    };


    
    // ================================
    // FINISH
    // ================================
    
    const finishOnboarding = () => {
        console.log('🎉 Finishing onboarding - checking for cookie consent');
        
        // Hide all onboarding modals first
        hideModal('ageGateModal');
        hideModal('welcomeModal');
        hideModal('nicknameModal');
        hideModal('signInModal');
        hideModal('passcodeModal');
        hideModal('benefitsModal');
        
        // Check if we need cookie consent
        if (needsCookieConsent()) {
            console.log('🍪 Showing cookie consent');
            setTimeout(() => {
                showModal('cookieModal');  // SHOW the cookie modal
            }, 500);
        } else {
            console.log('✅ Cookie consent already given');
            completeOnboarding();
        }
    };
    
    // ================================
    // UTILITIES
    // ================================
    
    const generatePasscode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let passcode = '';
        for (let i = 0; i < 6; i++) {
            passcode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return passcode;
    };
    
    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
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
        emailPasscode,
        confirmPasscodeSaved,
        confirmPasscodeSavedAndReturnToCommunity,
        showPasscodeDisplayForCommunity,
        startExploring,
        finishOnboarding,
        showInstallGuide,
        skipPWABenefits,
        closeIOSGuide,
        closeAndroidGuide,
        installAndroid,
        checkCookieConsent,
        completeOnboarding,
        acceptAllCookies,
        acceptSelectedCookies,
        essentialOnlyCookies,
        handleUnderstoodBtn,
        handleContinueBrowser
        
    };
})();

// Make available globally for onclick handlers
window.OnboardingFlow = OnboardingFlow;
