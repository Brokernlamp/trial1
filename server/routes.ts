import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { insertMemberSchema, insertPaymentSchema, insertEquipmentSchema, insertAttendanceSchema, settingsSchema, insertPlanSchema } from "@shared/schema";
import { sendWhatsAppMessage, isWAConnected, currentQR, forceReconnect, disconnectWhatsApp, sendWhatsAppDocument } from "./whatsapp";
import { generateInvoicePdfBuffer } from "./invoice";
import { calculateDaysLeft, formatPhoneNumber } from "./whatsapp-handlers";
import { getDb } from "./db-factory";
import { getTursoDb } from "./db-turso";
import { getLocalDb } from "./db-local";
import { randomUUID } from "crypto";
import { syncMemberToGoogleSheets, removeMemberFromGoogleSheets } from "./google-sheets";

export async function registerRoutes(app: Express): Promise<void> {
	// helper
	const jsonOk = (res: Response, body: unknown, status = 200) => res.status(status).json(body);

	// Coercion helpers for API inputs (accept ISO strings or Date/null)
	const toDateOrNull = (v: unknown): Date | null | undefined => {
		if (v === undefined) return undefined;
		if (v === null || v === "") return null;
		if (v instanceof Date) return v;
		if (typeof v === "string") {
			const d = new Date(v);
			return isNaN(d.getTime()) ? null : d;
		}
		return null;
	};

	// Simple test endpoint
	app.get("/api/test", (_req: Request, res: Response) => {
		return jsonOk(res, { message: "API is working!", timestamp: new Date().toISOString() });
	});

	// members
app.get("/api/members", async (_req: Request, res: Response, next: NextFunction) => {
		try {
			console.log("GET /api/members called");
			const items = await storage.listMembers();
			console.log("GET /api/members returning", items.length, "items");
			return jsonOk(res, items);
		} catch (err) {
			console.error("GET /api/members error:", err);
			next(err);
		}
	});

app.post("/api/members", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body ?? {};
        // Coerce date-like fields from strings
        body.startDate = toDateOrNull(body.startDate);
        body.expiryDate = toDateOrNull(body.expiryDate);
        body.lastCheckIn = toDateOrNull(body.lastCheckIn);

        // Normalize optional empty strings to null
        const toNullIfEmpty = (v: unknown) => (v === "" ? null : v);
        body.planId = toNullIfEmpty(body.planId);
        body.planName = toNullIfEmpty(body.planName);
        body.emergencyContact = toNullIfEmpty(body.emergencyContact);
        body.trainerId = toNullIfEmpty(body.trainerId);
        body.notes = toNullIfEmpty(body.notes);
        body.gender = toNullIfEmpty(body.gender);

        // Validate
        const data = insertMemberSchema.parse(body);
        // Normalize dates to ISO strings for SQLite TEXT columns
        const normalized = {
            ...data,
            startDate: data.startDate ? new Date(data.startDate as any).toISOString() : null,
            expiryDate: data.expiryDate ? new Date(data.expiryDate as any).toISOString() : null,
            lastCheckIn: (data as any).lastCheckIn ? new Date((data as any).lastCheckIn).toISOString() : null,
        } as any;

        // Create
        const created = await storage.createMember(normalized);

        // Sync to Google Sheets (non-blocking)
        syncMemberToGoogleSheets(created).catch((err) => {
            console.error("Failed to sync member to Google Sheets:", err);
        });

        // Fire-and-forget invoice PDF generation + WhatsApp delivery
        (async () => {
            try {
                const phone = created.phone;
                const formattedPhone = formatPhoneNumber(phone);
                if (!formattedPhone) return;

                // Try to fetch plan for price/duration
                const db = getDb();
                let planRow: any = null;
                if ((created as any).planId) {
                    const result = await db.execute({ sql: `SELECT id, name, duration, price FROM plans WHERE id = ?`, args: [(created as any).planId] });
                    planRow = (result.rows as any[])[0] ?? null;
                }
                const planName = (created as any).planName || planRow?.name || "Membership";
                const durationDays = planRow?.duration ?? null;
                const price = planRow?.price ? Number(planRow.price) : 0;

                const discountPercent = Number((req.body?.discountPercent as any) ?? 0) || 0;
                const discountAmount = Number((req.body?.discountAmount as any) ?? 0) || 0;

                const pdf = await generateInvoicePdfBuffer({
                    invoiceNumber: `${Date.now()}`,
                    invoiceDateISO: new Date().toISOString(),
                    member: { name: created.name, email: created.email, phone: created.phone },
                    plan: {
                        name: planName,
                        durationDays,
                        startDateISO: (created as any).startDate ? new Date((created as any).startDate).toISOString() : null,
                        expiryDateISO: (created as any).expiryDate ? new Date((created as any).expiryDate).toISOString() : null,
                        price,
                    },
                    discountPercent,
                    discountAmount,
                    business: {
                        name: process.env.BUSINESS_NAME || "Fitness Hub",
                        address: process.env.BUSINESS_ADDRESS || "Pune",
                        phone: process.env.BUSINESS_PHONE || "999999999",
                        email: process.env.BUSINESS_EMAIL || "123@gmail.com",
                        logoPath: process.env.BUSINESS_LOGO_PATH || "logo.jpg",
                        currency: process.env.BUSINESS_CURRENCY || "INR",
                        taxRatePercent: process.env.BUSINESS_TAX_RATE ? Number(process.env.BUSINESS_TAX_RATE) : 0,
                    },
                });

                if (isWAConnected) {
                    await sendWhatsAppDocument(formattedPhone, `Invoice-${created.name}.pdf`, "application/pdf", pdf);
                }
            } catch (e) {
                console.error("Failed to generate/send invoice PDF:", e);
            }
        })();

        return jsonOk(res, created, 201);
    } catch (err: any) {
        // Return helpful errors instead of a generic 500
        if (err?.name === "ZodError") {
            return res.status(400).json({
                message: "Invalid member data",
                issues: err.issues ?? undefined,
            });
        }
        const msg: string = err?.message || "Unknown error";
        if (/constraint|unique|UNIQUE|SQLITE_CONSTRAINT/i.test(msg)) {
            return res.status(409).json({
                message: "Duplicate or constraint violation while creating member",
                error: msg,
            });
        }
        return res.status(500).json({
            message: err?.message || "Failed to create member",
        });
    }
});

