@echo off
title AutoAds Platform Runner
echo ==========================================
echo    AutoAds Platform - Development Starter
echo ==========================================
echo.

cd /d "C:\Users\wangw\Projects\autoads-platform"

echo [1/3] Cleaning up old processes...
powershell -Command "Stop-Process -Name node -Force -ErrorAction SilentlyContinue"

echo [2/3] Checking dependencies...
if not exist "node_modules" (
    echo node_modules not found, installing...
    call pnpm install
)

echo [3/3] Starting Frontend (3000) and Backend (3001)...
echo.
echo Please wait for "Ready" or "Local: http://localhost:3000" message.
echo.

pnpm start

pause
