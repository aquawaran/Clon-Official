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

function looksLikeId(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const hex24Regex = /^[0-9a-fA-F]{24}$/;
    const digitsRegex = /^\d+$/;
    return uuidRegex.test(trimmed) || hex24Regex.test(trimmed) || digitsRegex.test(trimmed);
}

// Поиск пользователей
async function handleSearch(input) {
    const rawValue = typeof input === 'string' ? input : input?.target?.value || '';
    const query = rawValue.trim().toLowerCase();
    
    if (!query) {
        showScreen('feed');
        return;
    }
    if (query.length < 2) {
        displaySearchMessage('Введите минимум 2 символа для поиска');
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
            displaySearchResults(users);
            showScreen('search');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка поиска', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Поиск пользователей
async function handleSearch(e) {
    const query = typeof e === 'string' ? e : e.target.value.trim();
    
    console.log('Поиск:', query); // Отладка
    
    if (!query) {
        displaySearchMessage('Введите имя пользователя для поиска');
        return;
    }
    
    // Переключаемся на экран поиска
    showScreen('search');
    
    try {
        const url = `${API_URL}/users/search?q=${encodeURIComponent(query)}`;
        console.log('URL запроса:', url); // Отладка
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        console.log('Статус ответа:', response.status); // Отладка
        
        if (response.ok) {
            const users = await response.json();
            console.log('Найденные пользователи:', users); // Отладка
            displaySearchResults(users);
        } else {
            const data = await response.json();
            console.log('Ошибка поиска:', data); // Отладка
            showNotification(data.error || 'Ошибка поиска', 'error');
        }
    } catch (error) {
        console.log('Ошибка соединения:', error); // Отладка
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

function displaySearchResults(users) {
    console.log('displaySearchResults вызван с пользователями:', users); // Отладка
    
    const container = document.getElementById('searchResultsContainer');
    console.log('Контейнер найден:', container); // Отладка
    
    if (!container) {
        console.error('Контейнер searchResultsContainer не найден!'); // Отладка
        return;
    }
    
    if (users.length === 0) {
        container.innerHTML = '<p class="search-hint">Пользователи не найдены</p>';
        return;
    }
    
    console.log('Создаем HTML для пользователей...'); // Отладка
    
    const resultsHtml = users.map(user => `
        <div class="search-result-item" data-user-id="${user.id}">
            <div class="search-result-avatar">
                ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}" />` : `<div class="avatar-placeholder">${user.name.charAt(0).toUpperCase()}</div>`}
            </div>
            <div class="search-result-info">
                <div class="search-result-name">${user.name}</div>
                <div class="search-result-username">@${user.username}</div>
            </div>
            <div class="search-result-actions">
                <button class="btn-primary btn-sm" onclick="viewUserProfile('${user.id}')">Профиль</button>
                <button class="btn-secondary btn-sm follow-btn" data-user-id="${user.id}">Подписаться</button>
            </div>
        </div>
    `).join('');
    
    console.log('HTML создан:', resultsHtml); // Отладка
    
    container.innerHTML = resultsHtml;
    
    // Добавляем обработчики кликов
    container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Не обрабатываем клик на кнопки
            if (e.target.tagName === 'BUTTON') return;
            
            const userId = item.dataset.userId;
            console.log('Клик на пользователя:', userId); // Отладка
            viewUserProfile(userId);
        });
    });
    
    // Добавляем обработчики для кнопок подписки
    container.querySelectorAll('.follow-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = btn.dataset.userId;
            toggleFollow(userId);
        });
    });
    
    console.log('Обработчики кликов добавлены'); // Отладка
}

function displaySearchMessage(message) {
    const container = document.getElementById('searchResultsContainer');
    if (container) {
        container.innerHTML = `<p class="search-hint">${message}</p>`;
    }
}

function resolveId(entity) {
    if (!entity) return null;
    if (typeof entity === 'string') {
        return looksLikeId(entity) ? entity.trim() : null;
    }
    return entity.id || entity._id || entity.user_id || entity.userId || null;
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadTheme();
    initializeSocket();
});

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

// Инициализация
function initializeApp() {
    // Загрузка данных из localStorage
    const savedToken = localStorage.getItem('clone_token');
    const savedTheme = localStorage.getItem('clone_theme');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('themeToggle').textContent = '☀️';
        app.theme = 'dark';
    }
    
    if (savedToken) {
        app.token = savedToken;
        verifyToken();
    }
}

// Проверка токена
async function verifyToken() {
    try {
        const response = await fetch(`${API_URL}/me`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            app.currentUser = userData;

            let userIdToUse = app.currentUser.userId;
            const storedUserId = localStorage.getItem('clone_userId');

            if (!userIdToUse && storedUserId) {
                userIdToUse = storedUserId;
            }

            if (!userIdToUse) {
                userIdToUse = generateUserId();
            }

            app.currentUser.userId = userIdToUse;
            localStorage.setItem('clone_userId', userIdToUse);
            app.isCreator = !!app.currentUser.isCreator;
            showMainApp();
        } else {
            localStorage.removeItem('clone_token');
            app.token = null;
        }
    } catch (error) {
        console.error('Ошибка проверки токена:', error);
        localStorage.removeItem('clone_token');
        app.token = null;
    }
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
        mediaInput.addEventListener('change', handleMediaAttach);
    }
    
    // Профиль
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });
    }

    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarChange);
    }

    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', openEditProfile);
    }

    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfile);
    }

    const followProfileBtn = document.getElementById('followProfileBtn');
    if (followProfileBtn) {
        followProfileBtn.addEventListener('click', () => {
            const targetId = followProfileBtn.dataset.userId;
            if (targetId) {
                toggleFollow(targetId);
            }
        });
    }

    const saveInlineBtn = document.getElementById('saveInlineProfileBtn');
    if (saveInlineBtn) {
        saveInlineBtn.addEventListener('click', saveInlineProfile);
    }
    
    // Поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    document.getElementById('searchBtn').addEventListener('click', () => {
        if (!searchInput) return;
        const query = searchInput.value.trim();
        if (query) {
            handleSearch(query);
        }
    });
    document.getElementById('refreshFeed').addEventListener('click', refreshFeed);
    
    // Уведомления
    document.getElementById('notificationsBtn').addEventListener('click', openNotifications);
    document.getElementById('closeNotifications').addEventListener('click', closeNotifications);
    document.getElementById('markAllAsReadBtn').addEventListener('click', markAllAsRead);
    
    // Настройки
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('updateAccountBtn').addEventListener('click', updateAccount);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('deleteAccountBtn').addEventListener('click', deleteAccount);
    
    // Тема
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Закрытие модальных окон по клику вне их
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });
    
    // Модальные окна
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    document.getElementById('closeEditProfile').addEventListener('click', closeEditProfile);
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
}

// Переключение между формами входа и регистрации
function switchToRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

function switchToLogin() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
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
            app.token = data.token;
            app.currentUser = data.user;
            
            let serverUserId = app.currentUser?.userId;
            if (!serverUserId) {
                serverUserId = generateUserId();
                app.currentUser.userId = serverUserId;
                showNotification(`Ваш ID: ${serverUserId}`, 'success');
            }
            localStorage.setItem('clone_userId', serverUserId);
            app.isCreator = !!app.currentUser.isCreator;
            
            localStorage.setItem('clone_token', app.token);
            
            showMainApp();
            showNotification('Вход выполнен успешно!', 'success');
            
            // Аутентификация в Socket.IO
            if (app.socket) {
                app.socket.emit('authenticate', app.token);
            }
        } else {
            showNotification(data.error || 'Ошибка входа', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

async function saveInlineProfile() {
    const name = document.getElementById('inlineNameInput').value.trim();
    const username = document.getElementById('inlineUsernameInput').value.trim();
    const validationError = validateNameAndUsername(name, username);
    if (validationError) {
        showNotification(validationError, 'error');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.token}`
            },
            body: JSON.stringify({ name, username, bio: app.currentUser.bio })
        });
        if (response.ok) {
            const data = await response.json();
            app.currentUser = data.user;
            updateProfileInfo();
            showNotification('Профиль обновлен', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка обновления профиля', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Валидация имени и username
function validateNameAndUsername(name, username) {
    // Разрешаем только буквы (включая кириллицу), цифры и подчеркивания
    const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s]+$/;
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    
    if (!nameRegex.test(name)) {
        return 'Имя может содержать только буквы и пробелы';
    }
    
    if (!usernameRegex.test(username)) {
        return 'Username может содержать только буквы, цифры и подчеркивания';
    }
    
    return null; // Нет ошибок
}

// Обработка регистрации
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    // Валидация имени и username
    const validationError = validateNameAndUsername(name, username);
    if (validationError) {
        showNotification(validationError, 'error');
        return;
    }
    
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
            app.token = data.token;
            app.currentUser = data.user;
            let finalUserId = app.currentUser?.userId;
            if (!finalUserId) {
                finalUserId = generateUserId();
                app.currentUser.userId = finalUserId;
            }
            app.currentUser.userId = finalUserId;
            app.isCreator = !!app.currentUser.isCreator;
            localStorage.setItem('clone_token', app.token);
            localStorage.setItem('clone_userId', finalUserId);
            
            showMainApp();
            showNotification('Регистрация выполнена успешно! Ваш ID: ' + finalUserId, 'success');
            
            // Аутентификация в Socket.IO
            if (app.socket) {
                app.socket.emit('authenticate', app.token);
            }
        } else {
            showNotification(data.error || 'Ошибка регистрации', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Показ главного приложения
function showMainApp() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
    
    // Восстанавливаем ID из localStorage если есть
    const savedUserId = localStorage.getItem('clone_userId');
    if (savedUserId && !app.currentUser.userId) {
        app.currentUser.userId = savedUserId;
    }
    if (typeof app.isCreator !== 'boolean' && app.currentUser && typeof app.currentUser.isCreator === 'boolean') {
        app.isCreator = app.currentUser.isCreator;
    }
    
    // Добавить проверку админ-прав
    updateAdminPanelVisibility();
    
    updateProfileInfo();
    resetPagination();
    loadPosts();
    showScreen('feed');
    
    // Инициализация infinite scroll
    setTimeout(setupInfiniteScroll, 100);
}

// Показ экранов
function showScreen(screenName) {
    app.currentScreen = screenName;
    
    // Скрыть все экраны контента
    document.querySelectorAll('.content-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Обновить навигацию
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показать нужный экран
    switch(screenName) {
        case 'feed':
            document.getElementById('feedScreen').classList.add('active');
            document.getElementById('feedBtn').classList.add('active');
            if (app.posts.length === 0) {
                resetPagination();
                loadPosts();
            }
            break;
        case 'profile':
            document.getElementById('profileScreen').classList.add('active');
            loadUserPosts();
            break;
        case 'search':
            document.getElementById('searchScreen').classList.add('active');
            break;
    }
}

// Создание поста
async function createPost() {
    const content = document.getElementById('postContent').value.trim();
    
    if (!content) {
        showNotification('Напишите что-нибудь для публикации', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('content', content);
    
    // Добавление медиа файлов
    const mediaInput = document.getElementById('mediaInput');
    if (mediaInput.files.length > 0) {
        for (let file of mediaInput.files) {
            formData.append('media', file);
        }
    }
    
    try {
        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            },
            body: formData
        });
        
        if (response.ok) {
            document.getElementById('postContent').value = '';
            mediaInput.value = '';
            showNotification('Пост опубликован!', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка публикации', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Загрузка постов
let currentPage = 1;
let isLoading = false;
let hasMorePosts = true;

async function loadPosts(append = false) {
    if (isLoading || (!hasMorePosts && append)) return;
    
    isLoading = true;
    
    try {
        const limit = 10;
        const url = `${API_URL}/feed?page=${currentPage}&limit=${limit}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const newPosts = await response.json();
            
            if (append) {
                app.posts = [...app.posts, ...newPosts];
                newPosts.forEach(post => {
                    const postElement = createPostElement(post);
                    document.getElementById('postsContainer').appendChild(postElement);
                });
            } else {
                app.posts = newPosts;
                renderPosts();
            }
            
            // Если постов меньше чем limit, значит это последняя страница
            if (newPosts.length < limit) {
                hasMorePosts = false;
            } else {
                currentPage++;
            }
            
            console.log(`Загружено ${newPosts.length} постов, страница ${currentPage}`);
        } else {
            showNotification('Ошибка загрузки ленты', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    } finally {
        isLoading = false;
    }
}

// Отображение постов
function renderPosts() {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '';
    
    if (app.posts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Пока нет постов</p>';
        return;
    }
    
    app.posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

// Добавление поста в ленту (реальное время)
function addPostToFeed(post) {
    app.posts.unshift(post);
    const container = document.getElementById('postsContainer');
    const postElement = createPostElement(post);
    container.insertBefore(postElement, container.firstChild);
}

// Infinite Scroll
function setupInfiniteScroll() {
    const container = document.getElementById('postsContainer');
    
    window.addEventListener('scroll', () => {
        if (isLoading || !hasMorePosts) return;
        
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        
        // Если пользователь прокрутил до 90% страницы
        if (scrollTop + clientHeight >= scrollHeight * 0.9) {
            loadPosts(true); // Загружаем следующие посты
        }
    });
}

// Сброс пагинации при обновлении ленты
function resetPagination() {
    currentPage = 1;
    isLoading = false;
    hasMorePosts = true;
}

// Создание элемента поста
function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.dataset.postId = post.id;
    
    const authorId = resolveId(post.author) || post.author_id || post.authorId || post.user_id || post.userId || '';
    const authorName = post.author_name || post.authorName || post.author?.name || 'Без имени';
    const authorUsername = post.author_username || post.authorUsername || post.author?.username || 'user';
    const avatarSrc = post.author_avatar || post.authorAvatar || post.author?.avatar;

    const avatarHtml = avatarSrc 
        ? `<img src="${avatarSrc}" alt="${authorName}" class="post-avatar-img">`
        : '<div class="avatar-placeholder">😊</div>';
    
    const mediaHtml = post.media && post.media.length > 0 
        ? post.media.map(item => `
            <div class="post-media">
                ${item.type === 'image' 
                    ? `<img src="${item.url}" alt="Изображение">`
                    : `<video src="${item.url}" controls></video>`
                }
            </div>
          `).join('')
        : '';
    
    // Показываем все возможные реакции
    const allReactions = ['like', 'dislike', 'heart', 'angry', 'laugh', 'cry'];
    
    const reactionsHtml = allReactions.map(reaction => {
        const users = post.reactions[reaction] || [];
        const isActive = users.includes(app.currentUser?.id);
        const emoji = getReactionEmoji(reaction);
        const count = users.length;
        return `<button class="reaction-btn ${isActive ? 'active' : ''}" data-reaction="${reaction}" data-post-id="${post.id}">
                    ${emoji} ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
                </button>`;
    }).join('');
    
    const commentsHtml = post.comments.map(comment => {
        const commentId = comment.id || comment._id || '';
        return `
        <div class="comment" ${commentId ? `data-comment-id="${commentId}"` : ''}>
            <div class="comment-avatar">${comment.avatar ? `<img src="${comment.avatar}" alt="${comment.authorName}" />` : comment.authorName ? comment.authorName.charAt(0).toUpperCase() : '😊'}</div>
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
                <div class="post-author" data-user-id="${authorId}">${authorName}</div>
                <div class="post-username">@${authorUsername}</div>
            </div>
            <div class="post-time">${formatTime(post.created_at || post.createdAt)}</div>
        </div>
        <div class="post-content">${post.content}</div>
        ${mediaHtml}
        <div class="post-actions-bar">
            ${reactionsHtml}
            ${isCreator() && authorId !== app.currentUser?.id ? `<button class="btn-delete-post" onclick="deletePost('${post.id}')">🗑️ Удалить</button>` : ''}
        </div>
        <div class="comments-section">
            ${commentsHtml}
            <div class="comment-input-container">
                <input type="text" class="comment-input" placeholder="Написать комментарий..." data-post-id="${post.id}">
                <button class="comment-submit-btn" data-post-id="${post.id}">💬</button>
            </div>
        </div>
    `;
    
    const avatarImgEl = postDiv.querySelector('.post-avatar-img');
    if (avatarImgEl) {
        avatarImgEl.addEventListener('error', () => replaceWithAvatarFallback(avatarImgEl));
    }
    attachMediaFallbacks(postDiv);

    // Добавляем обработчики для реакций и комментариев
    postDiv.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const postId = btn.dataset.postId;
            const reaction = btn.dataset.reaction;
            toggleReaction(postId, reaction);
        });
    });
    
    // Обработчик клика на имя пользователя
    const authorElement = postDiv.querySelector('.post-author');
    if (authorElement) {
        if (authorId) {
            authorElement.addEventListener('click', () => {
                viewUserProfile(authorId);
            });
            authorElement.style.cursor = 'pointer';
            authorElement.style.color = 'var(--primary-color)';
        } else {
            authorElement.style.cursor = 'default';
        }
    }
    
    postDiv.querySelectorAll('.comment-submit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const postId = btn.dataset.postId;
            const input = postDiv.querySelector(`.comment-input[data-post-id="${postId}"]`);
            const text = input.value.trim();
            if (text) {
                addComment(postId, text);
                input.value = '';
                // Предотвращаем двойной клик
                btn.disabled = true;
                setTimeout(() => btn.disabled = false, 1000);
            }
        });
    });
    
    postDiv.querySelectorAll('.comment-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Предотвращаем двойную отправку
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
            // Если реакций нет, показываем все возможные реакции с 0
            const allReactions = ['like', 'dislike', 'heart', 'angry', 'laugh', 'cry'];
            
            const reactionsHtml = allReactions.map(reaction => {
                const users = reactions[reaction] || [];
                const isActive = users.includes(app.currentUser?.id);
                const emoji = getReactionEmoji(reaction);
                const count = users.length;
                return `<button class="reaction-btn ${isActive ? 'active' : ''}" data-reaction="${reaction}" data-post-id="${postId}">
                            ${emoji} ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
                        </button>`;
            }).join('');
            
            postElement.querySelector('.post-actions-bar').innerHTML = reactionsHtml;
            
            // Добавляем обработчики для новых кнопок реакций
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
            // Удаляем пост из ленты
            app.posts = app.posts.filter(p => p.id !== postId);
            
            // Удаляем пост из DOM
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

// Добавление комментария
async function addComment(postId, text) {
    if (!text.trim()) return;
    
    try {
        const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.token}`
            },
            body: JSON.stringify({ text: text.trim() })
        });
        
        if (response.ok) {
            const comment = await response.json();
            addCommentToPost(postId, comment);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка комментария', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Добавление комментария к посту (реальное время)
function addCommentToPost(postId, comment) {
    const post = app.posts.find(p => p.id === postId);
    if (post) {
        const incomingCommentId = comment.id || comment._id || null;
        if (incomingCommentId) {
            const alreadyExists = post.comments.some(existing => (existing.id || existing._id) === incomingCommentId);
            if (alreadyExists) {
                return;
            }
        }
        post.comments.push(comment);
        
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
            const commentsSection = postElement.querySelector('.comments-section');
            const commentHtml = `
                <div class="comment" ${incomingCommentId ? `data-comment-id="${incomingCommentId}"` : ''}>
                    <div class="comment-avatar">${comment.avatar ? `<img src="${comment.avatar}" alt="${comment.authorName}" />` : comment.authorName ? comment.authorName.charAt(0).toUpperCase() : '😊'}</div>
                    <div class="comment-content">
                        <div class="comment-author">${comment.authorName}</div>
                        <div class="comment-text">${comment.text}</div>
                    </div>
                </div>
            `;
            
            const existingDomNode = incomingCommentId 
                ? commentsSection.querySelector(`.comment[data-comment-id="${incomingCommentId}"]`)
                : null;
            if (!existingDomNode) {
                const inputContainer = commentsSection.querySelector('.comment-input-container');
                inputContainer.insertAdjacentHTML('beforebegin', commentHtml);
                
                // Очистка поля ввода (если инициировано самим пользователем)
                const input = inputContainer.querySelector('.comment-input');
                if (input && document.activeElement !== input) {
                    input.value = '';
                }
            }
        }
    }
}

// Загрузка постов пользователя
async function loadUserPosts() {
    if (!app.currentUser) return;
    const currentId = resolveId(app.currentUser);
    if (!currentId) return;
    return loadUserPostsById(currentId);
}

// Отображение постов пользователя
function renderUserPosts(posts) {
    const container = document.getElementById('userPostsContainer');
    container.innerHTML = '';

    if (posts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">У вас пока нет постов</p>';
        return;
    }
    
    posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

// Обновление информации профиля
function updateProfileInfo() {
    if (!app.currentUser) return;
    
    document.getElementById('profileName').textContent = app.currentUser.name;
    document.getElementById('profileUsername').textContent = '@' + app.currentUser.username;
    document.getElementById('profileBio').textContent = app.currentUser.bio || 'Описание профиля';
    document.getElementById('profileFollowers').textContent = app.currentUser.followersCount || 0;
    
    const avatarImg = document.getElementById('profileAvatar');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    
    if (app.currentUser.avatar) {
        avatarImg.src = app.currentUser.avatar;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
    } else {
        avatarImg.style.display = 'none';
        avatarPlaceholder.style.display = 'flex';
    }

    document.getElementById('inlineNameInput').value = app.currentUser.name;
    document.getElementById('inlineUsernameInput').value = app.currentUser.username;
    const ownerEdit = document.getElementById('profileOwnerEdit');
    if (ownerEdit) {
        ownerEdit.classList.remove('hidden');
    }
}

// Обработка смены аватара
async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('avatar', file);
        
        try {
            const response = await fetch(`${API_URL}/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${app.token}`
                },
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                app.currentUser.avatar = data.avatar;
                updateProfileInfo();
                loadPosts();
                showNotification('Аватар обновлен!', 'success');
            } else {
                const data = await response.json();
                showNotification(data.error || 'Ошибка загрузки аватара', 'error');
            }
        } catch (error) {
            showNotification('Ошибка соединения с сервером', 'error');
        }
    }
}

// Открытие редактирования профиля
function openEditProfile() {
    document.getElementById('editName').value = app.currentUser.name;
    document.getElementById('editUsername').value = app.currentUser.username;
    document.getElementById('editBio').value = app.currentUser.bio || '';
    document.getElementById('editProfileModal').classList.add('active');
}

function closeEditProfile() {
    document.getElementById('editProfileModal').classList.remove('active');
}

// Сохранение профиля
async function saveProfile() {
    const name = document.getElementById('editName').value.trim();
    const username = document.getElementById('editUsername').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    
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
            const data = await response.json();
            app.currentUser = data.user;
            updateProfileInfo();
            loadPosts();
            closeEditProfile();
            showNotification('Профиль обновлен!', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка обновления профиля', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Просмотр профиля пользователя
async function viewUserProfile(userId) {
    const normalizedId = resolveId(userId);
    if (!normalizedId) {
        showNotification('Не удалось определить пользователя', 'error');
        return;
    }
    try {
        // Получаем информацию о пользователе
        const response = await fetch(`${API_URL}/users/${normalizedId}`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            showUserProfile(user);
        } else {
            showNotification('Ошибка загрузки профиля', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Показ профиля пользователя
function showUserProfile(user) {
    const targetId = resolveId(user);
    if (!targetId) {
        showNotification('Не удалось открыть профиль пользователя', 'error');
        return;
    }
    app.viewedUserId = targetId;
    // Обновляем информацию в профиле
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl) profileNameEl.textContent = user.name;
    const profileUsernameEl = document.getElementById('profileUsername');
    if (profileUsernameEl) profileUsernameEl.textContent = '@' + user.username;
    const profileBioEl = document.getElementById('profileBio');
    if (profileBioEl) profileBioEl.textContent = user.bio || 'Описание профиля';
    
    const avatarImg = document.getElementById('profileAvatar');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    
    if (avatarImg && avatarPlaceholder) {
        if (user.avatar) {
            avatarImg.src = user.avatar;
            avatarImg.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarPlaceholder.style.display = 'flex';
        }
        avatarImg.addEventListener('error', () => {
            avatarImg.style.display = 'none';
            avatarPlaceholder.style.display = 'flex';
        }, { once: true });
    }
    
    // Показываем количество подписчиков
    updateFollowersCount(user.followersCount || 0);
    
    // Показываем/скрываем кнопки в зависимости от чей профиль
    const currentId = resolveId(app.currentUser);
    const isOwnProfile = currentId && targetId === currentId;
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
        editBtn.style.display = isOwnProfile ? 'block' : 'none';
    }

    const ownerEdit = document.getElementById('profileOwnerEdit');
    if (ownerEdit) {
        ownerEdit.classList.toggle('hidden', !isOwnProfile);
        if (isOwnProfile) {
            document.getElementById('inlineNameInput').value = user.name;
            document.getElementById('inlineUsernameInput').value = user.username;
        }
    }

    const followBtn = document.getElementById('followProfileBtn');
    if (followBtn) {
        if (isOwnProfile) {
            followBtn.classList.add('hidden');
            followBtn.dataset.userId = '';
        } else {
            followBtn.classList.remove('hidden');
            followBtn.dataset.userId = targetId;
            followBtn.textContent = user.isFollowing ? 'Отписаться' : 'Подписаться';
        }
    }
    
    // Загружаем посты пользователя
    loadUserPostsById(targetId);
    
    // Переключаемся на экран профиля
    showScreen('profile');
}

// Обновление количества подписчиков
function updateFollowersCount(count) {
    const followersElement = document.getElementById('profileFollowers');
    if (followersElement) {
        followersElement.textContent = count;
    }
}

// Загрузка постов пользователя по ID
async function loadUserPostsById(userId) {
    const normalizedId = resolveId(userId);
    if (!normalizedId) {
        showNotification('Не удалось загрузить посты пользователя', 'error');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/users/${normalizedId}/posts`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const posts = await response.json();
            renderUserPosts(posts);
        } else {
            showNotification('Ошибка загрузки постов', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Подписка/отписка
async function toggleFollow(userId) {
    const currentId = resolveId(app.currentUser);
    const targetId = resolveId(userId);
    if (!targetId) {
        showNotification('Некорректный пользователь', 'error');
        return;
    }
    if (currentId && currentId === targetId) {
        showNotification('Невозможно подписаться на себя', 'error');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/users/${targetId}/follow`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification(data.message, 'success');
            viewUserProfile(targetId);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка подписки', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Обновление ленты
function refreshFeed() {
    resetPagination();
    loadPosts();
    showNotification('Лента обновлена', 'success');
}

// Уведомления
let notifications = [];
let unreadCount = 0;

function openNotifications() {
    document.getElementById('notificationsModal').classList.add('active');
    loadNotifications();
}

function closeNotifications() {
    document.getElementById('notificationsModal').classList.remove('active');
}

async function loadNotifications() {
    try {
        const response = await fetch(`${API_URL}/notifications`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            notifications = await response.json();
            renderNotifications();
            updateNotificationsBadge();
        }
    } catch (error) {
        console.error('Ошибка загрузки уведомлений:', error);
    }
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    
    if (notifications.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Уведомлений нет</p>';
        return;
    }
    
    container.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.read ? 'read' : 'unread'}" data-id="${notification.id}">
            <div class="notification-content">
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${formatTime(notification.created_at)}</div>
            </div>
            ${!notification.read ? '<div class="notification-indicator"></div>' : ''}
        </div>
    `).join('');
}

function updateNotificationsBadge() {
    unreadCount = notifications.filter(n => !n.read).length;
    const notificationsBtn = document.getElementById('notificationsBtn');
    
    if (unreadCount > 0) {
        notificationsBtn.innerHTML = `🔔 <span class="notification-badge">${unreadCount}</span>`;
    } else {
        notificationsBtn.innerHTML = '🔔';
    }
}

async function markAllAsRead() {
    try {
        const response = await fetch(`${API_URL}/notifications/read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            notifications.forEach(n => n.read = true);
            renderNotifications();
            updateNotificationsBadge();
            showNotification('Все уведомления отмечены как прочитанные', 'success');
        }
    } catch (error) {
        console.error('Ошибка отметки уведомлений:', error);
    }
}

// Настройки
function openSettings() {
    document.getElementById('settingsModal').classList.add('active');
    const userDisplayId = document.getElementById('userDisplayId');
    if (userDisplayId) {
        const storedId = app.currentUser?.userId || localStorage.getItem('clone_userId');
        userDisplayId.value = storedId || 'Нет ID';
    }
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

// Обновление аккаунта
async function updateAccount() {
    const newEmail = document.getElementById('newEmail').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    
    if (!newEmail && !newPassword) {
        showNotification('Введите новые данные', 'error');
        return;
    }
    
    // В реальном приложении здесь был бы API endpoint
    showNotification('Функция обновления аккаунта в разработке', 'info');
    
    // Очистка полей
    document.getElementById('newEmail').value = '';
    document.getElementById('newPassword').value = '';
}

// Выход из аккаунта
function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('clone_token');
        app.token = null;
        app.currentUser = null;
        
        if (app.socket) {
            app.socket.disconnect();
            app.socket = null;
        }
        
        document.getElementById('mainApp').classList.remove('active');
        document.getElementById('authScreen').classList.add('active');
        
        // Очистка форм
        document.getElementById('loginFormElement').reset();
        document.getElementById('registerFormElement').reset();
        
        showNotification('Вы вышли из аккаунта', 'info');
    }
}

// Удаление аккаунта
async function deleteAccount() {
    if (confirm('Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить!')) {
        try {
            const response = await fetch(`${API_URL}/account`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${app.token}`
                }
            });
            
            if (response.ok) {
                localStorage.removeItem('clone_token');
                app.token = null;
                app.currentUser = null;
                
                if (app.socket) {
                    app.socket.disconnect();
                    app.socket = null;
                }
                
                document.getElementById('mainApp').classList.remove('active');
                document.getElementById('authScreen').classList.add('active');
                
                showNotification('Аккаунт удален', 'info');
            } else {
                const data = await response.json();
                showNotification(data.error || 'Ошибка удаления аккаунта', 'error');
            }
        } catch (error) {
            showNotification('Ошибка соединения с сервером', 'error');
        }
    }
}

// Тема
function toggleTheme() {
    const body = document.body;
    const themeBtn = document.getElementById('themeToggle');
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        themeBtn.textContent = '🌙';
        app.theme = 'light';
    } else {
        body.classList.add('dark-theme');
        themeBtn.textContent = '☀️';
        app.theme = 'dark';
    }
    
    localStorage.setItem('clone_theme', app.theme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('clone_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('themeToggle').textContent = '☀️';
        app.theme = 'dark';
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Позиционирование
    notification.style.position = 'fixed';
    notification.style.top = '1rem';
    notification.style.right = '1rem';
    notification.style.zIndex = '2000';
    notification.style.animation = 'fadeIn 0.3s ease-out';
    
    // Автоматическое удаление
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Форматирование времени
function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} д назад`;
    
    return date.toLocaleDateString('ru-RU');
}

// Обработка медиа файлов
function handleMediaAttach(e) {
    const files = e.target.files;
    const previewContainer = document.getElementById('mediaPreview') || createMediaPreviewContainer();
    
    // Очищаем предыдущий предпросмотр
    previewContainer.innerHTML = '';
    
    if (files.length > 0) {
        showNotification(`Выбрано файлов: ${files.length}`, 'success');
        
        // Создаем предпросмотр для каждого файла
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const previewItem = document.createElement('div');
                previewItem.className = 'media-preview-item';
                
                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = 'Предпросмотр изображения';
                    previewItem.appendChild(img);
                } else if (file.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.src = e.target.result;
                    video.controls = true;
                    previewItem.appendChild(video);
                }
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'media-preview-remove';
                removeBtn.textContent = '×';
                removeBtn.addEventListener('click', () => {
                    previewItem.remove();
                    updateMediaInput();
                });
                
                previewItem.appendChild(removeBtn);
                previewContainer.appendChild(previewItem);
            };
            
            reader.readAsDataURL(file);
        });
    }
}

// Создание контейнера для предпросмотра медиа
function createMediaPreviewContainer() {
    const container = document.createElement('div');
    container.id = 'mediaPreview';
    container.className = 'media-preview';
    container.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: var(--bg-secondary);
        border-radius: var(--radius-md);
        min-height: 100px;
    `;
    
    // Вставляем в новый composer профиля
    const composer = document.querySelector('.profile-composer');
    if (composer) {
        composer.appendChild(container);
    }
    
    return container;
}

// Обновление input файлами после удаления
function updateMediaInput() {
    const input = document.getElementById('mediaInput');
    const previewItems = document.querySelectorAll('.media-preview-item');
    
    if (previewItems.length === 0) {
        input.value = '';
        document.getElementById('mediaPreview').style.display = 'none';
    }
}

// Добавление стилей для анимации fadeOut и новых элементов
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
    }
    
    .follow-btn {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 0.875rem;
        transition: background-color 0.2s;
    }
    
    .follow-btn:hover {
        background: var(--primary-hover);
    }
    
    .comment-submit-btn {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: var(--radius-sm);
        transition: background-color 0.2s;
    }
    
    .comment-submit-btn:hover {
        background: var(--bg-tertiary);
    }
    
    .media-preview-item {
        position: relative;
        width: 100px;
        height: 100px;
        border-radius: var(--radius-sm);
        overflow: hidden;
    }
    
    .media-preview-item img,
    .media-preview-item video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .media-preview-remove {
        position: absolute;
        top: 4px;
        right: 4px;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    }
    
    .media-preview-remove:hover {
        background: rgba(255, 0, 0, 0.8);
        color: white;
    }
    
    .follow-profile-btn {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 0.875rem;
        margin-top: 0.5rem;
        transition: background-color 0.2s;
    }
    
    .follow-profile-btn:hover {
        background: var(--primary-hover);
    }
    
    .post-author {
        transition: color 0.2s;
    }
    
    .post-author:hover {
        color: var(--primary-hover) !important;
    }
    
    .notification-badge {
        background: var(--danger-color);
        color: white;
        border-radius: 50%;
        width: 18px;
        height: 18px;
        font-size: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: -4px;
        right: -4px;
    }
    
    .notifications-list {
        max-height: 400px;
        overflow-y: auto;
    }
    
    .notification-item {
        display: flex;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    .notification-item:hover {
        background: var(--bg-secondary);
    }
    
    .notification-item.unread {
        background: var(--bg-tertiary);
        font-weight: 500;
    }
    
    .notification-content {
        flex: 1;
    }
    
    .notification-message {
        margin-bottom: 0.25rem;
    }
    
    .notification-time {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .notification-indicator {
        width: 8px;
        height: 8px;
        background: var(--primary-color);
        border-radius: 50%;
        margin-left: 0.5rem;
    }
    
    .avatar-placeholder {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--bg-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
    }
`;
document.head.appendChild(style);

function replaceWithAvatarFallback(img) {
    if (!img) return;
    const wrapper = img.parentElement;
    if (!wrapper) return;
    const fallback = document.createElement('div');
    fallback.className = 'avatar-placeholder';
    fallback.textContent = '😊';
    wrapper.innerHTML = '';
    wrapper.appendChild(fallback);
}

function attachMediaFallbacks(postElement) {
    if (!postElement) return;
    postElement.querySelectorAll('.post-media img').forEach(img => {
        img.addEventListener('error', () => {
            img.replaceWith(createMediaFallback('image'));
        });
    });
    postElement.querySelectorAll('.post-media video').forEach(video => {
        video.addEventListener('error', () => {
            video.replaceWith(createMediaFallback('video'));
        });
    });
}

function createMediaFallback(type) {
    const fallback = document.createElement('div');
    fallback.className = 'media-fallback';
    fallback.textContent = type === 'video' ? 'Видео недоступно' : 'Изображение недоступно';
    return fallback;
}

// ==================== ИНИЦИАЛИЗАЦИЯ АДМИН-ПАНЕЛИ ====================

// Добавить обработчики событий для админ-панели
function initAdminPanel() {
    // Показать/скрыть админ-меню
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            const dropdown = document.getElementById('adminDropdown');
            if (dropdown) {
                dropdown.classList.toggle('hidden');
            }
        });
    }
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', (e) => {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && !adminPanel.contains(e.target)) {
            const dropdown = document.getElementById('adminDropdown');
            if (dropdown) {
                dropdown.classList.add('hidden');
            }
        }
    });
    
    // Обработчики для модальных окон
    const totalUsers = document.getElementById('totalUsers');
    if (totalUsers) {
        totalUsers.addEventListener('click', showAllUsers);
    }
    
    const bannedUsersBtn = document.getElementById('bannedUsersBtn');
    if (bannedUsersBtn) {
        bannedUsersBtn.addEventListener('click', showBannedUsers);
    }
    
    const allUsersBtn = document.getElementById('allUsersBtn');
    if (allUsersBtn) {
        allUsersBtn.addEventListener('click', showAllUsers);
    }
    
    const closeBannedUsers = document.getElementById('closeBannedUsers');
    if (closeBannedUsers) {
        closeBannedUsers.addEventListener('click', () => hideModal('bannedUsersModal'));
    }
    
    const closeAllUsers = document.getElementById('closeAllUsers');
    if (closeAllUsers) {
        closeAllUsers.addEventListener('click', () => hideModal('allUsersModal'));
    }
    
    // Показать ID в настройках
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            // Показываем ID пользователя в настройках
            if (app.currentUser) {
                const userDisplayId = document.getElementById('userDisplayId');
                if (userDisplayId) {
                    userDisplayId.value = app.currentUser.userId || 'Нет ID';
                }
            }
        });
    }
}

