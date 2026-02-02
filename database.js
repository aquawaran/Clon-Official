const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Инициализация базы данных
async function initDatabase() {
  try {
    // Таблица пользователей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar TEXT,
        bio TEXT,
        user_id VARCHAR(20) UNIQUE,
        is_banned BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS user_id VARCHAR(20)
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_user_id_idx ON users(user_id) WHERE user_id IS NOT NULL
    `);

    await pool.query(`
      UPDATE users
      SET user_id = LPAD(FLOOR(RANDOM() * 9000000000 + 1000000000)::TEXT, 10, '0')
      WHERE user_id IS NULL
    `);

    await pool.query(`
      UPDATE users
      SET is_banned = FALSE
      WHERE is_banned IS NULL
    `);

    // Таблица постов
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        media JSONB DEFAULT '[]',
        reactions JSONB DEFAULT '{"like": [], "dislike": [], "heart": [], "angry": [], "laugh": [], "cry": []}',
        comments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Таблица подписок
    await pool.query(`
      CREATE TABLE IF NOT EXISTS followers (
        follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
        following_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (follower_id, following_id)
      )
    `);

    // Таблица уведомлений
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('База данных инициализирована');
  } catch (error) {
    console.error('Ошибка инициализации БД:', error);
  }
}

// Модели данных
const User = {
  // Создание пользователя
  async create(userData) {
    const { name, username, email, password, userId, isBanned = false } = userData;
    const result = await pool.query(
      'INSERT INTO users (name, username, email, password, user_id, is_banned) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, username, email, password, userId, isBanned]
    );
    return result.rows[0];
  },

  // Поиск по email
  async findByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  // Поиск по username
  async findByUsername(username) {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  },

  async findByUserId(userId) {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    return result.rows[0];
  },

  // Поиск по ID
  async findById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Обновление профиля
  async update(id, userData) {
    const { name, username, bio } = userData;
    const result = await pool.query(
      'UPDATE users SET name = $1, username = $2, bio = $3 WHERE id = $4 RETURNING *',
      [name, username, bio, id]
    );
    return result.rows[0];
  },

  // Установка бан статуса
  async setBanStatus(userId, isBanned) {
    await pool.query('UPDATE users SET is_banned = $1 WHERE user_id = $2', [isBanned, userId]);
  },

  // Установка верификации
  async setVerification(userId, isVerified) {
    await pool.query('UPDATE users SET is_verified = $1, verification_request = NULL, verification_requested_at = NULL WHERE user_id = $2', [isVerified, userId]);
  },

  // Заявка на верификацию
  async requestVerification(userId, request) {
    await pool.query('UPDATE users SET verification_request = $1, verification_requested_at = CURRENT_TIMESTAMP WHERE user_id = $2', [request, userId]);
  },

  // Получение всех заявок на верификацию
  async getVerificationRequests() {
    const result = await pool.query(`
      SELECT id, name, username, user_id, verification_request, verification_requested_at 
      FROM users 
      WHERE verification_request IS NOT NULL 
      ORDER BY verification_requested_at DESC
    `);
    return result.rows;
  },

  // Отклонение заявки
  async rejectVerification(userId) {
    await pool.query('UPDATE users SET verification_request = NULL, verification_requested_at = NULL WHERE user_id = $1', [userId]);
  },

  // Обновление аватара
  async updateAvatar(id, avatar) {
    const result = await pool.query(
      'UPDATE users SET avatar = $1 WHERE id = $2 RETURNING *',
      [avatar, id]
    );
    return result.rows[0];
  },

  async setUserId(id, userId) {
    const result = await pool.query(
      'UPDATE users SET user_id = $1 WHERE id = $2 RETURNING *',
      [userId, id]
    );
    return result.rows[0];
  },

  async setBanStatus(id, banned) {
    const result = await pool.query(
      'UPDATE users SET is_banned = $1 WHERE id = $2 RETURNING *',
      [banned, id]
    );
    return result.rows[0];
  },

  async getAll() {
    const result = await pool.query('SELECT id, name, username, email, avatar, bio, user_id, is_banned, created_at FROM users ORDER BY created_at DESC');
    return result.rows;
  },

  async getBanned() {
    const result = await pool.query('SELECT id, name, username, email, avatar, bio, user_id, is_banned, created_at FROM users WHERE is_banned = TRUE ORDER BY created_at DESC');
    return result.rows;
  },

  async searchAll(query) {
    const result = await pool.query(
      `SELECT id, name, username, email, avatar, bio, user_id, is_banned, created_at
       FROM users
       WHERE (LOWER(name) LIKE LOWER($1) OR LOWER(username) LIKE LOWER($1) OR user_id ILIKE $1)
       ORDER BY created_at DESC`,
      [`%${query}%`]
    );
    return result.rows;
  },

  async searchBanned(query) {
    const result = await pool.query(
      `SELECT id, name, username, email, avatar, bio, user_id, is_banned, created_at
       FROM users
       WHERE is_banned = TRUE AND (LOWER(name) LIKE LOWER($1) OR LOWER(username) LIKE LOWER($1) OR user_id ILIKE $1)
       ORDER BY created_at DESC`,
      [`%${query}%`]
    );
    return result.rows;
  },

  // Поиск пользователей (нечувствительный к регистру)
  async search(query) {
    console.log('База данных: поиск по query:', query); // Отладка
    const sql = 'SELECT id, name, username, avatar FROM users WHERE LOWER(username) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($1) LIMIT 20';
    const params = [`%${query}%`];
    console.log('SQL запрос:', sql); // Отладка
    console.log('Параметры:', params); // Отладка
    
    const result = await pool.query(sql, params);
    console.log('Результаты из БД:', result.rows); // Отладка
    return result.rows;
  },

  // Удаление пользователя
  async delete(id) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  }
};

const Post = {
  // Создание поста
  async create(postData) {
    const { author_id, content, media } = postData;
    const result = await pool.query(
      'INSERT INTO posts (author_id, content, media) VALUES ($1, $2, $3) RETURNING *',
      [author_id, content, JSON.stringify(media || [])]
    );
    return result.rows[0];
  },

  // Получение ленты (все посты всех пользователей)
  async getFeed(limit = 10, offset = 0) {
    const result = await pool.query(`
      SELECT p.*, u.name as author_name, u.username as author_username, u.avatar as author_avatar
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
  },

  // Получение постов пользователя
  async getUserPosts(userId, limit = 10, offset = 0) {
    const result = await pool.query(`
      SELECT p.*, u.name as author_name, u.username as author_username, u.avatar as author_avatar
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.author_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    return result.rows;
  },

  // Получение поста по ID
  async findById(id) {
    const result = await pool.query(`
      SELECT p.*, u.name as author_name, u.username as author_username, u.avatar as author_avatar
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = $1
    `, [id]);
    return result.rows[0];
  },

  // Добавление/удаление реакции
  async addReaction(postId, userId, reaction) {
    const post = await this.findById(postId);
    if (!post) return null;

    const reactions = { ...post.reactions };
    
    // Проверяем, есть ли у пользователя уже такая реакция
    const hasReaction = reactions[reaction] && reactions[reaction].includes(userId);
    
    if (hasReaction) {
      // Убираем реакцию (пользователь нажал на ту же реакцию)
      reactions[reaction] = reactions[reaction].filter(id => id !== userId);
      if (reactions[reaction].length === 0) {
        delete reactions[reaction];
      }
    } else {
      // Удаляем предыдущие реакции пользователя
      Object.keys(reactions).forEach(key => {
        reactions[key] = reactions[key].filter(id => id !== userId);
        if (reactions[key].length === 0) {
          delete reactions[key];
        }
      });

      // Добавляем новую реакцию
      if (reactions[reaction]) {
        reactions[reaction].push(userId);
      } else {
        reactions[reaction] = [userId];
      }
    }

    const result = await pool.query(
      'UPDATE posts SET reactions = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(reactions), postId]
    );
    return result.rows[0];
  },

  // Добавление комментария
  async addComment(postId, commentData) {
    const post = await this.findById(postId);
    if (!post) return null;

    const comments = [...post.comments, commentData];
    
    const result = await pool.query(
      'UPDATE posts SET comments = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(comments), postId]
    );
    return result.rows[0];
  },

  // Удаление постов пользователя
  async deleteByUserId(userId) {
    await pool.query('DELETE FROM posts WHERE author_id = $1', [userId]);
  },

  // Удаление поста по ID
  async delete(postId) {
    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
  }
};

// Миграция для добавления полей верификации
async function migrateUsers() {
  try {
    // Сначала проверяем и добавляем user_id если нужно
    const userIdResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'user_id'
    `);
    
    if (userIdResult.rows.length === 0) {
      // Добавляем user_id только тем, у кого его нет
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN user_id VARCHAR(10) UNIQUE
      `);
      
      // Генерируем user_id на основе email для консистентности
      await pool.query(`
        UPDATE users 
        SET user_id = SUBSTRING(MD5(email::text), 1, 10)
        WHERE user_id IS NULL
      `);
      
      console.log('Миграция user_id завершена');
    }
    
    // Затем проверяем и добавляем поля верификации
    const verifiedResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_verified'
    `);
    
    if (verifiedResult.rows.length === 0) {
      // Добавляем колонки верификации
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN is_verified BOOLEAN DEFAULT FALSE,
        ADD COLUMN verification_request TEXT,
        ADD COLUMN verification_requested_at TIMESTAMP
      `);
      
      // Устанавливаем верификацию для создателя
      const creatorId = process.env.CREATOR_ID || '1761560316';
      await pool.query(`
        UPDATE users 
        SET is_verified = TRUE 
        WHERE user_id = $1
      `, [creatorId]);
      
      console.log('Миграция верификации завершена');
    }
  } catch (error) {
    console.error('Ошибка миграции:', error);
  }
}

const Follow = {

  // Подписка/отписка
  async toggle(followerId, followingId) {
    // Проверка существования подписки
    const existing = await pool.query(
      'SELECT * FROM followers WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );

    if (existing.rows.length > 0) {
      // Отписка
      await pool.query(
        'DELETE FROM followers WHERE follower_id = $1 AND following_id = $2',
        [followerId, followingId]
      );
      return false;
    } else {
      // Подписка
      await pool.query(
        'INSERT INTO followers (follower_id, following_id) VALUES ($1, $2)',
        [followerId, followingId]
      );
      return true;
    }
  },

  // Получение подписок пользователя
  async getFollowing(userId) {
    const result = await pool.query(
      'SELECT following_id FROM followers WHERE follower_id = $1',
      [userId]
    );
    return result.rows.map(row => row.following_id);
  },

  // Получение подписчиков
  async getFollowers(userId) {
    const result = await pool.query(
      'SELECT follower_id FROM followers WHERE following_id = $1',
      [userId]
    );
    return result.rows.map(row => row.follower_id);
  }
};

const Notification = {
  // Создание уведомления
  async create(notificationData) {
    const { user_id, type, message, data } = notificationData;
    const result = await pool.query(
      'INSERT INTO notifications (user_id, type, message, data) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, type, message, JSON.stringify(data || {})]
    );
    return result.rows[0];
  },

  // Получение уведомлений пользователя
  async getUserNotifications(userId, limit = 50) {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  },

  // Отметить как прочитанные
  async markAsRead(userId) {
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1',
      [userId]
    );
  },

  // Удаление уведомлений пользователя
  async deleteByUserId(userId) {
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
  }
};

module.exports = {
  pool,
  initDatabase,
  migrateUsers,
  User,
  Post,
  Follow,
  Notification
};
