@echo off
REM ABOS - Autonomous Business Operating System
REM Windows Startup Script

echo ========================================
echo   ABOS - Autonomous Business Operating System
echo   Starting all services...
echo ========================================

REM Check if .env exists
if not exist .env (
    echo ERROR: .env file not found!
    echo Please copy .env.example to .env and configure it.
    pause
    exit /b 1
)

REM Load environment variables
for /f "tokens=1,* delims==" %%a in (.env) do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" set %%a=%%b
)

REM Create data directory if not exists
if not exist data mkdir data

REM Check Docker
echo Checking Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker not found! Please install Docker Desktop.
    pause
    exit /b 1
)

REM Check Docker Compose
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker Compose not found!
    pause
    exit /b 1
)

REM Start n8n
echo Starting n8n...
cd /d "%~dp0.."
docker-compose up -d n8n

if %errorlevel% neq 0 (
    echo ERROR: Failed to start n8n!
    pause
    exit /b 1
)

echo n8n started successfully at http://localhost:5678

REM Wait for n8n to be healthy
echo Waiting for n8n to be ready...
:wait_n8n
timeout /t 5 /nobreak >nul
curl -s http://localhost:5678/healthz >nul 2>&1
if %errorlevel% neq 0 (
    goto wait_n8n
)
echo n8n is ready!

REM Initialize database
echo Initializing database...
cd packages\core
npm run db:init
cd ..\..

if %errorlevel% neq 0 (
    echo WARNING: Database initialization had issues
)

REM Start API server
echo Starting API server...
start "ABOS API" cmd /k "cd packages\api && npm run dev"

REM Give API time to start
timeout /t 5 /nobreak >nul

REM Start Dashboard
echo Starting Dashboard...
start "ABOS Dashboard" cmd /k "cd packages\dashboard && npm run dev"

echo.
echo ========================================
echo   ABOS Started Successfully!
echo ========================================
echo.
echo Services:
echo   - n8n:        http://localhost:5678
echo   - API:        http://localhost:3001
echo   - Dashboard:  http://localhost:3000
echo.
echo Press Ctrl+C in each window to stop services.
echo.

pause