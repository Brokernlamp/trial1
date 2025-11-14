// Use the Web adapter to avoid native binaries on serverless (Netlify)
import { createClient } from "@libsql/client/web";

let client: ReturnType<typeof createClient> | null = null;

export function getDb() {
	if (client) return client;
	const url = process.env.TURSO_DATABASE_URL?.trim();
	const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
	console.log("DB init - URL exists:", !!url, "Token exists:", !!authToken);
	if (!url) {
		console.error("Missing TURSO_DATABASE_URL");
		throw new Error("Missing TURSO_DATABASE_URL environment variable");
	}
	if (!authToken) {
		console.error("Missing TURSO_AUTH_TOKEN");
		throw new Error("Missing TURSO_AUTH_TOKEN environment variable");
	}
	try {
		client = createClient({ url, authToken });
		console.log("DB client created successfully");
		return client;
	} catch (error) {
		console.error("Failed to create DB client:", error);
		throw error;
	}
}
