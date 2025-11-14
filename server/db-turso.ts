import { createClient } from "@libsql/client/web";

let client: ReturnType<typeof createClient> | null = null;
let cachedCredentials: { url: string; token: string } | null = null;

export function getTursoDb(url?: string, authToken?: string) {
  // If credentials provided, use them (for settings-based sync)
  const finalUrl = url || process.env.TURSO_DATABASE_URL?.trim();
  const finalToken = authToken || process.env.TURSO_AUTH_TOKEN?.trim();
  
  // If credentials changed, reset client
  if (cachedCredentials && (cachedCredentials.url !== finalUrl || cachedCredentials.token !== finalToken)) {
    client = null;
    cachedCredentials = null;
  }
  
  if (client && cachedCredentials) return client;
  
  console.log("DB init - URL exists:", !!finalUrl, "Token exists:", !!finalToken);
  if (!finalUrl) {
    console.error("Missing TURSO_DATABASE_URL");
    throw new Error("Missing TURSO_DATABASE_URL environment variable");
  }
  if (!finalToken) {
    console.error("Missing TURSO_AUTH_TOKEN");
    throw new Error("Missing TURSO_AUTH_TOKEN environment variable");
  }
  try {
    client = createClient({ url: finalUrl, authToken: finalToken });
    cachedCredentials = { url: finalUrl, token: finalToken };
    console.log("DB client created successfully");
    return client;
  } catch (error) {
    console.error("Failed to create DB client:", error);
    throw error;
  }
}


