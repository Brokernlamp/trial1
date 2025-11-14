# eSSL K30 Pro Biometric Integration Setup

This guide shows how to connect your eSSL K30 Pro to the Gym Admin Desktop, map members to the device, test scans, and go live.

## 1) Prerequisites
- eSSL K30 Pro on the same LAN as the PC.
- Device details:
  - IP address and Port (default 4370)
  - Device ID
  - Comm Key / Device Password
  - Time/date/timezone set correctly
- Windows PC running the app (Node 20+, Electron build supported)
- Optional: eSSL utility to export users/logs (for backup/mapping)

## 2) Device Network & Time
On the device:
- Menu → Comm/Network → TCP/IP: note IP, Port (usually 4370)
- Menu → System → Device Info: note Device ID
- Menu → Comm → Comm Key: note (or set) a value
- Menu → System → Date/Time: set correct local time & timezone

On the PC:
- Verify reachability
  - PowerShell: `ping <DEVICE_IP>`
  - Port test: `Test-NetConnection <DEVICE_IP> -Port 4370`

## 3) App Biometric Settings
Store device settings in the app (these are saved in the Settings table).

- GET current settings
```bash
curl -s http://localhost:5000/api/biometric/settings
```

- POST new settings (example: IP 192.168.1.50, port 4370, 3s unlock, NO relay)
```bash
curl -s -X POST http://localhost:5000/api/biometric/settings \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.50",
    "port": "4370",
    "commKey": "0",
    "unlockSeconds": "3",
    "relayType": "NO"
  }'
```

Notes:
- `unlockSeconds`: door open duration
- `relayType`: `NO` or `NC` based on wiring

## 4) Map Members to Device User IDs
Each member must be linked to a device user ID (biometricId). If you exported a CSV of device users, use that UserID.

- Map a member (replace IDs):
```bash
curl -s -X POST http://localhost:5000/api/biometric/map-member \
  -H "Content-Type: application/json" \
  -d '{ "memberId": "member_001", "biometricId": "1001" }'
```

Repeat for each member. The member now stores `biometricId` internally.

## 5) Validate Access Logic (No Device Needed)
Use the built-in simulator to verify allow/deny and attendance logging.

```bash
curl -s -X POST http://localhost:5000/api/biometric/simulate-scan \
  -H "Content-Type: application/json" \
  -d '{ "biometricId": "1001" }'
```
Response includes `{ allowed: true|false, member: { id, name } }`. Each call records attendance with `markedVia = "biometric"`.

Allowed when ALL are true:
- `status === "active"`
- `startDate <= now <= expiryDate` (if dates exist)
- `paymentStatus` is NOT `pending` or `overdue`

## 6) Go-Live: Real Device Events
Two options (choose one):

- A) TCP Poller (4370)
  - The app opens a TCP session to fetch new logs every ~1s and sends a command to trigger the relay if allowed.
  - Provide final IP/port/comm key. If needed, we will enable the poller service.

- B) HTTP Push (preferred when firmware supports Push Service)
  - Device pushes events to the app: set Server URL on device to
    - `http://<PC-IP>:5000/essl/push`
  - We’ll enable the `/essl/push` endpoint and door-control command path. Confirm Push Service page exists on your device.

If you’re unsure, start with TCP poller.

## 7) Door Relay
Ensure the lock is wired to the device’s relay (NO or NC + COM) and power supply matches lock type (fail-safe vs fail-secure). Set desired unlock seconds in app settings.

## 8) Operational Checklist
- On app start, desktop syncs from Turso to local automatically.
- Verify WhatsApp is connected (if you use auto e-bills or reminders).
- Members page → ensure each active user has `biometricId` mapped.
- Test a scan (simulator) → allowed, attendance created.
- Switch to real device, test live scan → door opens for allowed, stays locked for denied.

## 9) Troubleshooting
- Cannot reach device: check IP, port 4370, firewall, LAN.
- Denied unexpectedly:
  - Check member: `status`, `startDate/expiryDate`, `paymentStatus`.
  - Timezone mismatch: verify device and PC time.
- Door doesn’t open: confirm wiring (NO/NC), power to lock, unlockSeconds setting.
- Mapping: if names differ between device and app, map by user ID only.

## 10) Safety & Logging
- Each scan creates an attendance entry.
- You can export members/attendance anytime; DB schema includes `biometric_id` in members.

---
Need help? Share: device IP/port, comm key, a sample biometricId, and the response from `/api/biometric/settings`.


