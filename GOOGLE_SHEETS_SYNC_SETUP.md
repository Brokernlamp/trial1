# Google Sheets Sync Setup Guide

## Overview

This integration automatically syncs member data from the Turso database to a Google Sheet. This allows you to use Google Sheets as a source for WhatsApp messaging via Baileys.

## What Gets Synced

When members are created, updated, or deleted in the database, the following information is synced to Google Sheets:

- **Phone** (unique key for matching)
- **Name**
- **Plan** (plan name)
- **Days Left** (calculated from expiry date)
- **Status** (active, expired, pending, frozen)
- **Payment Status** (paid, pending, overdue)

## Setup Instructions

### 1. Create Google Cloud Project and Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable **Google Sheets API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create a Service Account:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Enter name: `gym-admin-sheets`
   - Click "Create and Continue"
   - Skip role assignment
   - Click "Done"
5. Create Service Account Key:
   - Click on the service account email
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Select "JSON" format
   - Download the JSON file (keep it secure!)

### 2. Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it: "Gym Members" (or any name)
4. The first row will be auto-populated with headers:
   - Phone | Name | Plan | Days Left | Status | Payment Status
5. **Share the sheet with the service account email**:
   - Click "Share" button
   - Add the service account email (from the JSON file, field: `client_email`)
   - Set permission to "Editor"
   - Uncheck "Notify people"
   - Click "Share"

### 3. Get Sheet ID

From your Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/ABC123XYZ456DEF789/edit
```
The part between `/d/` and `/edit` is your Sheet ID: `ABC123XYZ456DEF789`

### 4. Configure Environment Variables

Create a `.env` file in the project root (or update existing):

```env
# Required: Google Sheets Configuration
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}

# Optional: Custom sheet name (defaults to "Members")
GOOGLE_SHEET_NAME=Members
```

**Option 1: JSON String (Recommended for production)**
```env
GOOGLE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"your-service@project.iam.gserviceaccount.com","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

**Option 2: File Path**
```env
GOOGLE_SERVICE_ACCOUNT=./service-account.json
```

### 5. Test the Integration

1. Start the server: `npm run dev`
2. Check console for: `✅ Google Sheets initialized successfully`
3. Create a new member in the dashboard
4. Check your Google Sheet - a new row should appear
5. Update the member - the row should update
6. Delete the member - the row should disappear

## How It Works

- **Automatic Sync**: When you create, update, or delete a member via the API, the Google Sheet is automatically updated
- **Non-Blocking**: Sync happens asynchronously, so API responses are fast
- **Phone Matching**: Uses phone number (digits only) to match existing rows
- **Auto-Create Sheet**: If the sheet doesn't exist, it's created automatically

## Troubleshooting

### "GOOGLE_SHEET_ID not set, skipping Google Sheets sync"
- Make sure `GOOGLE_SHEET_ID` is set in your `.env` file

### "Failed to parse GOOGLE_SERVICE_ACCOUNT"
- Ensure the JSON is valid and properly escaped
- If using file path, make sure the file exists and is readable
- Check that you copied the entire JSON from the service account key file

### "Permission denied" or "Sheet not found"
- Make sure the sheet is shared with the service account email
- Verify the service account has "Editor" permission
- Check that `GOOGLE_SHEET_ID` is correct

### "Failed to sync member to Google Sheets"
- Check server logs for detailed error messages
- Verify internet connectivity
- Ensure Google Sheets API is enabled in your Google Cloud project

## Security Notes

- **Never commit** service account JSON to version control
- **Never share** the service account credentials publicly
- Store credentials in environment variables (not in code)
- For production, consider using a secrets manager (AWS Secrets Manager, Google Secret Manager, etc.)

## Integration with WhatsApp

The synced Google Sheet can be used with Baileys WhatsApp automation:
- The sheet contains all member data needed for messaging
- Phone numbers are formatted (digits only) for consistency
- Days left is calculated and updated automatically
- Status and payment status are synced for filtering

## Next Steps

1. Set up WhatsApp connection (Baileys) - already implemented
2. Use the Google Sheet data for bulk messaging
3. Set up automated cron jobs for scheduled reminders
4. Create reports using the synced data

