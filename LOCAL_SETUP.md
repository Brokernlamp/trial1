# Local Development Setup Guide

## Quick Start

1. **Install Dependencies** (if not already installed)
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   
   Create a `.env` file in the root directory with:
   ```env
   # Database (Required)
   TURSO_DATABASE_URL=libsql://gym-management-shreekrishna.aws-ap-south-1.turso.io
   TURSO_AUTH_TOKEN=your_turso_token_here
   
   # Server
   PORT=5000
   NODE_ENV=development
   
   # Google Sheets (Optional - for WhatsApp sync)
   # GOOGLE_SHEET_ID=your_sheet_id
   # GOOGLE_SERVICE_ACCOUNT={"type":"service_account",...}
   # GOOGLE_SHEET_NAME=Members
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Access Dashboard**
   - Open browser: http://localhost:5000
   - The app will automatically reload on code changes

## Requirements

- **Node.js**: v20.x - v22.x (you have v22.18.0 ✅)
- **npm**: Latest version (you have 10.9.3 ✅)

## Troubleshooting

### Port Already in Use
If port 5000 is busy, change `PORT` in `.env`:
```env
PORT=3000
```

### Database Connection Issues
- Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are correct
- Check Turso dashboard for updated credentials

### WhatsApp Connection
- WhatsApp will initialize on server start
- Scan QR code in terminal to connect
- Auth state is saved in `auth_info_baileys/` folder

### Google Sheets Sync
- Only needed if you want WhatsApp sync
- Follow `GOOGLE_SHEETS_SYNC_SETUP.md` for setup

## Scripts

- `npm run dev` - Start development server (frontend + backend)
- `npm run build` - Build for production
- `npm run start` - Start production server (after build)
- `npm run check` - TypeScript type checking

