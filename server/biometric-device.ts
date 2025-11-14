import net from "net";
import { storage } from "./storage";

interface BiometricSettings {
  ip: string;
  port: string;
  commKey: string;
  unlockSeconds: string;
  relayType: string;
}

interface DeviceUser {
  userId: string;
  name: string;
}

interface AttendanceLog {
  userId: string;
  timestamp: Date;
  status: number; // 0 = Check-in, 1 = Check-out (if supported)
  verifyMode: number; // 0 = Fingerprint, etc.
}

interface ScanLog {
  biometricId: string;
  memberId: string | null;
  memberName: string | null;
  timestamp: Date;
  allowed: boolean;
  reason: string; // "allowed", "unknown_user", "inactive", "expired", "payment_pending", etc.
}

let deviceConnection: net.Socket | null = null;
let isPolling = false;
let pollingInterval: NodeJS.Timeout | null = null;
let lastLogTime: Date | null = null;
let scanLogs: ScanLog[] = []; // In-memory scan log (last 1000)
let pythonMonitor: { process: any; stop: () => void } | null = null; // Python live capture monitor

// eSSL Protocol Constants
const CMD_CONNECT = 0x10000001;
const CMD_GET_USER = 0x00000005;
const CMD_GET_ATTENDANCE_LOG = 0x0000000D;
const CMD_RELAY_CONTROL = 0x00140000;
const CMD_SET_USER = 0x00000008; // Set user info including access group

// Helper: Convert number to 4-byte little-endian buffer
function intToBuffer(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

// Helper: Calculate checksum (simple XOR for eSSL)
function calculateChecksum(data: Buffer): number {
  let checksum = 0;
  for (let i = 0; i < data.length; i++) {
    checksum ^= data[i];
  }
  return checksum;
}

// Build eSSL command packet
function buildCommand(command: number, data: Buffer = Buffer.alloc(0), commKey: number = 0): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(command, 0);
  header.writeUInt32LE(commKey, 4);
  
  const packet = Buffer.concat([header, data]);
  const checksum = calculateChecksum(packet);
  
  const fullPacket = Buffer.concat([
    Buffer.from([0x55, 0xAA]), // Start marker
    packet,
    Buffer.from([checksum]),
    Buffer.from([0x00, 0x00]) // End marker
  ]);
  
  return fullPacket;
}

// Parse eSSL response packet
function parseResponse(buffer: Buffer): { command: number; data: Buffer; success: boolean } | null {
  if (buffer.length < 12) return null;
  
  // Check start marker
  if (buffer[0] !== 0x55 || buffer[1] !== 0xAA) return null;
  
  const command = buffer.readUInt32LE(2);
  const commKey = buffer.readUInt32LE(6);
  const dataLength = buffer.length - 12; // Header + checksum + markers
  const data = buffer.slice(10, 10 + dataLength);
  
  // Verify checksum
  const packet = buffer.slice(2, buffer.length - 3);
  const checksum = calculateChecksum(packet);
  const receivedChecksum = buffer[buffer.length - 3];
  
  return {
    command,
    data,
    success: checksum === receivedChecksum
  };
}

// Connect to eSSL device
async function connectToDevice(settings: BiometricSettings): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (deviceConnection) {
        deviceConnection.destroy();
      }
      
      const socket = new net.Socket();
      const port = parseInt(settings.port || "4370", 10);
      const commKey = parseInt(settings.commKey || "0", 10);
      
      socket.setTimeout(5000); // 5 second timeout
      
      socket.on("connect", () => {
        console.log(`✅ Connected to eSSL device at ${settings.ip}:${port}`);
        deviceConnection = socket;
        
        // Send connect command
        const connectCmd = buildCommand(CMD_CONNECT, Buffer.alloc(0), commKey);
        socket.write(connectCmd);
        
        resolve(true);
      });
      
      socket.on("data", (data: Buffer) => {
        const response = parseResponse(data);
        if (response && response.success) {
          console.log(`📥 Received response: command=${response.command.toString(16)}`);
        }
      });
      
      socket.on("error", (err) => {
        console.error(`❌ Device connection error: ${err.message}`);
        resolve(false);
      });
      
      socket.on("timeout", () => {
        console.error("❌ Device connection timeout");
        socket.destroy();
        resolve(false);
      });
      
      socket.on("close", () => {
        console.log("🔌 Device connection closed");
        deviceConnection = null;
      });
      
      socket.connect(port, settings.ip);
      
      // Resolve after timeout if connection pending
      setTimeout(() => {
        if (!deviceConnection) {
          resolve(false);
        }
      }, 3000);
    } catch (error) {
      console.error("❌ Failed to connect to device:", error);
      resolve(false);
    }
  });
}

