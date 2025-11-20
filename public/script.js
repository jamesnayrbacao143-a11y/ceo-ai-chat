// Chat Management System
let chats = JSON.parse(localStorage.getItem('ceoChats') || '[]');
let currentSessionId = null;
let currentChatIndex = -1;
// Auto model selection - balanced quality and speed (handled by server)
let currentChatModel = null; // Will use server default

const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const chatHistoryContainer = document.querySelector('.chat-history');
const newChatBtn = document.getElementById('newChatBtn') || document.querySelector('.new-chat-btn');
const searchChatsInput = document.getElementById('searchChats');
const modelSelectorBtn = document.getElementById('modelSelectorBtn');
const modelSelectorDropdown = document.getElementById('modelSelectorDropdown');
let selectedModel = 'auto'; // Default to auto

// Logo path - update this if your logo has a different name or format
function getLogoPath() {
    // Try different formats in order of preference
    const formats = ['logo.png', 'logo.svg', 'logo.webp', 'logo.jpg'];
    // For now, return the first one - user should place their logo file in public folder
    return formats[0]; // Change index if using different format
}

// Dark Mode Toggle
const darkModeToggle = document.getElementById('darkModeToggle');
const html = document.documentElement;

// Load dark mode preference from localStorage
function loadDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        html.setAttribute('data-theme', 'dark');
    } else {
        html.removeAttribute('data-theme');
    }
}

// Toggle dark mode
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

// Initialize dark mode
loadDarkMode();

// Add event listener for dark mode toggle
if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
}

// Initialize
loadChats();
if (chats.length === 0) {
    createNewChat();
} else {
    loadChat(chats[0].sessionId, 0);
}

// Toggle sidebar on mobile
if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    }
});

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Send message on Enter (Shift+Enter for new line)
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Send button click
sendBtn.addEventListener('click', sendMessage);

// Clear chat button
clearBtn.addEventListener('click', deleteAllChats);

// New chat button
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        createNewChat();
    });
}

// Upgrade button - show custom modal
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

// Close modal when clicking outside
if (upgradeModal) {
    upgradeModal.addEventListener('click', (e) => {
        if (e.target === upgradeModal) {
            upgradeModal.classList.remove('show');
            document.body.style.overflow = '';
        }
    });
}

// Attach button - image upload (LOCKED FOR NOW)
const attachBtn = document.getElementById('attachBtn');
const imageUpload = document.getElementById('imageUpload');
if (attachBtn && imageUpload) {
    // Disable attach button
    attachBtn.disabled = true;
    attachBtn.style.opacity = '0.5';
    attachBtn.style.cursor = 'not-allowed';
    attachBtn.title = 'Attachment feature is coming soon';
    
    // Comment out the functionality for now
    /*
    attachBtn.addEventListener('click', () => {
        imageUpload.click();
    });
    
    imageUpload.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    handleImageUpload(file);
                } else {
                    alert('Please upload an image file only.');
                }
            });
        }
        // Reset input so same file can be selected again
        imageUpload.value = '';
    });
    */
}

// Handle image upload
function handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageUrl = e.target.result;
        // Add image to chat
        addImageToChat(imageUrl, file.name);
    };
    reader.readAsDataURL(file);
}

// Add image to chat UI
function addImageToChat(imageUrl, fileName) {
    // Remove welcome screen if visible
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.remove();
    }
    
    // Create image message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const imageElement = document.createElement('img');
    imageElement.src = imageUrl;
    imageElement.alt = fileName;
    imageElement.className = 'chat-image';
    imageElement.style.maxWidth = '100%';
    imageElement.style.borderRadius = '8px';
    imageElement.style.marginTop = '8px';
    
    contentDiv.appendChild(imageElement);
    messageDiv.appendChild(contentDiv);
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Save to chat history
    if (currentChatIndex >= 0 && chats[currentChatIndex]) {
        chats[currentChatIndex].messages.push({
            role: 'user',
            content: '',
            image: imageUrl,
            fileName: fileName
        });
        saveChats();
    }
}

