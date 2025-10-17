@echo off
echo ========================================
echo Starting Trading Platform (Localhost)
echo ========================================
echo.
echo Starting Backend Server on http://localhost:3001
echo.
cd backend
start "Backend Server" cmd /k "node server.js"
cd ..
echo.
echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak >nul
echo.
echo Starting Frontend on http://localhost:3000
echo.
start "Frontend Server" cmd /k "npm run dev"
echo.
echo ========================================
echo Both servers are starting!
echo ========================================
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Press any key to close this window...
pause >nul
