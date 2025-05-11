// Enhanced Alpaca AI - Main JavaScript
const socket = io();

// Global state management
const state = {
    currentChatId: null,
    isGenerating: false,
    baseModels: [],
    customModels: [],
    messageQueue: [],
    connectionRetries: 0,
    maxRetries: 3
};

// DOM element cache
const elements = {
    // Sidebar elements
    newChatBtn: document.getElementById('new-chat-btn'),
    manageModelsBtn: document.getElementById('manage-models-btn'),
    chatList: document.getElementById('chat-list'),
    
    // Chat elements
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    modelSelect: document.getElementById('model-select'),
    messages: document.getElementById('messages'),
    chatTitle: document.getElementById('chat-title'),
    chatModel: document.getElementById('chat-model'),
    deleteChatBtn: document.getElementById('delete-chat-btn'),
    
    // Modal elements
    modal: document.getElementById('custom-model-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    modelForm: document.getElementById('custom-model-form'),
    modelId: document.getElementById('model-id'),
    modelName: document.getElementById('model-name'),
    baseModelSelect: document.getElementById('base-model-select'),
    systemPrompt: document.getElementById('system-prompt'),
    saveModelBtn: document.getElementById('save-model-btn'),
    cancelBtn: document.getElementById('cancel-btn'),
    modelsList: document.getElementById('models-list'),
    
    // Toast container
    toastContainer: document.getElementById('toast-container')
};

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setupKeyboardShortcuts();
    await initializeApp();
});

// Setup all event listeners
function setupEventListeners() {
    // Button events
    elements.newChatBtn.addEventListener('click', createNewChat);
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.deleteChatBtn.addEventListener('click', deleteCurrentChat);
    elements.manageModelsBtn.addEventListener('click', openModelManager);
    
    // Modal events
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.modelForm.addEventListener('submit', handleModelFormSubmit);
    elements.cancelBtn.addEventListener('click', resetModelForm);
    
    // Input events
    elements.messageInput.addEventListener('input', handleInputChange);
    elements.messageInput.addEventListener('keydown', handleKeyPress);
    elements.modelSelect.addEventListener('change', handleModelChange);
    
    // Socket events
    socket.on('connected', handleConnected);
    socket.on('response_start', handleResponseStart);
    socket.on('response_chunk', handleResponseChunk);
    socket.on('response_complete', handleResponseComplete);
    socket.on('error', handleError);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);
    
    // Modal background click
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            closeModal();
        }
    });
    
    // Window events
    window.addEventListener('resize', handleResize);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Cmd/Ctrl + N: New chat
        if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
            e.preventDefault();
            createNewChat();
        }
        
        // Cmd/Ctrl + /: Focus message input
        if ((e.metaKey || e.ctrlKey) && e.key === '/') {
            e.preventDefault();
            elements.messageInput.focus();
        }
        
        // Escape: Close modal
        if (e.key === 'Escape' && elements.modal.style.display !== 'none') {
            closeModal();
        }
    });
}

// Initialize application
async function initializeApp() {
    showLoading();
    
    try {
        await Promise.all([
            loadModels(),
            loadChats()
        ]);
        
        // Check for saved preferences
        loadPreferences();
        
        // Show welcome screen if no chats
        if (state.currentChatId === null) {
            showWelcomeScreen();
        }
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showToast('Failed to initialize app. Please refresh the page.', 'error');
    } finally {
        hideLoading();
    }
}

// Loading states
function showLoading() {
    document.body.classList.add('loading');
}

function hideLoading() {
    document.body.classList.remove('loading');
}

// Toast notifications
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    
    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Connection handling
function handleConnected(data) {
    console.log('Connected:', data.status);
    state.connectionRetries = 0;
    showToast('Connected to server', 'success');
}

function handleDisconnect() {
    console.log('Disconnected from server');
    showToast('Connection lost. Attempting to reconnect...', 'warning');
    attemptReconnect();
}

function handleReconnect() {
    console.log('Reconnected to server');
    showToast('Reconnected to server', 'success');
    processMessageQueue();
}

function attemptReconnect() {
    if (state.connectionRetries < state.maxRetries) {
        state.connectionRetries++;
        setTimeout(() => {
            socket.connect();
        }, 1000 * state.connectionRetries);
    } else {
        showToast('Unable to connect to server. Please check your connection.', 'error');
    }
}

// Network status handlers
function handleOnline() {
    showToast('Connection restored', 'success');
    if (!socket.connected) {
        socket.connect();
    }
}

function handleOffline() {
    showToast('You are offline', 'warning');
}

