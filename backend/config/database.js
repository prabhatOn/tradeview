/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const mysql = require('mysql2/promise');

// Database configuration - read ONLY from environment variables.
// This file intentionally does not provide fallback defaults. All required
// values must be supplied via environment variables (or a .env file).
// DB_PASSWORD may be an empty string in dev, but the variable must be defined.
const requiredEnv = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = requiredEnv.filter((k) => typeof process.env[k] === 'undefined');
if (missing.length) {
  throw new Error(
    `Missing required database environment variables: ${missing.join(', ')}.\n` +
      'Please set these in your environment or copy .env.example to .env and edit values.'
  );
}

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  idleTimeout: 300000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: process.env.DB_TIMEZONE || '+00:00',
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: false
};

// Minimal, non-sensitive startup logging
console.log(`Database host: ${dbConfig.host}`);
console.log(`Database name: ${dbConfig.database}`);

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
    
    // Replace undefined with null to avoid driver errors
    if (Array.isArray(params) && params.length > 0) {
      params = params.map((p) => (p === undefined ? null : p));
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
          const safeParams = Array.isArray(query.params) ? query.params.map(p => p === undefined ? null : p) : query.params
          const [queryResult] = await connection.execute(query.sql, safeParams);
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
      const safeParams = Array.isArray(query.params) ? query.params.map(p => p === undefined ? null : p) : query.params
      const [result] = await connection.execute(query.sql, safeParams);
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