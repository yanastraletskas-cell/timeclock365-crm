@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   TimeClock 365 - LOCAL run
echo ============================================
echo.
echo Working directory: %CD%
echo.

REM --- First-time setup: run setup.bat if no .env file ---
if not exist .env (
  echo No settings file found. Starting first-time setup...
  echo.
  call setup.bat
  if not exist .env (
    echo Setup did not complete. Please run setup.bat again.
    pause
    exit /b 1
  )
  echo.
  echo Continuing to launch the program...
  echo.
)

REM --- Node.js check ---
where node >nul 2>nul
if errorlevel 1 goto :no_node

for /f "delims=" %%v in ('node -v') do set NODE_V=%%v
for /f "delims=" %%v in ('npm -v') do set NPM_V=%%v
echo Node: %NODE_V%    npm: %NPM_V%
echo.

REM --- Find first free port starting from PORT or 3000 ---
if "%PORT%"=="" set PORT=3000
set TRY_PORT=%PORT%
set MAX_PORT=3020

:check_port
set BUSY=
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%TRY_PORT% " ^| findstr "LISTENING"') do set BUSY=%%p
if not defined BUSY goto :port_found
echo Port %TRY_PORT% busy [PID %BUSY%], trying next...
set /a TRY_PORT=%TRY_PORT% + 1
if %TRY_PORT% gtr %MAX_PORT% goto :no_free_port
goto :check_port

:port_found
set PORT=%TRY_PORT%
echo Selected free port: %PORT%
echo.

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
set LINKEDIN_PUBLISH_ENABLED=false

REM --- Load .env file if present (KEY=VALUE lines, no comment support) ---
if exist .env (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" set %%A=%%B
  )
)

if "%ANTHROPIC_API_KEY%"=="" (
  echo [!] ANTHROPIC_API_KEY not set -- post generation disabled.
  echo     Create a .env file next to start-local.bat with:
  echo       ANTHROPIC_API_KEY=sk-ant-...
  echo.
) else (
  echo AI generator: ON  ^(ANTHROPIC_API_KEY set^)
)

echo LinkedIn: OFF
echo Port:     %PORT%
echo.
echo ====================================================
echo   READY. Approvals page:
echo     http://localhost:%PORT%/approvals-page
echo   CRM dashboard:
echo     http://localhost:%PORT%/
echo ====================================================
echo   Browser will open automatically in 3 seconds.
echo   Close this window to stop the server.
echo ====================================================
echo.

REM --- Auto-open browser after a short delay ---
start "" cmd /c "timeout /t 3 /nobreak >nul & start """" http://localhost:%PORT%/approvals-page"

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

:no_free_port
echo [X] No free port between %PORT% and %MAX_PORT%.
echo     Close some programs holding ports in that range and try again.
echo.
pause
exit /b 1

:npm_failed
echo.
echo [X] npm install failed. See messages above.
pause
exit /b 1
