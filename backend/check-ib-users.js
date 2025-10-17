const mysql = require('mysql2/promise');

async function checkIBUsers() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'pro2'
    });
    
    console.log('Checking for IB users...\n');
    
    // Check users with IB role
    const [ibUsers] = await connection.execute(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.status,
        r.name as role_name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = 'IB' OR r.name LIKE '%broker%' OR r.name LIKE '%IB%'
    `);
    
    console.log(`Users with IB role: ${ibUsers.length}`);
    ibUsers.forEach(u => {
      console.log(`  - ${u.first_name} ${u.last_name} (${u.email}) - Status: ${u.status} - Role: ${u.role_name}`);
    });
    
    console.log('\n=== ALL ROLES ===');
    const [roles] = await connection.execute('SELECT id, name FROM roles');
    roles.forEach(r => {
      console.log(`  - ${r.name} (ID: ${r.id})`);
    });
    
    console.log('\n=== ALL USERS ===');
    const [users] = await connection.execute(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        GROUP_CONCAT(r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id
    `);
    console.log(`Total users: ${users.length}`);
    users.forEach(u => {
      console.log(`  - ${u.email} - Roles: ${u.roles || 'none'}`);
    });
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

checkIBUsers();
