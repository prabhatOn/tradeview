/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  // Active defaults: XAMPP MySQL (root / no password)
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pro2',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Remove deprecated options that cause warnings
  // acquireTimeout: 60000,     // ← Removed - not valid for connection pool
  // timeout: 60000,            // ← Removed - not valid for connection pool
  // reconnect: true,           // ← Removed - not valid for connection pool
  idleTimeout: 300000,         // 5 minutes idle timeout
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00',
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: false
};

console.log('Database config loaded:');
console.log('Host:', dbConfig.host);
console.log('User:', dbConfig.user);
console.log('Database:', dbConfig.database);

// Create connection pool
let pool;

function createPool() {
  try {
    pool = mysql.createPool(dbConfig);
    console.log('✅ Database pool created successfully');
    return pool;
  } catch (error) {
    console.error('❌ Error creating database pool:', error);
    throw error;
  }
}

// Initialize database connection
async function initializeDatabase() {
  try {
    if (!pool) {
      createPool();
    }
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Get database pool
function getPool() {
  if (!pool) {
    createPool();
  }
  return pool;
}

// Execute query with error handling
async function executeQuery(sql, params = []) {
  try {
    // Handle LIMIT/OFFSET placeholders which MySQL doesn't support
    if (sql.includes('LIMIT ? OFFSET ?') && params.length >= 2) {
      const limitIndex = sql.lastIndexOf('LIMIT ?');
      const offsetIndex = sql.lastIndexOf('OFFSET ?');
      
      if (limitIndex !== -1 && offsetIndex !== -1 && offsetIndex > limitIndex) {
        const limitValue = parseInt(params[params.length - 2]);
        const offsetValue = parseInt(params[params.length - 1]);
        
        // Validate the values to prevent SQL injection
        if (isNaN(limitValue) || isNaN(offsetValue) || limitValue < 0 || offsetValue < 0 || limitValue > 10000) {
          throw new Error('Invalid LIMIT/OFFSET values');
        }

        const updatedSql = sql.replace(/LIMIT \? OFFSET \?\s*$/, `LIMIT ${limitValue} OFFSET ${offsetValue}`);
        if (updatedSql !== sql) {
          sql = updatedSql;
          params = params.slice(0, -2); // Remove the LIMIT/OFFSET params only if replacement occurred
        }
      }
    }
    
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
}

// Execute transaction with callback or query array
async function executeTransaction(callbackOrQueries) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    let result;
    if (typeof callbackOrQueries === 'function') {
      // Callback style
      result = await callbackOrQueries(connection);
    } else if (Array.isArray(callbackOrQueries)) {
      // Query array style (for legacy support)
      result = [];
      for (const query of callbackOrQueries) {
        if (typeof query === 'object' && query.sql && query.params) {
          const [queryResult] = await connection.execute(query.sql, query.params);
          result.push(queryResult);
        } else {
          throw new Error('Invalid query object in array');
        }
      }
      // Return the first result's insertId for legacy compatibility
      if (result.length > 0 && result[0].insertId) {
        result = { insertId: result[0].insertId };
      }
    } else {
      // Handle the case where it's called incorrectly (for cached code compatibility)
      console.warn('executeTransaction called with invalid argument type:', typeof callbackOrQueries);
      throw new Error('executeTransaction expects a callback function or an array of query objects');
    }
    
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Execute transaction with query array (legacy support)
async function executeTransactionQueries(queries) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const query of queries) {
      const [result] = await connection.execute(query.sql, query.params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Close all connections
async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('Database connections closed');
  }
}

module.exports = {
  dbConfig,
  initializeDatabase,
  getPool,
  executeQuery,
  executeTransaction,
  executeTransactionQueries,
  closeDatabase
};