// Показать/скрыть админ-панель в зависимости от прав пользователя
function updateAdminPanelVisibility() {
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
        if (isCreator()) {
            adminPanel.classList.remove('hidden');
            updateAdminStats();
        } else {
            adminPanel.classList.add('hidden');
        }
    }
}

// Показать/скрыть модальное окно
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Обновить статистику админа
function updateAdminStats() {
    // Для основной версии нужно получить статистику с сервера
    const totalUsersElement = document.getElementById('totalUsers');
    if (totalUsersElement) {
        // Временно показываем загрузку
        totalUsersElement.querySelector('.admin-stat-number').textContent = '...';
        totalUsersElement.querySelector('.admin-stat-label').textContent = 'Загрузка...';
        
        // Запрашиваем статистику с сервера
        fetchAdminStats();
    }
}

// Запрос статистики с сервера
async function fetchAdminStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            const totalUsersElement = document.getElementById('totalUsers');
            if (totalUsersElement) {
                totalUsersElement.querySelector('.admin-stat-number').textContent = stats.totalUsers || 0;
                totalUsersElement.querySelector('.admin-stat-label').textContent = `Пользователей (${stats.bannedUsers || 0} забанено)`;
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Показать всех пользователей
function showAllUsers() {
    hideModal('bannedUsersModal');
    showModal('allUsersModal');
    loadAllUsers();
}

// Показать забаненных пользователей
function showBannedUsers() {
    hideModal('allUsersModal');
    showModal('bannedUsersModal');
    loadBannedUsers();
}

// Загрузить всех пользователей
async function loadAllUsers() {
    const container = document.getElementById('allUsersList');
    if (container) {
        container.innerHTML = '<p>Загрузка...</p>';
        
        try {
            const response = await fetch(`${API_URL}/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${app.token}`
                }
            });
            
            if (response.ok) {
                const users = await response.json();
                displayUsersList(users, container, false);
            } else {
                container.innerHTML = '<p class="search-hint">Ошибка загрузки пользователей</p>';
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            container.innerHTML = '<p class="search-hint">Ошибка загрузки пользователей</p>';
        }
    }
}

