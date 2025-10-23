/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config({ path: './.env' });

// Debug environment variables
console.log('Environment variables loaded:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', '***' + (process.env.DB_PASSWORD ? process.env.DB_PASSWORD.slice(-2) : 'undefined'));
console.log('DB_NAME:', process.env.DB_NAME);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const WebSocket = require('ws');
const cron = require('node-cron');
const path = require('path');

// Import configurations and middleware
const database = require('./config/database');
const { initializeDatabase } = database;
const { ensurePositionsCloseColumns } = require('./utils/schemaMaintenance');
const { authMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const NotificationService = require('./services/NotificationService');
const PositionUpdateService = require('./services/PositionUpdateService');
const PendingOrderService = require('./services/PendingOrderService');
const MarketDataService = require('./services/MarketDataService');
const { initializeMarketData } = require('./initialize_market_data');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tradingRoutes = require('./routes/trading');
const transactionRoutes = require('./routes/transactions');
const adminRoutes = require('./routes/admin');
const adminFundsRoutes = require('./routes/admin-funds');
const marketRoutes = require('./routes/market');
const debugRoutes = require('./routes/debug');
const statusRoutes = require('./routes/status');
const apiKeysRoutes = require('./routes/api-keys');
const fundsRoutes = require('./routes/funds');
const introducingBrokerRoutes = require('./routes/introducing-broker');
const paymentGatewayRoutes = require('./routes/payment-gateways');
const tradingApiRoutes = require('./routes/trading-api');
const kycRoutes = require('./routes/kyc');
const bankDetailsRoutes = require('./routes/bank-details');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';
const DEV_HOST = process.env.DEV_HOST || 'localhost';

// Initialize database and ensure schema patches are applied
initializeDatabase()
  .then(() => ensurePositionsCloseColumns())
  .catch((error) => {
    console.error('Failed to initialize database or ensure schema:', error);
  });

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const devOrigins = Array.from(
  new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    `http://${DEV_HOST}:3000`,
  ]),
);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : devOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - Increased for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/trading', authMiddleware, tradingRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/transactions', authMiddleware, transactionRoutes);
app.use('/api/admin/funds', authMiddleware, adminFundsRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/api-keys', authMiddleware, apiKeysRoutes);
app.use('/api/funds', authMiddleware, fundsRoutes);
app.use('/api/introducing-broker', authMiddleware, introducingBrokerRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/bank-details', bankDetailsRoutes);
app.use('/api/payment-gateways', paymentGatewayRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/status', statusRoutes);

// Public Trading API - no JWT auth, uses API key auth instead
app.use('/api/v1', tradingApiRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handling middleware
app.use(errorHandler);

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ server });

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  // Send initial market data
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to trading platform'
  }));

  // Handle WebSocket messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Validate message structure
      if (!data || typeof data !== 'object' || !data.type) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format. Message must be a JSON object with a "type" field.' 
        }));
        return;
      }

      switch (data.type) {
        case 'subscribe_market':
          // Validate symbols array
          if (!Array.isArray(data.symbols)) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Invalid subscribe_market message. "symbols" must be an array.' 
            }));
            return;
          }
          // Validate each symbol is a string
          if (!data.symbols.every(symbol => typeof symbol === 'string' && symbol.length > 0)) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Invalid subscribe_market message. All symbols must be non-empty strings.' 
            }));
            return;
          }
          // Subscribe to market data updates
          ws.subscribedSymbols = data.symbols;
          ws.send(JSON.stringify({ 
            type: 'subscribed_market', 
            message: `Subscribed to ${data.symbols.length} symbols` 
          }));
          break;
          
        case 'subscribe_account':
          // Validate userId
          if (!data.userId || typeof data.userId !== 'number' || data.userId <= 0) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Invalid subscribe_account message. "userId" must be a positive number.' 
            }));
            return;
          }
          // Subscribe to account updates
          ws.userId = data.userId;
          ws.send(JSON.stringify({ 
            type: 'subscribed_account', 
            message: `Subscribed to account updates for user ${data.userId}` 
          }));
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Unknown message type: ${data.type}` 
          }));
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid JSON format' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast function for WebSocket
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Make broadcast function available globally
global.broadcast = broadcast;

// Scheduled tasks
// Market price updates every 5 seconds (simulating real-time data)
cron.schedule('*/5 * * * * *', async () => {
  try {
    const results = await MarketDataService.updateMarketPrices();
    
    // Broadcast market price updates to connected clients
    if (results.updated > 0) {
      broadcast({
        type: 'market_prices_update',
        timestamp: new Date().toISOString(),
        data: results,
        message: results.message
      });
    }
  } catch (error) {
    console.error('Error updating market prices:', error);
  }
});

// Enhanced position P&L updates every 10 seconds (after market prices update)
cron.schedule('*/10 * * * * *', async () => {
  try {
    const results = await PositionUpdateService.updateAllOpenPositions();
    
    // Broadcast position updates to connected clients
    if (results.updatedPositions > 0) {
      broadcast({
        type: 'positions_update',
        timestamp: new Date().toISOString(),
        data: results,
        message: results.message
      });
    }
  } catch (error) {
    console.error('Error updating position P&L:', error);
  }
});

// High-frequency updates during market hours (every 10 seconds)
cron.schedule('*/10 * * * * *', async () => {
  try {
    const now = new Date();
    const hour = now.getHours();
    
    // Market hours: 9 AM to 5 PM (adjust for your timezone)
    if (hour >= 9 && hour < 17) {
      const results = await PositionUpdateService.updateAllOpenPositions();
      
      // Broadcast to connected clients during market hours
      if (results.updatedPositions > 0) {
        broadcast({
          type: 'realtime_positions_update',
          timestamp: new Date().toISOString(),
          data: results,
          marketHours: true
        });
      }
    }
  } catch (error) {
    console.error('High-frequency position update failed:', error);
  }
});

// Process pending limit orders every 5 seconds
cron.schedule('*/5 * * * * *', async () => {
  try {
    const results = await PendingOrderService.processPendingOrders();
    if (results.filled > 0) {
      broadcast({ type: 'pending_orders_processed', data: results });
    }
  } catch (error) {
    console.error('Error processing pending orders:', error);
  }
});

// Daily cleanup: remove old pending and closed positions at 02:00 server time
cron.schedule('0 2 * * *', async () => {
  try {
    const results = await PendingOrderService.dailyCleanup({ pendingDays: 7, closedDays: 30 });
    console.log(`Daily cleanup removed pending: ${results.pendingDeleted}, closed: ${results.closedDeleted}`);
  } catch (error) {
    console.error('Daily cleanup failed:', error);
  }
});

// Check price alerts every minute
cron.schedule('* * * * *', async () => {
  try {
    const triggeredAlerts = await NotificationService.checkPriceAlerts();
    
    if (triggeredAlerts.length > 0) {
      console.log(`Triggered ${triggeredAlerts.length} price alerts`);
    }
  } catch (error) {
    console.error('Error checking price alerts:', error);
  }
});

// Cleanup old notifications and market prices every hour
cron.schedule('0 * * * *', async () => {
  try {
    const cleaned = await NotificationService.cleanOldNotifications(30);
    console.log(`Cleaned ${cleaned} old notifications`);
    
    // Also clean old market prices
    await MarketDataService.cleanOldPrices();
  } catch (error) {
    console.error('Error in hourly maintenance:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, HOST, async () => {
  const resolvedHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`
🚀 Trading Platform API Server started!
📡 Server running on port ${PORT}
🌐 Environment: ${process.env.NODE_ENV || 'development'}
🔗 API Base URL: http://${resolvedHost}:${PORT}/api
💾 Database: MySQL
🔄 WebSocket: Enabled
⏰ Scheduled Tasks: Running
  `);
  
  // Initialize market data on startup
  try {
    console.log('🔄 Initializing market data...');
    await initializeMarketData();
    console.log('✅ Market data initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize market data:', error);
  }
});

module.exports = app;