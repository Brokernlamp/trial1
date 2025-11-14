# Biometric Python Bridge Setup

The app now supports using Python's proven `zk` library for eSSL device communication. This is more reliable than the native implementation.

## Installation

### Step 1: Install Python
- Ensure Python 3.6+ is installed
- Check: `python --version` or `python3 --version`

### Step 2: Install zk library
```bash
pip install zk
```

Or if using python3:
```bash
pip3 install zk
```

### Step 3: Verify
The app will automatically detect Python and use it. If Python is not available, it falls back to the native implementation.

## How It Works

1. **Automatic Detection**: On startup, the app checks if Python + `zk` library are available
2. **Python First**: If available, uses Python bridge for:
   - Setting access groups (device shows green/red automatically)
   - Real-time scan monitoring (live_capture - more reliable than polling)
   - Door unlock commands
   - Connection testing
3. **Fallback**: If Python not available, uses native Node.js implementation

## Files

- `server/biometric-python-bridge.py` - Python script that handles device operations
- `server/biometric-python.ts` - Node.js wrapper that calls Python script

## Benefits

- ✅ Uses proven `zk` library (same as your working Python code)
- ✅ Real-time monitoring (live_capture instead of polling)
- ✅ More reliable access group configuration
- ✅ Automatic fallback if Python not available

## Troubleshooting

**Python not found:**
- Install Python 3.6+ from python.org
- Ensure `python` or `python3` is in PATH

**zk library not found:**
- Run: `pip install zk` or `pip3 install zk`

**Script not found:**
- Ensure `server/biometric-python-bridge.py` exists
- Check file permissions (should be executable)

The app will log which method it's using:
- `🔄 Biometric device monitoring started (Python live_capture)` = Using Python ✅
- `🔄 Biometric device polling started (every 1 second)` = Using native fallback

