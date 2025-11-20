let chats = JSON.parse(localStorage.getItem('ceoChats') || '[]');
let currentSessionId = null;
let currentChatIndex = -1;

let currentChatModel = null;

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_SIZE = 8 * 1024 * 1024; // 8MB
let pendingAttachments = [];
let pendingAttachmentPreviews = [];
let attachmentUploadsInProgress = 0;

// Authentication state
let authToken = localStorage.getItem('authToken') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let uploadCount = 0;
let uploadLimit = 5;

const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const chatHistoryContainer = document.querySelector('.chat-history');
const newChatBtn = document.getElementById('newChatBtn') || document.querySelector('.new-chat-btn');
const searchChatsInput = document.getElementById('searchChats');
const logoutBtn = document.getElementById('logoutBtn');
const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
const sidebarExpandBtn = document.getElementById('sidebarExpandBtn');
const sidebarRail = document.getElementById('sidebarRail');
const modelSelectorBtn = document.getElementById('modelSelectorBtn');
const modelSelectorDropdown = document.getElementById('modelSelectorDropdown');
let selectedModel = 'auto';

function getLogoPath() {
    const formats = ['logo.png', 'logo.svg', 'logo.webp', 'logo.jpg'];
    return formats[0];
}

const darkModeToggle = document.getElementById('darkModeToggle');
const html = document.documentElement;

function loadDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        html.setAttribute('data-theme', 'dark');
    } else {
        html.removeAttribute('data-theme');
    }
}

function toggleDarkMode() {
    const isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
        html.removeAttribute('data-theme');
        localStorage.setItem('darkMode', 'false');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('darkMode', 'true');
    }
}

loadDarkMode();

if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
}

// Initialize model selector - set Auto as default
(function initModelSelector() {
    const autoOption = document.querySelector('.model-option[data-model="auto"]');
    if (autoOption) {
        autoOption.classList.add('selected');
        const toggleSwitch = autoOption.querySelector('.toggle-switch');
        if (toggleSwitch) {
            toggleSwitch.classList.add('active');
        }
    }
})();

// Load chats on page load (async)
(async () => {
    // Update UI first to show/hide sidebar
    updateAuthUI();
    
    // Load chats (will be empty if not logged in)
    await loadChats();
    
    // Only create new chat if logged in and no chats exist
    if (authToken && chats.length === 0) {
        createNewChat();
    } else if (authToken && chats.length > 0) {
        loadChat(chats[0].sessionId, 0);
    }
})();

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        // Only toggle sidebar if user is logged in
        if (authToken && currentUser) {
            sidebar.classList.toggle('open');
        } else {
            // If not logged in, show login modal
            showAuthModal('login');
        }
    });
}

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    }
});

// Detect mobile device
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth <= 768 && 'ontouchstart' in window);
}

messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

messageInput.addEventListener('keydown', function(e) {
    // On mobile, only allow send button to send messages
    // Enter key should just create a new line
    if (isMobileDevice()) {
        return; // Let Enter key work normally (create new line)
    }
    
    // On desktop, Enter sends message (Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
}

if (clearBtn) {
    clearBtn.addEventListener('click', deleteAllChats);
}

if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        createNewChat();
    });
}

// Logout Button Handler
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showLogoutConfirmation();
    });
}

// Sidebar collapse/expand handlers are now handled via event delegation below

// Upgrade Plan and Settings buttons removed - using simpler UI

const upgradeBtn = document.getElementById('upgradeBtn');
const upgradeModal = document.getElementById('upgradeModal');
const closeModal = document.getElementById('closeModal');
const modalOkBtn = document.getElementById('modalOkBtn');

if (upgradeBtn && upgradeModal) {
    upgradeBtn.addEventListener('click', () => {
        upgradeModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    });
}

if (closeModal) {
    closeModal.addEventListener('click', () => {
        upgradeModal.classList.remove('show');
        document.body.style.overflow = '';
    });
}

if (modalOkBtn) {
    modalOkBtn.addEventListener('click', () => {
        upgradeModal.classList.remove('show');
        document.body.style.overflow = '';
    });
}

if (upgradeModal) {
    upgradeModal.addEventListener('click', (e) => {
        if (e.target === upgradeModal) {
            upgradeModal.classList.remove('show');
            document.body.style.overflow = '';
        }
    });
}

// Auth Modal Elements
const authModal = document.getElementById('authModal');
const authModalClose = document.getElementById('authModalClose');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginFormElement = document.getElementById('loginFormElement');
const signupFormElement = document.getElementById('signupFormElement');
const authTabs = document.querySelectorAll('.auth-tab');

// Auth Tab Switching
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        if (targetTab === 'login') {
            loginForm.classList.add('active');
            signupForm.classList.remove('active');
        } else {
            signupForm.classList.add('active');
            loginForm.classList.remove('active');
        }
    });
});

// Close Auth Modal
if (authModalClose) {
    authModalClose.addEventListener('click', () => {
        authModal.classList.remove('show');
        document.body.style.overflow = '';
    });
}

if (authModal) {
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.remove('show');
            document.body.style.overflow = '';
        }
    });
}

// Show Auth Modal
function showAuthModal(tab = 'login') {
    authModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    if (tab === 'signup') {
        authTabs[1].click();
    } else {
        authTabs[0].click();
    }
}

// Google Login/Signup Buttons
const googleLoginBtn = document.getElementById('googleLoginBtn');
const googleSignupBtn = document.getElementById('googleSignupBtn');

if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        window.location.href = '/api/auth/google';
    });
}

if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', () => {
        window.location.href = '/api/auth/google';
    });
}

// Handle Google OAuth callback
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleAuthSuccess = urlParams.get('google_auth_success');
    const token = urlParams.get('token');
    const email = urlParams.get('email');
    const name = urlParams.get('name');
    const error = urlParams.get('error');

    if (googleAuthSuccess === 'true' && token) {
        authToken = token;
        currentUser = {
            email: decodeURIComponent(email || ''),
            name: decodeURIComponent(name || '')
        };
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Load user info and chat history
        loadUserInfo().then(async () => {
            updateAuthUI(); // Update UI to show logout button
            await loadChats(); // Load chat history from database
            showLoginSuccess(); // Show login success modal
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else if (error) {
        let errorMessage = 'Google authentication failed. Please try again.';
        
        // Check for specific error types
        const urlParams = new URLSearchParams(window.location.search);
        const errorDetails = urlParams.get('details');
        
        if (error === 'google_oauth_not_configured') {
            errorMessage = 'Google OAuth is not configured. Please contact the administrator.';
        } else if (errorDetails === 'no_code') {
            errorMessage = 'Google authentication was cancelled or failed. Please try again.';
        } else if (errorDetails) {
            errorMessage = `Google authentication error: ${errorDetails}`;
        }
        
        showNotification(errorMessage, 'error');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// Login Handler
if (loginFormElement) {
    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');
        
        errorDiv.textContent = '';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                errorDiv.textContent = data.error || 'Login failed';
                return;
            }
            
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Load user info and upload count
            await loadUserInfo();
            
            // Update UI to show logout button
            updateAuthUI();
            
            // Load chat history from database
            await loadChats();
            
            authModal.classList.remove('show');
            document.body.style.overflow = '';
            loginFormElement.reset();
            
            // Show login success modal
            showLoginSuccess();
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
        }
    });
}

