// Глобальное состояние приложения
const app = {
    currentUser: null,
    token: null,
    posts: [],
    currentScreen: 'auth',
    theme: 'light',
    socket: null,
    viewedUserId: null,
    isCreator: false
};

// API базовый URL
const API_URL = window.location.origin + '/api';

// Генерация ID пользователя
function generateUserId() {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// Проверка является ли пользователь создателем
function isCreator() {
    return !!app.isCreator;
}

// Форматирование времени
function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} д назад`;
    
    return date.toLocaleDateString('ru-RU');
}

// Показать уведомление
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Переключение экранов
function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    document.getElementById(`${screenName}Screen`).classList.add('active');
    app.currentScreen = screenName;
}

// Показать главный экран
function showMainApp() {
    showScreen('feed');
    loadPosts();
    setupEventListeners();
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Аутентификация
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);
    
    // Переключение форм
    document.getElementById('switchToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        switchToRegister();
    });
    
    document.getElementById('switchToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        switchToLogin();
    });
    
    // Навигация
    document.getElementById('feedBtn').addEventListener('click', () => showScreen('feed'));
    document.getElementById('profileBtn').addEventListener('click', () => {
        if (app.currentUser) {
            showUserProfile(app.currentUser);
        } else {
            showScreen('profile');
        }
    });
    
    // Посты
    const publishPostBtn = document.getElementById('publishPostBtn');
    if (publishPostBtn) {
        publishPostBtn.addEventListener('click', createPost);
    }

    const attachMediaBtn = document.getElementById('attachMediaBtn');
    if (attachMediaBtn) {
        attachMediaBtn.addEventListener('click', () => {
            document.getElementById('mediaInput').click();
        });
    }

    const mediaInput = document.getElementById('mediaInput');
    if (mediaInput) {
        mediaInput.addEventListener('change', handleMediaSelect);
    }

    // Профиль
    const updateProfileBtn = document.getElementById('updateProfileBtn');
    if (updateProfileBtn) {
        updateProfileBtn.addEventListener('click', updateProfile);
    }

    const updateAvatarBtn = document.getElementById('updateAvatarBtn');
    if (updateAvatarBtn) {
        updateAvatarBtn.addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });
    }

    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarSelect);
    }

    // Поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Уведомления
    const notificationsBtn = document.getElementById('notificationsBtn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', openNotifications);
    }

    // Выход
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Удаление аккаунта
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', deleteAccount);
    }

    // Тема
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

// Переключение на регистрацию
function switchToRegister() {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.add('active');
}

// Переключение на вход
function switchToLogin() {
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
}

// Обработка входа
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            app.currentUser = data.user;
            app.token = data.token;
            app.isCreator = data.user.isCreator;
            
            localStorage.setItem('clone_token', app.token);
            localStorage.setItem('clone_userId', data.user.userId);
            
            showMainApp();
            showNotification('Вход выполнен успешно', 'success');
        } else {
            showNotification(data.error || 'Ошибка входа', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Обработка регистрации
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            app.currentUser = data.user;
            app.token = data.token;
            app.isCreator = data.user.isCreator;
            
            localStorage.setItem('clone_token', app.token);
            localStorage.setItem('clone_userId', data.user.userId);
            
            showMainApp();
            showNotification('Регистрация выполнена успешно', 'success');
        } else {
            showNotification(data.error || 'Ошибка регистрации', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Загрузка постов
async function loadPosts() {
    try {
        const response = await fetch(`${API_URL}/posts`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const posts = await response.json();
            app.posts = posts;
            renderPosts();
        } else {
            showNotification('Ошибка загрузки постов', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Отрисовка постов
function renderPosts() {
    const postsContainer = document.getElementById('postsContainer');
    if (!postsContainer) return;
    
    postsContainer.innerHTML = '';
    
    app.posts.forEach(post => {
        const postElement = createPostElement(post);
        postsContainer.appendChild(postElement);
    });
}

// Создание элемента поста
function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.dataset.postId = post.id;
    
    const avatarHtml = post.author_avatar ? 
        `<img src="${post.author_avatar}" alt="${post.author_name}" />` : 
        post.author_name.charAt(0).toUpperCase();
    
    const mediaHtml = post.media && post.media.length > 0 ? 
        post.media.map(media => {
            if (media.type === 'video') {
                return `<video controls><source src="${media.url}" type="video/mp4"></video>`;
            } else {
                return `<img src="${media.url}" alt="Медиа" />`;
            }
        }).join('') : '';
    
    const reactionsHtml = Object.keys(post.reactions || {}).map(reaction => {
        const users = post.reactions[reaction] || [];
        const isActive = users.includes(app.currentUser?.id);
        const count = users.length;
        const emoji = getReactionEmoji(reaction);
        return `<button class="reaction-btn ${isActive ? 'active' : ''}" data-reaction="${reaction}" data-post-id="${post.id}">
                    ${emoji} ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
                </button>`;
    }).join('');
    
    const commentsHtml = (post.comments || []).map(comment => {
        const commentAvatar = comment.avatar ? 
            `<img src="${comment.avatar}" alt="${comment.authorName}" />` : 
            comment.authorName.charAt(0).toUpperCase();
        return `
        <div class="comment">
            <div class="comment-avatar">${commentAvatar}</div>
            <div class="comment-content">
                <div class="comment-author">${comment.authorName}</div>
                <div class="comment-text">${comment.text}</div>
            </div>
        </div>`;
    }).join('');
    
    postDiv.innerHTML = `
        <div class="post-header">
            <div class="post-avatar">${avatarHtml}</div>
            <div class="post-info">
                <div class="post-author">${post.author_name}</div>
                <div class="post-username">@${post.author_username}</div>
            </div>
            <div class="post-time">${formatTime(post.created_at)}</div>
        </div>
        <div class="post-content">${post.content}</div>
        ${mediaHtml}
        <div class="post-actions">
            ${reactionsHtml}
            ${isCreator() && post.author_id !== app.currentUser?.id ? `<button class="btn-delete-post" onclick="deletePost('${post.id}')">🗑️ Удалить</button>` : ''}
        </div>
        <div class="comments-section">
            ${commentsHtml}
            <div class="comment-input-container">
                <input type="text" class="comment-input" placeholder="Написать комментарий..." data-post-id="${post.id}">
                <button class="comment-submit-btn" data-post-id="${post.id}">💬</button>
            </div>
        </div>
    `;
    
    // Добавление обработчиков для реакций
    postDiv.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const postId = btn.dataset.postId;
            const reaction = btn.dataset.reaction;
            toggleReaction(postId, reaction);
        });
    });
    
    // Добавление обработчиков для комментариев
    postDiv.querySelectorAll('.comment-submit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const postId = btn.dataset.postId;
            const input = postDiv.querySelector(`.comment-input[data-post-id="${postId}"]`);
            const text = input.value.trim();
            if (text) {
                addComment(postId, text);
                input.value = '';
            }
        });
    });
    
    postDiv.querySelectorAll('.comment-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const postId = input.dataset.postId;
                const text = input.value.trim();
                if (text) {
                    addComment(postId, text);
                    input.value = '';
                }
            }
        });
    });
    
    return postDiv;
}

// Получение эмодзи для реакции
function getReactionEmoji(reaction) {
    const emojis = {
        like: '👍',
        dislike: '👎',
        heart: '❤️',
        angry: '😡',
        laugh: '😂',
        cry: '😢'
    };
    return emojis[reaction] || '👍';
}

// Переключение реакции
async function toggleReaction(postId, reactionType) {
    try {
        const response = await fetch(`${API_URL}/posts/${postId}/reactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.token}`
            },
            body: JSON.stringify({ reaction: reactionType })
        });
        
        if (response.ok) {
            const data = await response.json();
            updatePostReactions(postId, data.reactions);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка реакции', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Обновление реакций поста
function updatePostReactions(postId, reactions) {
    const post = app.posts.find(p => p.id === postId);
    if (post) {
        post.reactions = reactions;
        
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
            const reactionsHtml = Object.keys(reactions).map(reaction => {
                const users = reactions[reaction] || [];
                const isActive = users.includes(app.currentUser?.id);
                const count = users.length;
                const emoji = getReactionEmoji(reaction);
                return `<button class="reaction-btn ${isActive ? 'active' : ''}" data-reaction="${reaction}" data-post-id="${postId}">
                            ${emoji} ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
                        </button>`;
            }).join('');
            
            postElement.querySelector('.post-actions').innerHTML = reactionsHtml;
            
            // Добавление обработчиков для новых кнопок реакций
            postElement.querySelectorAll('.reaction-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const postId = btn.dataset.postId;
                    const reaction = btn.dataset.reaction;
                    toggleReaction(postId, reaction);
                });
            });
        }
    }
}

// Добавление комментария
async function addComment(postId, text) {
    try {
        const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.token}`
            },
            body: JSON.stringify({ text })
        });
        
        if (response.ok) {
            const data = await response.json();
            addCommentToPost(postId, data.comments[data.comments.length - 1]);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка добавления комментария', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Добавление комментария к посту
function addCommentToPost(postId, comment) {
    const postElement = document.querySelector(`[data-post-id="${postId}"]`);
    if (postElement) {
        const commentsSection = postElement.querySelector('.comments-section');
        const commentHtml = `
            <div class="comment">
                <div class="comment-avatar">${comment.avatar ? `<img src="${comment.avatar}" alt="${comment.authorName}" />` : comment.authorName.charAt(0).toUpperCase()}</div>
                <div class="comment-content">
                    <div class="comment-author">${comment.authorName}</div>
                    <div class="comment-text">${comment.text}</div>
                </div>
            </div>
        `;
        
        const inputContainer = commentsSection.querySelector('.comment-input-container');
        inputContainer.insertAdjacentHTML('beforebegin', commentHtml);
    }
}

// Создание поста
async function createPost() {
    const content = document.getElementById('postContent').value.trim();
    if (!content) {
        showNotification('Напишите текст поста', 'error');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('content', content);
        
        const mediaInput = document.getElementById('mediaInput');
        if (mediaInput.files.length > 0) {
            for (let file of mediaInput.files) {
                formData.append('media', file);
            }
        }
        
        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            },
            body: formData
        });
        
        if (response.ok) {
            const newPost = await response.json();
            app.posts.unshift(newPost);
            
            const postsContainer = document.getElementById('postsContainer');
            const postElement = createPostElement(newPost);
            postsContainer.insertBefore(postElement, postsContainer.firstChild);
            
            document.getElementById('postContent').value = '';
            document.getElementById('mediaInput').value = '';
            
            showNotification('Пост опубликован', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка создания поста', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Обработка выбора медиа
function handleMediaSelect(e) {
    const files = e.target.files;
    if (files.length > 5) {
        showNotification('Максимум 5 файлов', 'error');
        e.target.value = '';
        return;
    }
    
    for (let file of files) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            showNotification('Только изображения и видео', 'error');
            e.target.value = '';
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            showNotification('Максимальный размер файла 10MB', 'error');
            e.target.value = '';
            return;
        }
    }
}

