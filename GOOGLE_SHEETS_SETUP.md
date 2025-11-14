# Google Sheets Integration Setup Guide

## Step-by-Step Instructions

### 1. Create Google Cloud Project and Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on project dropdown at the top
3. Click "New Project"
4. Enter project name: "Gym Admin WhatsApp Logs" (or any name)
5. Click "Create"
6. Wait for project creation (usually takes 10-30 seconds)

### 2. Enable Google Sheets API

1. In Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click on "Google Sheets API"
4. Click "Enable" button
5. Wait for API to be enabled

### 3. Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Enter service account details:
   - **Name**: `gym-admin-sheets`
   - **Description**: `Service account for WhatsApp logs`
4. Click "Create and Continue"
5. Skip role assignment (click "Continue")
6. Click "Done"

### 4. Generate Service Account Key

1. In the Credentials page, find your newly created service account
2. Click on the service account email
3. Go to "Keys" tab
4. Click "Add Key" → "Create new key"
5. Select "JSON" format
6. Click "Create"
7. **IMPORTANT**: A JSON file will download automatically - **SAVE THIS FILE SECURELY**
8. This file contains your credentials - never share it publicly

### 5. Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it: "WhatsApp Message Logs"
4. In the first row (Row 1), add these headers:
   - Column A: `Timestamp`
   - Column B: `Member Name`
   - Column C: `Phone Number`
   - Column D: `Message`
   - Column E: `Status`
   - Column F: `Error Message`
   - Column G: `Message Type`
5. **Rename the sheet tab** (bottom left) to: `WhatsApp Logs`
   - If you don't rename, the default name is "Sheet1" - update the code accordingly

### 6. Share Sheet with Service Account

1. Click "Share" button (top right of Google Sheet)
2. Get the service account email from:
   - Google Cloud Console → IAM & Admin → Service Accounts
   - Or from the JSON file you downloaded (field: `client_email`)
   - It looks like: `gym-admin-sheets@your-project-id.iam.gserviceaccount.com`
3. Paste the service account email in the "Add people" field
4. Set permission to **"Editor"**
5. **Uncheck** "Notify people" (not needed for service accounts)
6. Click "Share"
7. Click "Done"

### 7. Get Sheet ID

1. In your Google Sheet, look at the URL:
   ```
   https://docs.google.com/spreadsheets/d/ABC123XYZ456DEF789/edit
   ```
2. The part between `/d/` and `/edit` is your Sheet ID
3. Example: `ABC123XYZ456DEF789`
4. Copy this ID - you'll need it in settings

### 8. Configure in Gym Admin Dashboard

1. Open your Gym Admin Dashboard
2. Go to **Settings** page
3. Scroll to **"WhatsApp Integration"** section
4. Enable "Automatic Payment Reminders" if not already enabled
5. Fill in:
   - **Google Sheets ID**: Paste the Sheet ID from step 7
   - **Service Account JSON**: Open the JSON file you downloaded in step 4
     - Copy the ENTIRE contents of the JSON file
     - Paste it in the textarea field
6. Click **"Save Changes"**

### 9. Test the Integration

1. Go to **WhatsApp** page
2. Find a member expiring soon (or manually trigger a reminder)
3. Click "Send Reminder" for a member
4. Check your Google Sheet - you should see a new row appear with:
   - Timestamp
   - Member name
   - Phone number
   - Message content
   - Status (sent/failed)
   - Error message (if failed)
   - Message type

### 10. Verify Logging Works

1. Check the Google Sheet after sending a test message
2. If a row appears, integration is working!
3. If no row appears, check:
   - Sheet ID is correct
   - Service account JSON is complete and valid
   - Sheet is shared with service account email
   - Sheet tab is named "WhatsApp Logs" (or update code)

## Troubleshooting

### Issue: "Failed to get access token"
- **Solution**: Verify the service account JSON is correctly pasted (should start with `{` and end with `}`)

### Issue: "Failed to log to Google Sheets"
- **Solution**: 
  - Verify Sheet ID is correct
  - Check that sheet is shared with service account
  - Verify sheet tab name matches (default: "WhatsApp Logs")

### Issue: "Permission denied"
- **Solution**: Make sure service account has "Editor" access to the sheet

### Issue: JSON parsing error
- **Solution**: Ensure you copied the entire JSON file contents, including all curly braces

## Security Notes

- **Never commit** the service account JSON to version control
- **Never share** the service account credentials publicly
- The credentials are stored in your database settings - protect your database access
- Consider using environment variables in production instead of storing in database

## Next Steps

1. Set up automated cron job (if needed) to trigger expiry reminders
2. Create reports using the logged data in Google Sheets
3. Set up Google Sheets formulas/charts for analytics

## Alternative: Use Environment Variables

For better security in production, you can store credentials in environment variables:

```env
GOOGLE_SHEETS_ID=your_sheet_id_here
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
```

Then update the code to read from `process.env` instead of settings.

