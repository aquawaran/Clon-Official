const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Импорт базы данных
const { initDatabase, User, Post, Follow, Notification } = require('./database');
const crypto = require('crypto');

function generateUserId() {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

const CREATOR_ID = process.env.CREATOR_ID || '1761560316';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Cloudinary конфигурация
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Конфигурация
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clone-secret-key-2024';

// Middleware
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Обслуживаем статические файлы (кроме uploads) - ВАЖНО: до всех маршрутов!
app.use(express.static(__dirname));

// Trust proxy для Render (ограничиваем до одного прокси)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100 // лимит запросов
});
app.use('/api/', limiter);

// Настройка Cloudinary Storage для Multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'clone-social-network',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'avi', 'mov'],
        public_id: (req, file) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            return uniqueSuffix;
        }
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Недопустимый тип файла'));
        }
    }
});

// JWT токен middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен отсутствует' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

// Middleware для проверки прав создателя
const checkCreator = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        if (user.user_id !== CREATOR_ID) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }
        next();
    } catch (error) {
        console.error('Ошибка проверки прав создателя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

// Socket.IO аутентификация
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Отсутствует токен'));
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return next(new Error('Недействительный токен'));
        }
        socket.userId = user.id;
        next();
    });
});

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.userId);
    
    socket.join(socket.userId);
    
    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.userId);
    });
});

// Роуты

