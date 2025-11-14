================================================================================
  GYM ADMIN DASHBOARD - INSTALLATION INSTRUCTIONS
================================================================================

QUICK START:
------------
1. Double-click "GymAdminDesktop-1.0.0-Setup.exe"
2. Follow the installation wizard
3. Launch the app from Start Menu
4. Configure biometric device settings in Settings page
5. Link members to biometric IDs

REQUIREMENTS:
-------------
- Windows 10 or later (64-bit)
- Administrator access (for installation)
- Internet connection
- Same WiFi network as biometric device

INSTALLATION:
-------------
1. Run the installer as Administrator (right-click → Run as administrator)
2. Accept default installation location
3. Click "Install" and wait for completion
4. Launch from Start Menu or desktop shortcut

FIRST TIME SETUP:
-----------------
1. Open Settings → Biometric Device Settings
2. Enter device IP address (e.g., 192.168.1.100)
3. Enter port (default: 4370)
4. Enter Comm Key (default: 0)
5. Click "Test Connection"
6. Click "Save Biometric Settings"

NETWORK REQUIREMENTS:
---------------------
- PC and biometric device MUST be on the same WiFi network
- Test connection: Open Command Prompt and run: ping [DEVICE_IP]
- If ping fails, check Windows Firewall settings

LINKING MEMBERS:
----------------
1. Go to Members page
2. Click "View" on a member card
3. Click "Link Biometric"
4. Enter the biometric User ID from device
5. Click "Link"

TESTING:
--------
1. Scan fingerprint on device
2. Active members: Door should unlock, attendance recorded
3. Expired members: Access denied, door stays locked

TROUBLESHOOTING:
----------------
- App won't start: Run as Administrator, check antivirus
- Can't connect to device: Check IP address, verify same WiFi
- Members not showing: Check database connection, verify sync
- Door not unlocking: Check relay wiring, verify relay type setting

For detailed instructions, see HANDOVER_GUIDE.md

For biometric setup details, see BIOMETRIC_SETUP_GUIDE.md

================================================================================
Support: Contact the development team with error messages and screenshots
================================================================================

