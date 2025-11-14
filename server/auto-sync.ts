import { getTursoDb } from "./db-turso";
import { getLocalDb } from "./db-local";
import { storage } from "./storage";

let isSyncing = false;
let lastSyncTimestamp: Record<string, number> = {};
let syncInterval: NodeJS.Timeout | null = null;
let backgroundSyncEnabled = false;
// Ensure local (SQLite) schema has required columns
async function ensureLocalSchemaUpgrades(local: ReturnType<typeof getLocalDb>): Promise<void> {
  const addColIfMissing = async (table: string, col: string, type: string) => {
    try {
      const info = await local.execute({ sql: `PRAGMA table_info(${table})`, args: [] });
      const has = (info.rows as any[]).some((r: any) => r.name === col || r[1] === col);
      if (!has) {
        await local.execute({ sql: `ALTER TABLE ${table} ADD COLUMN ${col} ${type}` });
      }
    } catch (e) {
      console.error(`Failed to ensure column ${table}.${col} locally:`, e);
    }
  };
  const coreTables = ["members", "payments", "attendance", "equipment", "plans"];
  for (const t of coreTables) {
    await addColIfMissing(t, "updated_at", "TEXT");
    await addColIfMissing(t, "deleted_at", "TEXT");
  }
  await addColIfMissing("members", "biometric_id", "TEXT");
}
// Ensure Turso (remote) schema has required columns
async function ensureTursoSchemaUpgrades(turso: ReturnType<typeof getTursoDb>): Promise<void> {
  const addColIfMissing = async (table: string, col: string, type: string) => {
    try {
      const info = await turso.execute({ sql: `PRAGMA table_info(${table})`, args: [] });
      const has = (info.rows as any[]).some((r) => (r as any).name === col || (r as any)[1] === col);
      if (!has) {
        await turso.execute({ sql: `ALTER TABLE ${table} ADD COLUMN ${col} ${type}`, args: [] });
      }
    } catch (e) {
      console.error(`Failed to ensure column ${table}.${col} on Turso:`, e);
    }
  };
  const coreTables = ["members", "payments", "attendance", "equipment", "plans"];
  for (const t of coreTables) {
    await addColIfMissing(t, "updated_at", "TEXT");
    await addColIfMissing(t, "deleted_at", "TEXT");
  }
  // Members requires biometric_id
  await addColIfMissing("members", "biometric_id", "TEXT");
}


// Sync a single table row to Turso
async function syncRowToTurso(
  turso: ReturnType<typeof getTursoDb>,
  table: string,
  row: any
): Promise<void> {
  try {
    const cols = Object.keys(row);
    const placeholders = cols.map(() => "?").join(",");
    
    // Check if row exists
    const check = await turso.execute({ 
      sql: `SELECT id FROM ${table} WHERE id = ?`, 
      args: [row.id] 
    });
    
    if ((check.rows as any[]).length > 0) {
      // Update existing
      const updatable = cols.filter(c => c !== "id");
      const updates = updatable.map(c => `${c} = ?`).join(",");
      const values = updatable.map(c => row[c]);
      await turso.execute({ 
        sql: `UPDATE ${table} SET ${updates} WHERE id = ?`, 
        args: [...values, row.id] 
      });
    } else {
      // Insert new
      await turso.execute({ 
        sql: `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`, 
        args: cols.map((c) => row[c]) 
      });
    }
  } catch (error) {
    console.error(`Failed to sync ${table} row ${row.id} to Turso:`, error);
    throw error;
  }
}

// Sync a single table row from Turso to local
async function syncRowFromTurso(
  local: ReturnType<typeof getLocalDb>,
  table: string,
  row: any
): Promise<void> {
  try {
    const cols = Object.keys(row);
    const placeholders = cols.map(() => "?").join(",");
    
    // Check if row exists
    const check = await local.execute({ 
      sql: `SELECT id FROM ${table} WHERE id = ?`, 
      args: [row.id] 
    });
    
    if ((check.rows as any[]).length > 0) {
      // Update existing
      const updatable = cols.filter(c => c !== "id");
      const updates = updatable.map(c => `${c} = ?`).join(",");
      const values = updatable.map(c => row[c]);
      await local.execute({ 
        sql: `UPDATE ${table} SET ${updates} WHERE id = ?`, 
        args: [...values, row.id] 
      });
    } else {
      // Insert new
      await local.execute({ 
        sql: `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`, 
        args: cols.map((c) => row[c]) 
      });
    }
  } catch (error) {
    console.error(`Failed to sync ${table} row ${row.id} from Turso:`, error);
    throw error;
  }
}

// Sync a single record from local to Turso (called after local changes)
export async function syncToTurso(_table: string, _recordId: string): Promise<void> {
  // Offline-only: no-op
  return;
}

