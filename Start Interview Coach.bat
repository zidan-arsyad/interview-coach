@echo off
title Interview Coach
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed. Install the LTS version from https://nodejs.org
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)

rem Installs the first time, and picks up new dependencies after an update. Quick when up to date.
echo Checking dependencies...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  echo.
  echo   Installing failed. Check your internet connection and try again.
  echo.
  pause
  exit /b 1
)

rem Open the app once the server has had a moment to start: Chrome if installed, else the default browser.
set "URL=http://localhost:5179"
set "BROWSER="
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>nul && set "BROWSER=chrome"
reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>nul && set "BROWSER=chrome"
if defined BROWSER (
  start "" cmd /c "timeout /t 3 /nobreak >nul & start chrome %URL%"
) else (
  start "" cmd /c "timeout /t 3 /nobreak >nul & start %URL%"
)

node server\index.ts
pause
