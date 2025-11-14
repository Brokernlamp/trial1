# Automatic Bidirectional Sync Guide

## ✅ What's Implemented

Automatic, real-time bidirectional sync between desktop app and web app is now fully configured!

### Features:

1. **Automatic Desktop → Turso Sync**
   - Every create/update/delete operation in desktop app automatically syncs to Turso
   - Non-blocking - happens in background
   - Works for all tables: members, payments, attendance, equipment, plans

2. **Automatic Turso → Desktop Sync**
   - Background service polls Turso every 5 seconds
   - Detects changes from web app
   - Automatically syncs to local database
   - Desktop app stays in sync with web app

3. **No Manual Sync Needed**
   - Everything happens automatically
   - No buttons to click
   - Both databases stay in sync

## 🔄 How It Works

### Desktop Changes → Turso (Immediate)

When you make changes in desktop app:
1. Data is saved to local SQLite database
2. **Automatically** syncs to Turso in background
3. Web app sees changes within seconds

**Example:**
- Create a new member in desktop app
- Member is saved locally
- Automatically synced to Turso
- Web app shows the new member

### Turso Changes → Desktop (Every 5 seconds)

Background service continuously:
1. Checks Turso for changes (every 5 seconds)
2. Compares with local database
3. Syncs new/updated records to local
4. Desktop app stays up-to-date

**Example:**
- Create a payment in web app
- Background sync detects it (within 5 seconds)
- Payment is synced to desktop app
- Desktop app shows the new payment

### Conflict Resolution

- **Turso wins** on conflicts (web app is source of truth)
- If same record exists in both, Turso version is used
- Local-only records are kept (if not in Turso)

## ⚙️ Configuration

### Requirements

1. **Turso Credentials** (in Settings → Database Sync):
   - Turso Database URL
   - Turso Auth Token

2. **Desktop Mode**:
   - Auto-sync only works in desktop/Electron mode
   - Automatically enabled when running as desktop app

### How to Configure

1. Open desktop app
2. Go to **Settings** → **Database Sync**
3. Enter Turso credentials:
   - **Turso Database URL**: Your database URL
   - **Turso Auth Token**: Your auth token
4. Click **"Save Settings"**
5. **That's it!** Auto-sync starts immediately

## 📊 Sync Details

### Tables Synced

All these tables sync automatically:
- ✅ `members`
- ✅ `payments`
- ✅ `attendance`
- ✅ `plans`
- ✅ `equipment`
- ✅ `trainers`
- ✅ `classes`

### Sync Frequency

- **Desktop → Turso**: Immediate (on every change)
- **Turso → Desktop**: Every 5 seconds (background polling)

### Performance

- Sync is **non-blocking** - doesn't slow down operations
- Background sync runs independently
- Errors are logged but don't break the app

## 🎯 User Experience

### For Desktop Users

1. **Configure credentials** (one-time setup)
2. **Use the app normally** - sync happens automatically
3. **See web app changes** within 5 seconds
4. **Your changes sync to web app** immediately

### For Web App Users

1. **Use the app normally** - no changes needed
2. **Desktop app automatically** gets your changes
3. **No manual sync required**

## 🔍 Monitoring

### Console Logs

Watch the console for sync activity:
- `✅ Auto-synced members:member_001 to Turso` - Desktop change synced
- `✅ Background sync from Turso completed` - Periodic sync success
- `❌ Auto-sync failed...` - Sync error (non-critical)

### Sync Status

- Background sync runs automatically
- No UI indicators (yet) - works silently
- Check console logs for sync activity

## ⚠️ Important Notes

1. **Internet Required**
   - Desktop → Turso sync needs internet
   - Background sync needs internet
   - Works offline (local changes stored, sync when online)

2. **Conflict Resolution**
   - Turso (web app) is source of truth
   - Desktop changes are synced to Turso
   - If conflict, Turso version wins

3. **Performance**
   - Sync is optimized and non-blocking
   - Background sync every 5 seconds
   - No impact on app performance

4. **Error Handling**
   - Sync errors don't break the app
   - Errors are logged to console
   - Sync retries automatically

## 🐛 Troubleshooting

### Sync Not Working

1. **Check credentials**:
   - Settings → Database Sync
   - Verify URL and token are correct

2. **Check internet**:
   - Desktop → Turso needs internet
   - Background sync needs internet

3. **Check console logs**:
   - Look for sync error messages
   - Verify background sync started

### Slow Sync

- Background sync runs every 5 seconds
- This is intentional to avoid overload
- Desktop changes sync immediately

### Data Not Appearing

1. **Check credentials** are correct
2. **Wait 5 seconds** for background sync
3. **Check console** for error messages
4. **Verify** both use same Turso database

## 📝 Summary

**Before:**
- Manual sync required
- Had to click sync buttons
- Risk of data getting out of sync

**After:**
- ✅ Automatic sync
- ✅ No manual intervention
- ✅ Always in sync
- ✅ Works in background
- ✅ Real-time updates

Both desktop and web app now stay automatically synchronized! 🎉