// Pull all data from Turso to local
export async function syncPullFromTurso(): Promise<Record<string, number>> {
  try {
    const settings = await storage.getSettings();
    if (!settings.tursoDatabaseUrl || !settings.tursoAuthToken) {
      throw new Error("Turso credentials not configured");
    }

    const turso = getTursoDb(settings.tursoDatabaseUrl, settings.tursoAuthToken);
    const local = getLocalDb();
    
    await ensureLocalSchemaUpgrades(local);
    await ensureTursoSchemaUpgrades(turso);

    const tables = ["members", "payments", "attendance", "equipment", "plans"];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      try {
        const tursoRows = await turso.execute({ sql: `SELECT * FROM ${table} WHERE deleted_at IS NULL OR deleted_at = ''`, args: [] });
        const rows = tursoRows.rows as any[];
        
        for (const row of rows) {
          await syncRowFromTurso(local, table, row);
        }
        
        counts[table] = rows.length;
      } catch (err) {
        console.error(`Failed to sync ${table} from Turso:`, err);
        counts[table] = 0;
      }
    }

    return { counts };
  } catch (error) {
    console.error("Sync pull failed:", error);
    throw error;
  }
}

// Push all data from local to Turso
export async function syncPushToTurso(): Promise<Record<string, number>> {
  try {
    const settings = await storage.getSettings();
    if (!settings.tursoDatabaseUrl || !settings.tursoAuthToken) {
      throw new Error("Turso credentials not configured");
    }

    const turso = getTursoDb(settings.tursoDatabaseUrl, settings.tursoAuthToken);
    const local = getLocalDb();
    
    await ensureLocalSchemaUpgrades(local);
    await ensureTursoSchemaUpgrades(turso);

    const tables = ["members", "payments", "attendance", "equipment", "plans"];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      try {
        const localRows = await local.execute({ sql: `SELECT * FROM ${table} WHERE deleted_at IS NULL OR deleted_at = ''`, args: [] });
        const rows = localRows.rows as any[];
        
        for (const row of rows) {
          await syncRowToTurso(turso, table, row);
        }
        
        counts[table] = rows.length;
      } catch (err) {
        console.error(`Failed to sync ${table} to Turso:`, err);
        counts[table] = 0;
      }
    }

    return { counts };
  } catch (error) {
    console.error("Sync push failed:", error);
    throw error;
  }
}

// Full bidirectional sync (merge - Turso wins on conflicts)
export async function syncFullBidirectional(): Promise<Record<string, number>> {
  try {
    const settings = await storage.getSettings();
    if (!settings.tursoDatabaseUrl || !settings.tursoAuthToken) {
      throw new Error("Turso credentials not configured");
    }

    const turso = getTursoDb(settings.tursoDatabaseUrl, settings.tursoAuthToken);
    const local = getLocalDb();
    
    await ensureLocalSchemaUpgrades(local);
    await ensureTursoSchemaUpgrades(turso);

    const tables = ["members", "payments", "attendance", "equipment", "plans"];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      try {
        // Get all from both
        const tursoRows = await turso.execute({ sql: `SELECT * FROM ${table} WHERE deleted_at IS NULL OR deleted_at = ''`, args: [] });
        const localRows = await local.execute({ sql: `SELECT * FROM ${table} WHERE deleted_at IS NULL OR deleted_at = ''`, args: [] });
        
        const tursoData = new Map((tursoRows.rows as any[]).map((r: any) => [r.id, r]));
        const localData = new Map((localRows.rows as any[]).map((r: any) => [r.id, r]));
        
        let synced = 0;
        
        // Sync Turso → Local (Turso wins on conflicts)
        for (const [id, row] of tursoData) {
          await syncRowFromTurso(local, table, row);
          synced++;
        }
        
        // Sync Local → Turso (only if not in Turso)
        for (const [id, row] of localData) {
          if (!tursoData.has(id)) {
            await syncRowToTurso(turso, table, row);
            synced++;
          }
        }
        
        counts[table] = synced;
      } catch (err) {
        console.error(`Failed to sync ${table}:`, err);
        counts[table] = 0;
      }
    }

    return { counts };
  } catch (error) {
    console.error("Full sync failed:", error);
    throw error;
  }
}

// Background sync: Check Turso for changes and sync to local
async function backgroundSyncFromTurso(): Promise<void> {
  // Offline-only: no-op
  return;
}

// Start background sync service (polls Turso every 5 seconds)
export function startBackgroundSync(): void {
  // Offline-only: disabled
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
  backgroundSyncEnabled = false;
  console.log("Background sync disabled (offline-only)");
}

// Stop background sync service
export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  backgroundSyncEnabled = false;
  console.log("⏹️ Background sync service stopped");
}

