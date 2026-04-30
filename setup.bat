@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   TimeClock 365 - First-Time Setup
echo ============================================
echo.
echo This will create the .env file the program needs.
echo You only have to do this once.
echo.

REM ===== Anthropic API key =====
echo --------------------------------------------
echo  STEP 1 of 4: Anthropic (Claude) API key
echo --------------------------------------------
echo.
echo This is the key that lets the agent WRITE the 60 LinkedIn posts.
echo.
echo Where to get it:
echo   1. Open https://console.anthropic.com/settings/keys
echo   2. Sign in (or create an account)
echo   3. Click "Create Key"
echo   4. Copy the key (it starts with sk-ant-...)
echo.
set /p ANTHROPIC_KEY="Paste your key here and press Enter (or leave blank to skip): "
echo.

REM ===== LinkedIn token =====
echo --------------------------------------------
echo  STEP 2 of 4: LinkedIn access token
echo --------------------------------------------
echo.
echo This is what lets the agent PUBLISH approved posts to LinkedIn.
echo If you skip this, posts will only print to the screen ("dry-run").
echo.
echo Where to get it:
echo   1. Open https://www.linkedin.com/developers/apps
echo   2. Pick your app (or create one)
echo   3. Go to "Auth" tab and generate a token with "w_member_social"
echo.
set /p LINKEDIN_TOKEN="Paste your LinkedIn access token (or leave blank to skip): "
echo.

set LINKEDIN_URN=
if not "!LINKEDIN_TOKEN!"=="" (
  echo LinkedIn author URN format:
  echo   For a personal profile: urn:li:person:YOUR_ID
  echo   For a company page:     urn:li:organization:YOUR_PAGE_ID
  echo.
  set /p LINKEDIN_URN="Paste your LinkedIn author URN: "
  echo.
)

REM ===== Banners folder =====
echo --------------------------------------------
echo  STEP 3 of 4: Banner images folder
echo --------------------------------------------
echo.
echo Each LinkedIn post gets a banner image attached.
echo Tell us the FULL path to a folder that contains .png or .jpg files.
echo.
echo Example: C:\Users\Marinko\Desktop\banners
echo.
set /p BANNERS_PATH="Folder path (or leave blank to use default): "
echo.

REM ===== Publish times =====
echo --------------------------------------------
echo  STEP 4 of 4: Publish times
echo --------------------------------------------
echo.
echo The agent publishes 2 posts per day at fixed times.
echo Default: 11:25 and 18:36 (24-hour format, server local time)
echo.
set /p PUBLISH_TIMES="Times to publish, comma-separated (or press Enter for default): "
echo.

REM ===== Write .env file =====
echo --------------------------------------------
echo  Writing .env file...
echo --------------------------------------------

> .env (
  echo # TimeClock 365 - configuration ^(do not share this file^)
  echo ANTHROPIC_API_KEY=!ANTHROPIC_KEY!
  echo LINKEDIN_ACCESS_TOKEN=!LINKEDIN_TOKEN!
  echo LINKEDIN_AUTHOR_URN=!LINKEDIN_URN!
  if not "!LINKEDIN_TOKEN!"=="" (
    echo LINKEDIN_PUBLISH_ENABLED=true
    echo LINKEDIN_DRY_RUN=false
  ) else (
    echo LINKEDIN_PUBLISH_ENABLED=false
    echo LINKEDIN_DRY_RUN=true
  )
  if not "!BANNERS_PATH!"=="" (
    echo BANNERS_DIR=!BANNERS_PATH!
  )
  if not "!PUBLISH_TIMES!"=="" (
    echo PUBLISH_SLOTS=!PUBLISH_TIMES!
  )
)

echo.
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo Your settings are saved in: .env
echo.
echo Now double-click start-local.bat to run the program.
echo.
pause
