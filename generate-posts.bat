@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   TimeClock 365 - Generate LinkedIn posts
echo ============================================
echo.

if "%ANTHROPIC_API_KEY%"=="" (
  echo [X] ANTHROPIC_API_KEY is not set.
  echo     Set it first, e.g.:
  echo       set ANTHROPIC_API_KEY=sk-ant-...
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  echo.
)

if "%POST_COUNT%"=="" set POST_COUNT=3

echo Generating %POST_COUNT% post(s)...
echo Make sure the CRM server is running (start-local.bat) before this.
echo.

node generate-posts.js

echo.
pause
