# Handover Guide - Testing the Gym Admin Dashboard

This guide will help you hand over the application to your partner for testing on Windows, connected to the same WiFi network as the biometric device.

## Table of Contents
1. [Building the Application](#building-the-application)
2. [Distribution Package](#distribution-package)
3. [Installation Instructions for Partner](#installation-instructions-for-partner)
4. [Network Configuration](#network-configuration)
5. [Initial Setup Steps](#initial-setup-steps)
6. [Testing Checklist](#testing-checklist)

---

## Building the Application

### Step 1: Build the Desktop Application

Run this command in the project root directory:

```bash
npm run desktop:build
```

This will:
- Build the client (Vite)
- Bundle the server (esbuild)
- Package everything into an Electron app
- Create an installer in the `dist` folder

**Expected output:**
- Installer file: `dist/GymAdminDesktop-1.0.0-Setup.exe` (or similar)
- This is a Windows installer that your partner can run

### Step 2: Verify Build Files

After building, check that these files exist:
- `dist/GymAdminDesktop-*.exe` - The installer
- `dist/win-unpacked/` - Unpacked application (for testing without installer)

---

## Distribution Package

### What to Send to Your Partner

Create a folder with the following:

```
GymAdminDashboard_Package/
├── GymAdminDesktop-1.0.0-Setup.exe    (The installer)
├── README_INSTALLATION.txt             (Installation instructions)
├── BIOMETRIC_SETUP_GUIDE.md            (Biometric setup guide)
└── ENV_TEMPLATE.txt                    (Environment variables template - if needed)
```

### Optional: Create a ZIP File

1. Create a folder named `GymAdminDashboard_Package`
2. Copy the installer EXE file
3. Copy the setup guides
4. Create a ZIP file: `GymAdminDashboard_Package.zip`
5. Send this ZIP to your partner

---

## Installation Instructions for Partner

### Prerequisites

Your partner's Windows PC must have:
- ✅ **Windows 10 or later** (64-bit)
- ✅ **Administrator access** (for installation)
- ✅ **Internet connection** (for initial setup and WhatsApp)
- ✅ **Same WiFi network** as the biometric device

### Installation Steps

1. **Download the Package**
   - Extract the ZIP file if received as ZIP
   - Locate `GymAdminDesktop-1.0.0-Setup.exe`

2. **Run the Installer**
   - Right-click the EXE file
   - Select **"Run as administrator"** (if prompted)
   - Follow the installation wizard
   - Accept default installation location (recommended)
   - Click **Install**

3. **Launch the Application**
   - After installation, find **"Gym Admin Desktop"** in Start Menu
   - Or locate it in: `C:\Users\[Username]\AppData\Local\Programs\gym-admin-desktop\`
   - Double-click to launch

4. **First Launch**
   - The app will start automatically
   - Wait for the server to initialize (10-30 seconds)
   - The application window will open automatically

---

## Network Configuration

### WiFi Setup

**CRITICAL:** Both the PC and biometric device must be on the **same WiFi network**.

1. **Verify PC WiFi Connection**
   - On the partner's PC, check WiFi settings
   - Note the WiFi network name (SSID)
   - Ensure it's connected to the same network as the biometric device

2. **Find Biometric Device IP**
   - The biometric device should have a static IP or DHCP IP
   - Example: `192.168.1.100` (this is what you'll configure in Settings)

3. **Test Network Connectivity**
   - On the partner's PC, open Command Prompt
   - Run: `ping [DEVICE_IP]`
   - Example: `ping 192.168.1.100`
   - Should see replies if connected

### Firewall Configuration

**If ping fails**, check Windows Firewall:

1. Open **Windows Defender Firewall**
2. Click **"Allow an app or feature through Windows Firewall"**
3. Find **"Gym Admin Desktop"** in the list
4. Check both **Private** and **Public** boxes
5. If not listed, click **"Allow another app"** and browse to the installed app

**Alternative:** Temporarily disable firewall for testing (not recommended for production)

---

## Initial Setup Steps

### Step 1: Configure Biometric Device Settings

1. Open the **Gym Admin Dashboard** application
2. Navigate to **Settings** (sidebar)
3. Scroll to **"Biometric Device Settings"** section
4. Enter the following (get these from you/the device):
   - **Device IP Address**: `[Device IP, e.g., 192.168.1.100]`
   - **Port**: `4370` (default)
   - **Comm Key**: `[Device password, usually 0]`
   - **Door Unlock Duration**: `3` seconds (or as preferred)
   - **Relay Type**: `NO` or `NC` (check device wiring)

5. Click **"Test Connection"** button
   - ✅ Should show "Connection successful"
   - ❌ If failed, check IP address and network

6. Click **"Save Biometric Settings"**

### Step 2: Sync Database (If Needed)

If you're using Turso (cloud database):

1. The app will automatically sync on first launch
2. If members don't appear, check:
   - Environment variables are set (if using .env file)
   - Internet connection is working
   - Database credentials are correct

### Step 3: Link Members to Biometric IDs

1. Navigate to **Members** page
2. Click **"View"** on a member card
3. Click **"Link Biometric"** button
4. Enter the **Biometric User ID** from the device
   - Or click **"Fetch from Device"** to load users
5. Click **"Link"** to save
6. Repeat for all members

---

## Testing Checklist

### Basic Functionality

- [ ] **Application launches** without errors
- [ ] **Dashboard loads** and shows statistics
- [ ] **Members page** displays all members
- [ ] **Settings page** allows configuration changes
- [ ] **Biometric settings** can be saved and tested

### Biometric Integration

- [ ] **Test Connection** works in Settings
- [ ] **Device IP** is reachable (ping test)
- [ ] **Members can be linked** to biometric IDs
- [ ] **Fingerprint scan** is recognized by device
- [ ] **Access granted** for active members (door unlocks)
- [ ] **Access denied** for expired/inactive members (door stays locked)
- [ ] **Attendance records** are created automatically

### Network Connectivity

- [ ] **PC and device** on same WiFi network
- [ ] **Ping test** successful to device IP
- [ ] **Test Connection** in Settings works
- [ ] **No firewall blocking** the connection

### Data Sync (If Using Cloud Database)

- [ ] **Members sync** from cloud database
- [ ] **New members** appear after sync
- [ ] **Changes persist** after closing app

---

## Troubleshooting

### Application Won't Start

**Problem**: App doesn't launch or crashes immediately

**Solutions**:
1. ✅ Check Windows Event Viewer for errors
2. ✅ Run installer as Administrator
3. ✅ Ensure Windows 10/11 is up to date
4. ✅ Check if antivirus is blocking the app
5. ✅ Try running from installation directory directly

### Can't Connect to Biometric Device

**Problem**: "Connection failed" in Settings

**Solutions**:
1. ✅ Verify device IP address is correct
2. ✅ Ensure PC and device are on same WiFi
3. ✅ Test ping: `ping [DEVICE_IP]`
4. ✅ Check Windows Firewall settings
5. ✅ Verify device is powered on and connected
6. ✅ Check Comm Key is correct (try 0 if not set)

### Members Not Appearing

**Problem**: Members list is empty

**Solutions**:
1. ✅ Check database connection (if using cloud)
2. ✅ Verify sync completed (check logs)
3. ✅ Check if using local database (desktop mode)
4. ✅ Ensure environment variables are set (if using .env)

### Door Not Unlocking

**Problem**: Access granted but door doesn't unlock

**Solutions**:
1. ✅ Verify relay wiring is correct (NO vs NC)
2. ✅ Check relay type setting matches wiring
3. ✅ Test relay manually using device menu
4. ✅ Verify unlock duration is set (minimum 1 second)
5. ✅ Check if door strike/lock is functioning

---

## What to Share with Your Partner

### Required Information

1. **Biometric Device Details**:
   - Device IP Address (e.g., `192.168.1.100`)
   - Port (usually `4370`)
   - Comm Key/Password (usually `0`)
   - Relay Type (NO or NC)
   - Unlock Duration (recommended: `3` seconds)

2. **Database Details** (if using cloud):
   - Turso Database URL
   - Turso Auth Token
   - (Or create a .env file with these values)

3. **Member-Biometric Mapping** (if available):
   - CSV or list of member names and their biometric User IDs
   - This speeds up the linking process

### Documentation

- **BIOMETRIC_SETUP_GUIDE.md** - Detailed setup instructions
- **This HANDOVER_GUIDE.md** - Installation and testing guide

---

## Quick Start Summary

For your partner, here's the quickest path to get started:

1. **Install** the `GymAdminDesktop-*.exe` file
2. **Launch** the application
3. **Configure** Settings → Biometric Device Settings:
   - Enter device IP, port, comm key
   - Test connection
   - Save settings
4. **Link Members**:
   - Members → View Member → Link Biometric
   - Enter User ID from device
5. **Test**:
   - Scan fingerprint on device
   - Verify door unlocks (if active member)
   - Check attendance is recorded

---

## Support Contacts

If your partner encounters issues:

1. **Check this guide** first
2. **Review BIOMETRIC_SETUP_GUIDE.md** for device-specific issues
3. **Check server logs** (if available in installation directory)
4. **Contact you** with:
   - Error messages (screenshots)
   - Device IP address
   - Network configuration details
   - Steps to reproduce the issue

---

## Version Information

- **Application Version**: 1.0.0
- **Build Date**: [Date when built]
- **Platform**: Windows (64-bit)
- **Minimum Windows Version**: Windows 10

---

**Last Updated**: 2025-01-27

