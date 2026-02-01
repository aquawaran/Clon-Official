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

const CREATOR_ID = process.env.CREATOR_ID || '4798654566';

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

// ==================== АДМИН-МАРШРУТЫ ====================

app.get('/api/admin/stats', authenticateToken, checkCreator, async (req, res) => {
    try {
        const allUsers = await User.getAll();
        const totalUsers = allUsers.length;
        const bannedUsers = allUsers.filter(u => u.is_banned).length;
        res.json({ totalUsers, bannedUsers });
    } catch (error) {
        console.error('Ошибка получения админ-статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/users', authenticateToken, checkCreator, async (req, res) => {
    try {
        const users = await User.getAll();
        res.json(users);
    } catch (error) {
        console.error('Ошибка получения списка пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/users/banned', authenticateToken, checkCreator, async (req, res) => {
    try {
        const users = await User.getBanned();
        res.json(users);
    } catch (error) {
        console.error('Ошибка получения забаненных пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/users/search', authenticateToken, checkCreator, async (req, res) => {
    try {
        const query = req.query.q || '';
        if (!query.trim()) {
            return res.json([]);
        }
        const users = await User.searchAll(query.trim());
        res.json(users);
    } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/users/banned/search', authenticateToken, checkCreator, async (req, res) => {
    try {
        const query = req.query.q || '';
        if (!query.trim()) {
            const users = await User.getBanned();
            return res.json(users);
        }
        const users = await User.searchBanned(query.trim());
        res.json(users);
    } catch (error) {
        console.error('Ошибка поиска забаненных пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/admin/users/:id/ban', authenticateToken, checkCreator, async (req, res) => {
    try {
        const targetId = req.params.id;
        const user = await User.findById(targetId);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (user.user_id === CREATOR_ID) {
            return res.status(400).json({ error: 'Невозможно забанить создателя' });
        }

        await User.setBanStatus(targetId, true);
        res.json({ message: 'Пользователь забанен' });
    } catch (error) {
        console.error('Ошибка блокировки пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/admin/users/:id/unban', authenticateToken, checkCreator, async (req, res) => {
    try {
        const targetId = req.params.id;
        const user = await User.findById(targetId);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        await User.setBanStatus(targetId, false);
        res.json({ message: 'Пользователь разбанен' });
    } catch (error) {
        console.error('Ошибка разблокировки пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==================== АДМИН-МАРШРУТЫ ====================

app.get('/api/admin/stats', authenticateToken, checkCreator, async (req, res) => {
    try {
        const allUsers = await User.getAll();
        const totalUsers = allUsers.length;
        const bannedUsers = allUsers.filter(u => u.is_banned).length;
        res.json({ totalUsers, bannedUsers });
    } catch (error) {
        console.error('Ошибка получения админ-статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/users', authenticateToken, checkCreator, async (req, res) => {
    try {
        const users = await User.getAll();
        res.json(users);
    } catch (error) {
        console.error('Ошибка получения списка пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/users/banned', authenticateToken, checkCreator, async (req, res) => {
    try {
        const users = await User.getBanned();
        res.json(users);
    } catch (error) {
        console.error('Ошибка получения забаненных пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/users/search', authenticateToken, checkCreator, async (req, res) => {
    try {
        const query = req.query.q || '';
        if (!query.trim()) {
            return res.json([]);
        }
        const users = await User.searchAll(query.trim());
        res.json(users);
    } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/admin/users/banned/search', authenticateToken, checkCreator, async (req, res) => {
    try {
        const query = req.query.q || '';
        if (!query.trim()) {
            const users = await User.getBanned();
            return res.json(users);
        }
        const users = await User.searchBanned(query.trim());
        res.json(users);
    } catch (error) {
        console.error('Ошибка поиска забаненных пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/admin/users/:id/ban', authenticateToken, checkCreator, async (req, res) => {
    try {
        const targetId = req.params.id;
        const user = await User.findById(targetId);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (user.user_id === CREATOR_ID) {
            return res.status(400).json({ error: 'Невозможно забанить создателя' });
        }

        await User.setBanStatus(targetId, true);
        res.json({ message: 'Пользователь забанен' });
    } catch (error) {
        console.error('Ошибка блокировки пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/admin/users/:id/unban', authenticateToken, checkCreator, async (req, res) => {
    try {
        const targetId = req.params.id;
        const user = await User.findById(targetId);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        await User.setBanStatus(targetId, false);
        res.json({ message: 'Пользователь разбанен' });
    } catch (error) {
        console.error('Ошибка разблокировки пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Раздача статических файлов
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Обслуживаем статические файлы (кроме uploads)
app.use(express.static(__dirname));

// Инициализация базы данных и запуск сервера
initDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Сервер Clone запущен на порту ${PORT}`);
        console.log(`📱 Откройте http://localhost:${PORT} в браузере`);
    });
}).catch(error => {
    console.error('Ошибка инициализации базы данных:', error);
});

module.exports = app;
