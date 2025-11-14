import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type ConnectionState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";

// Handle both ESM (import.meta.url) and CommonJS (require.main) environments
let __dirname: string;
try {
  // Try ESM approach first
  if (typeof import.meta !== "undefined" && import.meta.url) {
    const __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
  } else {
    // Fallback for CommonJS/bundled environments (like Netlify)
    __dirname = process.cwd();
  }
} catch (error) {
  // If fileURLToPath fails, use process.cwd() as fallback
  __dirname = process.cwd();
}

// Get AppData directory for desktop mode (same as database)
function getAppDataDir(): string {
  const base = process.env.GYM_APPDATA_DIR || path.join(os.homedir(), ".gymadmindashboard");
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
}

// Session directory for storing auth state
// Use /tmp on serverless platforms, AppData for desktop, otherwise project directory
const desktop = process.env.DESKTOP === "1" || process.env.ELECTRON === "1";
const AUTH_DIR = process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join("/tmp", "auth_info_baileys") // Use /tmp for serverless (Netlify, AWS Lambda)
  : desktop
  ? path.join(getAppDataDir(), "auth_info_baileys") // Use AppData for desktop/packaged app
  : path.join(__dirname, "..", "auth_info_baileys"); // Use project directory for local/dev

// Connection state tracking
export let isWAConnected = false;
export let currentQR: string | null = null;
export let lastConnectionState: string | null = null;
let sock: WASocket | null = null;
let isInitializing = false;
let shouldAutoRetry = false;
let retryTimeout: NodeJS.Timeout | null = null;

/**
 * Initialize WhatsApp connection
 */