// Search chats
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

// Load chats from localStorage
function loadChats() {
    chats = JSON.parse(localStorage.getItem('ceoChats') || '[]');
    renderChatHistory();
}

// Save chats to localStorage
function saveChats() {
    localStorage.setItem('ceoChats', JSON.stringify(chats));
}

// Create new chat
function createNewChat() {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const newChat = {
        sessionId: sessionId,
        topic: 'New Chat',
        createdAt: Date.now(),
        messages: []
        // Model is auto-selected by server (balanced quality and speed)
    };
    
    chats.unshift(newChat); // Add to beginning
    saveChats();
    renderChatHistory();
    loadChat(sessionId, 0);
}

// Load a specific chat
function loadChat(sessionId, index) {
    currentSessionId = sessionId;
    currentChatIndex = index;
    
    const chat = chats.find(c => c.sessionId === sessionId);
    if (!chat) return;
    
    // Update active state in sidebar
    document.querySelectorAll('.chat-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
    
    // Clear chat container
    chatContainer.innerHTML = '';
    
    // Show welcome screen if no messages
    if (chat.messages.length === 0) {
        showWelcomeScreen();
    } else {
        // Load messages
        chat.messages.forEach(msg => {
            if (msg.image) {
                // Load image message
                addImageToChat(msg.image, msg.fileName || 'Image');
            } else {
                // Map role: 'assistant' -> 'ai', 'user' -> 'user'
                const displayRole = msg.role === 'assistant' ? 'ai' : msg.role;
                addMessageToUI(displayRole, msg.content, false);
            }
        });
    }
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Model selection is now automatic - no manual selection needed

// Render chat history in sidebar
function renderChatHistory() {
    const historySection = chatHistoryContainer.querySelector('.history-section');
    if (!historySection) return;
    
    // Clear existing chat items (except section title)
    const sectionTitle = historySection.querySelector('.section-title');
    historySection.innerHTML = '';
    if (sectionTitle) {
        historySection.appendChild(sectionTitle);
    }
    
    // Group chats by date
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

// Generate chat topic from conversation
function generateChatTopic(sessionId, userMessage, aiResponse) {
    const chat = chats.find(c => c.sessionId === sessionId);
    if (!chat) return;
    
    // Extract meaningful topic from the conversation
    let topic = 'New Chat';
    
    // Remove common words and extract key phrases
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'what', 'how', 'why', 'when', 'where', 'who', 'which'];
    
    // Clean and extract keywords from user message
    const cleanUserMsg = userMessage.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word));
    
    // Extract keywords from AI response (first sentence)
    const aiFirstSentence = aiResponse.split(/[.!?]/)[0].toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.includes(word));
    
    // Combine and get unique keywords
    const allKeywords = [...new Set([...cleanUserMsg.slice(0, 3), ...aiFirstSentence.slice(0, 2)])];
    
    if (allKeywords.length > 0) {
        // Create topic from keywords (capitalize first letter of each word)
        topic = allKeywords.slice(0, 4).map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
        
        // Limit to 35 characters for better display
        if (topic.length > 35) {
            topic = topic.substring(0, 35).trim() + '...';
        }
    } else {
        // Fallback: use first meaningful part of user message
        const sentences = userMessage.split(/[.!?]/).filter(s => s.trim().length > 10);
        if (sentences.length > 0) {
            topic = sentences[0].trim();
            if (topic.length > 35) {
                topic = topic.substring(0, 35).trim() + '...';
            }
        }
    }
    
    chat.topic = topic || 'New Chat';
    saveChats();
    renderChatHistory();
}

// Update chat topic from first message (fallback)
function updateChatTopic(sessionId, firstMessage) {
    const chat = chats.find(c => c.sessionId === sessionId);
    if (!chat) return;
    
    // Extract topic (first 50 characters of first message)
    let topic = firstMessage.substring(0, 50);
    if (firstMessage.length > 50) {
        topic += '...';
    }
    
    chat.topic = topic;
    saveChats();
    renderChatHistory();
}

