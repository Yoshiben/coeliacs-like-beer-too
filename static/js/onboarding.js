// ================================================================================
// ONBOARDING.JS - PROPERLY USING EXISTING HTML MODALS
// No more inline HTML - everything uses the modals from onboarding.html
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
                console.log('👤 Anonymous user');
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
        showWelcome();
    };
    
    const underAge = () => {
        window.location.href = 'https://www.google.com/search?q=best+non-alcoholic+drinks';
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
        window.dispatchEvent(new Event('onboardingComplete'));
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
        hideModal('nicknameModal');
        window.dispatchEvent(new Event('onboardingComplete'));
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
            // For now, simulate account creation
            const result = {
                success: true,
                nickname: state.nickname,
                passcode: generatePasscode(),
                user_id: Date.now()
            };
            
            if (result.success) {
                state.passcode = result.passcode;
                
                localStorage.setItem('userNickname', state.nickname);
                localStorage.setItem('userAvatar', state.avatarEmoji);
                localStorage.setItem('user_id', result.user_id);
                
                if (window.App) {
                    window.App.setState('userNickname', state.nickname);
                    window.App.setState('userId', result.user_id);
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
            }
        } catch (error) {
            console.error('❌ Error saving nickname:', error);
            alert('Failed to create account. Please try again.');
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
            nicknameInput.style.background = '#f5f5f5';
            nicknameInput.style.cursor = 'not-allowed';
        }
        
        // Update the header if nickname is known
        const headerEl = modal.querySelector('.signin-header h2');
        if (headerEl) {
            headerEl.textContent = nickname ? `Welcome back, ${nickname}!` : 'Sign In';
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
            // Simulate sign in for now
            const result = { success: true, user: { nickname, avatarEmoji: '🍺' } };
            
            if (result.success) {
                localStorage.setItem('userNickname', nickname);
                
                if (window.App) {
                    window.App.setState('userNickname', nickname);
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
        hideModal('benefitsModal');
        finishOnboarding();
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
    
    // ================================
    // FINISH
    // ================================
    
    const finishOnboarding = () => {
        console.log('🎉 Finishing onboarding');
        
        // Hide all onboarding modals
        ['ageGateModal', 'welcomeModal', 'nicknameModal', 'signInPromptModal', 
         'signInModal', 'passcodeModal', 'benefitsModal'].forEach(modalId => {
            hideModal(modalId);
        });
        
        window.dispatchEvent(new Event('onboardingComplete'));
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
        finishOnboarding
    };
})();

// Make available globally for onclick handlers
window.OnboardingFlow = OnboardingFlow;
