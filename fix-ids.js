const { pool } = require('./database');

async function fixUserIds() {
  try {
    console.log('Восстанавливаем старые user_id...');
    
    // Ищем старые ID в постах
    const postsResult = await pool.query('SELECT DISTINCT author_id FROM posts');
    const oldIds = postsResult.rows.map(row => row.author_id);
    
    console.log(`Найдено старых ID в постах: ${oldIds.length}`);
    
    for (const oldId of oldIds) {
      // Ищем пользователя с таким ID в таблице users
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [oldId]);
      
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        
        // Если у пользователя нет user_id, устанавливаем старый ID
        if (!user.user_id) {
          await pool.query('UPDATE users SET user_id = $1 WHERE id = $2', [oldId, oldId]);
          console.log(`Восстановлен user_id ${oldId} для пользователя ${user.name}`);
        }
      }
    }
    
    // Устанавливаем верификацию для создателя
    const creatorId = process.env.CREATOR_ID || '1761560316';
    await pool.query('UPDATE users SET is_verified = TRUE WHERE user_id = $1', [creatorId]);
    
    console.log('Восстановление завершено!');
    process.exit(0);
    
  } catch (error) {
    console.error('Ошибка:', error);
    process.exit(1);
  }
}

fixUserIds();