// Delete a specific chat (global function for onclick)
window.deleteChat = function(sessionId) {
    if (confirm('Are you sure you want to delete this chat?')) {
        const deletedIndex = chats.findIndex(c => c.sessionId === sessionId);
        chats = chats.filter(c => c.sessionId !== sessionId);
        saveChats();
        
        if (chats.length === 0) {
            createNewChat();
        } else {
            // Load the next available chat
            const newIndex = deletedIndex > 0 ? deletedIndex - 1 : 0;
            loadChat(chats[newIndex].sessionId, newIndex);
        }
        renderChatHistory();
    }
};

// Delete all chats
async function deleteAllChats() {
    if (confirm('Are you sure you want to delete all chat history?')) {
        // Clear all sessions on server
        for (const chat of chats) {
            try {
                await fetch('/api/clear', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sessionId: chat.sessionId })
                });
            } catch (error) {
                console.error('Error clearing session:', error);
            }
        }
        
        chats = [];
        saveChats();
        createNewChat();
    }
}

// Show welcome screen
function showWelcomeScreen() {
    chatContainer.innerHTML = `
        <div class="welcome-screen">
            <h1>CEO AI</h1>
            <p class="welcome-description">CEO AI is an AI chatbot that writes text. You can use it to write stories, messages, or programming code.</p>
        </div>
    `;
}

async function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    if (!currentSessionId) {
        createNewChat();
    }
    
    // Disable input while processing
    messageInput.disabled = true;
    sendBtn.disabled = true;
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Remove welcome screen if present
    const welcomeScreen = chatContainer.querySelector('.welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.remove();
    }
    
    // Check if this is the first message
    const chat = chats.find(c => c.sessionId === currentSessionId);
    const isFirstMessage = chat && chat.messages.length === 0;
    
    // Add user message to chat
    addMessageToUI('user', message);
    
    // Save message to chat history
    if (chat) {
        chat.messages.push({ role: 'user', content: message });
        saveChats();
        
        // Update topic if this is the first message
        if (isFirstMessage) {
            updateChatTopic(currentSessionId, message);
        }
    }
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                sessionId: currentSessionId,
                model: selectedModel === 'auto' ? null : selectedModel // Send null for auto (server will use default)
            })
        });
        
        const data = await response.json();
        
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to get response');
        }
        
        // Add AI response to chat
        addMessageToUI('ai', data.response);
        
        // Save AI message to chat history
        if (chat) {
            chat.messages.push({ role: 'ai', content: data.response });
            saveChats();
            
            // Update topic based on conversation (use AI response to generate better topic)
            if (isFirstMessage) {
                generateChatTopic(currentSessionId, message, data.response);
            }
        }
        
    } catch (error) {
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        // Show error message with ChatGPT-style rate limit messages
        const errorMessage = error.message || 'Failed to get AI response';
        
        // Check for rate limit errors
        if (errorMessage.includes('rate limit') || errorMessage.includes('429') || 
            errorMessage.includes('quota') || errorMessage.includes('Rate limit')) {
            addRateLimitMessage();
        } else if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
            addTimeoutMessage();
        } else {
            addErrorMessage(errorMessage);
        }
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

