import express from "express";
import serverless from "serverless-http";
import { registerRoutes } from "../../server/routes";

let cachedHandler: any;

async function getHandler() {
	if (cachedHandler) return cachedHandler;

	const app = express();
	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));

	// CORS for frontend
	app.use((req, res, next) => {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
		res.header("Access-Control-Allow-Headers", "Content-Type");
		if (req.method === "OPTIONS") return res.status(200).end();
		next();
	});

	// Error handler
	app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
		console.error("API Error:", err);
		const status = err.status || err.statusCode || 500;
		const message = err.message || "Internal server error";
		res.status(status).json({ message, error: err.toString() });
	});

	// Register routes
	try {
		await registerRoutes(app);
	} catch (error) {
		console.error("Failed to register routes:", error);
		throw error;
	}

	cachedHandler = serverless(app, {
		request: (request, event) => {
			// Fix path for Netlify - strip /api prefix that netlify.toml redirects add
			if (event.path) {
				const path = event.path.replace(/^\/\.netlify\/functions\/server/, "");
				request.url = path + (event.rawQuery ? `?${event.rawQuery}` : "");
			}
		},
	});
	return cachedHandler;
}

export const handler = async (event: any, context: any) => {
	try {
		console.log("Function invoked:", event.path, event.httpMethod);
		const h = await getHandler();
		const result = await h(event, context);
		console.log("Function result:", result?.statusCode);
		return result;
	} catch (error: any) {
		console.error("Function crash:", error);
		return {
			statusCode: 500,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ 
				message: error?.message ?? "Internal server error",
				stack: process.env.NODE_ENV === "development" ? error?.stack : undefined
			}),
		};
	}
};
