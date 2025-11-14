# Standalone Biometric Service

This is a **standalone Python service** that runs separately from your Node.js/React app. It handles all biometric device communication, access control, and door unlocking.

## Architecture

```
┌─────────────────────┐
│  Python Service     │ ← Runs independently
│  (biometric-service)│
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼───┐   ┌─────▼─────┐
│ SQLite│   │ eSSL X900 │
│  DB   │   │  Device   │
└───────┘   └───────────┘
    │
    │ HTTP POST
    ▼
┌─────────────────────┐
│  Node.js API        │ ← Your React app
│  (Express Server)   │
└─────────────────────┘
```

## Features

✅ **Device-side feedback**: Configures access groups so device shows GREEN/RED automatically  
✅ **Database integration**: Queries SQLite directly to get member status  
✅ **Auto-unlock**: Unlocks door relay for allowed members  
✅ **Attendance logging**: Sends events to Node.js API to mark attendance  
✅ **Auto-reconnect**: Handles connection failures gracefully  
✅ **Member refresh**: Updates member list every 5 minutes  

## Setup

### 1. Install Python Dependencies

```bash
pip install pyzk requests
```

### 2. Configure Environment Variables (Optional)

You can set these environment variables, or edit the script directly:

```bash
export BIOMETRIC_IP="192.168.1.201"
export BIOMETRIC_PORT="4370"
export BIOMETRIC_COMM_KEY="0"
export BIOMETRIC_UNLOCK_SECS="3"
export API_URL="http://localhost:3000"
export GYM_APPDATA_DIR="C:\Users\YourName\.gymadmindashboard"  # Windows
# or
export GYM_APPDATA_DIR="$HOME/.gymadmindashboard"  # Linux/Mac
```

### 3. Start the Service

**Option A: Run directly**
```bash
python biometric-service.py
```

**Option B: Run as background service (Linux/Mac)**
```bash
nohup python biometric-service.py > biometric.log 2>&1 &
```

**Option C: Run as Windows Service**
Use `nssm` (Non-Sucking Service Manager) or Task Scheduler to run it as a service.

## How It Works

1. **On Startup**:
   - Connects to SQLite database at `~/.gymadmindashboard/data.db`
   - Queries all members with `biometric_id`
   - Determines allowed/denied based on status, dates, payment
   - Connects to biometric device
   - Configures device access groups (group 1 = allowed, group 0 = denied)

2. **During Operation**:
   - Monitors scans via `live_capture()`
   - Device automatically shows GREEN for allowed, RED for denied
   - For allowed users: unlocks door relay
   - Sends HTTP POST to `http://localhost:3000/api/biometric/attendance-event`
   - Node.js API creates attendance record and logs the scan

3. **Every 5 Minutes**:
   - Refreshes member list from database
   - Reconfigures device access groups if list changed

## Testing

1. **Start your Node.js app** (so API is available):
   ```bash
   npm run dev
   ```

2. **Start the Python service**:
   ```bash
   python biometric-service.py
   ```

3. **Scan a fingerprint** on the device

4. **Check console output**:
   ```
   [2024-01-15 10:30:45] ✓ ALLOWED user 68 (John Doe)
            Device showed: GREEN tick + 'Thank You'
            Unlocking relay for 3s...
            ✓ Door unlocked
            ✓ Attendance logged in software
   ```

5. **Check Node.js console**:
   ```
   📥 Attendance event from Python: User 68, Allowed: true, Reason: allowed
   ✅ Attendance recorded for member member_xxx
   ```

## Troubleshooting

### Database not found
- Check the path: `~/.gymadmindashboard/data.db` (or `C:\Users\<YourName>\.gymadmindashboard\data.db` on Windows)
- Make sure you've run the Node.js app at least once to create the database

### Can't connect to device
- Verify IP address and port
- Check network connectivity: `ping 192.168.1.201`
- Verify COMM_KEY matches device settings

### API connection failed
- Make sure Node.js app is running on port 3000
- Check firewall settings
- Verify API_URL environment variable

### No scans detected
- Check if `live_capture()` works with your device model
- Some devices may need different settings
- Check device logs/menu for connection status

## Integration with Your App

The Python service sends events to:
```
POST http://localhost:3000/api/biometric/attendance-event
```

Payload:
```json
{
  "biometricId": "68",
  "memberId": "member_xxx",
  "memberName": "John Doe",
  "allowed": true,
  "reason": "allowed",
  "timestamp": "2024-01-15T10:30:45"
}
```

Your Node.js app will:
- Create attendance record if `allowed: true`
- Log the scan event (visible in Attendance page)
- Update member's last check-in time

## Advantages of This Approach

✅ **Separation of concerns**: Python handles device, Node.js handles UI  
✅ **Reliability**: Python service can run independently  
✅ **Device feedback**: Users see GREEN/RED on device immediately  
✅ **No React integration needed**: Python is completely separate  
✅ **Easy to debug**: Clear console output shows everything  
✅ **Database direct access**: No need for API calls to get member list  

## Next Steps

1. Test the service with your device
2. Set up as a system service (so it starts automatically)
3. Monitor logs for any issues
4. Adjust `UNLOCK_SECS` and other settings as needed