function addMessageToUI(role, content, scroll = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    // Add avatar for AI messages
    if (role === 'ai') {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        const logoPath = getLogoPath();
        // Use logo image with fallback to text if image fails to load
        avatarDiv.innerHTML = `<div class="avatar-circle"><img src="${logoPath}" alt="CEO AI" class="avatar-logo" onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='CEO'; this.parentElement.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; this.parentElement.style.color='white'; this.parentElement.style.fontSize='12px'; this.parentElement.style.fontWeight='600';"></div>`;
        messageDiv.appendChild(avatarDiv);
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Check if content is an image data URL
    if (content && typeof content === 'string' && content.startsWith('data:image/')) {
        const imageElement = document.createElement('img');
        imageElement.src = content;
        imageElement.className = 'chat-image';
        contentDiv.appendChild(imageElement);
    } else if (role === 'user') {
        contentDiv.textContent = content;
    } else {
        // Format AI response (preserve line breaks)
        contentDiv.innerHTML = formatMessage(content);
    }
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    if (scroll) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function formatMessage(text) {
    // Convert line breaks to <br>
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
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
    
    // Scroll to bottom
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

// Model selector functionality
if (modelSelectorBtn) {
    modelSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modelSelectorDropdown.classList.toggle('show');
        modelSelectorBtn.classList.toggle('active');
    });
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!modelSelectorBtn.contains(e.target) && !modelSelectorDropdown.contains(e.target)) {
        modelSelectorDropdown.classList.remove('show');
        modelSelectorBtn.classList.remove('active');
    }
});

// Handle model option clicks
if (modelSelectorDropdown) {
    modelSelectorDropdown.addEventListener('click', (e) => {
        const modelOption = e.target.closest('.model-option');
        if (modelOption) {
            const modelType = modelOption.getAttribute('data-type');
            const modelName = modelOption.getAttribute('data-model');
            
            if (modelType === 'image' && modelName) {
                // Image generation
                const prompt = prompt('Enter a prompt for image generation:');
                if (prompt && prompt.trim()) {
                    generateImage(prompt.trim());
                }
                modelSelectorDropdown.classList.remove('show');
                modelSelectorBtn.classList.remove('active');
            } else if (modelName) {
                // Chat model selection
                selectedModel = modelName;
                
                // Update UI
                document.querySelectorAll('.model-option').forEach(option => {
                    option.classList.remove('selected');
                });
                modelOption.classList.add('selected');
                
                // Update button text
                const modelNameText = modelOption.querySelector('.model-option-name').textContent;
                modelSelectorBtn.querySelector('span:first-child').textContent = modelName === 'auto' ? 'Auto' : modelNameText;
                
                // Close dropdown
                modelSelectorDropdown.classList.remove('show');
                modelSelectorBtn.classList.remove('active');
                
                console.log('Selected model:', selectedModel);
            }
        }
        
        // Handle toggle switch for Auto
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

// Initialize: Set Auto as selected
if (modelSelectorDropdown) {
    const autoOption = modelSelectorDropdown.querySelector('.auto-option');
    if (autoOption) {
        autoOption.classList.add('selected');
    }
}

// Generate image function
async function generateImage(prompt) {
    // Disable input while processing
    messageInput.disabled = true;
    sendBtn.disabled = true;
    
    // Remove welcome screen if present
    const welcomeScreen = chatContainer.querySelector('.welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.remove();
    }
    
    // Add user prompt to chat
    addMessageToUI('user', `Generate image: ${prompt}`);
    
    // Show loading indicator
    const loadingId = showImageLoading();
    
    try {
        const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            body: JSON.stringify({ prompt: prompt })
        });
        
        const data = await response.json();
        
        // Remove loading indicator
        removeImageLoading(loadingId);
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate image');
        }
        
        // Display generated image
        displayGeneratedImage(data.imageUrl, prompt);
        
    } catch (error) {
        // Remove loading indicator
        removeImageLoading(loadingId);
        
        // Show error message
        addErrorMessage(error.message);
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

// Display generated image
function displayGeneratedImage(imageUrl, prompt) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const imageContainer = document.createElement('div');
    imageContainer.className = 'generated-image-container';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'generated-image';
    img.loading = 'lazy';
    
    const promptText = document.createElement('p');
    promptText.className = 'image-prompt';
    promptText.textContent = `Generated: ${prompt}`;
    
    imageContainer.appendChild(img);
    imageContainer.appendChild(promptText);
    contentDiv.appendChild(imageContainer);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show image loading indicator
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

// Remove image loading indicator
function removeImageLoading(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

// Focus input on load
messageInput.focus();
