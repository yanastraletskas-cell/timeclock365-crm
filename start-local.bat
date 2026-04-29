@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   TimeClock 365 - LOCAL run [one-click]
echo ============================================
echo.
echo Working directory: %CD%
echo.

REM --- Node.js check ---
where node >nul 2>nul
if errorlevel 1 goto :no_node

for /f "delims=" %%v in ('node -v') do set NODE_V=%%v
for /f "delims=" %%v in ('npm -v') do set NPM_V=%%v
echo Node: %NODE_V%    npm: %NPM_V%
echo.

REM --- Port (default 3000) ---
if "%PORT%"=="" set PORT=3000

REM --- Check port is free ---
set PORT_BUSY=
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do set PORT_BUSY=%%p
if defined PORT_BUSY goto :port_busy

REM --- Install deps if missing ---
if not exist node_modules goto :install_deps
goto :run

:install_deps
echo Installing npm dependencies, this may take a minute...
call npm install
if errorlevel 1 goto :npm_failed
echo.
goto :run

:run
set EMAIL_ENABLED=false
set LINKEDIN_PUBLISH_ENABLED=false

echo Email:    OFF
echo LinkedIn: OFF
echo Port:     %PORT%
echo.
echo ====================================================
echo   READY. Open in your browser:
echo     http://localhost:%PORT%/approvals-page
echo     http://localhost:%PORT%/   - CRM dashboard
echo ====================================================
echo   Close this window to stop the server.
echo ====================================================
echo.

node server.js
set EXIT_CODE=%errorlevel%
echo.
echo === Server stopped, exit code %EXIT_CODE% ===
pause
exit /b %EXIT_CODE%

:no_node
echo [X] Node.js not found in PATH.
echo     Install LTS from https://nodejs.org and re-run this file.
echo.
pause
exit /b 1

:port_busy
echo [X] Port %PORT% is already in use by PID %PORT_BUSY%.
echo.
echo     Process holding the port:
for /f "tokens=*" %%a in ('tasklist /FI "PID eq %PORT_BUSY%" /NH 2^>nul') do echo       %%a
echo.
echo     Fix options:
echo       1. Close that program, or
echo       2. Run with a different port:
echo             set PORT=3001
echo             start-local.bat
echo.
pause
exit /b 1

:npm_failed
echo.
echo [X] npm install failed. See messages above.
pause
exit /b 1
