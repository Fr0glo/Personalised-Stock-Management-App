@echo off
echo ========================================
echo   Stock Management - First Time Setup
echo ========================================
echo.

echo [1/6] Installing backend dependencies...
cd backend
call npm install --production
if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo [2/6] Initializing database...
call npm run init-db

echo.
echo [3/6] Running migrations + creating logs directory...
call node database/migrate.js up
if not exist logs mkdir logs

echo.
echo [4/6] Installing frontend dependencies and building...
cd ..\frontend
call npm install
call npm run build
cd ..

echo.
echo [5/6] Installing PM2 globally...
call npm install -g pm2

echo.
echo [6/6] Starting the server with PM2...
cd backend
call pm2 start ecosystem.config.js
call pm2 save
cd ..

echo.
echo ========================================
echo   Setup complete!
echo.
echo   Your app is now running at:
echo   http://192.168.100.254:4000
echo.
echo   All laptops on the network can
echo   open this URL in their browser.
echo.
echo   To auto-start on reboot, run:
echo   pm2 startup
echo ========================================
pause
