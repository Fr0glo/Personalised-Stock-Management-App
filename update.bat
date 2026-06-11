@echo off
echo ========================================
echo   Stock Management - Update Script
echo ========================================
echo.

echo [1/7] Creating backup before update...
cd backend
call node database/backup.js daily
cd ..

echo.
echo [2/7] Pulling latest code from GitHub...
git pull origin main
if errorlevel 1 (
    echo ERROR: Git pull failed. Check your connection.
    pause
    exit /b 1
)

echo.
echo [3/7] Installing backend dependencies...
cd backend
call npm install --production
cd ..

echo.
echo [4/7] Running database migrations...
cd backend
call node database/migrate.js up
cd ..

echo.
echo [5/7] Installing frontend dependencies and building...
cd frontend
call npm install
call npm run build
cd ..

echo.
echo [6/7] Restarting the server...
cd backend
call pm2 restart stock-management-api
cd ..

echo.
echo [7/7] Checking server status...
cd backend
call pm2 status
cd ..

echo.
echo ========================================
echo   Update complete!
echo   App: http://192.168.100.254:4000
echo   Database was NOT touched (safe).
echo   A backup was created before updating.
echo ========================================
pause
