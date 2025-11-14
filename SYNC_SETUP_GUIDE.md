# Database Sync Setup Guide

## ✅ What's Been Implemented

Online/Offline bidirectional sync between desktop app and web app is now fully configured!

### Features Added:

1. **Turso Credentials Configuration**
   - Settings page now has "Database Sync" section
   - Users can enter Turso Database URL and Auth Token
   - Credentials are saved securely in settings

2. **Three Sync Endpoints:**
   - **Pull from Online** (`/api/sync/pull`): Downloads data from web app (Turso) to desktop app
   - **Push to Online** (`/api/sync/push`): Uploads data from desktop app to web app (Turso)
   - **Full Sync** (`/api/sync/full`): Merges both databases (Turso takes precedence on conflicts)

3. **Sync UI Controls**
   - Settings page has three buttons for sync operations
   - Real-time feedback with success/error messages
   - Shows number of records synced

## 🚀 How to Use

### Step 1: Configure Credentials

1. Open the desktop app
2. Go to **Settings** page
3. Scroll to **"Database Sync (Online/Offline)"** section
4. Enter your Turso credentials:
   - **Turso Database URL**: `libsql://your-database.aws-ap-south-1.turso.io`
   - **Turso Auth Token**: Your token from Turso dashboard
5. Click **"Save Settings"** (main save button at top)

### Step 2: Sync Data

**Option A: Pull from Web App (Recommended first time)**
- Click **"Pull from Online"** button
- Downloads all data from web app to desktop app
- Use this when you want to get data created on web app

**Option B: Push to Web App**
- Click **"Push to Online"** button
- Uploads all desktop data to web app
- Use this when you want to share desktop changes with web app

**Option C: Full Bidirectional Sync (Recommended)**
- Click **"Full Sync"** button
- Merges both databases
- Turso (web app) data takes precedence on conflicts
- Best for keeping both in sync

## 📊 How It Works

### Sync Strategy

1. **Pull**: Replaces local database with Turso database
2. **Push**: Replaces Turso database with local database
3. **Full Sync**: Merges both (Turso wins on conflicts)

### Tables Synced

All these tables are included in sync:
- `members`
- `payments`
- `attendance`
- `plans`
- `trainers`
- `equipment`
- `classes`

### Conflict Resolution

When using **Full Sync**:
- If same record exists in both databases, Turso version wins
- New records from both databases are merged
- All records end up in both databases after sync

## 🔄 Typical Workflow

### Scenario 1: Desktop-first workflow
1. Work on desktop app (offline)
2. Make changes, add members, record payments
3. When ready, click **"Push to Online"**
4. Web app now has all desktop changes

### Scenario 2: Web-first workflow
1. Work on web app
2. Make changes online
3. On desktop, click **"Pull from Online"**
4. Desktop now has all web changes

### Scenario 3: Both working (Recommended)
1. Desktop and web app both have changes
2. Click **"Full Sync"** on desktop
3. Both databases merge (Turso wins on conflicts)
4. Both now have same data

## ⚠️ Important Notes

1. **Credentials Security**
   - Turso Auth Token is stored in settings (local database)
   - Keep your desktop app secure
   - Don't share credentials

2. **Sync Frequency**
   - Sync manually when needed
   - Don't sync too frequently (once per day/hour is usually enough)
   - Full sync is best for regular syncs

3. **Data Loss Warning**
   - Pull/Push replace entire tables
   - Full sync merges safely
   - **Always use Full Sync** if unsure

4. **Offline Mode**
   - Desktop app works completely offline
   - Sync only when you need to share data
   - No internet required for normal operations

## 🐛 Troubleshooting

### "Missing Turso credentials" error
- Go to Settings → Database Sync
- Enter both URL and Token
- Click Save Settings
- Try sync again

### "Sync failed" error
- Check your internet connection
- Verify credentials are correct (from Turso dashboard)
- Check if Turso database is accessible
- Try again after a moment

### Data not syncing
- Make sure you're using the correct Turso database
- Verify both desktop and web app use same database URL
- Try Full Sync instead of Pull/Push

## 📝 Next Steps

1. **Test the sync:**
   - Configure credentials in Settings
   - Try Full Sync
   - Verify data appears in both desktop and web app

2. **Regular sync:**
   - Set a schedule (e.g., daily sync)
   - Or sync manually when needed
   - Use Full Sync for best results

3. **Share with users:**
   - Users can configure their own credentials
   - Or share same database for team collaboration
   - Each installation can sync independently