export async function initWhatsApp(): Promise<void> {
  if (isInitializing) {
    console.log("⏳ WhatsApp initialization already in progress...");
    return;
  }
  
  isInitializing = true;
  
  try {
    console.log("🔧 Initializing WhatsApp connection...");
    console.log(`📁 Auth directory: ${AUTH_DIR}`);
    
    // Ensure auth directory exists
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
      console.log(`📂 Created auth directory: ${AUTH_DIR}`);
    }
    
    // Check if auth files exist
    const authFilesExist = fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).length > 0;
    console.log(`📂 Auth files exist: ${authFilesExist}`);

    // Load auth state from files
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    console.log(`🔑 Auth state loaded: ${state.creds.me?.id ? 'Has credentials' : 'No credentials - will generate QR'}`);

    // Create Baileys socket
    sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }), // Suppress Baileys logs, we'll handle our own
      browser: ["GymAdminDashboard", "Desktop", "1.0.0"],
    });

    // Save credentials whenever they update
    sock.ev.on("creds.update", saveCreds);

    // Handle connection updates
    sock.ev.on("connection.update", (update: ConnectionState) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Log all connection updates for debugging
      console.log(`\n📡 Connection Update:`, {
        connection,
        hasQR: !!qr,
        hasLastDisconnect: !!lastDisconnect,
        disconnectError: lastDisconnect ? (lastDisconnect.error as any)?.message : null,
      });

      if (qr) {
        // QR code received for authentication
        currentQR = qr;
        isInitializing = false;
        lastConnectionState = connection ?? null;
        console.log("\n═══════════════════════════════════════");
        console.log("📱 QR CODE RECEIVED!");
        console.log("   Length:", qr.length);
        console.log("   Stored in currentQR");
        console.log("═══════════════════════════════════════");
        qrcode.generate(qr, { small: true });
        isWAConnected = false;
      }

      if (connection === "close") {
        // Connection closed
        console.log("\n🔴 Connection CLOSED");
        isWAConnected = false;
        isInitializing = false;
        lastConnectionState = "close";
        const disconnectReason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = disconnectReason !== DisconnectReason.loggedOut;
        
        // 515 = Stream Errored (restart required) - should reconnect
        // 401 = Logged out - need new QR
        const isStreamError = disconnectReason === DisconnectReason.restartRequired || disconnectReason === 515;
        const isLoggedOut = disconnectReason === DisconnectReason.loggedOut;

        console.log(`   Disconnect reason code: ${disconnectReason}`);
        console.log(`   Is stream error (515): ${isStreamError}`);
        console.log(`   Is logged out: ${isLoggedOut}`);
        console.log(`   Should reconnect: ${shouldReconnect}`);

        if (isLoggedOut) {
          // User logged out - need fresh QR
          console.log("   ❌ Logged out - need fresh QR code");
          currentQR = null;
          isInitializing = false;
        } else if (isStreamError && shouldReconnect) {
          // Stream error - auto-retry after a short delay
          console.log("   🔄 Stream error detected - will auto-retry in 2 seconds...");
          currentQR = null;
          isInitializing = false;
          
          // Clear any existing retry timeout
          if (retryTimeout) {
            clearTimeout(retryTimeout);
          }
          
          // Auto-retry after 2 seconds
          shouldAutoRetry = true;
          retryTimeout = setTimeout(async () => {
            if (shouldAutoRetry && !isWAConnected && !isInitializing) {
              console.log("   🔄 Auto-retrying connection...");
              shouldAutoRetry = false;
              try {
                await initWhatsApp();
              } catch (err) {
                console.error("   ❌ Auto-retry failed:", err);
              }
            }
          }, 2000);
        } else if (shouldReconnect) {
          console.log("   🔄 Should reconnect - resetting state");
          currentQR = null;
          isInitializing = false;
        } else {
          console.log("   ⚠️  Unexpected disconnect reason");
          currentQR = null;
          isInitializing = false;
        }
      } else if (connection === "open") {
        // Connection successful
        console.log("\n═══════════════════════════════════════");
        console.log("✅✅✅ CONNECTION OPENED! ✅✅✅");
        console.log("═══════════════════════════════════════");
        isWAConnected = true;
        currentQR = null;
        isInitializing = false;
        shouldAutoRetry = false; // Cancel any pending retries
        lastConnectionState = "open";
        
        // Clear retry timeout if exists
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }
        
        console.log("✅ WhatsApp connected successfully!");
        if (sock?.user) {
          console.log(`👤 Connected as: ${sock.user.name || sock.user.id}`);
        }
        console.log("═══════════════════════════════════════\n");
      } else if (connection === "connecting") {
        console.log("🔄 Connection state: CONNECTING...");
        isWAConnected = false;
        lastConnectionState = "connecting";
        // Cancel retry when actively connecting
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }
        shouldAutoRetry = false;
      } else {
        console.log(`ℹ️  Connection state: ${connection || 'undefined'}`);
        lastConnectionState = connection ?? null;
      }
    });

    // Handle any errors
    sock.ev.on("error", (err) => {
      console.error("❌ WhatsApp error:", err);
      isWAConnected = false;
      isInitializing = false;
      lastConnectionState = "error";
    });

    console.log("✅ WhatsApp initialization complete. Waiting for connection...");
  } catch (error) {
    console.error("❌ Failed to initialize WhatsApp:", error);
    isWAConnected = false;
    isInitializing = false;
    throw error;
  }
}

/**
 * Force disconnect and generate new QR code
 */
