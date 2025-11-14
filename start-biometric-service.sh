#!/bin/bash
# Linux/Mac script to start biometric service
# Edit the variables below to match your setup

export BIOMETRIC_IP="192.168.1.201"
export BIOMETRIC_PORT="4370"
export BIOMETRIC_COMM_KEY="0"
export BIOMETRIC_UNLOCK_SECS="3"
export API_URL="http://localhost:3000"

echo "Starting Biometric Service..."
echo "Device IP: $BIOMETRIC_IP"
echo "API URL: $API_URL"
echo ""

python3 biometric-service.py