// Signup Handler
if (signupFormElement) {
    signupFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const errorDiv = document.getElementById('signupError');
        
        errorDiv.textContent = '';
        
        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                errorDiv.textContent = data.error || 'Signup failed';
                return;
            }
            
            errorDiv.textContent = '';
            signupFormElement.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; color: #10b981; margin-bottom: 20px;">✓</div>
                    <h3 style="color: #333; margin-bottom: 12px; font-size: 24px; font-weight: 700;">Account Created Successfully!</h3>
                    <p style="color: #7c5dfa; font-size: 16px; font-weight: 600; margin-bottom: 12px;">Thank you for using HarvionGPT! 🚀</p>
                    <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">Please check your email to verify your account before logging in. We've sent a verification link to your inbox.</p>
                    <button type="button" class="auth-btn" onclick="document.getElementById('authModal').classList.remove('show'); document.body.style.overflow = ''; location.reload();">Close</button>
                </div>
            `;
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
        }
    });
}

// Login Nav Button Handler
const loginNavBtn = document.getElementById('loginNavBtn');
if (loginNavBtn) {
    loginNavBtn.addEventListener('click', () => {
        showAuthModal('login');
    });
}

// Update Auth UI
function updateAuthUI() {
    const loginNavBtn = document.getElementById('loginNavBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarUserInfo = document.getElementById('sidebarUserInfo');
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserPlan = document.getElementById('sidebarUserPlan');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (authToken && currentUser) {
        // Hide login button
        if (loginNavBtn) loginNavBtn.style.display = 'none';
        
        // Show sidebar for logged-in users
        if (sidebar) sidebar.style.display = 'flex';
        
        // Show user info in sidebar
        if (sidebarUserInfo) sidebarUserInfo.style.display = 'flex';
        
        // Update user info
        const userName = currentUser.name || currentUser.email || 'User';
        if (sidebarUserName) sidebarUserName.textContent = userName;
        if (sidebarUserPlan) sidebarUserPlan.textContent = 'Free Plan';
    } else {
        // Show login button
        if (loginNavBtn) loginNavBtn.style.display = 'flex';
        
        // Hide sidebar for non-logged-in users
        if (sidebar) {
            sidebar.style.display = 'none';
        }
        
        // Hide user info
        if (sidebarUserInfo) sidebarUserInfo.style.display = 'none';
    }
}

// Show Logout Confirmation with SweetAlert
function showLogoutConfirmation() {
    Swal.fire({
        title: 'Logout from HarvionGPT?',
        text: 'Are you sure you want to logout? Your chat history will be saved.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, Logout',
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        allowOutsideClick: false,
        allowEscapeKey: true,
        backdrop: true,
        didOpen: () => {
            // Prevent body scroll but keep input area in place
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = '0px';
        },
        willClose: () => {
            // Restore body scroll
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        },
        customClass: {
            popup: 'swal-popup',
            title: 'swal-title',
            confirmButton: 'swal-confirm-btn',
            cancelButton: 'swal-cancel-btn'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            logout();
        }
    });
}

// Logout Function
async function logout() {
    // Save current chat state to database before logging out
    if (authToken && chats.length > 0) {
        try {
            await saveChats();
            console.log('Chat history saved before logout');
        } catch (error) {
            console.error('Failed to save chat history before logout:', error);
        }
    }
    
    // Clear auth data
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    // Clear chat history from localStorage (will reload from database on next login)
    chats = [];
    localStorage.removeItem('ceoChats');
    
    // Update UI
    updateAuthUI();
    
    // Reload chat history (will load empty or from localStorage if any)
    await loadChats();
    
    // Create new chat
    if (chats.length === 0) {
        createNewChat();
    }
    
    // Show success message with SweetAlert
    Swal.fire({
        title: 'Logged Out Successfully!',
        text: 'You have been logged out. Your chat history has been saved.',
        icon: 'success',
        confirmButtonColor: '#7c5dfa',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
        allowEscapeKey: true,
        backdrop: true,
        didOpen: () => {
            // Prevent body scroll but keep input area in place
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = '0px';
        },
        willClose: () => {
            // Restore body scroll
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        },
        customClass: {
            popup: 'swal-popup',
            title: 'swal-title',
            confirmButton: 'swal-confirm-btn'
        }
    });
}

// Show Login Success Modal
function showLoginSuccess() {
    const modal = document.getElementById('loginSuccessModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Hide Login Success Modal
function hideLoginSuccess() {
    const modal = document.getElementById('loginSuccessModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Use event delegation for various buttons - ensures buttons work even when dynamically shown/hidden
document.addEventListener('click', (e) => {
    // New Chat Button
    if (e.target.closest('#newChatBtn')) {
        e.preventDefault();
        e.stopPropagation();
        createNewChat();
        return;
    }
    
    // Sidebar Collapse Button
    if (e.target.closest('#sidebarCollapseBtn')) {
        e.preventDefault();
        e.stopPropagation();
        // Don't collapse on mobile
        if (window.innerWidth <= 768) return;
        
        const sidebar = document.getElementById('sidebar');
        const sidebarRail = document.getElementById('sidebarRail');
        if (sidebar && sidebarRail) {
            sidebar.classList.add('collapsed');
            sidebarRail.classList.add('show');
            sidebarRail.style.display = 'flex';
        }
        return;
    }
    
    // Sidebar Expand Button
    if (e.target.closest('#sidebarExpandBtn')) {
        e.preventDefault();
        e.stopPropagation();
        // Don't expand on mobile
        if (window.innerWidth <= 768) return;
        
        const sidebar = document.getElementById('sidebar');
        const sidebarRail = document.getElementById('sidebarRail');
        if (sidebar && sidebarRail) {
            sidebar.classList.remove('collapsed');
            sidebarRail.classList.remove('show');
            sidebarRail.style.display = 'none';
        }
        return;
    }
    
    // Logout Button
    if (e.target.closest('#logoutBtn')) {
        e.preventDefault();
        e.stopPropagation();
        showLogoutConfirmation();
        return;
    }
    
    // Attachment Button
    if (e.target.closest('#attachBtn')) {
        e.preventDefault();
        e.stopPropagation();
        const attachBtn = document.getElementById('attachBtn');
        const imageUpload = document.getElementById('imageUpload');
        if (attachBtn && imageUpload) {
            // Check if user is authenticated
            if (!authToken) {
                showAuthModal('login');
                return;
            }
            
            // Check upload limit
            checkUploadLimit().then(limitCheck => {
                if (!limitCheck.canUpload) {
                    showNotification(`Upload limit reached! You have used ${uploadCount}/${uploadLimit} uploads.`, 'error');
                    return;
                }
                imageUpload.click();
            });
        }
        return;
    }
    
    // Model Selector Button
    if (e.target.closest('#modelSelectorBtn')) {
        e.preventDefault();
        e.stopPropagation();
        const modelSelectorBtn = document.getElementById('modelSelectorBtn');
        const modelSelectorDropdown = document.getElementById('modelSelectorDropdown');
        if (modelSelectorBtn && modelSelectorDropdown) {
            modelSelectorDropdown.classList.toggle('show');
            modelSelectorBtn.classList.toggle('active');
        }
        return;
    }
    
    // Model Option Selection
    if (e.target.closest('.model-option')) {
        e.preventDefault();
        e.stopPropagation();
        const option = e.target.closest('.model-option');
        const model = option.dataset.model;
        if (model !== undefined) {
            // Update selected model
            selectedModel = model;
            
            // Update UI - remove selected from all options
            document.querySelectorAll('.model-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
            
            // Update toggle switch for auto option
            if (model === 'auto') {
                const toggleSwitch = option.querySelector('.toggle-switch');
                if (toggleSwitch) {
                    toggleSwitch.classList.add('active');
                }
            }
            
            // Update button text
            const modelSelectorBtn = document.getElementById('modelSelectorBtn');
            if (modelSelectorBtn) {
                const modelName = option.querySelector('.model-option-name')?.textContent || 'Auto';
                const span = modelSelectorBtn.querySelector('span:not(.dropdown-arrow)');
                if (span) {
                    span.textContent = modelName;
                }
            }
            
            // Close dropdown
            const modelSelectorDropdown = document.getElementById('modelSelectorDropdown');
            if (modelSelectorDropdown) {
                modelSelectorDropdown.classList.remove('show');
            }
            const btn = document.getElementById('modelSelectorBtn');
            if (btn) {
                btn.classList.remove('active');
            }
        }
        return;
    }
    
    // Toggle switch for Auto option
    if (e.target.closest('.toggle-switch')) {
        e.preventDefault();
        e.stopPropagation();
        const toggleSwitch = e.target.closest('.toggle-switch');
        const option = toggleSwitch.closest('.model-option');
        if (option && option.dataset.model === 'auto') {
            // Select auto option
            selectedModel = 'auto';
            document.querySelectorAll('.model-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
            toggleSwitch.classList.add('active');
            
            // Update button text
            const modelSelectorBtn = document.getElementById('modelSelectorBtn');
            if (modelSelectorBtn) {
                const span = modelSelectorBtn.querySelector('span:not(.dropdown-arrow)');
                if (span) {
                    span.textContent = 'Auto';
                }
            }
            
            // Close dropdown
            const modelSelectorDropdown = document.getElementById('modelSelectorDropdown');
            if (modelSelectorDropdown) {
                modelSelectorDropdown.classList.remove('show');
            }
            const btn = document.getElementById('modelSelectorBtn');
            if (btn) {
                btn.classList.remove('active');
            }
        }
        return;
    }
    
    // Upgrade Button
    if (e.target.closest('#upgradeBtn')) {
        e.preventDefault();
        e.stopPropagation();
        const upgradeModal = document.getElementById('upgradeModal');
        if (upgradeModal) {
            upgradeModal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
        return;
    }
    
    // Close Upgrade Modal
    if (e.target.closest('#closeModal') || e.target.closest('#modalOkBtn')) {
        e.preventDefault();
        e.stopPropagation();
        const upgradeModal = document.getElementById('upgradeModal');
        if (upgradeModal) {
            upgradeModal.classList.remove('show');
            document.body.style.overflow = '';
        }
        return;
    }
    
    // Close Upgrade Modal when clicking outside
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal && e.target === upgradeModal) {
        upgradeModal.classList.remove('show');
        document.body.style.overflow = '';
        return;
    }
    
    // Delete All Chats Button
    if (e.target.closest('#clearBtn')) {
        e.preventDefault();
        e.stopPropagation();
        deleteAllChats();
        return;
    }
    
    // Close Model Selector Dropdown when clicking outside
    const modelSelectorBtn = document.getElementById('modelSelectorBtn');
    const modelSelectorDropdown = document.getElementById('modelSelectorDropdown');
    if (modelSelectorDropdown && modelSelectorBtn && 
        !modelSelectorDropdown.contains(e.target) && 
        !modelSelectorBtn.contains(e.target) &&
        modelSelectorDropdown.classList.contains('show')) {
        modelSelectorDropdown.classList.remove('show');
        modelSelectorBtn.classList.remove('active');
    }
    
    // Login success close button
    if (e.target.closest('#loginSuccessCloseBtn') || e.target.id === 'loginSuccessCloseBtn') {
        e.preventDefault();
        e.stopPropagation();
        hideLoginSuccess();
        return;
    }
    
    // Close modals when clicking outside
    const loginSuccessModal = document.getElementById('loginSuccessModal');
    
    if (loginSuccessModal && e.target === loginSuccessModal) {
        hideLoginSuccess();
    }
});

// Logout handlers will be initialized automatically when updateAuthUI is called

// Load User Info
async function loadUserInfo() {
    if (!authToken) {
        updateAuthUI();
        return;
    }
    
    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            uploadCount = data.uploadCount || 0;
            uploadLimit = data.uploadLimit || 5;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateAuthUI();
        } else {
            // Token might be invalid, logout
            logout();
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
        updateAuthUI();
    }
}

// Check Upload Limit
async function checkUploadLimit() {
    if (!authToken) return { canUpload: false, error: 'Not authenticated' };
    
    try {
        const response = await fetch('/api/auth/upload-limit', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            uploadCount = data.count || 0;
            return data;
        }
    } catch (error) {
        console.error('Failed to check upload limit:', error);
    }
    
    return { canUpload: false };
}

// Show Notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Load user info on page load and update UI
if (authToken) {
    loadUserInfo();
} else {
    updateAuthUI();
}

// Image upload handler - using event delegation above for attachBtn click
const imageUpload = document.getElementById('imageUpload');
if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                showNotification('Please upload an image file only.', 'error');
                return;
            }
            handleImageUpload(file);
        });

        imageUpload.value = '';
    });
}

function handleImageUpload(file) {
    if (!currentSessionId) {
        createNewChat();
    }

    if (pendingAttachments.length + pendingAttachmentPreviews.length >= MAX_ATTACHMENTS) {
        alert(`You can attach up to ${MAX_ATTACHMENTS} images per message.`);
        return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
        alert('Each image must be 8MB or smaller.');
        return;
    }

    const preview = createAttachmentPreview(file.name, file.size);
    pendingAttachmentPreviews.push(preview);
    attachmentUploadsInProgress += 1;

    const reader = new FileReader();
    reader.onload = (e) => {
        attachmentUploadsInProgress = Math.max(attachmentUploadsInProgress - 1, 0);
        const imageUrl = e.target.result;

        finalizeAttachmentPreview(preview, imageUrl, file.name);

        pendingAttachments.push({
            id: preview.id,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'image/png',
            dataUrl: imageUrl
        });
    };
    reader.onerror = () => {
        attachmentUploadsInProgress = Math.max(attachmentUploadsInProgress - 1, 0);
        showUploadError(preview, 'Failed to load image. Please try again.');
        setTimeout(() => {
            removeAttachmentPreview(preview.id);
        }, 2000);
    };

    reader.readAsDataURL(file);
}

function createAttachmentPreview(fileName, fileSize) {
    const previewId = `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user uploading';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    const textContainer = document.createElement('div');
    textContainer.className = 'message-text';
    contentDiv.appendChild(textContainer);

    const uploadStatus = document.createElement('div');
    uploadStatus.className = 'upload-status';
    uploadStatus.innerHTML = `
        <div class="upload-spinner"></div>
        <div>
            <div class="upload-title">Uploading ${fileName}</div>
            <div class="upload-subtitle">${formatFileSize(fileSize)}</div>
        </div>
    `;

    contentDiv.appendChild(uploadStatus);
    messageDiv.appendChild(contentDiv);

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return { id: previewId, element: messageDiv, contentElement: contentDiv };
}