// Get users from device
export async function getDeviceUsers(settings: BiometricSettings): Promise<DeviceUser[]> {
  return new Promise((resolve) => {
    if (!deviceConnection || deviceConnection.destroyed) {
      resolve([]);
      return;
    }
    
    const commKey = parseInt(settings.commKey || "0", 10);
    const cmd = buildCommand(CMD_GET_USER, Buffer.alloc(0), commKey);
    
    const timeout = setTimeout(() => {
      resolve([]);
    }, 5000);
    
    const dataHandler = (data: Buffer) => {
      const response = parseResponse(data);
      if (response && response.command === CMD_GET_USER && response.success) {
        // Parse user data (format depends on device)
        const users: DeviceUser[] = [];
        // TODO: Parse actual user data from response.data
        // This requires knowing the exact eSSL data format
        clearTimeout(timeout);
        deviceConnection?.removeListener("data", dataHandler);
        resolve(users);
      }
    };
    
    deviceConnection.on("data", dataHandler);
    deviceConnection.write(cmd);
  });
}

// Get attendance logs from device
export async function getAttendanceLogs(settings: BiometricSettings): Promise<AttendanceLog[]> {
  return new Promise(async (resolve) => {
    // Ensure connected
    if (!deviceConnection || deviceConnection.destroyed) {
      console.log("⚠️ Device not connected, attempting connection...");
      const connected = await connectToDevice(settings);
      if (!connected || !deviceConnection || deviceConnection.destroyed) {
        console.log("❌ Failed to connect to device for log fetch");
        resolve([]);
        return;
      }
    }
    
    if (!deviceConnection || deviceConnection.destroyed) {
      resolve([]);
      return;
    }
    
    const commKey = parseInt(settings.commKey || "0", 10);
    const cmd = buildCommand(CMD_GET_ATTENDANCE_LOG, Buffer.alloc(0), commKey);
    
    const timeout = setTimeout(() => {
      resolve([]);
    }, 5000);
    
    const logs: AttendanceLog[] = [];
    let buffer = Buffer.alloc(0);
    
    const dataHandler = (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      
      // Try to parse logs from buffer
      // eSSL log format: timestamp (4 bytes) + user_id (2 bytes) + status + verify_mode
      while (buffer.length >= 8) {
        try {
          const timestamp = buffer.readUInt32LE(0);
          const userId = buffer.readUInt16LE(4);
          const status = buffer[6];
          const verifyMode = buffer[7];
          
          logs.push({
            userId: userId.toString(),
            timestamp: new Date(timestamp * 1000), // Convert Unix timestamp
            status,
            verifyMode
          });
          
          buffer = buffer.slice(8);
        } catch (e) {
          break;
        }
      }
      
      // If we got a response, process it
      const response = parseResponse(buffer);
      if (response && response.command === CMD_GET_ATTENDANCE_LOG) {
        clearTimeout(timeout);
        deviceConnection?.removeListener("data", dataHandler);
        resolve(logs);
      }
    };
    
    deviceConnection.on("data", dataHandler);
    deviceConnection.write(cmd);
  });
}

