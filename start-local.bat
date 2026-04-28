@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   TimeClock 365 - LOCAL run (one-click)
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js not found. Install LTS from https://nodejs.org and re-run.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing npm dependencies, this may take a minute...
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] npm install failed.
    pause
    exit /b 1
  )
)

set EMAIL_ENABLED=false
set LINKEDIN_PUBLISH_ENABLED=false
if "%PORT%"=="" set PORT=3000

echo.
echo Email:    OFF (no Gmail credentials needed)
echo LinkedIn: OFF (no real posts will be made)
echo Port:     %PORT%
echo.
echo Browser will auto-open the approvals page in 3 seconds.
echo Close this window to stop the server.
echo.

start "" /b cmd /c "timeout /t 3 /nobreak >nul && start """" http://localhost:%PORT%/approvals-page"

node server.js