function finalizeAttachmentPreview(preview, imageUrl, fileName) {
    if (!preview?.contentElement || !preview.element || !document.body.contains(preview.element)) {
        return;
    }

    preview.element.classList.remove('uploading');
    preview.contentElement.innerHTML = '';

    const imageElement = document.createElement('img');
    imageElement.src = imageUrl;
    imageElement.alt = fileName;
    imageElement.className = 'chat-image';

    const note = document.createElement('div');
    note.className = 'attachment-note';
    note.textContent = 'Photo ready. Describe what you want to do with it, then hit send.';

    preview.contentElement.appendChild(imageElement);
    preview.contentElement.appendChild(note);

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showUploadError(preview, message) {
    if (!preview?.contentElement || !preview.element || !document.body.contains(preview.element)) return;
    preview.element.classList.add('upload-error');
    preview.contentElement.innerHTML = `
        <div class="upload-status">
            <div class="upload-error-icon">⚠️</div>
            <div class="upload-title">${message}</div>
        </div>
    `;
}

function removeAttachmentPreview(previewId) {
    pendingAttachmentPreviews = pendingAttachmentPreviews.filter((preview) => {
        if (preview.id === previewId) {
            if (preview.element && preview.element.parentNode) {
                preview.element.remove();
            }
            return false;
        }
        return true;
    });
}

function clearPendingAttachmentPreviews() {
    pendingAttachments = [];
    pendingAttachmentPreviews.forEach((preview) => {
        if (preview.element && preview.element.parentNode) {
            preview.element.remove();
        }
    });
    pendingAttachmentPreviews = [];
    attachmentUploadsInProgress = 0;
}

function consumePendingAttachments() {
    if (pendingAttachments.length === 0) {
        return [];
    }

    const attachmentsCopy = pendingAttachments.map((attachment) => ({ ...attachment }));

    pendingAttachments = [];
    pendingAttachmentPreviews.forEach((preview) => {
        if (preview.element && preview.element.parentNode) {
            preview.element.remove();
        }
    });
    pendingAttachmentPreviews = [];

    return attachmentsCopy;
}

function formatFileSize(sizeInBytes) {
    if (!sizeInBytes && sizeInBytes !== 0) return '';
    if (sizeInBytes < 1024) {
        return `${sizeInBytes} B`;
    }
    if (sizeInBytes < 1024 * 1024) {
        return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function addImageToChat(imageUrl, fileName) {
    addMessageToUI('user', '', true, [{
        dataUrl: imageUrl,
        name: fileName || 'Image'
    }]);
}

if (searchChatsInput) {
    searchChatsInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const chatItems = document.querySelectorAll('.chat-item');
        
        chatItems.forEach(item => {
            const topic = item.querySelector('.chat-topic').textContent.toLowerCase();
            if (topic.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

async function loadChats() {
    // Only load chat history if user is logged in
    if (!authToken) {
        chats = [];
        renderChatHistory();
        return;
    }
    
    // If user is logged in, load from database
    try {
        const response = await fetch('/api/auth/chat-history', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            chats = data.chats || [];
            
            // Format chats properly (ensure all required fields)
            chats = chats.map(chat => ({
                sessionId: chat.sessionId,
                topic: chat.topic || 'New Chat',
                messages: chat.messages || [],
                createdAt: chat.createdAt || Date.now(),
                updatedAt: chat.updatedAt || Date.now()
            }));
            
            renderChatHistory();
            
            // Also save to localStorage as backup
            localStorage.setItem('ceoChats', JSON.stringify(chats));
            return;
        } else {
            // If unauthorized, user might be logged out
            if (response.status === 401) {
                logout();
                return;
            }
        }
    } catch (error) {
        console.error('Failed to load chat history from database:', error);
        // Try to load from localStorage as fallback
        chats = JSON.parse(localStorage.getItem('ceoChats') || '[]');
        renderChatHistory();
    }
}

async function saveChats() {
    // Always save to localStorage first (for quick access)
    localStorage.setItem('ceoChats', JSON.stringify(chats));
    
    // Only save to database if user is logged in
    if (!authToken) {
        return;
    }
    
    // Ensure chats array is not empty and has valid data
    if (!chats || chats.length === 0) {
        return;
    }
    
    // Format chats properly before saving to database
    const formattedChats = chats.map(chat => {
        // Ensure chat has required fields
        if (!chat.sessionId) {
            chat.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        if (!chat.messages) {
            chat.messages = [];
        }
        
        return {
            sessionId: chat.sessionId,
            topic: chat.topic || 'New Chat',
            messages: chat.messages.map(msg => ({
                role: msg.role || 'user',
                content: msg.content || '',
                attachments: msg.attachments || null
            }))
        };
    }).filter(chat => chat.messages.length > 0 || chat.topic !== 'New Chat'); // Only save chats with messages or custom topics
    
    // If user is logged in, also save to database
    try {
        const response = await fetch('/api/auth/chat-history', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ chats: formattedChats })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                // Token expired, logout user
                console.error('Authentication failed, logging out');
                logout();
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Failed to save chat history:', errorData.error || response.statusText);
            }
        } else {
            console.log('Chat history saved successfully to database');
        }
    } catch (error) {
        console.error('Failed to save chat history to database:', error);
        // Continue anyway - localStorage is saved
    }
}

async function createNewChat() {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const newChat = {
        sessionId: sessionId,
        topic: 'New Chat',
        createdAt: Date.now(),
        messages: []

    };
    
    chats.unshift(newChat);
    await saveChats(); // Ensure chat is saved
    renderChatHistory();
    loadChat(sessionId, 0);
}

function loadChat(sessionId, index) {
    currentSessionId = sessionId;
    currentChatIndex = index;
    
    const chat = chats.find(c => c.sessionId === sessionId);
    if (!chat) return;

    clearPendingAttachmentPreviews();

    document.querySelectorAll('.chat-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });

    chatContainer.innerHTML = '';

    if (chat.messages.length === 0) {
        showWelcomeScreen();
    } else {

        chat.messages.forEach(msg => {
            const displayRole = msg.role === 'assistant' ? 'ai' : msg.role;
            if (msg.attachments && msg.attachments.length > 0) {
                addMessageToUI(displayRole, msg.content || '', false, msg.attachments);
            } else if (msg.image) {
                addMessageToUI(displayRole, '', false, [{
                    dataUrl: msg.image,
                    name: msg.fileName || 'Image'
                }]);
            } else {
                addMessageToUI(displayRole, msg.content, false);
            }
        });
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;
}


function renderChatHistory() {
    const historySection = chatHistoryContainer.querySelector('.history-section');
    if (!historySection) return;

    const sectionTitle = historySection.querySelector('.section-title');
    historySection.innerHTML = '';
    if (sectionTitle) {
        historySection.appendChild(sectionTitle);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    chats.forEach((chat, index) => {
        const chatDate = new Date(chat.createdAt);
        chatDate.setHours(0, 0, 0, 0);
        
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        if (index === currentChatIndex) {
            chatItem.classList.add('active');
        }
        
        const topicSpan = document.createElement('span');
        topicSpan.className = 'chat-topic';
        topicSpan.textContent = chat.topic;
        
        const menuBtn = document.createElement('button');
        menuBtn.className = 'chat-menu-btn';
        menuBtn.textContent = '⋯';
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.deleteChat(chat.sessionId);
        });
        
        chatItem.appendChild(topicSpan);
        chatItem.appendChild(menuBtn);
        
        chatItem.addEventListener('click', () => {
            loadChat(chat.sessionId, index);
        });
        
        historySection.appendChild(chatItem);
    });
}

async function generateChatTopic(sessionId, userMessage, aiResponse) {
    const chat = chats.find(c => c.sessionId === sessionId);
    if (!chat) return;

    let topic = 'New Chat';

    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'what', 'how', 'why', 'when', 'where', 'who', 'which'];

    const cleanUserMsg = userMessage.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word));

    const aiFirstSentence = aiResponse.split(/[.!?]/)[0].toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.includes(word));

    const allKeywords = [...new Set([...cleanUserMsg.slice(0, 3), ...aiFirstSentence.slice(0, 2)])];
    
    if (allKeywords.length > 0) {

        topic = allKeywords.slice(0, 4).map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');

        if (topic.length > 35) {
            topic = topic.substring(0, 35).trim() + '...';
        }
    } else {

        const sentences = userMessage.split(/[.!?]/).filter(s => s.trim().length > 10);
        if (sentences.length > 0) {
            topic = sentences[0].trim();
            if (topic.length > 35) {
                topic = topic.substring(0, 35).trim() + '...';
            }
        }
    }
    
    chat.topic = topic || 'New Chat';
    await saveChats();
    renderChatHistory();
}

async function updateChatTopic(sessionId, firstMessage) {
    const chat = chats.find(c => c.sessionId === sessionId);
    if (!chat) return;

    let topic = firstMessage.substring(0, 50);
    if (firstMessage.length > 50) {
        topic += '...';
    }
    
    chat.topic = topic;
    await saveChats();
    renderChatHistory();
}

window.deleteChat = async function(sessionId) {
    if (confirm('Are you sure you want to delete this chat?')) {
        const deletedIndex = chats.findIndex(c => c.sessionId === sessionId);
        chats = chats.filter(c => c.sessionId !== sessionId);
        await saveChats();
        
        if (chats.length === 0) {
            await createNewChat();
        } else {

            const newIndex = deletedIndex > 0 ? deletedIndex - 1 : 0;
            loadChat(chats[newIndex].sessionId, newIndex);
        }
        renderChatHistory();
    }
};

async function deleteAllChats() {
    // Use SweetAlert for confirmation
    const result = await Swal.fire({
        title: 'Delete All Chat History?',
        text: 'Are you sure you want to delete all your chat history? This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, Delete All',
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        allowOutsideClick: false,
        allowEscapeKey: true,
        backdrop: true,
        customClass: {
            popup: 'swal-popup',
            title: 'swal-title',
            confirmButton: 'swal-confirm-btn',
            cancelButton: 'swal-cancel-btn'
        }
    });

    if (result.isConfirmed) {
        // Delete from database if logged in
        if (authToken && chats.length > 0) {
            for (const chat of chats) {
                try {
                    await fetch('/api/auth/chat-history', {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({ sessionId: chat.sessionId })
                    });
                } catch (error) {
                    console.error('Error deleting session from database:', error);
                }
            }
        }
        
        // Clear local storage
        chats = [];
        localStorage.removeItem('ceoChats');
        
        // Save empty chats
        await saveChats();
        
        // Clear UI
        renderChatHistory();
        if (chatContainer) {
            chatContainer.innerHTML = '';
            showWelcomeScreen();
        }
        
        // Create new chat
        await createNewChat();
        
        // Show success message
        Swal.fire({
            title: 'Deleted Successfully!',
            text: 'All chat history has been deleted.',
            icon: 'success',
            confirmButtonColor: '#7c5dfa',
            confirmButtonText: 'OK',
            allowOutsideClick: false,
            allowEscapeKey: true,
            backdrop: true,
            customClass: {
                popup: 'swal-popup',
                title: 'swal-title',
                confirmButton: 'swal-confirm-btn'
            }
        });
    }
}

function showWelcomeScreen() {
    if (!chatContainer) return;
    chatContainer.innerHTML = `
        <div class="welcome-screen">
            <h1>HarvionGPT</h1>
            <p class="welcome-description">HarvionGPT is an AI assistant built by Harvey. Use it for writing, brainstorming, research, or coding.</p>
        </div>
    `;
}

async function sendMessage() {
    const message = messageInput.value.trim();
    
    if (attachmentUploadsInProgress > 0) {
        addErrorMessage('Please wait for the photo upload to finish before sending.');
        return;
    }
    
    if (!message && pendingAttachments.length === 0) return;
    
    if (!currentSessionId) {
        createNewChat();
    }

    // Ensure chat exists in chats array
    let chat = chats.find(c => c.sessionId === currentSessionId);
    if (!chat) {
        // If chat doesn't exist, create it
        chat = {
            sessionId: currentSessionId,
            topic: 'New Chat',
            createdAt: Date.now(),
            messages: []
        };
        chats.unshift(chat);
        await saveChats(); // Save immediately to ensure chat exists
    }
    
    const isFirstMessage = chat && chat.messages.length === 0;
    const attachmentsForMessage = consumePendingAttachments();

    messageInput.disabled = true;
    sendBtn.disabled = true;

    messageInput.value = '';
    messageInput.style.height = 'auto';

    const welcomeScreen = chatContainer.querySelector('.welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.remove();
    }

    addMessageToUI('user', message, true, attachmentsForMessage);
    
    if (chat) {
        const userMessageRecord = { role: 'user', content: message };
        if (attachmentsForMessage.length > 0) {
            userMessageRecord.attachments = attachmentsForMessage;
        }
        chat.messages.push(userMessageRecord);
        // Save immediately after adding user message
        await saveChats();

        if (isFirstMessage) {
            const topicSeed = message || (attachmentsForMessage[0]?.name ? `Photo: ${attachmentsForMessage[0].name}` : 'Image attachment');
            await updateChatTopic(currentSessionId, topicSeed);
        }
    }

    const typingId = showTypingIndicator();
    
    try {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        // Add auth token if available and attachments are present
        if (authToken && attachmentsForMessage.length > 0) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                message: message,
                sessionId: currentSessionId,
                model: selectedModel === 'auto' ? null : selectedModel,
                attachments: attachmentsForMessage
            })
        });

        const responseText = await response.text();
        if (!responseText || responseText.trim() === '') {
            throw new Error('Empty response from server. Please check your API configuration.');
        }
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Response text:', responseText);
            throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}`);
        }

        removeTypingIndicator(typingId);
        
        if (!response.ok) {
            // Handle authentication and upload limit errors
            if (response.status === 401 && data.error?.includes('Authentication')) {
                authToken = null;
                currentUser = null;
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                showAuthModal('login');
                throw new Error('Please log in to upload attachments');
            } else if (response.status === 403 && data.error?.includes('limit')) {
                await loadUserInfo(); // Refresh upload count
                showNotification(data.error || 'Upload limit reached', 'error');
                throw new Error(data.error || 'Upload limit reached');
            }
            throw new Error(data.error || 'Failed to get response');
        }
        
        // Update upload count after successful upload
        if (attachmentsForMessage.length > 0 && authToken) {
            await loadUserInfo();
        }

        addMessageToUI('ai', data.response);

        if (chat) {
            chat.messages.push({ role: 'ai', content: data.response });
            // Save immediately after adding AI response
            await saveChats();

            if (isFirstMessage) {
                const sourceMessage = message || 'Image attachment';
                await generateChatTopic(currentSessionId, sourceMessage, data.response);
            }
        }
        
    } catch (error) {

        removeTypingIndicator(typingId);

        const errorMessage = error.message || 'Failed to get AI response';

        if (errorMessage.includes('rate limit') || errorMessage.includes('429') || 
            errorMessage.includes('quota') || errorMessage.includes('Rate limit')) {
            addRateLimitMessage();
        } else if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
            addTimeoutMessage();
        } else {
            addErrorMessage(errorMessage);
        }
    } finally {

        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

function addMessageToUI(role, content, scroll = true, attachments = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}${role === 'ai' ? ' typing' : ''}`;

    const plainTextContent = typeof content === 'string' ? content.trim() : '';
    
    if (role === 'ai') {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        const logoPath = getLogoPath();

        avatarDiv.innerHTML = `<div class="avatar-circle"><img src="${logoPath}" alt="CEO AI" class="avatar-logo" onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='CEO'; this.parentElement.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; this.parentElement.style.color='white'; this.parentElement.style.fontSize='12px'; this.parentElement.style.fontWeight='600';"></div>`;
        messageDiv.appendChild(avatarDiv);
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    const textContainer = document.createElement('div');
    textContainer.className = 'message-text';
    contentDiv.appendChild(textContainer);

    const attachmentList = Array.isArray(attachments) ? attachments : [];
    const hasStandaloneImage = !attachmentList.length && content && typeof content === 'string' && content.startsWith('data:image/');

    if (hasStandaloneImage) {
        const imageElement = document.createElement('img');
        imageElement.src = content;
        imageElement.className = 'chat-image';
        textContainer.appendChild(imageElement);
    } else if (content) {
        if (role === 'user') {
            textContainer.textContent = content;
        } else {
            textContainer.innerHTML = formatMessage(content);
        }
    }

    if (attachmentList.length > 0) {
        const attachmentWrapper = document.createElement('div');
        attachmentWrapper.className = 'attachment-wrapper';

        attachmentList.forEach((attachment) => {
            const imageUrl = attachment?.dataUrl || attachment?.url || attachment?.image;
            if (!imageUrl) {
                return;
            }

            const attachmentItem = document.createElement('div');
            attachmentItem.className = 'attachment-item';

            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = attachment?.name || 'Attachment';
            img.className = 'chat-image';

            attachmentItem.appendChild(img);

            if (attachment?.name) {
                const caption = document.createElement('div');
                caption.className = 'attachment-caption';
                caption.textContent = attachment.name;
                attachmentItem.appendChild(caption);
            }

            attachmentWrapper.appendChild(attachmentItem);
        });

        contentDiv.appendChild(attachmentWrapper);
    }
    
    messageDiv.appendChild(contentDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    messageDiv.appendChild(actionsDiv);

    const appendCopyBtn = () => {
        if (!plainTextContent) return;
        actionsDiv.innerHTML = '';
        const copyBtn = createCopyButton(plainTextContent);
        actionsDiv.appendChild(copyBtn);
    };

    if (role === 'ai') {
        messageDiv.classList.add('typing-animation');
        const formattedContent = formatMessage(plainTextContent);
        animateMessageText(textContainer, formattedContent, () => {
            messageDiv.classList.remove('typing', 'typing-animation');
            messageDiv.classList.add('completed');
            appendCopyBtn();
            setTimeout(() => {
                messageDiv.classList.remove('completed');
            }, 1500);
        });
    } else {
        if (plainTextContent) {
            textContainer.innerHTML = formatMessage(plainTextContent);
        }
    }

    chatContainer.appendChild(messageDiv);

    if (scroll) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function formatMessage(text) {
    if (!text) {
        return '';
    }

    const lines = text.split('\n');
    let html = '';
    let inList = false;

    lines.forEach((line) => {
        const trimmed = line.trim();
        const bulletMatch = trimmed.match(/^(-|\*|•|\d+\.)\s+(.*)/);

        if (bulletMatch) {
            if (!inList) {
                inList = true;
                html += '<ul class="message-list">';
            }
            html += `<li>${formatInlineMarkdown(bulletMatch[2])}</li>`;
        } else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }

            if (trimmed.length > 0) {
                html += `<p>${formatInlineMarkdown(trimmed)}</p>`;
            } else {
                html += '<br>';
            }
        }
    });

    if (inList) {
        html += '</ul>';
    }

    if (!html) {
        return formatInlineMarkdown(text).replace(/\n/g, '<br>');
    }

    return html;
}

