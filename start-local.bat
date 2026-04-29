@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   TimeClock 365 - LOCAL run (one-click)
echo ============================================
echo.
echo Working directory: %CD%
echo.

REM --- Node.js check ---
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js not found in PATH.
  echo     Install LTS from https://nodejs.org and re-run this file.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODE_V=%%v
for /f "delims=" %%v in ('npm -v') do set NPM_V=%%v
echo Node: %NODE_V%    npm: %NPM_V%
echo.

REM --- Port (default 3000) ---
if "%PORT%"=="" set PORT=3000

REM --- Check port is free ---
set PORT_BUSY=
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do set PORT_BUSY=%%p
if defined PORT_BUSY (
  echo [X] Port %PORT% is already in use by PID %PORT_BUSY%.
  echo.
  echo     Process holding the port:
  for /f "tokens=*" %%a in ('tasklist /FI "PID eq %PORT_BUSY%" /NH 2^>nul') do echo       %%a
  echo.
  echo     Fix options:
  echo       (1) close that program, or
  echo       (2) run with a different port:
  echo             set PORT=3001
  echo             start-local.bat
  echo.
  pause
  exit /b 1
)

REM --- Install deps if missing ---
if not exist node_modules (
  echo Installing npm dependencies, this may take a minute...
  call npm install
  if errorlevel 1 (
    echo.
    echo [X] npm install failed. See messages above.
    pause
    exit /b 1
  )
  echo.
)

REM --- Safe defaults: nothing is sent anywhere ---
set EMAIL_ENABLED=false
set LINKEDIN_PUBLISH_ENABLED=false

echo Email:    OFF (no Gmail credentials needed)
echo LinkedIn: OFF (no real posts will be made)
echo Port:     %PORT%
echo.
echo ====================================================
echo   READY. Open in your browser:
echo     http://localhost:%PORT%/approvals-page
echo     http://localhost:%PORT%/   (CRM dashboard)
echo ====================================================
echo   Close this window to stop the server.
echo ====================================================
echo.

node server.js
set EXIT_CODE=%errorlevel%
echo.
echo === Server stopped (exit code %EXIT_CODE%) ===
pause
