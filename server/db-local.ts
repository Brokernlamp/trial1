import fs from "fs";
import path from "path";
import os from "os";
import initSqlJs from "sql.js";
import { createRequire } from "module";
import { fileURLToPath } from "url";

type SqlArg = string | number | null;
type ExecuteInput = string | { sql: string; args?: SqlArg[] };

interface ExecuteResult {
  rows: any[];
  rowsAffected?: number;
}

interface DbLike {
  execute(input: ExecuteInput): Promise<ExecuteResult>;
}

let dbInstancePromise: Promise<DbLike> | null = null;

function getAppDataDir(): string {
  const base = process.env.GYM_APPDATA_DIR || path.join(os.homedir(), ".gymadmindashboard");
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
}

async function createWasmDb(): Promise<DbLike> {
  // Locate wasm in node_modules/sql.js/dist (ESM-safe)
  const req = createRequire(import.meta.url);
  const distDir = path.dirname(req.resolve("sql.js/dist/sql-wasm.js"));
  const wasmPath = path.join(distDir, "sql-wasm.wasm");

  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  const dataDir = getAppDataDir();
  const dbFile = path.join(dataDir, "data.db");
  let db: any;
  if (fs.existsSync(dbFile)) {
    try {
      const fileBuffer = fs.readFileSync(dbFile);
      db = new SQL.Database(new Uint8Array(fileBuffer));
      // Verify it's a valid database by running a simple query
      db.exec("PRAGMA user_version;");
    } catch (error: any) {
      // Database file is corrupted - backup and recreate
      console.error("❌ Database file is corrupted, recreating...", error?.message);
      const backupFile = `${dbFile}.corrupted.${Date.now()}`;
      try {
        fs.copyFileSync(dbFile, backupFile);
        console.log(`📦 Backed up corrupted database to: ${backupFile}`);
      } catch (backupErr) {
        console.error("Failed to backup corrupted database:", backupErr);
      }
      // Delete corrupted file and create new one
      fs.unlinkSync(dbFile);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Ensure schema
  db.exec("PRAGMA foreign_keys = ON;");
  const hasUserVersion = db.exec("PRAGMA user_version;");
  const version = hasUserVersion?.[0]?.values?.[0]?.[0] || 0;
  if (!version) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirnameSafe = path.dirname(__filename);
    const rootDir = path.resolve(__dirnameSafe, "..");
    const candidates = [
      // When packaged with electron-builder
      process.resourcesPath ? path.join(process.resourcesPath, "DB_TURSO_SCHEMA.sql") : "",
      // Project root (run from source)
      path.join(rootDir, "DB_TURSO_SCHEMA.sql"),
      // CWD fallback
      path.join(process.cwd(), "DB_TURSO_SCHEMA.sql"),
    ].filter(Boolean) as string[];
    const filePath = candidates.find((p) => fs.existsSync(p));
    if (!filePath) {
      throw new Error("DB_TURSO_SCHEMA.sql not found in expected locations");
    }
    const sql = fs.readFileSync(filePath, "utf8");
    db.exec(sql);
    db.exec("PRAGMA user_version = 1;");
    // Persist initial DB
    const data = db.export();
    fs.writeFileSync(dbFile, Buffer.from(data));
  }

  function persist() {
    const data = db.export();
    fs.writeFileSync(dbFile, Buffer.from(data));
  }

  const adapter: DbLike = {
    async execute(input: ExecuteInput): Promise<ExecuteResult> {
      const sql = typeof input === "string" ? input : input.sql;
      const args = typeof input === "string" ? [] : input.args ?? [];
      const trimmed = sql.trim().toUpperCase();

      if (trimmed.startsWith("SELECT")) {
        const stmt = db.prepare(sql);
        stmt.bind(args);
        const rows: any[] = [];
        while (stmt.step()) {
          const row = stmt.getAsObject();
          rows.push(row);
        }
        stmt.free();
        return { rows };
      }

      const stmt = db.prepare(sql);
      stmt.bind(args);
      // Step once for run; sql.js executes on step and we don't need row results
      stmt.step();
      stmt.free();
      persist();
      return { rows: [], rowsAffected: undefined };
    },
  };

  return adapter;
}

export function getLocalDb(): DbLike {
  if (!dbInstancePromise) {
    dbInstancePromise = createWasmDb();
  }
  // Return a proxy that awaits the underlying instance for each call
  const proxy: DbLike = {
    async execute(input: ExecuteInput) {
      const inst = await dbInstancePromise!;
      return inst.execute(input);
    },
  };
  return proxy;
}

export type { DbLike, ExecuteResult };