function formatInlineMarkdown(text = '') {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function createCopyButton(content = '') {
    const button = document.createElement('button');
    button.className = 'copy-btn text-token-text-secondary hover:bg-token-bg-secondary rounded-lg';
    button.type = 'button';
    button.setAttribute('aria-label', 'Copy message');
    button.innerHTML = `
        <span class="copy-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon">
                <path d="M12.668 10.667C12.668 9.95614 12.668 9.46258 12.6367 9.0791C12.6137 8.79732 12.5758 8.60761 12.5244 8.46387L12.4688 8.33399C12.3148 8.03193 12.0803 7.77885 11.793 7.60254L11.666 7.53125C11.508 7.45087 11.2963 7.39395 10.9209 7.36328C10.5374 7.33197 10.0439 7.33203 9.33301 7.33203H6.5C5.78896 7.33203 5.29563 7.33195 4.91211 7.36328C4.63016 7.38632 4.44065 7.42413 4.29688 7.47559L4.16699 7.53125C3.86488 7.68518 3.61186 7.9196 3.43555 8.20703L3.36524 8.33399C3.28478 8.49198 3.22795 8.70352 3.19727 9.0791C3.16595 9.46259 3.16504 9.95611 3.16504 10.667V13.5C3.16504 14.211 3.16593 14.7044 3.19727 15.0879C3.22797 15.4636 3.28473 15.675 3.36524 15.833L3.43555 15.959C3.61186 16.2466 3.86474 16.4807 4.16699 16.6348L4.29688 16.6914C4.44063 16.7428 4.63025 16.7797 4.91211 16.8027C5.29563 16.8341 5.78896 16.835 6.5 16.835H9.33301C10.0439 16.835 10.5374 16.8341 10.9209 16.8027C11.2965 16.772 11.508 16.7152 11.666 16.6348L11.793 16.5645C12.0804 16.3881 12.3148 16.1351 12.4688 15.833L12.5244 15.7031C12.5759 15.5594 12.6137 15.3698 12.6367 15.0879C12.6681 14.7044 12.668 14.211 12.668 13.5V10.667Z"></path>
                <path d="M13.998 12.665C14.4528 12.6634 14.8011 12.6602 15.0879 12.6367C15.4635 12.606 15.675 12.5492 15.833 12.4688L15.959 12.3975C16.2466 12.2211 16.4808 11.9682 16.6348 11.666L16.6914 11.5361C16.7428 11.3924 16.7797 11.2026 16.8027 10.9209C16.8341 10.5374 16.835 10.0439 16.835 9.33301V6.5C16.835 5.78896 16.8341 5.29563 16.8027 4.91211C16.7797 4.63025 16.7428 4.44063 16.6914 4.29688L16.6348 4.16699C16.4807 3.86474 16.2466 3.61186 15.959 3.43555L15.833 3.36524C15.675 3.28473 15.4636 3.22797 15.0879 3.19727C14.7044 3.16593 14.211 3.16504 13.5 3.16504H10.667C9.9561 3.16504 9.46259 3.16595 9.0791 3.19727C8.79739 3.22028 8.6076 3.2572 8.46387 3.30859L8.33399 3.36524C8.03176 3.51923 7.77886 3.75343 7.60254 4.04102L7.53125 4.16699C7.4508 4.32498 7.39397 4.53655 7.36328 4.91211C7.33985 5.19893 7.33562 5.54719 7.33399 6.00195H9.33301C10.022 6.00195 10.5791 6.00131 11.0293 6.03809C11.4873 6.07551 11.8937 6.15471 12.2705 6.34668L12.4883 6.46875C12.984 6.7728 13.3878 7.20854 13.6533 7.72949L13.7197 7.87207C13.8642 8.20859 13.9292 8.56974 13.9619 8.9707C13.9987 9.42092 13.998 9.97799 13.998 10.667V12.665Z"></path>
            </svg>
        </span>
    `;

    // Handle both click and touch events for better mobile support
    const handleCopy = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            await navigator.clipboard.writeText(content);
            button.classList.add('copied');
            setTimeout(() => button.classList.remove('copied'), 1800);
        } catch (err) {
            console.error('Copy failed:', err);
            // Fallback for older browsers or mobile
            try {
                const textArea = document.createElement('textarea');
                textArea.value = content;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    button.classList.add('copied');
                    setTimeout(() => button.classList.remove('copied'), 1800);
                }
            } catch (fallbackErr) {
                console.error('Fallback copy failed:', fallbackErr);
            }
        }
    };
    
    button.addEventListener('click', handleCopy);
    button.addEventListener('touchend', handleCopy);

    return button;
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai';
    typingDiv.id = 'typing-indicator';
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    
    typingDiv.appendChild(indicator);
    chatContainer.appendChild(typingDiv);

    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return 'typing-indicator';
}

