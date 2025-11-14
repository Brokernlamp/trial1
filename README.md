# Gym Admin Desktop Application

A comprehensive gym management system with desktop and web support, featuring member management, payment tracking, attendance monitoring, biometric integration, and WhatsApp notifications.

## 📋 Requirements

Before starting, ensure you have:

- **Node.js**: Version 20.x or 21.x (not 22.x or higher)
  - Check your version: `node --version`
  - Download: [Node.js Official Website](https://nodejs.org/)
- **npm**: Comes with Node.js
  - Check your version: `npm --version`
- **Git**: To clone the repository (if delivering via GitHub)

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
npm install
```

This will:
- Install all required packages (dependencies and devDependencies)
- Automatically run `electron-builder install-app-deps` after installation
- Set up the project for development

### Step 2: Run in Development Mode

```bash
npm run desktop:dev
```

This will:
- Build the frontend and backend
- Start the Electron desktop application
- Open the app in a window

## 📁 Project Structure

```
GymAdminDashboard/
├── client/          # React frontend
├── server/          # Express backend
├── electron/        # Electron main process
├── shared/          # Shared schemas/types
├── dist/            # Build output (generated)
└── package.json     # Dependencies & scripts
```

## 🛠️ Available Scripts

### Development
- `npm run dev` - Start web server (browser mode)
- `npm run dev:desktop` - Start server in desktop mode (no Electron)
- `npm run desktop:dev` - **Build and run desktop app** (recommended)

### Building
- `npm run build` - Build for production
- `npm run desktop:build` - Build installer (.exe file)

### Other
- `npm run check` - Type check TypeScript code
- `npm start` - Run production server (after build)

## ⚙️ Configuration

### Database Sync (Optional)

The app works offline by default. To enable sync with web app:

1. Open the desktop app
2. Go to **Settings** → **Database Sync**
3. Enter your Turso credentials:
   - Turso Database URL
   - Turso Auth Token
4. Click **Save Settings**

Sync will happen automatically in the background.

### Environment Variables (Optional)

Create a `.env` file in the root directory for development:

```env
# Optional - for web app deployment
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_token_here

# Server
PORT=5000
NODE_ENV=development
```

**Note**: Desktop app works without these - it uses local SQLite database.

## 🔧 Troubleshooting

### "Cannot find module" errors
- Run `npm install` again
- Delete `node_modules` folder and `package-lock.json`, then run `npm install`

### "Port already in use"
- Change `PORT` in `.env` file
- Or kill the process using port 5000

### Build errors
- Make sure Node.js version is 20.x or 21.x
- Delete `node_modules` and `dist` folders
- Run `npm install` again
- Try `npm run build` separately to see errors

### Electron not starting
- Make sure you ran `npm install` first
- Check if `electron` is installed: `npm list electron`
- Try `npm run desktop:dev` (builds first, then runs)

## 📦 Building for Distribution

To create an installer (.exe file):

```bash
npm run desktop:build
```

The installer will be in the `dist/` folder:
- `GymAdminDesktop-1.0.0-Setup.exe`

## 🎯 Features

- ✅ Member Management
- ✅ Payment Tracking
- ✅ Attendance Monitoring
- ✅ Biometric Device Integration (eSSL K30 Pro)
- ✅ WhatsApp Notifications
- ✅ Offline/Online Database Sync
- ✅ Reports & Analytics

## 📝 Notes

- The app works **completely offline** by default
- Data is stored locally in SQLite database
- Sync with web app is optional (configure in Settings)
- First run may take time to build (subsequent runs are faster)

## 🤝 Support

For issues or questions, refer to:
- `SYNC_SETUP_GUIDE.md` - Database sync setup
- `AUTO_SYNC_GUIDE.md` - Automatic sync details
- `BIOMETRIC_SETUP_GUIDE.md` - Biometric device setup

---

**Made with ❤️ for Gym Management**