app.patch("/api/members/:id", async (req: Request, res: Response) => {
		const body = req.body ?? {};
		body.startDate = toDateOrNull(body.startDate);
		body.expiryDate = toDateOrNull(body.expiryDate);
		body.lastCheckIn = toDateOrNull(body.lastCheckIn);
		const updated = await storage.updateMember(req.params.id, body);
		if (!updated) return res.status(404).json({ message: "Not found" });
		
		// Sync to Google Sheets (non-blocking)
		syncMemberToGoogleSheets(updated).catch((err) => {
			console.error("Failed to sync member to Google Sheets:", err);
		});
		
		return jsonOk(res, updated);
	});

app.delete("/api/members/:id", async (req: Request, res: Response) => {
		// Get member before deleting to get phone number
		const member = await storage.getMember(req.params.id);
		const phone = member?.phone || "";
		
		const ok = await storage.deleteMember(req.params.id);
		if (!ok) return res.status(404).json({ message: "Not found" });
		
		// Remove from Google Sheets (non-blocking)
		if (phone) {
			removeMemberFromGoogleSheets(phone).catch((err) => {
				console.error("Failed to remove member from Google Sheets:", err);
			});
		}
		
		return res.status(204).end();
	});

	// payments
app.get("/api/payments", async (_req: Request, res: Response) => {
		const items = await storage.listPayments();
		return jsonOk(res, items);
	});

app.post("/api/payments", async (req: Request, res: Response, next: NextFunction) => {
		try {
			const body = req.body ?? {};
			body.dueDate = toDateOrNull(body.dueDate);
			body.paidDate = toDateOrNull(body.paidDate);
			const data = insertPaymentSchema.parse(body);
		const created = await storage.createPayment(data);
		return jsonOk(res, created, 201);
		} catch (err) {
			next(err);
		}
	});

app.patch("/api/payments/:id", async (req: Request, res: Response) => {
		const updated = await storage.updatePayment(req.params.id, req.body ?? {});
		if (!updated) return res.status(404).json({ message: "Not found" });
		return jsonOk(res, updated);
	});

app.delete("/api/payments/:id", async (req: Request, res: Response) => {
		const ok = await storage.deletePayment(req.params.id);
		if (!ok) return res.status(404).json({ message: "Not found" });
		return res.status(204).end();
	});

	// member history
app.get("/api/members/:id/history", async (req: Request, res: Response) => {
		try {
			const history = await storage.getMemberHistory(req.params.id);
			return jsonOk(res, history);
		} catch (err: any) {
			return res.status(500).json({ message: err?.message || "Failed to get member history" });
		}
	});

	// invoice download
app.get("/api/members/:id/invoice", async (req: Request, res: Response) => {
		try {
			const member = await storage.getMember(req.params.id);
			if (!member) {
				return res.status(404).json({ message: "Member not found" });
			}

			// Get plan details
			const db = getDb();
			let planRow: any = null;
			if ((member as any).planId) {
				const result = await db.execute({ sql: `SELECT id, name, duration, price FROM plans WHERE id = ?`, args: [(member as any).planId] });
				planRow = (result.rows as any[])[0] ?? null;
			}
			const planName = (member as any).planName || planRow?.name || "Membership";
			const durationDays = planRow?.duration ?? null;
			const price = planRow?.price ? Number(planRow.price) : 0;

			const pdf = await generateInvoicePdfBuffer({
				invoiceNumber: `INV-${Date.now()}-${member.id.slice(0, 6)}`,
				invoiceDateISO: new Date().toISOString(),
				member: { name: member.name, email: member.email, phone: member.phone },
				plan: {
					name: planName,
					durationDays,
					startDateISO: (member as any).startDate ? new Date((member as any).startDate).toISOString() : null,
					expiryDateISO: (member as any).expiryDate ? new Date((member as any).expiryDate).toISOString() : null,
					price,
				},
				business: {
					name: process.env.BUSINESS_NAME || "Fitness Hub",
					address: process.env.BUSINESS_ADDRESS || "Pune",
					phone: process.env.BUSINESS_PHONE || "999999999",
					email: process.env.BUSINESS_EMAIL || "123@gmail.com",
					logoPath: process.env.BUSINESS_LOGO_PATH || "logo.jpg",
					currency: process.env.BUSINESS_CURRENCY || "INR",
					taxRatePercent: process.env.BUSINESS_TAX_RATE ? Number(process.env.BUSINESS_TAX_RATE) : 0,
				},
			});

			res.setHeader("Content-Type", "application/pdf");
			res.setHeader("Content-Disposition", `attachment; filename="Invoice-${member.name}-${Date.now()}.pdf"`);
			res.send(pdf);
		} catch (err: any) {
			return res.status(500).json({ message: err?.message || "Failed to generate invoice" });
		}
	});

	// equipment
