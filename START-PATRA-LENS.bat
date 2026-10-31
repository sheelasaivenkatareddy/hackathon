@echo off
title Patra Lens
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo First run: installing. This can take a few minutes.
  call npm install
)
if not exist public\opencv\opencv.js call npm install
echo.
echo Patra Lens is starting at http://localhost:5173
echo Keep this window open while you use it. Close it to stop.
echo.
start "" http://localhost:5173
call npm run dev
pause
