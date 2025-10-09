# Position Logic Refinement Plan

## Current Analysis

### Database Schema ✅
- Single `positions` table in schema.sql (no duplicates found)
- Proper `trade_history` table for closed positions
- Good normalization with foreign keys to accounts and symbols

### Backend Issues Found 🔧
1. **Position Model**: Good structure but calculation logic needs enhancement
2. **Trading Routes**: Complex but functional position opening/closing
3. **Multiple P&L Calculation Methods**: Inconsistent between services
4. **Real-time Price Updates**: Partially implemented

### Frontend Issues Found 🔧  
1. **Field Mapping Inconsistencies**: Backend uses `lotSize`, frontend expects `volume`
2. **Position Stats**: Multiple calculation methods causing confusion
3. **Real-time Updates**: Missing WebSocket integration for live P&L

## Refinement Strategy

### 1. Backend Enhancements
- Standardize P&L calculation methods
- Enhance Position model with better profit calculations
- Improve real-time position updates
- Streamline trading routes

### 2. Frontend Alignment
- Standardize field mapping between backend/frontend
- Enhance position management UI
- Add real-time P&L updates
- Improve position statistics display

### 3. Database Optimizations
- Add indexes for better performance
- Ensure proper transaction handling
- Add position audit trail

### 4. Logic Flow Improvements
- User opens position (BUY/SELL) → Record everything
- Real-time price updates → Calculate unrealized P&L
- Position closing → Update funds, create trade history
- Enhanced position management in positions tab

## Implementation Plan

### Phase 1: Backend Standardization
1. Enhanced Position model with unified calculations
2. Improved trading service with better P&L logic
3. Enhanced API responses with consistent field names

### Phase 2: Frontend Alignment  
1. Updated type definitions
2. Enhanced position management components
3. Real-time updates integration

### Phase 3: Database & Performance
1. Database optimizations
2. Enhanced audit trail
3. Performance improvements

### Phase 4: Enhanced UI/UX
1. Better position management interface
2. Real-time charts and updates
3. Enhanced statistics dashboard