// Показать профиль пользователя
function showUserProfile(user) {
    app.viewedUserId = user.id || user.userId;
    
    const profileScreen = document.getElementById('profileScreen');
    const profileName = document.getElementById('profileName');
    const profileUsername = document.getElementById('profileUsername');
    const profileBio = document.getElementById('profileBio');
    const profileAvatar = document.getElementById('profileAvatar');
    
    if (profileName) profileName.textContent = user.name || 'Имя не указано';
    if (profileUsername) profileUsername.textContent = `@${user.username || 'username'}`;
    if (profileBio) profileBio.textContent = user.bio || 'О себе не указано';
    
    if (profileAvatar) {
        if (user.avatar) {
            profileAvatar.innerHTML = `<img src="${user.avatar}" alt="${user.name}" />`;
        } else {
            profileAvatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : '?';
        }
    }
    
    loadUserPosts(user.id || user.userId);
    showScreen('profile');
}

// Загрузка постов пользователя
async function loadUserPosts(userId) {
    try {
        const response = await fetch(`${API_URL}/users/${userId}/posts`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const posts = await response.json();
            const postsContainer = document.getElementById('profilePostsContainer');
            if (postsContainer) {
                postsContainer.innerHTML = '';
                
                if (posts.length === 0) {
                    postsContainer.innerHTML = '<p class="no-posts">Нет постов</p>';
                } else {
                    posts.forEach(post => {
                        const postElement = createPostElement(post);
                        postsContainer.appendChild(postElement);
                    });
                }
            }
        } else {
            showNotification('Ошибка загрузки постов пользователя', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Обновление профиля
async function updateProfile() {
    const name = document.getElementById('profileNameInput').value.trim();
    const username = document.getElementById('profileUsernameInput').value.trim();
    const bio = document.getElementById('profileBioInput').value.trim();
    
    if (!name || !username) {
        showNotification('Имя и username обязательны', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.token}`
            },
            body: JSON.stringify({ name, username, bio })
        });
        
        if (response.ok) {
            const updatedUser = await response.json();
            app.currentUser = updatedUser;
            
            showNotification('Профиль обновлен', 'success');
            showUserProfile(updatedUser);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка обновления профиля', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Обработка выбора аватара
function handleAvatarSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Только изображения', 'error');
        e.target.value = '';
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Максимальный размер аватара 5MB', 'error');
        e.target.value = '';
        return;
    }
    
    updateAvatar(file);
}

// Обновление аватара
async function updateAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    
    try {
        const response = await fetch(`${API_URL}/avatar`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${app.token}`
            },
            body: formData
        });
        
        if (response.ok) {
            const updatedUser = await response.json();
            app.currentUser = updatedUser;
            
            showNotification('Аватар обновлен', 'success');
            showUserProfile(updatedUser);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка обновления аватара', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Поиск пользователей
async function handleSearch(e) {
    const query = e.target.value.trim();
    const searchResults = document.getElementById('searchResults');
    
    if (!query) {
        searchResults.innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            renderSearchResults(users);
        } else {
            searchResults.innerHTML = '<p class="no-results">Пользователи не найдены</p>';
        }
    } catch (error) {
        showNotification('Ошибка поиска', 'error');
    }
}

// Отрисовка результатов поиска
function renderSearchResults(users) {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;
    
    if (users.length === 0) {
        searchResults.innerHTML = '<p class="no-results">Пользователи не найдены</p>';
        return;
    }
    
    const resultsHtml = users.map(user => `
        <div class="search-result" onclick="showUserProfile(${JSON.stringify(user).replace(/"/g, '&quot;')})">
            <div class="search-result-avatar">${user.avatar ? `<img src="${user.avatar}" alt="${user.name}" />` : user.name.charAt(0).toUpperCase()}</div>
            <div class="search-result-info">
                <div class="search-result-name">${user.name}</div>
                <div class="search-result-username">@${user.username}</div>
            </div>
        </div>
    `).join('');
    
    searchResults.innerHTML = resultsHtml;
}

// Открыть уведомления
function openNotifications() {
    loadNotifications();
    document.getElementById('notificationsModal').classList.add('active');
}

// Загрузка уведомлений
async function loadNotifications() {
    try {
        const response = await fetch(`${API_URL}/notifications`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const notifications = await response.json();
            renderNotifications(notifications);
        } else {
            showNotification('Ошибка загрузки уведомлений', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Отрисовка уведомлений
function renderNotifications(notifications) {
    const notificationsContainer = document.getElementById('notificationsContainer');
    if (!notificationsContainer) return;
    
    if (notifications.length === 0) {
        notificationsContainer.innerHTML = '<p class="no-notifications">Нет уведомлений</p>';
        return;
    }
    
    const notificationsHtml = notifications.map(notification => `
        <div class="notification-item ${notification.read ? 'read' : ''}">
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${formatTime(notification.created_at)}</div>
        </div>
    `).join('');
    
    notificationsContainer.innerHTML = notificationsHtml;
    
    // Отметить как прочитанные
    markNotificationsAsRead();
}

// Отметить уведомления как прочитанные
async function markNotificationsAsRead() {
    try {
        await fetch(`${API_URL}/notifications/read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
    } catch (error) {
        console.error('Ошибка отметки уведомлений:', error);
    }
}

// Удаление поста
async function deletePost(postId) {
    if (!confirm('Вы уверены, что хотите удалить этот пост?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/posts/${postId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            // Удаление поста из ленты
            app.posts = app.posts.filter(p => p.id !== postId);
            
            // Удаление элемента поста из DOM
            const postElement = document.querySelector(`[data-post-id="${postId}"]`);
            if (postElement) {
                postElement.remove();
            }
            
            showNotification('Пост удален', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка удаления поста', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Выход
function logout() {
    app.currentUser = null;
    app.token = null;
    app.isCreator = false;
    
    localStorage.removeItem('clone_token');
    localStorage.removeItem('clone_userId');
    
    showScreen('auth');
    showNotification('Вы вышли из аккаунта', 'info');
}

// Удаление аккаунта
async function deleteAccount() {
    if (!confirm('Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить.')) {
        return;
    }
    
    if (!confirm('Все ваши данные будут безвозвратно удалены. Продолжить?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/account`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            showNotification('Аккаунт удален', 'success');
            logout();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка удаления аккаунта', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Переключение темы
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        themeToggle.textContent = '🌙';
        app.theme = 'light';
        localStorage.setItem('clone_theme', 'light');
    } else {
        body.classList.add('dark-theme');
        themeToggle.textContent = '☀️';
        app.theme = 'dark';
        localStorage.setItem('clone_theme', 'dark');
    }
}

// Загрузка темы
function loadTheme() {
    const savedTheme = localStorage.getItem('clone_theme');
    const themeToggle = document.getElementById('themeToggle');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeToggle) themeToggle.textContent = '☀️';
        app.theme = 'dark';
    } else {
        if (themeToggle) themeToggle.textContent = '🌙';
        app.theme = 'light';
    }
}

// Инициализация Socket.IO
function initializeSocket() {
    app.socket = io();
    
    app.socket.on('connect', () => {
        console.log('Подключено к серверу');
        if (app.token) {
            app.socket.emit('authenticate', app.token);
        }
    });
    
    app.socket.on('new_post', (post) => {
        if (app.currentScreen === 'feed') {
            addPostToFeed(post);
        }
    });
    
    app.socket.on('post_reaction', (data) => {
        updatePostReactions(data.postId, data.reactions);
    });
    
    app.socket.on('new_comment', (data) => {
        addCommentToPost(data.postId, data.comment);
    });
    
    app.socket.on('notification', (notification) => {
        showNotification(notification.message, 'info');
    });
}

// Добавление поста в ленту
function addPostToFeed(post) {
    app.posts.unshift(post);
    
    const postsContainer = document.getElementById('postsContainer');
    const postElement = createPostElement(post);
    postsContainer.insertBefore(postElement, postsContainer.firstChild);
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    initializeSocket();
    
    // Восстановление токена из localStorage
    const savedToken = localStorage.getItem('clone_token');
    if (savedToken) {
        app.token = savedToken;
        
        // Проверка токена
        fetch(`${API_URL}/me`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        }).then(response => response.json())
        .then(data => {
            app.currentUser = data;
            app.isCreator = data.isCreator;
            showMainApp();
        })
        .catch(error => {
            console.error('Ошибка проверки токена:', error);
            localStorage.removeItem('clone_token');
            app.token = null;
        });
    }
    
    setupEventListeners();
});