// Загрузить забаненных пользователей
async function loadBannedUsers() {
    const container = document.getElementById('bannedUsersList');
    if (container) {
        container.innerHTML = '<p>Загрузка...</p>';
        
        try {
            const response = await fetch(`${API_URL}/admin/users/banned`, {
                headers: {
                    'Authorization': `Bearer ${app.token}`
                }
            });
            
            if (response.ok) {
                const users = await response.json();
                displayUsersList(users, container, true);
            } else {
                container.innerHTML = '<p class="search-hint">Забаненных пользователей нет</p>';
            }
        } catch (error) {
            console.error('Ошибка загрузки забаненных:', error);
            container.innerHTML = '<p class="search-hint">Ошибка загрузки</p>';
        }
    }
}

// Отобразить список пользователей
function displayUsersList(users, container, isBanned) {
    container.innerHTML = '';
    
    if (!users || users.length === 0) {
        container.innerHTML = `<p class="search-hint">${isBanned ? 'Забаненных пользователей нет' : 'Пользователей нет'}</p>`;
        return;
    }
    
    users.forEach(user => {
        const userElement = createUserElement(user, isBanned);
        container.appendChild(userElement);
    });
}

// Создать элемент пользователя
function createUserElement(user, isBanned) {
    const userDiv = document.createElement('div');
    userDiv.className = 'user-item';
    
    userDiv.innerHTML = `
        <div class="user-item-info">
            <div class="user-item-avatar">
                <span>${user.avatar || '😊'}</span>
            </div>
            <div class="user-item-details">
                <div class="user-item-name">
                    ${user.name || 'Пользователь'}
                    ${isBanned ? '<span class="banned-badge">ЗАБАНЕН</span>' : ''}
                </div>
                <div class="user-item-username">@${user.username || 'user'}</div>
                <div class="user-item-id">ID: ${user.userId || 'Нет ID'}</div>
            </div>
        </div>
        <div class="user-item-actions">
            ${isBanned ? 
                `<button class="btn-unban" onclick="unbanUser('${user._id || user.id}')">Разбанить</button>` :
                `<button class="btn-ban" onclick="banUser('${user._id || user.id}')">Забанить</button>`
            }
        </div>
    `;

    return userDiv;
}

