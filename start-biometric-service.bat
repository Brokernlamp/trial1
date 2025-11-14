@echo off
REM Windows batch script to start biometric service
REM Edit the variables below to match your setup

set BIOMETRIC_IP=192.168.1.201
set BIOMETRIC_PORT=4370
set BIOMETRIC_COMM_KEY=0
set BIOMETRIC_UNLOCK_SECS=3
set API_URL=http://localhost:3000

echo Starting Biometric Service...
echo Device IP: %BIOMETRIC_IP%
echo API URL: %API_URL%
echo.

python biometric-service.py

pause

