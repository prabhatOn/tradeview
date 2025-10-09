const mysql = require('mysql2/promise');

const updatePassword = async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'trading_app',
      password: 'secure_password',
      database: 'trading_platform'
    });

    console.log('Connected to database');
    
    // Hash generated from password123
    const hash = '$2a$10$n1qqFJ1QPMYOfnY9dZxr8u2oc5lIi10gQ5OcCca4tc9N9kqeYoLO.';
    
    const [result] = await connection.execute(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hash, 'john.anderson@example.com']
    );
    
    console.log('Password updated for john.anderson@example.com');
    console.log('Affected rows:', result.affectedRows);
    
    await connection.end();
    console.log('Connection closed');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

updatePassword();