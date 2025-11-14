import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { initWhatsApp } from "./whatsapp";
import { initGoogleSheets } from "./google-sheets";
// Sync disabled for offline-only mode
import { startBiometricDevicePolling } from "./biometric-device";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Don't auto-initialize WhatsApp - wait for user to click "Generate QR Code"
  // This allows manual control over when to connect
  // try {
  //   await initWhatsApp();
  //   log("WhatsApp initialization started");
  // } catch (error) {
  //   console.error("Failed to initialize WhatsApp:", error);
  //   // Continue server startup even if WhatsApp fails
  // }
  log("WhatsApp will be initialized when user clicks 'Generate QR Code'");

  // Initialize Google Sheets sync
  try {
    await initGoogleSheets();
    log("Google Sheets initialization started");
  } catch (error) {
    console.error("Failed to initialize Google Sheets:", error);
    // Continue server startup even if Google Sheets fails
  }

  // Start services (desktop mode only)
  const desktop = process.env.DESKTOP === "1" || process.env.ELECTRON === "1";
  if (desktop) {
    try {
      // Background sync disabled (offline-only mode)
      log("Background sync is disabled (offline-only mode)");
    } catch (error) {
      console.error("Background sync disabled:", error);
      // Continue server startup even if sync fails
    }
    
    // Start biometric device polling (desktop mode only)
    try {
      startBiometricDevicePolling();
      log("Biometric device polling service started");
    } catch (error) {
      console.error("Failed to start biometric device polling:", error);
      // Continue server startup even if polling fails
    }
  }

  // Register routes first
  await registerRoutes(app);

  // Error handler must come after routes
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Create HTTP server for local dev
  const http = await import("http");
  const server = http.createServer(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  // For desktop/Electron builds, force production unless explicitly debugging
  const isDesktop = process.env.DESKTOP === "1" || process.env.ELECTRON === "1";
  const isDev = !isDesktop && process.env.NODE_ENV !== "production" || process.env.DESKTOP_DEBUG === "1";
  if (isDev) {
    // Dynamic import to avoid bundling vite in production
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
