import { execFile } from "child_process";
import { promisify } from "util";
import { storage } from "./storage";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

interface BiometricSettings {
  ip: string;
  port: string;
  commKey: string;
  unlockSeconds: string;
  relayType: string;
}

// Get script path - relative to server directory
const PYTHON_SCRIPT = path.join(process.cwd(), "server", "biometric-python-bridge.py");

// Verify script exists on module load
if (!fs.existsSync(PYTHON_SCRIPT)) {
  console.warn(`⚠️ Python script not found at: ${PYTHON_SCRIPT}`);
  console.warn(`   Current working directory: ${process.cwd()}`);
}

// Check if Python is available
async function checkPython(): Promise<boolean> {
  try {
    await execFileAsync("python", ["--version"]);
    return true;
  } catch {
    try {
      await execFileAsync("python3", ["--version"]);
      return true;
    } catch {
      return false;
    }
  }
}

// Get Python command (python or python3)
async function getPythonCmd(): Promise<string> {
  try {
    await execFileAsync("python", ["--version"]);
    return "python";
  } catch {
    return "python3";
  }
}

// Sync access groups using Python
export async function syncAccessGroupsPython(settings: BiometricSettings): Promise<{ success: boolean; results?: any[]; error?: string }> {
  try {
    const pythonCmd = await getPythonCmd();
    const members = await storage.listMembers();
    const linkedMembers = members.filter((m: any) => !!(m.biometricId ?? m.biometric_id));
    
    const membersData = linkedMembers.map((member) => {
      const biometricId = (member as any).biometricId ?? (member as any).biometric_id;
      const now = new Date();
      const startOk = !member.startDate || new Date(member.startDate) <= now;
      const endOk = !member.expiryDate || new Date(member.expiryDate) >= now;
      const statusOk = member.status === "active";
      const paymentOk = member.paymentStatus !== "overdue" && member.paymentStatus !== "pending";
      const allowed = statusOk && startOk && endOk && paymentOk;
      
      return {
        biometricId,
        allowed,
      };
    });
    
    const { stdout } = await execFileAsync(pythonCmd, [
      PYTHON_SCRIPT,
      "sync_access_groups",
      settings.ip,
      settings.port,
      settings.commKey || "0",
      JSON.stringify(membersData),
    ]);
    
    return JSON.parse(stdout);
  } catch (error: any) {
    console.error("Python sync access groups failed:", error);
    return { success: false, error: error.message };
  }
}

// Test connection using Python
export async function testConnectionPython(settings: BiometricSettings): Promise<boolean> {
  try {
    const pythonCmd = await getPythonCmd();
    const { stdout } = await execFileAsync(pythonCmd, [
      PYTHON_SCRIPT,
      "test_connection",
      settings.ip,
      settings.port,
      settings.commKey || "0",
    ]);
    
    const result = JSON.parse(stdout);
    return result.success && result.connected;
  } catch (error) {
    console.error("Python test connection failed:", error);
    return false;
  }
}

// Unlock door using Python
export async function unlockDoorPython(settings: BiometricSettings, seconds: number): Promise<boolean> {
  try {
    const pythonCmd = await getPythonCmd();
    const { stdout } = await execFileAsync(pythonCmd, [
      PYTHON_SCRIPT,
      "unlock_door",
      settings.ip,
      settings.port,
      settings.commKey || "0",
      String(seconds),
    ]);
    
    const result = JSON.parse(stdout);
    return result.success;
  } catch (error) {
    console.error("Python unlock door failed:", error);
    return false;
  }
}

// Start live scan monitoring using Python (spawns process that outputs JSON)
export function startLiveScanMonitoring(
  settings: BiometricSettings,
  onScan: (userId: string, timestamp: Date) => void,
  onError: (error: Error) => void
): { process: any; stop: () => void } {
  let pythonProcess: any = null;
  let shouldRestart = true;
  let restartTimeout: NodeJS.Timeout | null = null;
  
  const startProcess = async () => {
    if (!shouldRestart) return;
    
    try {
      const pythonCmd = await getPythonCmd();
      console.log(`🐍 Starting Python biometric monitoring process...`);
      console.log(`   Command: ${pythonCmd}`);
      console.log(`   Script: ${PYTHON_SCRIPT}`);
      console.log(`   Args: monitor_scans ${settings.ip} ${settings.port} ${settings.commKey || "0"} ${settings.unlockSeconds || "3"}`);
      
      if (!fs.existsSync(PYTHON_SCRIPT)) {
        throw new Error(`Python script not found at: ${PYTHON_SCRIPT}`);
      }
      
      pythonProcess = execFile(pythonCmd, [
        PYTHON_SCRIPT,
        "monitor_scans",
        settings.ip,
        settings.port,
        settings.commKey || "0",
        settings.unlockSeconds || "3",
      ]);
      
      pythonProcess.stdout?.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter((l: string) => l.trim());
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            
            if (event.type === "scan") {
              // Normalize userId to string
              const normalizedUserId = String(event.userId || event.user_id || "").trim();
              console.log(`🐍 Python live capture: User ID "${normalizedUserId}" scanned`);
              onScan(normalizedUserId, new Date(event.timestamp));
            } else if (event.type === "status") {
              console.log(`🐍 Python status: ${event.message}`);
            } else if (event.type === "connected") {
              console.log(`✅ Python connected to device ${event.ip}:${event.port}`);
            } else if (event.type === "error") {
              console.error(`❌ Python error: ${event.error}`);
              onError(new Error(event.error));
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });
      
      pythonProcess.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        // Log all stderr for debugging (Python errors, warnings, etc.)
        if (output.trim()) {
          console.error("🐍 Python stderr:", output.trim());
        }
      });
      
      pythonProcess.on("error", (err: Error) => {
        console.error("❌ Python process error:", err);
        onError(err);
        scheduleRestart();
      });
      
      pythonProcess.on("exit", (code: number | null, signal: string | null) => {
        console.log(`🐍 Python process exited with code ${code}, signal ${signal}`);
        if (shouldRestart && code !== 0) {
          console.log("🔄 Python process died, will restart in 5 seconds...");
          scheduleRestart();
        }
      });
    } catch (error) {
      console.error("❌ Failed to start Python process:", error);
      onError(error as Error);
      scheduleRestart();
    }
  };
  
  const scheduleRestart = () => {
    if (restartTimeout) {
      clearTimeout(restartTimeout);
    }
    restartTimeout = setTimeout(() => {
      if (shouldRestart) {
        console.log("🔄 Restarting Python biometric monitoring...");
        startProcess();
      }
    }, 5000); // Restart after 5 seconds
  };
  
  // Start the process
  startProcess();
  
  return {
    process: pythonProcess,
    stop: () => {
      shouldRestart = false;
      if (restartTimeout) {
        clearTimeout(restartTimeout);
      }
      if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
      }
    },
  };
}

// Check if Python bridge is available
export async function isPythonBridgeAvailable(): Promise<boolean> {
  return await checkPython();
}