// Забанить пользователя
async function banUser(userId) {
    if (!confirm('Вы уверены, что хотите забанить этого пользователя?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/ban`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            showNotification('Пользователь забанен', 'success');
            loadAllUsers();
            updateAdminStats();
        } else {
            showNotification('Ошибка при бане пользователя', 'error');
        }
    } catch (error) {
        console.error('Ошибка бана:', error);
        showNotification('Ошибка при бане пользователя', 'error');
    }
}

// Разбанить пользователя
async function unbanUser(userId) {
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/unban`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            showNotification('Пользователь разбанен', 'success');
            loadBannedUsers();
            updateAdminStats();
        } else {
            showNotification('Ошибка при разбане пользователя', 'error');
        }
    } catch (error) {
        console.error('Ошибка разбана:', error);
        showNotification('Ошибка при разбане пользователя', 'error');
    }
}

// Поиск всех пользователей
async function searchAllUsers() {
    const query = document.getElementById('allUsersSearchInput')?.value.toLowerCase().trim();
    const container = document.getElementById('allUsersList');
    
    if (!container) return;
    
    if (!query) {
        loadAllUsers();
        return;
    }
    
    container.innerHTML = '<p>Поиск...</p>';
    
    try {
        const response = await fetch(`${API_URL}/admin/users/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            displayUsersList(users, container, false);
        } else {
            container.innerHTML = '<p class="search-hint">Пользователи не найдены</p>';
        }
    } catch (error) {
        console.error('Ошибка поиска:', error);
        container.innerHTML = '<p class="search-hint">Ошибка поиска</p>';
    }
}