app.get("/api/equipment", async (_req: Request, res: Response) => {
		const items = await storage.listEquipment();
		return jsonOk(res, items);
	});

app.post("/api/equipment", async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = insertEquipmentSchema.parse(req.body);
		const created = await storage.createEquipment(data);
		return jsonOk(res, created, 201);
		} catch (err) {
			next(err);
		}
	});

app.patch("/api/equipment/:id", async (req: Request, res: Response) => {
		const updated = await storage.updateEquipment(req.params.id, req.body ?? {});
		if (!updated) return res.status(404).json({ message: "Not found" });
		return jsonOk(res, updated);
	});

app.delete("/api/equipment/:id", async (req: Request, res: Response) => {
		const ok = await storage.deleteEquipment(req.params.id);
		if (!ok) return res.status(404).json({ message: "Not found" });
		return res.status(204).end();
	});

	// attendance
app.get("/api/attendance", async (_req: Request, res: Response) => {
		const items = await storage.listAttendance();
		return jsonOk(res, items);
	});

app.post("/api/attendance", async (req: Request, res: Response, next: NextFunction) => {
		try {
			const body = req.body ?? {};
			// Ensure memberId is provided
			if (!body.memberId) {
				return res.status(400).json({ message: "memberId is required" });
			}
			// Ensure checkInTime is set (default to now if not provided)
			if (!body.checkInTime) {
				body.checkInTime = new Date().toISOString();
			} else {
				const checkInDate = toDateOrNull(body.checkInTime);
				body.checkInTime = checkInDate ? checkInDate.toISOString() : new Date().toISOString();
			}
			// Handle checkOutTime (can be null)
			if (body.checkOutTime !== undefined) {
				const checkOutDate = toDateOrNull(body.checkOutTime);
				body.checkOutTime = checkOutDate ? checkOutDate.toISOString() : null;
			}
			// Parse with schema (this will coerce dates and validate)
			const parsed = insertAttendanceSchema.parse(body);
			// Convert Date objects back to ISO strings for storage layer
			const data: any = {
				...parsed,
				checkInTime: parsed.checkInTime instanceof Date ? parsed.checkInTime.toISOString() : (parsed.checkInTime || new Date().toISOString()),
				checkOutTime: parsed.checkOutTime instanceof Date ? parsed.checkOutTime.toISOString() : (parsed.checkOutTime ?? null),
			};
			const created = await storage.createAttendance(data);
			return jsonOk(res, created, 201);
		} catch (err: any) {
			console.error("Attendance creation error:", err);
			// Provide better error messages
			if (err instanceof Error) {
				if (err.message.includes("member_id") || err.message.includes("memberId")) {
					return res.status(400).json({ message: "Invalid member ID" });
				}
				if (err.message.includes("FOREIGN KEY")) {
					return res.status(400).json({ message: "Member not found" });
				}
			}
			next(err);
		}
	});

app.patch("/api/attendance/:id", async (req: Request, res: Response) => {
		const updated = await storage.updateAttendance(req.params.id, req.body ?? {});
		if (!updated) return res.status(404).json({ message: "Not found" });
		return jsonOk(res, updated);
	});