export async function forceReconnect(): Promise<void> {
  console.log("═══════════════════════════════════════");
  console.log("🔄 FORCE RECONNECT CALLED");
  console.log("═══════════════════════════════════════");
  
  try {
    // Reset initialization flag first
    isInitializing = false;
    console.log("1️⃣ Reset isInitializing flag");
    
    // Close existing socket if it exists
    if (sock) {
      console.log("2️⃣ Closing existing socket...");
      try {
        await sock.logout(); // Logout instead of just end to force fresh auth
        console.log("   ✅ Logged out existing socket");
      } catch (e) {
        try {
          await sock.end(undefined);
          console.log("   ✅ Closed existing socket");
        } catch (e2) {
          console.log("   ℹ️  Socket already closed");
        }
      }
      sock = null;
    } else {
      console.log("2️⃣ No existing socket to close");
    }
    
    isWAConnected = false;
    currentQR = null;
    console.log("3️⃣ Reset connection state");
    
    // Delete auth files to force QR code generation
    console.log("4️⃣ Deleting auth files...");
    try {
      if (fs.existsSync(AUTH_DIR)) {
        const files = fs.readdirSync(AUTH_DIR);
        console.log(`   📂 Found ${files.length} auth files`);
        let deletedCount = 0;
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(AUTH_DIR, file));
            deletedCount++;
          } catch (fileErr) {
            console.error(`   ❌ Failed to delete ${file}:`, fileErr);
          }
        }
        console.log(`   🗑️  Deleted ${deletedCount} of ${files.length} files`);
        
        // Verify deletion
        const remainingFiles = fs.existsSync(AUTH_DIR) ? fs.readdirSync(AUTH_DIR).length : 0;
        if (remainingFiles > 0) {
          console.warn(`   ⚠️  Warning: ${remainingFiles} files still remain`);
        } else {
          console.log(`   ✅ All auth files deleted successfully`);
        }
      } else {
        console.log("   📂 Auth directory doesn't exist - will create fresh");
      }
    } catch (e) {
      console.error("   ❌ Failed to delete auth files:", e);
      // Continue anyway
    }
    
    // Small delay to ensure cleanup is done
    console.log("5️⃣ Waiting for cleanup to complete...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clear the initialization flag again before reinitializing
    isInitializing = false;
    console.log("6️⃣ Calling initWhatsApp()...");
    
    // Reinitialize - this will generate a new QR code since auth files are deleted
    await initWhatsApp();
    
    console.log("7️⃣ initWhatsApp() completed");
    console.log("   ⏳ QR code should appear shortly in connection.update event");
    console.log("═══════════════════════════════════════");
  } catch (error) {
    console.error("═══════════════════════════════════════");
    console.error("❌ FAILED TO FORCE RECONNECT:", error);
    console.error("═══════════════════════════════════════");
    isInitializing = false;
    isWAConnected = false;
    currentQR = null;
    throw error;
  }
}

/**
 * Disconnect WhatsApp (logout)
 */
export async function disconnectWhatsApp(): Promise<void> {
  try {
    console.log("🔌 Disconnecting WhatsApp...");
    
    if (sock) {
      await sock.logout();
      sock = null;
    }
    
    // Delete auth files to force fresh login next time
    try {
      if (fs.existsSync(AUTH_DIR)) {
        const files = fs.readdirSync(AUTH_DIR);
        for (const file of files) {
          fs.unlinkSync(path.join(AUTH_DIR, file));
        }
        console.log("🗑️  Deleted auth files");
      }
    } catch (e) {
      console.error("Failed to delete auth files:", e);
    }
    
    isWAConnected = false;
    currentQR = null;
    
    console.log("✅ WhatsApp disconnected successfully");
  } catch (error) {
    console.error("❌ Failed to disconnect WhatsApp:", error);
    throw error;
  }
}

/**
 * Send WhatsApp message to a phone number
 * @param phone - Phone number (will be formatted)
 * @param message - Message text to send
 * @returns Promise resolving to message send status
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sock || !isWAConnected) {
      return {
        success: false,
        error: "WhatsApp is not connected. Please connect first.",
      };
    }

    // Format phone number and create JID
    const cleanPhone = phone.replace(/\D/g, ""); // Remove non-digits
    const jid = `${cleanPhone}@s.whatsapp.net`;

    // Send message
    await sock.sendMessage(jid, { text: message });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Failed to send WhatsApp message:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function sendWhatsAppDocument(
  phone: string,
  fileName: string,
  mimeType: string,
  data: Buffer
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sock || !isWAConnected) {
      return { success: false, error: "WhatsApp is not connected. Please connect first." };
    }
    const cleanPhone = phone.replace(/\D/g, "");
    const jid = `${cleanPhone}@s.whatsapp.net`;
    await sock.sendMessage(jid, {
      document: data,
      mimetype: mimeType,
      fileName,
    });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Failed to send WhatsApp document:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

