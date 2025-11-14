# Database Persistence Guarantee

## ✅ Your Database Never Expires

Your gym management system uses **persistent databases** that **never automatically delete data**. Your data will remain intact for centuries until you manually delete it.

### Database Types Used

1. **Local SQLite Database** (Desktop/Offline Mode)
   - Location: `~/.gymadmindashboard/data.db` (or custom path via `GYM_APPDATA_DIR`)
   - **Persistence**: File-based storage on your local filesystem
   - **Retention**: Data persists indefinitely until:
     - You manually delete the database file
     - You manually delete records through the application
     - File system corruption (rare, with automatic backup/recovery)
   - **No Auto-Expiration**: SQLite has no TTL (Time To Live) or auto-delete features
   - **Backup**: Corrupted databases are automatically backed up before recreation

2. **Turso Database** (Cloud/Online Mode)
   - **Persistence**: Cloud-hosted SQLite database
   - **Retention**: Data persists indefinitely in Turso's cloud storage
   - **No Auto-Expiration**: Turso does not automatically delete data
   - **Manual Deletion Only**: Data is only removed when:
     - You explicitly delete records through the application
     - You manually delete the database in Turso console
     - Your Turso account is closed (account-level action, not automatic)

### Data Retention Policy

✅ **Data is NEVER automatically deleted**
✅ **No expiration dates or TTL on records**
✅ **No cleanup jobs or scheduled deletions**
✅ **Data persists across application restarts**
✅ **Data persists across system reboots**
✅ **Data persists across application updates**

### Soft Deletes

The system uses "soft deletes" (deleted_at column) instead of hard deletes:
- Records are marked as deleted but remain in the database
- This allows for data recovery if needed
- Only explicit "Delete" actions remove data
- Even "deleted" records can be recovered from the database file

### Backup Recommendations

While the database never expires, we recommend:
1. **Regular Backups**: Copy the `data.db` file periodically
2. **Turso Backups**: Use Turso's built-in backup features for cloud data
3. **Export Data**: Use the export features in the application to create backups

### Conclusion

**Your data is safe and will persist indefinitely.** The database architecture ensures that all member records, payments, attendance, and other data remain accessible for as long as you need them, with no automatic expiration or deletion mechanisms.

