import { getTursoDb } from "./db-turso";
import { getLocalDb } from "./db-local";

export function getDb() {
  const desktop = process.env.DESKTOP === "1" || process.env.ELECTRON === "1";
  const hasTurso = !!process.env.TURSO_DATABASE_URL && !!process.env.TURSO_AUTH_TOKEN;
  if (desktop || !hasTurso) {
    return getLocalDb();
  }
  return getTursoDb();
}