function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

function addErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-icon">⚠️</div>
        <div class="error-content">
            <div class="error-title">Error</div>
            <div class="error-text">${message}</div>
        </div>
    `;
    chatContainer.appendChild(errorDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addRateLimitMessage() {
    const rateLimitDiv = document.createElement('div');
    rateLimitDiv.className = 'rate-limit-message';
    rateLimitDiv.innerHTML = `
        <div class="rate-limit-icon">⏱️</div>
        <div class="rate-limit-content">
            <div class="rate-limit-title">Rate limit exceeded</div>
            <div class="rate-limit-text">You've hit your usage limit. Please wait a moment and try again.</div>
            <div class="rate-limit-suggestion">If this persists, check your API quota or try again later.</div>
        </div>
    `;
    chatContainer.appendChild(rateLimitDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addTimeoutMessage() {
    const timeoutDiv = document.createElement('div');
    timeoutDiv.className = 'error-message timeout-message';
    timeoutDiv.innerHTML = `
        <div class="error-icon">⏳</div>
        <div class="error-content">
            <div class="error-title">Request timeout</div>
            <div class="error-text">The request took too long to complete. Please try again.</div>
        </div>
    `;
    chatContainer.appendChild(timeoutDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Model selector handlers are now handled via event delegation above

if (modelSelectorDropdown) {
    modelSelectorDropdown.addEventListener('click', (e) => {
        const modelOption = e.target.closest('.model-option');
        if (modelOption) {
            const modelType = modelOption.getAttribute('data-type');
            const modelName = modelOption.getAttribute('data-model');
            
            if (modelType === 'image' && modelName) {
                const imagePrompt = prompt('Enter a prompt for image generation:');
                if (imagePrompt && imagePrompt.trim()) {
                    generateImage(imagePrompt.trim(), modelName);
                }
                modelSelectorDropdown.classList.remove('show');
                modelSelectorBtn.classList.remove('active');
            } else if (modelName) {

                selectedModel = modelName;

                document.querySelectorAll('.model-option').forEach(option => {
                    option.classList.remove('selected');
                });
                modelOption.classList.add('selected');

                const modelNameText = modelOption.querySelector('.model-option-name').textContent;
                modelSelectorBtn.querySelector('span:first-child').textContent = modelName === 'auto' ? 'Auto' : modelNameText;

                modelSelectorDropdown.classList.remove('show');
                modelSelectorBtn.classList.remove('active');
                
                console.log('Selected model:', selectedModel);
            }
        }

        const toggleSwitch = e.target.closest('.toggle-switch');
        if (toggleSwitch && toggleSwitch.getAttribute('data-model') === 'auto') {
            toggleSwitch.classList.toggle('active');
            if (toggleSwitch.classList.contains('active')) {
                selectedModel = 'auto';
                document.querySelectorAll('.model-option').forEach(option => {
                    option.classList.remove('selected');
                });
                document.querySelector('.auto-option').classList.add('selected');
                modelSelectorBtn.querySelector('span:first-child').textContent = 'Auto';
            }
        }
    });
}

if (modelSelectorDropdown) {
    const autoOption = modelSelectorDropdown.querySelector('.auto-option');
    if (autoOption) {
        autoOption.classList.add('selected');
    }
}

async function generateImage(prompt, modelName = null) {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    if (!currentSessionId) {
        createNewChat();
    }

    const chat = chats.find(c => c.sessionId === currentSessionId);
    const isFirstMessage = chat && chat.messages.length === 0;
    const userPromptMessage = `Generate image: ${trimmedPrompt}`;

    messageInput.disabled = true;
    sendBtn.disabled = true;

    const welcomeScreen = chatContainer.querySelector('.welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.remove();
    }

    addMessageToUI('user', userPromptMessage);

    if (chat) {
        chat.messages.push({ role: 'user', content: userPromptMessage });
        await saveChats();

        if (isFirstMessage) {
            await updateChatTopic(currentSessionId, userPromptMessage);
        }
    }

    const loadingId = showImageLoading();
    
    try {
        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: trimmedPrompt,
                model: modelName
            })
        });
        
        const responseText = await response.text();
        if (!responseText || responseText.trim() === '') {
            throw new Error('Empty response from image generator.');
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Image generation JSON Parse Error:', parseError);
            console.error('Response text:', responseText);
            throw new Error(`Invalid response from server: ${responseText.substring(0, 120)}`);
        }

        removeImageLoading(loadingId);
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate image');
        }

        const attachment = displayGeneratedImage(data.imageUrl, trimmedPrompt, data.model || modelName);

        if (chat && attachment) {
            chat.messages.push({
                role: 'ai',
                content: '',
                attachments: [attachment]
            });
            await saveChats();

            if (isFirstMessage) {
                await generateChatTopic(currentSessionId, userPromptMessage, 'Generated image');
            }
        }
        
    } catch (error) {

        removeImageLoading(loadingId);

        addErrorMessage(error.message || 'Failed to generate image');
    } finally {

        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

function displayGeneratedImage(imageUrl, prompt, modelId) {
    const normalizedUrl = typeof imageUrl === 'string' ? imageUrl : '';
    if (!normalizedUrl) {
        addErrorMessage('Image URL missing from generator response.');
        return null;
    }

    const attachment = {
        dataUrl: normalizedUrl.startsWith('data:') ? normalizedUrl : null,
        url: normalizedUrl.startsWith('http') ? normalizedUrl : null,
        name: `Generated: ${prompt}`,
        model: modelId || 'stabilityai/stable-diffusion-xl-base-1.0'
    };

    if (!attachment.dataUrl && !attachment.url) {
        attachment.dataUrl = normalizedUrl;
    }

    addMessageToUI('ai', '', true, [attachment]);

    return attachment;
}

function animateMessageText(container, formattedHtml, onComplete) {
    if (!formattedHtml) {
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    container.innerHTML = '';
    const tempEl = document.createElement('div');
    tempEl.innerHTML = formattedHtml;

    const nodes = Array.from(tempEl.childNodes);
    let index = 0;

    function typeNextNode() {
        if (index >= nodes.length) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        const node = nodes[index];
        const clone = node.cloneNode(true);

        if (clone.nodeType === Node.TEXT_NODE) {
            const text = clone.textContent;
            const span = document.createElement('span');
            container.appendChild(span);
            typeText(span, text, () => {
                index++;
                typeNextNode();
            });
        } else {
            container.appendChild(clone);
            index++;
            requestAnimationFrame(typeNextNode);
        }
    }

    function typeText(element, text, done) {
        let charIndex = 0;
        function addNextChar() {
            if (charIndex >= text.length) {
                done();
                return;
            }
            element.textContent += text.charAt(charIndex);
            charIndex++;
            const delay = Math.random() * 25 + 10;
            setTimeout(addNextChar, delay);
        }
        addNextChar();
    }

    typeNextNode();
}

function showImageLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai';
    loadingDiv.id = 'image-loading';
    
    const indicator = document.createElement('div');
    indicator.className = 'image-loading-indicator';
    indicator.innerHTML = '<div class="spinner"></div><p>Generating image...</p>';
    
    loadingDiv.appendChild(indicator);
    chatContainer.appendChild(loadingDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return 'image-loading';
}

function removeImageLoading(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

messageInput.focus();