// Send door unlock command
async function unlockDoor(settings: BiometricSettings, durationSeconds: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (!deviceConnection || deviceConnection.destroyed) {
      resolve(false);
      return;
    }
    
    const commKey = parseInt(settings.commKey || "0", 10);
    const relayNum = 1; // Usually relay 1
    const duration = durationSeconds;
    
    // Build relay control command
    const data = Buffer.alloc(2);
    data.writeUInt8(relayNum, 0);
    data.writeUInt8(duration, 1);
    
    const cmd = buildCommand(CMD_RELAY_CONTROL, data, commKey);
    
    const timeout = setTimeout(() => {
      resolve(false);
    }, 2000);
    
    const dataHandler = (data: Buffer) => {
      const response = parseResponse(data);
      if (response && response.command === CMD_RELAY_CONTROL) {
        clearTimeout(timeout);
        deviceConnection?.removeListener("data", dataHandler);
        resolve(response.success);
      }
    };
    
    deviceConnection.on("data", dataHandler);
    deviceConnection.write(cmd);
  });
}

// Public helper to trigger a brief relay pulse (e.g., for test-connection)
export async function pulseRelay(settings: BiometricSettings, seconds: number = 1): Promise<boolean> {
  return await unlockDoor(settings, seconds);
}

// Set user access group on device (0 = denied, 1 = allowed)
export async function setUserAccessGroup(settings: BiometricSettings, userId: string, allowed: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    if (!deviceConnection || deviceConnection.destroyed) {
      resolve(false);
      return;
    }
    
    const commKey = parseInt(settings.commKey || "0", 10);
    const groupId = allowed ? 1 : 0; // 1 = allowed, 0 = denied
    
    // Build set user command with group_id
    // Format: user_id (2 bytes) + group_id (1 byte) + name (variable) + ...
    const userIdNum = parseInt(userId, 10);
    const data = Buffer.alloc(4);
    data.writeUInt16LE(userIdNum, 0);
    data.writeUInt8(groupId, 2);
    data.writeUInt8(0, 3); // Reserved
    
    const cmd = buildCommand(CMD_SET_USER, data, commKey);
    
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);
    
    const dataHandler = (data: Buffer) => {
      const response = parseResponse(data);
      if (response && response.command === CMD_SET_USER) {
        clearTimeout(timeout);
        deviceConnection?.removeListener("data", dataHandler);
        resolve(response.success);
      }
    };
    
    deviceConnection.on("data", dataHandler);
    deviceConnection.write(cmd);
  });
}

// Sync member access groups to device (call after linking/unlinking or status changes)
export async function syncMemberAccessGroups(settings: BiometricSettings): Promise<void> {
  try {
    // Try Python bridge first (more reliable)
    try {
      const { syncAccessGroupsPython, isPythonBridgeAvailable } = await import("./biometric-python");
      if (await isPythonBridgeAvailable()) {
        const result = await syncAccessGroupsPython(settings);
        if (result.success) {
          console.log(`✅ Synced access groups via Python: ${result.results?.length || 0} users`);
          return;
        }
      }
    } catch (pyErr) {
      console.log("Python bridge not available, using native implementation");
    }
    
    // Fallback to native implementation
    const members = await storage.listMembers();
    const linkedMembers = members.filter((m: any) => !!(m.biometricId ?? m.biometric_id));
    
    for (const member of linkedMembers) {
      const biometricId = (member as any).biometricId ?? (member as any).biometric_id;
      if (!biometricId) continue;
      
      const now = new Date();
      const startOk = !member.startDate || new Date(member.startDate) <= now;
      const endOk = !member.expiryDate || new Date(member.expiryDate) >= now;
      const statusOk = member.status === "active";
      const paymentOk = member.paymentStatus !== "overdue" && member.paymentStatus !== "pending";
      const allowed = statusOk && startOk && endOk && paymentOk;
      
      await setUserAccessGroup(settings, biometricId, allowed);
      console.log(`✅ Synced access group for user ${biometricId}: ${allowed ? "ALLOWED" : "DENIED"}`);
    }
  } catch (error) {
    console.error("Failed to sync access groups:", error);
  }
}