// Поиск забаненных пользователей
async function searchBannedUsers() {
    const query = document.getElementById('bannedSearchInput')?.value.toLowerCase().trim();
    const container = document.getElementById('bannedUsersList');
    
    if (!container) return;
    
    if (!query) {
        loadBannedUsers();
        return;
    }
    
    container.innerHTML = '<p>Поиск...</p>';
    
    try {
        const response = await fetch(`${API_URL}/admin/users/banned/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            displayUsersList(users, container, true);
        } else {
            container.innerHTML = '<p class="search-hint">Забаненные не найдены</p>';
        }
    } catch (error) {
        console.error('Ошибка поиска:', error);
        container.innerHTML = '<p class="search-hint">Ошибка поиска</p>';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Восстанавливаем токен из localStorage
    const savedToken = localStorage.getItem('clone_token');
    if (savedToken) {
        app.token = savedToken;
        // Восстанавливаем ID из localStorage
        const savedUserId = localStorage.getItem('clone_userId');
        if (savedUserId) {
            // Временно устанавливаем ID, будет обновлен при загрузке профиля
            if (!app.currentUser) {
                app.currentUser = {};
            }
            app.currentUser.userId = savedUserId;
        }
    }
    
    // Инициализируем админ-панель
    initAdminPanel();
});