// Model management
async function loadModels() {
    try {
        const response = await fetch('/api/models');
        const data = await response.json();
        
        if (data.success) {
            state.baseModels = data.models.filter(m => m.type === 'base');
            state.customModels = data.models.filter(m => m.type === 'custom');
            renderModelSelect();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to load models:', error);
        showToast('Failed to load models', 'error');
    }
}

function renderModelSelect() {
    elements.modelSelect.innerHTML = '<option value="">Select a model...</option>';
    
    // Add base models
    if (state.baseModels.length > 0) {
        const baseGroup = document.createElement('optgroup');
        baseGroup.label = 'Base Models';
        
        state.baseModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = `${model.name} (${model.size})`;
            baseGroup.appendChild(option);
        });
        
        elements.modelSelect.appendChild(baseGroup);
    }
    
    // Add custom models
    if (state.customModels.length > 0) {
        const customGroup = document.createElement('optgroup');
        customGroup.label = 'Custom Models';
        
        state.customModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = `${model.name} (based on ${model.base_model})`;
            customGroup.appendChild(option);
        });
        
        elements.modelSelect.appendChild(customGroup);
    }
}

// Chat management
async function loadChats() {
    try {
        const response = await fetch('/api/chats');
        const data = await response.json();
        
        if (data.success) {
            renderChatList(data.chats);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to load chats:', error);
        showToast('Failed to load chat history', 'error');
    }
}

function renderChatList(chats) {
    elements.chatList.innerHTML = '';
    
    if (chats.length === 0) {
        elements.chatList.innerHTML = `
            <div class="empty-message" role="status">
                <p>No chats yet. Start a new conversation!</p>
            </div>
        `;
        return;
    }
    
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.role = 'listitem';
        chatItem.dataset.chatId = chat.id; // Add data attribute for chat ID
        
        if (chat.id === state.currentChatId) {
            chatItem.classList.add('active');
            chatItem.setAttribute('aria-current', 'true');
        }
        
        chatItem.innerHTML = `
            <div class="chat-item-content">
                <h4>${escapeHtml(chat.title)}</h4>
                <p>${escapeHtml(chat.model)}</p>
            </div>
        `;
        
        chatItem.addEventListener('click', () => loadChat(chat.id));
        elements.chatList.appendChild(chatItem);
    });
}

async function createNewChat() {
    const model = elements.modelSelect.value;
    if (!model) {
        showToast('Please select a model first', 'warning');
        elements.modelSelect.focus();
        return;
    }
    
    try {
        showLoading();
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model })
        });
        
        const data = await response.json();
        if (data.success) {
            state.currentChatId = data.chat_id;
            await loadChats();
            clearMessages();
            updateChatHeader('New Chat', model);
            elements.deleteChatBtn.style.display = 'block';
            elements.messageInput.focus();
            showToast('New chat created', 'success');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to create chat:', error);
        showToast('Failed to create chat', 'error');
    } finally {
        hideLoading();
    }
}