// Log scan event (for attendance page display)
function logScan(biometricId: string, member: any | null, allowed: boolean, reason: string): void {
  const log: ScanLog = {
    biometricId: String(biometricId), // Ensure it's always a string
    memberId: member?.id ?? null,
    memberName: member?.name ?? null,
    timestamp: new Date(),
    allowed,
    reason,
  };
  
  console.log(`📝 Logging scan: User ID="${log.biometricId}", Member="${log.memberName || 'N/A'}", Allowed=${allowed}, Reason=${reason}`);
  
  scanLogs.push(log);
  // Keep last 1000 logs
  if (scanLogs.length > 1000) {
    scanLogs.shift();
  }
}

// Get scan logs (for API)
export function getScanLogs(): ScanLog[] {
  return [...scanLogs].reverse(); // Most recent first
}

// Process a scan event
export async function processScan(biometricId: string | number, settings: BiometricSettings): Promise<void> {
  // Normalize to string for consistent comparison (outside try so catch can use it)
  const normalizedId = String(biometricId).trim();
  
  try {
    console.log(`🔍 Processing scan for biometric ID: "${normalizedId}" (original: ${biometricId}, type: ${typeof biometricId})`);
    
    // Find member by biometric ID
    const allMembers = await storage.listMembers();
    console.log(`📋 Checking ${allMembers.length} members for biometric ID "${normalizedId}"`);
    
    // Log all members with biometric IDs for debugging
    const membersWithBio = allMembers.filter((m: any) => (m as any).biometricId);
    console.log(`📊 Members with biometric IDs: ${membersWithBio.length}`);
    membersWithBio.forEach((m: any) => {
      const mBioId = String((m as any).biometricId).trim();
      console.log(`  - Member "${m.name}": biometricId="${mBioId}" (type: ${typeof (m as any).biometricId})`);
    });
    
    const member = allMembers.find((m: any) => {
      const mBioId = (m as any).biometricId;
      if (!mBioId) return false;
      
      // Normalize both to strings for comparison
      const normalizedMemberId = String(mBioId).trim();
      const match = normalizedMemberId === normalizedId || normalizedMemberId == normalizedId;
      
      if (match) {
        console.log(`  ✅ MATCH FOUND: Member "${m.name}" - biometricId="${normalizedMemberId}" matches scan="${normalizedId}"`);
      }
      return match;
    });
    
    if (!member) {
      console.log(`⚠️ Biometric scan from unknown user: "${normalizedId}"`);
      console.log(`   Available biometric IDs in system: ${membersWithBio.map((m: any) => String((m as any).biometricId)).join(", ") || "NONE"}`);
      logScan(normalizedId, null, false, "unknown_user");
      return;
    }
    
    console.log(`👤 Found member: ${member.name} (ID: ${member.id}, Status: ${member.status})`);
    
    // Check access control (same logic as simulate-scan)
    const now = new Date();
    const startOk = !member.startDate || new Date(member.startDate) <= now;
    const endOk = !member.expiryDate || new Date(member.expiryDate) >= now;
    const statusOk = member.status === "active";
    const paymentOk = member.paymentStatus !== "overdue" && member.paymentStatus !== "pending";
    
    let allowed = false;
    let reason = "allowed";
    
    if (!statusOk) {
      reason = "inactive";
    } else if (!startOk) {
      reason = "not_started";
    } else if (!endOk) {
      reason = "expired";
    } else if (!paymentOk) {
      reason = member.paymentStatus === "pending" ? "payment_pending" : "payment_overdue";
    } else {
      allowed = true;
      reason = "allowed";
    }
    
    if (allowed) {
      // Record attendance
      await storage.createAttendance({
        memberId: member.id,
        checkInTime: now.toISOString(),
        checkOutTime: null,
        latitude: null as any,
        longitude: null as any,
        markedVia: "biometric",
      } as any);
      
      // Unlock door (try Python first, fallback to native)
      const unlockSeconds = parseInt(settings.unlockSeconds || "3", 10);
      try {
        const { unlockDoorPython, isPythonBridgeAvailable } = await import("./biometric-python");
        if (await isPythonBridgeAvailable()) {
          await unlockDoorPython(settings, unlockSeconds);
        } else {
          await unlockDoor(settings, unlockSeconds);
        }
      } catch {
        await unlockDoor(settings, unlockSeconds);
      }
      
      console.log(`✅ Access granted: ${member.name} (${normalizedId})`);
      logScan(normalizedId, member, true, reason);
    } else {
      console.log(`❌ Access denied: ${member.name} (${normalizedId}) - ${reason}`);
      logScan(normalizedId, member, false, reason);
    }
  } catch (error) {
    console.error(`❌ Error processing scan for ${normalizedId}:`, error);
    logScan(normalizedId, null, false, "error");
  }
}