app.delete("/api/attendance/:id", async (req: Request, res: Response) => {
		const ok = await storage.deleteAttendance(req.params.id);
		if (!ok) return res.status(404).json({ message: "Not found" });
		return res.status(204).end();
	});

	// settings
	app.get("/api/settings", async (_req: Request, res: Response) => {
		try {
			const settings = await storage.getSettings();
			return jsonOk(res, settings);
		} catch (err) {
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to get settings" });
		}
	});

	app.post("/api/settings", async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = settingsSchema.parse(req.body);
			const updated = await storage.updateSettings(data);
			return jsonOk(res, updated);
		} catch (err) {
			next(err);
		}
	});

	// member lookup by login code (for user attendance)
	app.get("/api/members/login/:code", async (req: Request, res: Response) => {
		try {
			const member = await storage.getMemberByLoginCode(req.params.code);
			if (!member) {
				return res.status(404).json({ message: "Member not found" });
			}
			return jsonOk(res, member);
		} catch (err) {
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to find member" });
		}
	});

	// plans
	app.get("/api/plans", async (_req: Request, res: Response) => {
		const items = await storage.listPlans();
		return jsonOk(res, items);
	});

	app.get("/api/plans/:id", async (req: Request, res: Response) => {
		const plan = await storage.getPlan(req.params.id);
		if (!plan) return res.status(404).json({ message: "Not found" });
		return jsonOk(res, plan);
	});

	app.post("/api/plans", async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = insertPlanSchema.parse(req.body);
			const created = await storage.createPlan(data);
			return jsonOk(res, created, 201);
		} catch (err) {
			next(err);
		}
	});

	app.patch("/api/plans/:id", async (req: Request, res: Response, next: NextFunction) => {
		try {
			const updated = await storage.updatePlan(req.params.id, req.body ?? {});
			if (!updated) return res.status(404).json({ message: "Not found" });
			return jsonOk(res, updated);
		} catch (err) {
			next(err);
		}
	});

	app.delete("/api/plans/:id", async (req: Request, res: Response) => {
		const ok = await storage.deletePlan(req.params.id);
		if (!ok) return res.status(404).json({ message: "Not found" });
		return res.status(204).end();
	});


	// health: verify DB connectivity quickly
	app.get("/api/health", async (_req: Request, res: Response) => {
		try {
			const [members, payments, attendance] = await Promise.all([
				storage.listMembers(),
				storage.listPayments(),
				storage.listAttendance(),
			]);
			return jsonOk(res, {
				ok: true,
				db: "turso",
				counts: {
					members: members.length,
					payments: payments.length,
					attendance: attendance.length,
				},
			});
		} catch (e: any) {
			return res.status(500).json({ ok: false, message: e?.message ?? "DB error" });
		}
	});

	// WhatsApp endpoints
  app.post("/api/whatsapp/send-invoices-today", async (_req: Request, res: Response) => {
    try {
      if (!isWAConnected) {
        return res.status(400).json({ message: "WhatsApp not connected" });
      }
      const db = getDb();
      // Members whose start_date is today (local date)
      const result = await db.execute({
        sql: `SELECT id, name, email, phone, plan_id as planId, plan_name as planName, start_date as startDate, expiry_date as expiryDate
              FROM members
              WHERE date(start_date) = date('now','localtime')`,
        args: [],
      });
      const membersToday = (result.rows as any[]) || [];

      let sent = 0;
      let failed = 0;
      for (const m of membersToday) {
        try {
          const formattedPhone = formatPhoneNumber(m.phone);
          if (!formattedPhone) { failed++; continue; }

          let planRow: any = null;
          if (m.planId) {
            const p = await db.execute({ sql: `SELECT id, name, duration, price FROM plans WHERE id = ?`, args: [m.planId] });
            planRow = (p.rows as any[])[0] ?? null;
          }
          const pdf = await generateInvoicePdfBuffer({
            invoiceNumber: `${Date.now()}-${m.id.slice(0,6)}`,
            invoiceDateISO: new Date().toISOString(),
            member: { name: m.name, email: m.email, phone: m.phone },
            plan: {
              name: m.planName || planRow?.name || "Membership",
              durationDays: planRow?.duration ?? null,
              startDateISO: m.startDate ? new Date(m.startDate).toISOString() : null,
              expiryDateISO: m.expiryDate ? new Date(m.expiryDate).toISOString() : null,
              price: planRow?.price ? Number(planRow.price) : 0,
            },
            business: {
              name: process.env.BUSINESS_NAME || "Fitness Hub",
              address: process.env.BUSINESS_ADDRESS || "Pune",
              phone: process.env.BUSINESS_PHONE || "999999999",
              email: process.env.BUSINESS_EMAIL || "123@gmail.com",
              logoPath: process.env.BUSINESS_LOGO_PATH || "logo.jpg",
              currency: process.env.BUSINESS_CURRENCY || "INR",
              taxRatePercent: process.env.BUSINESS_TAX_RATE ? Number(process.env.BUSINESS_TAX_RATE) : 0,
            },
          });
          const r = await sendWhatsAppDocument(formattedPhone, `Invoice-${m.name}.pdf`, "application/pdf", pdf);
          if (r.success) sent++; else failed++;
          await new Promise(r => setTimeout(r, 500));
        } catch {
          failed++;
        }
      }
      return jsonOk(res, { success: true, count: membersToday.length, sent, failed });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to send invoices" });
    }
  });

  // Sync endpoints - check if sync is enabled
  app.post("/api/sync/pull", async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      const hasTurso = !!(settings.tursoDatabaseUrl && settings.tursoAuthToken);
      if (!hasTurso) {
        return res.status(400).json({ message: "Sync not configured. Please add Turso credentials in Settings." });
      }
      // Import sync function dynamically
      const { syncPullFromTurso } = await import("./auto-sync");
      const result = await syncPullFromTurso();
      return jsonOk(res, result);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Sync failed" });
    }
  });

  // Sync: push from local to Turso (desktop)
  app.post("/api/sync/push", async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      const hasTurso = !!(settings.tursoDatabaseUrl && settings.tursoAuthToken);
      if (!hasTurso) {
        return res.status(400).json({ message: "Sync not configured. Please add Turso credentials in Settings." });
      }
      const { syncPushToTurso } = await import("./auto-sync");
      const result = await syncPushToTurso();
      return jsonOk(res, result);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Sync failed" });
    }
  });

  // Sync: bidirectional sync (merge strategy - Turso wins on conflicts)
  app.post("/api/sync/full", async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getSettings();
      const hasTurso = !!(settings.tursoDatabaseUrl && settings.tursoAuthToken);
      if (!hasTurso) {
        return res.status(400).json({ message: "Sync not configured. Please add Turso credentials in Settings." });
      }
      const { syncFullBidirectional } = await import("./auto-sync");
      const result = await syncFullBidirectional();
      return jsonOk(res, result);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Sync failed" });
    }
  });
	app.post("/api/whatsapp/send-bulk", async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { template, memberIds, allMembers } = req.body;

			if (!template || typeof template !== "string") {
				return res.status(400).json({ message: "Template is required and must be a string" });
			}

			// Get all members from DB
			const allMembersList = await storage.listMembers();

			// Filter: only members with paymentStatus = "pending" or "overdue" (unless allMembers is true)
			let filteredMembers = allMembersList;
			
			if (!allMembers) {
				filteredMembers = allMembersList.filter(
					(member) => member.paymentStatus === "pending" || member.paymentStatus === "overdue"
				);
			}

			// If memberIds provided, filter to only those members
			if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
				filteredMembers = filteredMembers.filter((member) => memberIds.includes(member.id));
			}

			const results: Array<{ memberId: string; phone: string; status: string }> = [];
			const db = getDb();

			// Process each member
			for (const member of filteredMembers) {
				try {
					// Format phone (remove non-digits)
					const formattedPhone = formatPhoneNumber(member.phone);

					if (!formattedPhone) {
						results.push({
							memberId: member.id,
							phone: member.phone,
							status: "failed - invalid phone",
						});
						// Log to database
						await db.execute({
							sql: `INSERT INTO whatsapp_logs (id, member_id, phone, message, status, sent_at, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
							args: [
								randomUUID(),
								member.id,
								member.phone,
								template,
								"failed",
								new Date().toISOString(),
								"Invalid phone number",
							],
						});
						continue;
					}

					// Calculate days left
					let daysLeft = 0;
					try {
						if (member.expiryDate) {
							daysLeft = calculateDaysLeft(member.expiryDate);
						}
					} catch (err) {
						// If date calculation fails, default to 0
						daysLeft = 0;
					}

					// Replace {name}, {plan}, {daysLeft} in template
					const personalizedMessage = template
						.replace(/{name}/g, member.name || "Member")
						.replace(/{plan}/g, member.planName || "No Plan")
						.replace(/{daysLeft}/g, daysLeft.toString());

					// Send via sendWhatsAppMessage()
					const sendResult = await sendWhatsAppMessage(formattedPhone, personalizedMessage);

					const status = sendResult.success ? "sent" : "failed";

					// Log to whatsapp_logs table
					await db.execute({
						sql: `INSERT INTO whatsapp_logs (id, member_id, phone, message, status, sent_at, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
						args: [
							randomUUID(),
							member.id,
							formattedPhone,
							personalizedMessage,
							status,
							new Date().toISOString(),
							sendResult.error || null,
						],
					});

					results.push({
						memberId: member.id,
						phone: formattedPhone,
						status,
					});

					// 2 second delay between each
					if (filteredMembers.indexOf(member) < filteredMembers.length - 1) {
						await new Promise((resolve) => setTimeout(resolve, 2000));
					}
				} catch (err) {
					const errorMessage = err instanceof Error ? err.message : "Unknown error";
					results.push({
						memberId: member.id,
						phone: member.phone,
						status: `failed - ${errorMessage}`,
					});

					// Log error to database
					try {
						await db.execute({
							sql: `INSERT INTO whatsapp_logs (id, member_id, phone, message, status, sent_at, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
							args: [
								randomUUID(),
								member.id,
								member.phone,
								template,
								"failed",
								new Date().toISOString(),
								errorMessage,
							],
						});
					} catch (logErr) {
						console.error("Failed to log WhatsApp error:", logErr);
					}
				}
			}

			return jsonOk(res, { success: true, results });
		} catch (err) {
			next(err);
		}
	});

	// Send payment reminder to a specific member
	app.post("/api/payments/:id/send-reminder", async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!isWAConnected) {
				return res.status(400).json({ message: "WhatsApp not connected" });
			}

			const payment = await storage.getPayment(req.params.id);
			if (!payment) {
				return res.status(404).json({ message: "Payment not found" });
			}

			const member = await storage.getMember(payment.memberId);
			if (!member) {
				return res.status(404).json({ message: "Member not found" });
			}

			const formattedPhone = formatPhoneNumber(member.phone);
			if (!formattedPhone) {
				return res.status(400).json({ message: "Invalid phone number" });
			}

			// Calculate days left until due date
			let daysLeft = 0;
			if (payment.dueDate) {
				const dueDate = new Date(payment.dueDate);
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				dueDate.setHours(0, 0, 0, 0);
				const diffTime = dueDate.getTime() - today.getTime();
				daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
			}

			// Create reminder message
			const message = `Hi ${member.name}, this is a reminder that your payment of ₹${Number(payment.amount || 0).toLocaleString()} for ${payment.planName || "membership"} is ${payment.status === "overdue" ? "overdue" : "due"}${payment.dueDate ? ` (${daysLeft > 0 ? `in ${daysLeft} days` : daysLeft === 0 ? "today" : `${Math.abs(daysLeft)} days ago`})` : ""}. Please make the payment at your earliest convenience. Thank you!`;

			const sendResult = await sendWhatsAppMessage(formattedPhone, message);

			// Log to database
			const db = getDb();
			await db.execute({
				sql: `INSERT INTO whatsapp_logs (id, member_id, phone, message, status, sent_at, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				args: [
					randomUUID(),
					member.id,
					formattedPhone,
					message,
					sendResult.success ? "sent" : "failed",
					new Date().toISOString(),
					sendResult.error || null,
				],
			});

			if (sendResult.success) {
				return jsonOk(res, { success: true, message: "Reminder sent successfully" });
			} else {
				return res.status(500).json({ message: sendResult.error || "Failed to send reminder" });
			}
		} catch (err) {
			next(err);
		}
	});

	// Biometric settings (stored in settings table)
	app.get("/api/biometric/settings", async (_req: Request, res: Response) => {
		try {
			const s = await storage.getSettings();
			return jsonOk(res, {
				ip: s.biometricIp || "",
				port: s.biometricPort || "4370",
				commKey: s.biometricCommKey || "",
				unlockSeconds: s.biometricUnlockSeconds || "3",
				relayType: s.biometricRelayType || "NO",
			});
		} catch (err) {
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to get biometric settings" });
		}
	});

	app.post("/api/biometric/test-connection", async (_req: Request, res: Response) => {
		try {
			const s = await storage.getSettings();
			const ip = s.biometricIp || "";
			const port = s.biometricPort || "4370";
			const commKey = s.biometricCommKey || "0";
			
			if (!ip) return res.status(400).json({ connected: false, error: "IP address not configured" });
			
			// Validate IP format
			const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
			if (!ipRegex.test(ip)) {
				return res.status(400).json({ connected: false, error: "Invalid IP address format" });
			}
			
			// Try Python bridge first, fallback to native
			let connected = false;
			try {
				const { testConnectionPython, unlockDoorPython, isPythonBridgeAvailable } = await import("./biometric-python");
				if (await isPythonBridgeAvailable()) {
					connected = await testConnectionPython({
						ip,
						port,
						commKey,
						unlockSeconds: s.biometricUnlockSeconds || "3",
						relayType: s.biometricRelayType || "NO"
					});
					if (connected) {
						// Pulse relay via Python
						await unlockDoorPython({
							ip,
							port,
							commKey,
							unlockSeconds: s.biometricUnlockSeconds || "3",
							relayType: s.biometricRelayType || "NO"
						}, 1);
					}
				}
			} catch (pyErr) {
				console.log("Python bridge not available, using native");
			}
			
			if (!connected) {
				// Fallback to native
				const { testDeviceConnection, pulseRelay } = await import("./biometric-device");
				connected = await testDeviceConnection({
					ip,
					port,
					commKey,
					unlockSeconds: s.biometricUnlockSeconds || "3",
					relayType: s.biometricRelayType || "NO"
				});
				
				if (connected) {
					try {
						await pulseRelay({
							ip,
							port,
							commKey,
							unlockSeconds: s.biometricUnlockSeconds || "3",
							relayType: s.biometricRelayType || "NO"
						}, 1);
					} catch {}
				}
			}
			
			if (connected) {
				return jsonOk(res, { connected: true, message: `Successfully connected to device at ${ip}:${port}` });
			} else {
				return res.status(400).json({ connected: false, error: "Could not connect to device. Check IP, port, and network connection." });
			}
		} catch (err) {
			return res.status(500).json({ connected: false, error: err instanceof Error ? err.message : "Connection test failed" });
		}
	});

	app.get("/api/biometric/device-users", async (_req: Request, res: Response) => {
		try {
			const s = await storage.getSettings();
			const ip = s.biometricIp || "";
			if (!ip) return res.status(400).json({ users: [], error: "IP address not configured" });
			
			// Fetch actual users from device
			const { getDeviceUsers } = await import("./biometric-device");
			const users = await getDeviceUsers({
				ip,
				port: s.biometricPort || "4370",
				commKey: s.biometricCommKey || "0",
				unlockSeconds: s.biometricUnlockSeconds || "3",
				relayType: s.biometricRelayType || "NO"
			});
			
			return jsonOk(res, { users });
		} catch (err) {
			return res.status(500).json({ users: [], error: err instanceof Error ? err.message : "Failed to fetch device users" });
		}
	});

	app.post("/api/biometric/settings", async (req: Request, res: Response) => {
		try {
			const { ip, port, commKey, unlockSeconds, relayType } = req.body || {};
			const updated = await storage.updateSettings({
				biometricIp: ip ?? "",
				biometricPort: port ?? "4370",
				biometricCommKey: commKey ?? "",
				biometricUnlockSeconds: unlockSeconds ?? "3",
				biometricRelayType: relayType ?? "NO",
			});
			
			// Restart polling with new settings
			try {
				const { startBiometricDevicePolling, stopBiometricDevicePolling } = await import("./biometric-device");
				stopBiometricDevicePolling(); // Stop old monitoring first
				setTimeout(() => {
					startBiometricDevicePolling(); // Start with new settings
					console.log("🔄 Restarted biometric device polling after settings update");
				}, 500); // Small delay to ensure cleanup
			} catch (pollErr) {
				console.error("Failed to restart polling:", pollErr);
			}
			
			return jsonOk(res, updated);
		} catch (err) {
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to save biometric settings" });
		}
	});

	// Map a member to biometric user ID
	app.post("/api/biometric/map-member", async (req: Request, res: Response) => {
		try {
			const { memberId, biometricId } = req.body || {};
			console.log("Map biometric requested", { memberId, biometricId });
			if (!memberId || !biometricId) return res.status(400).json({ message: "memberId and biometricId are required" });
			const updated = await storage.updateMember(memberId, { biometricId });
			if (!updated) return res.status(404).json({ message: "Member not found" });
			console.log("Map biometric saved", { memberId, biometricId, updatedBiometricId: (updated as any).biometricId });
			
			// Sync access group to device
			try {
				const s = await storage.getSettings();
				const { syncMemberAccessGroups } = await import("./biometric-device");
				await syncMemberAccessGroups({
					ip: s.biometricIp || "",
					port: s.biometricPort || "4370",
					commKey: s.biometricCommKey || "0",
					unlockSeconds: s.biometricUnlockSeconds || "3",
					relayType: s.biometricRelayType || "NO"
				});
			} catch (syncErr) {
				console.error("Failed to sync access groups:", syncErr);
			}
			
			return jsonOk(res, updated);
		} catch (err) {
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to map biometric" });
		}
	});

	// Get scan logs (for attendance page)
	app.get("/api/biometric/scan-logs", async (_req: Request, res: Response) => {
		try {
			const { getScanLogs } = await import("./biometric-device");
			const logs = getScanLogs();
			return jsonOk(res, { logs });
		} catch (err) {
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to get scan logs" });
		}
	});

	// Receive attendance event from standalone Python service
	app.post("/api/biometric/attendance-event", async (req: Request, res: Response) => {
		try {
			const { biometricId, memberId, memberName, allowed, reason, timestamp } = req.body || {};
			
			if (!biometricId) {
				return res.status(400).json({ message: "biometricId is required" });
			}
			
			console.log(`📥 Attendance event from Python: User ${biometricId}, Allowed: ${allowed}, Reason: ${reason}`);
			
			// If member exists and access was allowed, create attendance record
			if (allowed && memberId) {
				try {
					await storage.createAttendance({
						memberId,
						checkInTime: timestamp ? new Date(timestamp) : new Date(),
						checkOutTime: null,
						latitude: null as any,
						longitude: null as any,
						markedVia: "biometric",
					} as any);
					console.log(`✅ Attendance recorded for member ${memberId}`);
				} catch (attErr) {
					console.error("Failed to create attendance:", attErr);
				}
			}
			
			// Log the scan event
			try {
				const { logScan } = await import("./biometric-device");
				const member = memberId ? await storage.getMember(memberId) : null;
				logScan(
					biometricId,
					member || null,
					allowed || false,
					reason || "unknown"
				);
			} catch (logErr) {
				console.error("Failed to log scan:", logErr);
			}
			
			return jsonOk(res, { 
				success: true,
				message: allowed ? "Attendance recorded" : "Access denied logged"
			});
		} catch (err) {
			console.error("Error processing attendance event:", err);
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to process attendance event" });
		}
	});

	// Get monitoring status
	app.get("/api/biometric/status", async (_req: Request, res: Response) => {
		try {
			const settings = await storage.getSettings();
			const ip = settings.biometricIp;
			
			const { isPythonBridgeAvailable } = await import("./biometric-python");
			const pythonAvailable = await isPythonBridgeAvailable();
			
			return jsonOk(res, {
				configured: !!ip,
				ip: ip || null,
				pythonAvailable,
				monitoringMethod: "Native polling",
				scanLogsCount: (await import("./biometric-device")).getScanLogs().length,
			});
		} catch (err) {
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to get status" });
		}
	});

	// Debug: Get all members with biometric IDs
	app.get("/api/biometric/debug-members", async (_req: Request, res: Response) => {
		try {
			const members = await storage.listMembers();
			const membersWithBio = members
				.filter((m: any) => (m as any).biometricId)
				.map((m: any) => ({
					id: m.id,
					name: m.name,
					biometricId: String((m as any).biometricId),
					biometricIdType: typeof (m as any).biometricId,
					status: m.status,
				}));
			
			return jsonOk(res, { 
				totalMembers: members.length,
				membersWithBiometric: membersWithBio.length,
				members: membersWithBio 
			});
		} catch (err) {
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to get members" });
		}
	});

	// Manual sync - fetch logs from device immediately
	app.post("/api/biometric/sync-now", async (_req: Request, res: Response) => {
		try {
			const settings = await storage.getSettings();
			const ip = settings.biometricIp;
			if (!ip) {
				return res.status(400).json({ message: "Biometric device not configured" });
			}

			const { getAttendanceLogs, processScan } = await import("./biometric-device");
			const logs = await getAttendanceLogs({
				ip,
				port: settings.biometricPort || "4370",
				commKey: settings.biometricCommKey || "0",
				unlockSeconds: settings.biometricUnlockSeconds || "3",
				relayType: settings.biometricRelayType || "NO"
			});

			console.log(`📥 Manual sync: Found ${logs.length} log(s) from device`);

			// Process all logs
			for (const log of logs) {
				await processScan(log.userId, {
					ip,
					port: settings.biometricPort || "4370",
					commKey: settings.biometricCommKey || "0",
					unlockSeconds: settings.biometricUnlockSeconds || "3",
					relayType: settings.biometricRelayType || "NO"
				});
			}

			return jsonOk(res, { 
				message: `Synced ${logs.length} log(s)`,
				logsCount: logs.length 
			});
		} catch (err) {
			console.error("Manual sync error:", err);
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to sync" });
		}
	});

	// HTTP Push endpoint for eSSL devices (if device supports push notifications)
	app.post("/essl/push", async (req: Request, res: Response) => {
		try {
			// eSSL devices can push scan events to this endpoint
			const body = req.body;
			const biometricId = body.userId || body.user_id || body.id;
			
			if (!biometricId) {
				return res.status(400).json({ error: "Missing user ID" });
			}
			
			// Process the scan event
			const s = await storage.getSettings();
			const { processScan } = await import("./biometric-device");
			
			await processScan(biometricId.toString(), {
				ip: s.biometricIp || "",
				port: s.biometricPort || "4370",
				commKey: s.biometricCommKey || "0",
				unlockSeconds: s.biometricUnlockSeconds || "3",
				relayType: s.biometricRelayType || "NO"
			});
			
			return jsonOk(res, { success: true, message: "Scan event processed" });
		} catch (err) {
			console.error("Error processing push event:", err);
			return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to process push event" });
		}
	});

	// Simulate a scan (for testing without device). Body: { biometricId }
	app.post("/api/biometric/simulate-scan", async (req: Request, res: Response) => {
		try {
			const { biometricId } = req.body || {};
			if (!biometricId) return res.status(400).json({ message: "biometricId is required" });
			const all = await storage.listMembers();
			const member = all.find((m: any) => (m as any).biometricId == biometricId);
			if (!member) return res.status(404).json({ message: "Member not mapped" });
			const now = new Date();
			const startOk = !member.startDate || new Date(member.startDate) <= now;
			const endOk = !member.expiryDate || new Date(member.expiryDate) >= now;
			const statusOk = member.status === "active";
			const paymentOk = member.paymentStatus !== "overdue" && member.paymentStatus !== "pending";
			const allowed = statusOk && startOk && endOk && paymentOk;
			// Record attendance
			await storage.createAttendance({
				memberId: member.id,
				checkInTime: new Date(),
				checkOutTime: null,
				latitude: null as any,
				longitude: null as any,
				markedVia: "biometric",
			} as any);
			return jsonOk(res, { allowed, member: { id: member.id, name: member.name } });
		} catch (err) {
			return res.status(500).json({ message: err instanceof Error ? err.message : "Failed to simulate scan" });
		}
	});
	app.post("/api/whatsapp/test-template", async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { template } = req.body;

			if (!template || typeof template !== "string") {
				return res.status(400).json({ message: "Template is required and must be a string" });
			}

			// Get first 3 members
			const allMembers = await storage.listMembers();
			const sampleMembers = allMembers.slice(0, 3);

			const samples = sampleMembers.map((member) => {
				// Format phone (remove non-digits)
				const formattedPhone = formatPhoneNumber(member.phone);

				// Calculate days left
				let daysLeft = 0;
				try {
					if (member.expiryDate) {
						daysLeft = calculateDaysLeft(member.expiryDate);
					}
				} catch (err) {
					daysLeft = 0;
				}

				// Replace {name}, {plan}, {daysLeft} in template
				const preview = template
					.replace(/{name}/g, member.name || "Member")
					.replace(/{plan}/g, member.planName || "No Plan")
					.replace(/{daysLeft}/g, daysLeft.toString());

				return {
					name: member.name,
					phone: formattedPhone,
					preview,
				};
			});

			return jsonOk(res, { samples });
		} catch (err) {
			next(err);
		}
	});

	app.get("/api/whatsapp/status", async (_req: Request, res: Response) => {
		try {
			return jsonOk(res, {
				connected: isWAConnected,
				qr: currentQR || null,
			});
		} catch (err) {
			return res.status(500).json({
				message: err instanceof Error ? err.message : "Failed to get WhatsApp status",
			});
		}
	});

	app.post("/api/whatsapp/connect", async (req: Request, res: Response) => {
		try {
			console.log("POST /api/whatsapp/connect called");
			await forceReconnect();
			console.log("POST /api/whatsapp/connect - forceReconnect completed");
			return jsonOk(res, { success: true, message: "Reconnection initiated. QR code will appear shortly." });
		} catch (err) {
			console.error("Error in /api/whatsapp/connect:", err);
			const errorMessage = err instanceof Error ? err.message : "Failed to generate QR code";
			console.error("Returning error response:", errorMessage);
			return res.status(500).json({
				success: false,
				message: errorMessage,
			});
		}
	});

	app.post("/api/whatsapp/disconnect", async (_req: Request, res: Response, next: NextFunction) => {
		try {
			await disconnectWhatsApp();
			return jsonOk(res, { success: true, message: "WhatsApp disconnected successfully." });
		} catch (err) {
			console.error("Error in /api/whatsapp/disconnect:", err);
			return res.status(500).json({
				success: false,
				message: err instanceof Error ? err.message : "Failed to disconnect WhatsApp",
			});
		}
	});
}