async function loadChat(chatId) {
    try {
        showLoading();
        const response = await fetch(`/api/chat/${chatId}`);
        const data = await response.json();
        
        if (data.success) {
            state.currentChatId = chatId;
            elements.modelSelect.value = data.chat.model;
            updateChatHeader(data.chat.title, data.chat.model);
            renderMessages(data.messages);
            updateChatListSelection();
            elements.deleteChatBtn.style.display = 'block';
            savePreferences();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to load chat:', error);
        showToast('Failed to load chat', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteCurrentChat() {
    if (!state.currentChatId) return;
    
    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`/api/chat/${state.currentChatId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            state.currentChatId = null;
            await loadChats();
            clearMessages();
            updateChatHeader('Welcome to Alpaca AI', 'Select a model to start');
            elements.deleteChatBtn.style.display = 'none';
            showToast('Chat deleted', 'success');
            savePreferences();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to delete chat:', error);
        showToast('Failed to delete chat', 'error');
    } finally {
        hideLoading();
    }
}

// Message handling
function renderMessages(messages) {
    clearMessages();
    messages.forEach(msg => {
        if (msg.role !== 'system') {
            addMessage(msg.role, msg.content);
        }
    });
    scrollToBottom();
}

function addMessage(role, content) {
    // Remove welcome message if it exists
    const welcomeMsg = elements.messages.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = `
        <div class="message-content">${escapeHtml(content)}</div>
    `;
    
    elements.messages.appendChild(messageDiv);
    scrollToBottom();
}

function clearMessages() {
    elements.messages.innerHTML = `
        <div class="welcome-message">
            <h3>Start a conversation</h3>
            <p>Choose a model and type your message to begin exploring the capabilities of AI</p>
        </div>
    `;
}

// Message sending
async function sendMessage() {
    const message = elements.messageInput.value.trim();
    const model = elements.modelSelect.value;
    
    if (!message || !model || state.isGenerating) return;
    
    // Create chat if needed
    if (!state.currentChatId) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model })
            });
            
            const data = await response.json();
            if (data.success) {
                state.currentChatId = data.chat_id;
                updateChatHeader('New Chat', model);
                elements.deleteChatBtn.style.display = 'block';
            } else {
                showToast('Failed to create chat', 'error');
                return;
            }
        } catch (error) {
            console.error('Failed to create chat:', error);
            showToast('Failed to create chat', 'error');
            return;
        }
    }
    
    // Add user message
    addMessage('user', message);
    elements.messageInput.value = '';
    autoResizeTextarea();
    
    // Update state
    state.isGenerating = true;
    updateInputState();
    showTypingIndicator();
    
    // Send message through socket
    const messageData = {
        chat_id: state.currentChatId,
        message: message,
        model: model
    };
    
    if (socket.connected) {
        socket.emit('send_message', messageData);
    } else {
        state.messageQueue.push(messageData);
        showToast('Message queued. Waiting for connection...', 'warning');
    }
}

// Process queued messages
function processMessageQueue() {
    while (state.messageQueue.length > 0 && socket.connected) {
        const messageData = state.messageQueue.shift();
        socket.emit('send_message', messageData);
    }
}

// Response handling
function handleResponseStart(data) {
    removeTypingIndicator();
    addMessage('assistant', '');
}

function handleResponseChunk(data) {
    const messages = elements.messages.children;
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage && lastMessage.classList.contains('assistant-message')) {
        const content = lastMessage.querySelector('.message-content');
        content.textContent += data.content;
        scrollToBottom();
    }
}

function handleResponseComplete(data) {
    state.isGenerating = false;
    updateInputState();
    removeTypingIndicator();
    
    // Reload chats to update titles
    loadChats();
}

function handleError(data) {
    console.error('Error:', data.error);
    state.isGenerating = false;
    updateInputState();
    removeTypingIndicator();
    showToast(`Error: ${data.error}`, 'error');
}

// Typing indicator
function showTypingIndicator() {
    removeTypingIndicator();
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    elements.messages.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Input handling
function handleInputChange() {
    autoResizeTextarea();
    updateInputState();
}

function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function handleModelChange() {
    updateInputState();
    savePreferences();
}

function autoResizeTextarea() {
    const textarea = elements.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
}

function updateInputState() {
    const hasMessage = elements.messageInput.value.trim().length > 0;
    const hasModel = elements.modelSelect.value !== '';
    
    elements.sendBtn.disabled = !hasMessage || !hasModel || state.isGenerating;
    
    // Update placeholder
    if (hasModel) {
        elements.messageInput.placeholder = state.isGenerating ? 
            'Generating response...' : 
            'Type your message here...';
    } else {
        elements.messageInput.placeholder = 'Select a model to start chatting...';
    }
}

// Custom model management
function openModelManager() {
    elements.modal.style.display = 'flex';
    elements.modal.setAttribute('aria-hidden', 'false');
    loadCustomModels();
    loadBaseModelsForModal();
    
    // Focus management
    setTimeout(() => {
        elements.modelName.focus();
    }, 100);
}

function closeModal() {
    elements.modal.style.display = 'none';
    elements.modal.setAttribute('aria-hidden', 'true');
    resetModelForm();
    
    // Return focus to the trigger button
    elements.manageModelsBtn.focus();
}

async function loadBaseModelsForModal() {
    elements.baseModelSelect.innerHTML = '<option value="">Select base model...</option>';
    
    state.baseModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = `${model.name} (${model.size})`;
        elements.baseModelSelect.appendChild(option);
    });
}

async function loadCustomModels() {
    try {
        const response = await fetch('/api/custom-models');
        const data = await response.json();
        
        if (data.success) {
            renderCustomModels(data.models);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to load custom models:', error);
        showToast('Failed to load custom models', 'error');
    }
}

function renderCustomModels(models) {
    elements.modelsList.innerHTML = '';
    
    if (models.length === 0) {
        elements.modelsList.innerHTML = `
            <div class="empty-message" role="status">
                <p>No custom models yet. Create your first one above!</p>
            </div>
        `;
        return;
    }
    
    models.forEach(model => {
        const modelItem = document.createElement('div');
        modelItem.className = 'custom-model-item';
        modelItem.role = 'listitem';
        modelItem.innerHTML = `
            <div class="model-info">
                <h4>${escapeHtml(model.name)}</h4>
                <p>Based on: ${escapeHtml(model.base_model)}</p>
                <p class="system-prompt-preview">${escapeHtml(model.system_prompt.substring(0, 100))}${model.system_prompt.length > 100 ? '...' : ''}</p>
            </div>
            <div class="model-actions">
                <button class="btn btn-icon" 
                        onclick="editCustomModel(${model.id})"
                        aria-label="Edit ${escapeHtml(model.name)}">
                    <span class="icon" aria-hidden="true">✏️</span>
                </button>
                <button class="btn btn-icon" 
                        onclick="deleteCustomModel(${model.id})"
                        aria-label="Delete ${escapeHtml(model.name)}">
                    <span class="icon" aria-hidden="true">🗑</span>
                </button>
            </div>
        `;
        elements.modelsList.appendChild(modelItem);
    });
}

async function handleModelFormSubmit(e) {
    e.preventDefault();
    
    const modelId = elements.modelId.value;
    const name = elements.modelName.value.trim();
    const baseModel = elements.baseModelSelect.value;
    const systemPrompt = elements.systemPrompt.value.trim();
    
    if (!name || !baseModel || !systemPrompt) {
        showToast('Please fill all fields', 'warning');
        return;
    }
    
    try {
        showLoading();
        const url = modelId ? `/api/custom-model/${modelId}` : '/api/custom-model';
        const method = modelId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                base_model: baseModel,
                system_prompt: systemPrompt
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast(modelId ? 'Model updated successfully' : 'Model created successfully', 'success');
            await Promise.all([
                loadCustomModels(),
                loadModels()
            ]);
            resetModelForm();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to save custom model:', error);
        showToast(error.message || 'Failed to save model', 'error');
    } finally {
        hideLoading();
    }
}

function resetModelForm() {
    elements.modelForm.reset();
    elements.modelId.value = '';
}

// Global functions for model management
window.editCustomModel = async function(modelId) {
    try {
        const response = await fetch('/api/custom-models');
        const data = await response.json();
        
        if (data.success) {
            const model = data.models.find(m => m.id === modelId);
            if (model) {
                elements.modelId.value = model.id;
                elements.modelName.value = model.name;
                elements.baseModelSelect.value = model.base_model;
                elements.systemPrompt.value = model.system_prompt;
                elements.modelName.focus();
            }
        }
    } catch (error) {
        console.error('Failed to load model for editing:', error);
        showToast('Failed to load model details', 'error');
    }
};

window.deleteCustomModel = async function(modelId) {
    if (!confirm('Are you sure you want to delete this custom model? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`/api/custom-model/${modelId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('Model deleted successfully', 'success');
            await Promise.all([
                loadCustomModels(),
                loadModels()
            ]);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to delete custom model:', error);
        showToast('Failed to delete model', 'error');
    } finally {
        hideLoading();
    }
};

// UI utilities
function updateChatHeader(title, model) {
    elements.chatTitle.textContent = title;
    elements.chatModel.textContent = `Model: ${model}`;
}

function updateChatListSelection() {
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
    });
    
    const activeItem = document.querySelector(`.chat-item[data-chat-id="${state.currentChatId}"]`);
    
    if (activeItem) {
        activeItem.classList.add('active');
        activeItem.setAttribute('aria-current', 'true');
    }
}

function scrollToBottom() {
    const container = elements.messages;
    container.scrollTop = container.scrollHeight;
}

function handleResize() {
    // Handle responsive layout changes
    const viewportWidth = window.innerWidth;
    
    if (viewportWidth <= 768) {
        // Mobile layout adjustments
        document.body.classList.add('mobile');
    } else {
        document.body.classList.remove('mobile');
    }
}

// Preferences management
function savePreferences() {
    const preferences = {
        selectedModel: elements.modelSelect.value,
        currentChatId: state.currentChatId
    };
    
    localStorage.setItem('alpaca-preferences', JSON.stringify(preferences));
}

function loadPreferences() {
    try {
        const saved = localStorage.getItem('alpaca-preferences');
        if (saved) {
            const preferences = JSON.parse(saved);
            
            if (preferences.selectedModel) {
                elements.modelSelect.value = preferences.selectedModel;
            }
            
            if (preferences.currentChatId) {
                loadChat(preferences.currentChatId);
            }
        }
    } catch (error) {
        console.error('Failed to load preferences:', error);
    }
}

// Welcome screen
function showWelcomeScreen() {
    clearMessages();
    elements.messages.innerHTML = `
        <div class="welcome-message">
            <h3>Welcome to Alpaca AI</h3>
            <p>Your intelligent conversation partner powered by advanced language models.</p>
            <p>Select a model and start a new chat to begin exploring the capabilities of AI.</p>
        </div>
    `;
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Performance optimizations
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Debounced resize handler
window.addEventListener('resize', debounce(handleResize, 250));

// Error boundary
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showToast('An unexpected error occurred. Please refresh the page.', 'error');
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('An unexpected error occurred. Please refresh the page.', 'error');
});

// Service worker registration (for offline support)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
        console.log('Service worker registration failed:', error);
    });
}