@echo off
setlocal
title Knightfall Chess Launcher

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is needed once before Knightfall can run.
  echo Your browser will open the official download page now.
  echo Install the LTS version, then double-click this file again.
  start "" "https://nodejs.org/en/download"
  echo.
  pause
  exit /b 1
)

cd /d "%~dp0"
echo Starting Knightfall Chess...
start "Knightfall server - keep this window open while playing" /min cmd /k node server.js
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo Knightfall is open in your browser.
echo Keep the small Knightfall server window open while you play.
echo.
pause
