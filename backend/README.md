# Trading Platform Backend

A comprehensive Node.js/Express.js backend API for a trading platform with real-time market data, user management, trading operations, and administrative features.

## Features

### Core Functionality
- **User Authentication & Authorization** - JWT-based auth with role-based access control
- **Trading Operations** - Position management, P&L calculations, margin management
- **Market Data** - Real-time price feeds, historical data, market statistics
- **Transaction Management** - Deposits, withdrawals, transaction history
- **Notification System** - Real-time notifications for trading events
- **Admin Panel** - User management, transaction processing, system monitoring

### Real-time Features
- **WebSocket Server** - Live market data and position updates
- **Price Alerts** - Customizable price alert notifications
- **Position Monitoring** - Real-time P&L calculations and margin calls

### Security Features
- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcryptjs for secure password storage
- **Rate Limiting** - Protection against API abuse
- **Input Validation** - Joi schema validation for all inputs
- **Security Headers** - Helmet.js for security headers

## Technology Stack

- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Database**: MySQL 8.0+
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Joi
- **Real-time**: WebSocket (ws)
- **Scheduling**: node-cron
- **Security**: Helmet, bcryptjs, CORS

## Project Structure

```
backend/
├── config/
│   └── database.js          # Database connection and utilities
├── middleware/
│   ├── auth.js              # Authentication middleware
│   └── errorHandler.js      # Error handling middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management routes
│   ├── trading.js           # Trading operations routes
│   ├── market.js            # Market data routes
│   ├── transactions.js      # Transaction management routes
│   └── admin.js             # Admin panel routes
├── services/
│   ├── MarketService.js     # Market data utilities
│   ├── TradingService.js    # Trading calculations and logic
│   └── NotificationService.js # Notification management
├── database/
│   ├── schema.sql           # Database schema
│   └── sample_data.sql      # Sample data for development
├── server.js                # Main server file
├── package.json             # Dependencies and scripts
└── .env.example             # Environment variables template
```

## Installation

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up MySQL database**
   ```bash
   # Create database
   mysql -u root -p -e "CREATE DATABASE trading_platform;"
   
   # Import schema
   mysql -u root -p trading_platform < database/schema.sql
   
   # Import sample data (optional)
   mysql -u root -p trading_platform < database/sample_data.sql
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## Environment Configuration

Copy `.env.example` to `.env` and configure the following variables:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=trading_platform

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

## API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

#### POST /api/auth/login
Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Trading Endpoints

#### GET /api/trading/positions
Get user's trading positions.

**Query Parameters:**
- `status`: 'open' | 'closed' | 'all'
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

#### POST /api/trading/positions
Open a new trading position.

**Request Body:**
```json
{
  "accountId": 1,
  "symbolId": 1,
  "positionType": "buy",
  "volume": 1.0,
  "leverage": 100,
  "stopLoss": 1.2500,
  "takeProfit": 1.3000
}
```

### Market Data Endpoints

#### GET /api/market/overview
Get market overview with top symbols.

#### GET /api/market/symbols/:id/history
Get price history for a symbol.

**Query Parameters:**
- `timeframe`: '1M' | '5M' | '15M' | '1H' | '4H' | '1D'
- `limit`: Number of records (default: 100)

### Transaction Endpoints

#### GET /api/transactions/history
Get transaction history.

#### POST /api/transactions/deposits
Create a deposit request.

#### POST /api/transactions/withdrawals
Create a withdrawal request.

### Admin Endpoints (Admin Role Required)

#### GET /api/admin/dashboard
Get admin dashboard statistics.

#### GET /api/admin/users
Get all users with filtering options.

#### PATCH /api/admin/deposits/:id/process
Process a pending deposit.

## WebSocket Events

The server provides real-time updates via WebSocket on port 3002.

### Client Events
- `subscribe`: Subscribe to specific data feeds
- `unsubscribe`: Unsubscribe from data feeds

### Server Events
- `market_update`: Real-time market data updates
- `positions_update`: Position P&L updates
- `notification`: User notifications
- `price_alert`: Triggered price alerts

## Database Schema

The database follows a normalized design with the following key entities:

- **users**: User accounts and profiles
- **trading_accounts**: Trading account details
- **symbols**: Trading instruments
- **positions**: Trading positions
- **market_data**: Price and volume data
- **deposits/withdrawals**: Financial transactions
- **notifications**: User notifications
- **support_tickets**: Customer support system

## Security Considerations

1. **JWT Tokens**: Use strong secrets and appropriate expiration times
2. **Password Hashing**: All passwords are hashed with bcryptjs
3. **Rate Limiting**: API endpoints are rate-limited to prevent abuse
4. **Input Validation**: All inputs are validated using Joi schemas
5. **CORS**: Configure CORS properly for your frontend domain
6. **Helmet**: Security headers are automatically added

## Development

### Running in Development Mode

```bash
npm run dev
```

This starts the server with nodemon for auto-reloading.

### Testing

```bash
npm test
```

### Code Structure Guidelines

1. **Routes**: Handle HTTP requests and responses
2. **Services**: Business logic and data processing
3. **Middleware**: Authentication, validation, error handling
4. **Config**: Database connections and configuration

## Production Deployment

1. **Environment Variables**: Set all production environment variables
2. **Database**: Use production MySQL database with proper security
3. **SSL/TLS**: Enable HTTPS in production
4. **Process Management**: Use PM2 or similar for process management
5. **Monitoring**: Set up logging and monitoring
6. **Backup**: Implement database backup strategy

### PM2 Deployment Example

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name "trading-backend"

# Save PM2 configuration
pm2 save
pm2 startup
```

## API Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {...}
  }
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Default**: 100 requests per 15 minutes per IP
- **Authentication**: 5 failed attempts per 15 minutes per IP
- **Trading**: 60 requests per minute per user

## Monitoring and Logging

The application includes:
- **Morgan**: HTTP request logging
- **Error Handling**: Centralized error handling with stack traces
- **Health Check**: `/health` endpoint for monitoring
- **Performance Metrics**: Response time tracking

## Contributing

1. Follow the existing code structure and patterns
2. Add appropriate error handling and validation
3. Include tests for new features
4. Update documentation for API changes
5. Follow JavaScript/Node.js best practices

## License

MIT License - see LICENSE file for details.