// Регистрация
app.post('/api/register', async (req, res) => {
    try {
        const { name, username, email, password } = req.body;

        // Проверка существования пользователя
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        const existingUsername = await User.findByUsername(username);
        if (existingUsername) {
            return res.status(400).json({ error: 'Пользователь с таким username уже существует' });
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создание пользователя
        const userId = generateUserId();
        const newUser = await User.create({
            name,
            username,
            email,
            password: hashedPassword,
            userId
        });

        // Создание JWT токена
        const token = jwt.sign(
            { id: newUser.id, userId: newUser.user_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            user: {
                id: newUser.id,
                name: newUser.name,
                username: newUser.username,
                email: newUser.email,
                avatar: newUser.avatar,
                bio: newUser.bio,
                userId: newUser.user_id,
                isCreator: newUser.user_id === CREATOR_ID
            },
            token
        });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Поиск пользователя
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }

        // Проверка пароля
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }

        // Создание JWT токена
        const token = jwt.sign(
            { id: user.id, userId: user.user_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                bio: user.bio,
                userId: user.user_id,
                isCreator: user.user_id === CREATOR_ID,
                isBanned: user.is_banned
            },
            token
        });
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение текущего пользователя
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            bio: user.bio,
            userId: user.user_id,
            isCreator: user.user_id === CREATOR_ID,
            isBanned: user.is_banned
        });
    } catch (error) {
        console.error('Ошибка получения пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание поста
app.post('/api/posts', authenticateToken, upload.array('media', 5), async (req, res) => {
    try {
        const { content } = req.body;
        const author_id = req.user.id;

        // Обработка медиа файлов
        let media = [];
        if (req.files && req.files.length > 0) {
            media = req.files.map(file => ({
                url: file.path,
                type: file.mimetype.startsWith('video/') ? 'video' : 'image'
            }));
        }

        const newPost = await Post.create({
            author_id,
            content,
            media
        });

        // Получение информации об авторе
        const author = await User.findById(author_id);

        // Добавление информации об авторе в пост
        const postWithAuthor = {
            ...newPost,
            author_name: author.name,
            author_username: author.username,
            author_avatar: author.avatar
        };

        // Отправка поста всем подключенным клиентам
        io.emit('new_post', postWithAuthor);

        res.status(201).json(postWithAuthor);
    } catch (error) {
        console.error('Ошибка создания поста:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение ленты
app.get('/api/posts', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const posts = await Post.getFeed(limit, offset);
        res.json(posts);
    } catch (error) {
        console.error('Ошибка получения ленты:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение постов пользователя
app.get('/api/users/:userId/posts', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const posts = await Post.getUserPosts(userId, limit, offset);
        res.json(posts);
    } catch (error) {
        console.error('Ошибка получения постов пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление реакций
app.post('/api/posts/:postId/reactions', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const { reaction } = req.body;
        const userId = req.user.id;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Пост не найден' });
        }

        // Обновление реакций
        const reactions = { ...post.reactions };
        
        // Удаление пользователя из всех реакций
        Object.keys(reactions).forEach(key => {
            reactions[key] = reactions[key].filter(id => id !== userId);
        });

        // Добавление пользователя к новой реакции
        if (!reactions[reaction]) {
            reactions[reaction] = [];
        }
        reactions[reaction].push(userId);

        // Сохранение в базу
        const updatedPost = await Post.updateReactions(postId, reactions);

        // Отправка обновления всем клиентам
        io.emit('post_reaction', { postId, reactions });

        res.json({ reactions });
    } catch (error) {
        console.error('Ошибка обновления реакций:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавление комментария
app.post('/api/posts/:postId/comments', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const { text } = req.body;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const comment = {
            id: uuidv4(),
            authorName: user.name,
            text,
            avatar: user.avatar,
            createdAt: new Date().toISOString()
        };

        const updatedPost = await Post.addComment(postId, comment);

        // Отправка обновления всем клиентам
        io.emit('new_comment', { postId, comment });

        res.json(updatedPost);
    } catch (error) {
        console.error('Ошибка добавления комментария:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление поста
app.delete('/api/posts/:postId', authenticateToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Пост не найден' });
        }

        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const isAuthor = post.author_id === userId;
        const isCreator = currentUser.user_id === CREATOR_ID;

        if (!isAuthor && !isCreator) {
            return res.status(403).json({ error: 'Нет прав для удаления этого поста' });
        }

        await Post.delete(postId);

        if (!isAuthor) {
            await Notification.create({
                user_id: post.author_id,
                type: 'post_deleted',
                message: 'Ваш пост был удален администратором',
                data: { postId }
            });
        }

        io.emit('post_deleted', { postId });

        res.json({ message: 'Пост удален' });
    } catch (error) {
        console.error('Ошибка удаления поста:', error);
        res.status(500).json({ error: 'Ошибка удаления поста' });
    }
});

// Подписка/отписка
app.post('/api/users/:userId/follow', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const followerId = req.user.id;

        if (userId === followerId) {
            return res.status(400).json({ error: 'Нельзя подписаться на себя' });
        }

        const isFollowing = await Follow.toggle(followerId, userId);

        if (isFollowing) {
            // Создание уведомления о подписке
            await Notification.create({
                user_id: userId,
                type: 'follow',
                message: 'На вас подписались',
                data: { followerId }
            });

            io.to(userId).emit('notification', {
                type: 'follow',
                message: 'На вас подписались'
            });
        }

        res.json({ following: isFollowing });
    } catch (error) {
        console.error('Ошибка подписки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение подписок пользователя
app.get('/api/users/:userId/following', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const following = await Follow.getFollowing(userId);
        res.json(following);
    } catch (error) {
        console.error('Ошибка получения подписок:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение подписчиков пользователя
app.get('/api/users/:userId/followers', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const followers = await Follow.getFollowers(userId);
        res.json(followers);
    } catch (error) {
        console.error('Ошибка получения подписчиков:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление профиля
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { name, username, bio } = req.body;
        const userId = req.user.id;

        // Проверка уникальности username
        if (username) {
            const existingUser = await User.findByUsername(username);
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({ error: 'Этот username уже занят' });
            }
        }

        const updatedUser = await User.update(userId, { name, username, bio });
        
        res.json({
            id: updatedUser.id,
            name: updatedUser.name,
            username: updatedUser.username,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
            bio: updatedUser.bio,
            userId: updatedUser.user_id,
            isCreator: updatedUser.user_id === CREATOR_ID
        });
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление аватара
app.put('/api/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        const updatedUser = await User.updateAvatar(userId, req.file.path);
        
        res.json({
            id: updatedUser.id,
            name: updatedUser.name,
            username: updatedUser.username,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
            bio: updatedUser.bio,
            userId: updatedUser.user_id,
            isCreator: updatedUser.user_id === CREATOR_ID
        });
    } catch (error) {
        console.error('Ошибка обновления аватара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Поиск пользователей
app.get('/api/users/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Запрос отсутствует' });
        }

        const users = await User.search(q);
        res.json(users);
    } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение уведомлений
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const notifications = await Notification.getUserNotifications(req.user.id);
        res.json(notifications);
    } catch (error) {
        console.error('Ошибка получения уведомлений:', error);
        res.status(500).json({ error: 'Ошибка получения уведомлений' });
    }
});

// Отметить уведомления как прочитанные
app.post('/api/notifications/read', authenticateToken, async (req, res) => {
    try {
        await Notification.markAsRead(req.user.id);
        res.json({ message: 'Уведомления отмечены как прочитанные' });
    } catch (error) {
        console.error('Ошибка отметки уведомлений:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление аккаунта
app.delete('/api/account', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Удаление пользователя (каскадное удаление сработает для постов)
        await User.delete(userId);

        res.json({ message: 'Аккаунт удален' });
    } catch (error) {
        console.error('Ошибка удаления аккаунта:', error);
        res.status(500).json({ error: 'Ошибка удаления аккаунта' });
    }
});

// Раздача статических файлов
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Инициализация базы данных и запуск сервера
initDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Сервер Clone запущен на порту ${PORT}`);
        console.log(`📱 Откройте http://localhost:${PORT} в браузере`);
    });
}).catch(error => {
    console.error('Ошибка инициализации базы данных:', error);
    process.exit(1);
});