// Poll device for new attendance logs
async function pollDeviceForScans(): Promise<void> {
  if (isPolling) return;
  
  try {
    isPolling = true;
    
    const settings = await storage.getSettings();
    const ip = settings.biometricIp;
    const port = settings.biometricPort || "4370";
    const commKey = settings.biometricCommKey || "0";
    
    if (!ip) {
      isPolling = false;
      return;
    }
    
    // Ensure connected
    if (!deviceConnection || deviceConnection.destroyed) {
      const connected = await connectToDevice({
        ip,
        port,
        commKey,
        unlockSeconds: settings.biometricUnlockSeconds || "3",
        relayType: settings.biometricRelayType || "NO"
      });
      
      if (!connected) {
        isPolling = false;
        return;
      }
    }
    
    // Get new logs
    const logs = await getAttendanceLogs({
      ip,
      port,
      commKey,
      unlockSeconds: settings.biometricUnlockSeconds || "3",
      relayType: settings.biometricRelayType || "NO"
    });
    
    if (logs.length > 0) {
      console.log(`📥 Found ${logs.length} new log(s) from device`);
    }
    
    // Process new logs
    for (const log of logs) {
      // Only process logs newer than last processed
      if (!lastLogTime || log.timestamp > lastLogTime) {
        console.log(`🔄 Processing scan: User ID ${log.userId} at ${log.timestamp}`);
        await processScan(log.userId, {
          ip,
          port,
          commKey,
          unlockSeconds: settings.biometricUnlockSeconds || "3",
          relayType: settings.biometricRelayType || "NO"
        });
        
        if (!lastLogTime || log.timestamp > lastLogTime) {
          lastLogTime = log.timestamp;
        }
      }
    }
  } catch (error) {
    console.error("❌ Error polling device:", error);
  } finally {
    isPolling = false;
  }
}

// Start polling device for scans
export function startBiometricDevicePolling(): void {
  const desktop = process.env.DESKTOP === "1" || process.env.ELECTRON === "1";
  if (!desktop) return;
  
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  // Initial sync of access groups
  (async () => {
    try {
      const settings = await storage.getSettings();
      const ip = settings.biometricIp;
      if (ip) {
        await syncMemberAccessGroups({
          ip,
          port: settings.biometricPort || "4370",
          commKey: settings.biometricCommKey || "0",
          unlockSeconds: settings.biometricUnlockSeconds || "3",
          relayType: settings.biometricRelayType || "NO"
        });
      }
    } catch (err) {
      console.error("Failed to sync access groups on startup:", err);
    }
  })();
  
  // Use native polling only (Python live_capture disabled - causes device hangs)
  console.log("🔄 Starting native polling (every 1 second)...");
  pollDeviceForScans().catch(console.error);
  
  pollingInterval = setInterval(() => {
    pollDeviceForScans().catch(console.error);
  }, 1000);
  
  console.log("✅ Biometric device polling started (every 1 second)");
}

// Stop polling
export function stopBiometricDevicePolling(): void {
  // Stop Python monitor if running
  if (pythonMonitor) {
    pythonMonitor.stop();
    pythonMonitor = null;
  }
  
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  
  if (deviceConnection) {
    deviceConnection.destroy();
    deviceConnection = null;
  }
  
  console.log("🛑 Biometric device polling stopped");
}

// Test connection to device
export async function testDeviceConnection(settings: BiometricSettings): Promise<boolean> {
  return await connectToDevice(settings);
}

