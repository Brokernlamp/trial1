# Step-by-Step Testing Guide

## ✅ Step 1: Start the Server

```bash
npm run dev
```

**What to look for:**
- ✅ "DB client created successfully" 
- ✅ "WhatsApp initialization complete"
- ✅ "serving on port 5000"

**If you see errors:**
- Port 5000 in use? Change `PORT=3000` in `.env`
- Database errors? Check `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env`

---

## ✅ Step 2: Open the Dashboard

Open browser: **http://localhost:5000**

**You should see:**
- Dashboard with stats
- Sidebar menu on left
- Navigation working

**If page doesn't load:**
- Check terminal for errors
- Make sure server shows "serving on port 5000"

---

## ✅ Step 3: Test Basic Features (No WhatsApp Needed)

### Test 1: View Members
1. Click "Members" in sidebar
2. You should see members list (or empty if no data)

### Test 2: Create a Member
1. Click "Members" → "Add Member" button
2. Fill in:
   - Name: "Test User"
   - Email: "test@example.com"
   - Phone: "+1234567890"
   - Status: Active
   - Payment Status: Paid
3. Click "Save"
4. **Verify**: Member appears in list

### Test 3: View Dashboard
1. Click "Dashboard"
2. **Verify**: Stats update with new member

**✅ If these work, your database and basic features are working!**

---

## ✅ Step 4: Test WhatsApp Connection (Optional)

### Option A: Check Status (No QR Scan Needed)
1. Go to **http://localhost:5000/whatsapp**
2. Check "Connection Status" section
3. **If "Disconnected ❌"**: WhatsApp needs QR code scan
4. **If "Connected ✅"**: Already connected (can skip to Step 5)

### Option B: Connect WhatsApp (If Disconnected)
1. Go to **http://localhost:5000/whatsapp**
2. Look at terminal - you should see a QR code
3. Open WhatsApp on your phone
4. Go to Settings → Linked Devices → Link a Device
5. Scan the QR code from terminal
6. **Verify**: Status changes to "Connected ✅"

**If no QR code appears:**
- Check terminal output
- Try refreshing the WhatsApp page
- API endpoint: `GET http://localhost:5000/api/whatsapp/status` (returns QR in JSON)

---

## ✅ Step 5: Test WhatsApp Messaging (After Connected)

### Test 1: Preview Template
1. Go to **http://localhost:5000/whatsapp**
2. In "Message Template" section, keep default template:
   ```
   Hi {name}, your {plan} expires in {daysLeft} days!
   ```
3. Click "Preview" button
4. **Verify**: You see 3 sample messages with different member names

### Test 2: Send Test Message (Small Test)
1. In "Send Messages" section
2. Select "All Pending Payments" from dropdown
3. Make sure template is filled in
4. Click "Send Messages"
5. **Verify**: 
   - Shows "X sent, Y failed" results
   - Check if messages appear on phone (if members have valid WhatsApp numbers)

**⚠️ Note**: This will only send to members with:
- Payment status = "pending" OR "overdue"
- Valid phone numbers in WhatsApp format

### Test 3: Check Logs (Optional)
1. The system automatically logs to `whatsapp_logs` table in Turso
2. You can verify by checking database or logs in terminal

---

## ✅ Step 6: Test Google Sheets Sync (Optional - Can Skip)

**Only if you want to sync data to Google Sheets:**

1. Set up Google Cloud Service Account (follow `GOOGLE_SHEETS_SYNC_SETUP.md`)
2. Add to `.env`:
   ```
   GOOGLE_SHEET_ID=your_sheet_id
   GOOGLE_SERVICE_ACCOUNT={"type":"service_account",...}
   ```
3. Restart server: `npm run dev`
4. Create/update a member
5. **Verify**: Member appears in your Google Sheet

**If you skip this, everything else still works!**

---

## 🎯 Quick Test Checklist

### Must Test (Required):
- [ ] Server starts without errors
- [ ] Dashboard loads at http://localhost:5000
- [ ] Can view Members page
- [ ] Can create a new member
- [ ] Member appears in list after creation

### Optional Tests (Nice to Have):
- [ ] WhatsApp connects (QR scan)
- [ ] Can preview message template
- [ ] Can send test message
- [ ] Google Sheets sync works (if configured)

---

## 🐛 Common Issues & Fixes

### "Port 5000 in use"
**Fix**: 
```bash
# Kill process using port 5000
netstat -ano | findstr :5000
# Note the PID, then:
taskkill /PID <PID> /F
# Or change PORT in .env to 3000
```

### "Database connection failed"
**Fix**: Check `.env` file has correct:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

### "WhatsApp not connecting"
**Fix**: 
- Check terminal for QR code
- Make sure you scan QR code quickly (expires in ~20 seconds)
- If QR keeps refreshing, there might be auth issues in `auth_info_baileys/` folder

### "No members showing"
**Fix**: This is normal if database is empty. Create a test member first.

---

## 📝 Testing Order (Simplified)

1. **Start**: `npm run dev` ✅
2. **Open**: http://localhost:5000 ✅
3. **Test**: Create a member ✅
4. **Test**: WhatsApp connection (optional) ⚠️
5. **Test**: Send message (optional) ⚠️
6. **Done!** 🎉

**Everything else is optional enhancements!**

