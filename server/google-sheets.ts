import { google } from "googleapis";
import type { Member } from "@shared/schema";
import { calculateDaysLeft } from "./whatsapp-handlers";

let sheetsClient: ReturnType<typeof google.sheets> | null = null;
let isInitialized = false;

/**
 * Initialize Google Sheets API client
 */
export async function initGoogleSheets(): Promise<void> {
  try {
    if (process.env.DESKTOP === "1" || process.env.ELECTRON === "1") {
      console.log("🖥️ Desktop mode: skipping Google Sheets initialization");
      return;
    }
    const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT?.trim();

    if (!sheetId) {
      console.log("⚠️  GOOGLE_SHEET_ID not set, skipping Google Sheets sync");
      return;
    }

    if (!serviceAccountJson) {
      console.log("⚠️  GOOGLE_SERVICE_ACCOUNT not set, skipping Google Sheets sync");
      return;
    }

    // Parse service account credentials
    // Can be either JSON string or path to JSON file
    let credentials;
    try {
      // Check if it's a file path
      if (serviceAccountJson.startsWith("/") || serviceAccountJson.startsWith("./") || serviceAccountJson.startsWith("../")) {
        const fs = await import("fs");
        const path = await import("path");
        const filePath = path.resolve(serviceAccountJson);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        credentials = JSON.parse(fileContent);
      } else {
        // Assume it's a JSON string
        credentials = JSON.parse(serviceAccountJson);
      }
    } catch (error) {
      console.error("❌ Failed to parse GOOGLE_SERVICE_ACCOUNT (must be JSON string or file path):", error);
      return;
    }

    // Authenticate with Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    sheetsClient = google.sheets({ version: "v4", auth });
    isInitialized = true;

    console.log("✅ Google Sheets initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize Google Sheets:", error);
    isInitialized = false;
  }
}

/**
 * Get or create the sheet with headers
 */
async function ensureSheetSetup(sheetId: string, sheetName: string = "Members"): Promise<void> {
  if (!sheetsClient) return;

  try {
    // Check if sheet exists
    const spreadsheet = await sheetsClient.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetExists = spreadsheet.data.sheets?.some(
      (sheet) => sheet.properties?.title === sheetName
    );

    if (!sheetExists) {
      // Create new sheet
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });
    }

    // Get the sheet to check headers
    const sheet = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1:F1`,
    });

    // If no headers exist, add them
    if (!sheet.data.values || sheet.data.values.length === 0) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1:F1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Phone", "Name", "Plan", "Days Left", "Status", "Payment Status"]],
        },
      });
    }
  } catch (error) {
    console.error("❌ Failed to setup sheet:", error);
    throw error;
  }
}

/**
 * Find row index by phone number
 */
async function findRowByPhone(
  sheetId: string,
  sheetName: string,
  phone: string
): Promise<number | null> {
  if (!sheetsClient) return null;

  try {
    const cleanPhone = phone.replace(/\D/g, ""); // Remove non-digits
    const response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:A`, // Column A is Phone
    });

    const rows = response.data.values || [];
    // Skip header row (index 0), search from row 2
    for (let i = 1; i < rows.length; i++) {
      const rowPhone = rows[i]?.[0]?.toString().replace(/\D/g, "") || "";
      if (rowPhone === cleanPhone) {
        return i + 1; // +1 because Sheets is 1-indexed
      }
    }
    return null;
  } catch (error) {
    console.error("❌ Failed to find row by phone:", error);
    return null;
  }
}

/**
 * Calculate days left from expiry date
 */
function getDaysLeft(member: Member): number {
  try {
    if (member.expiryDate) {
      return calculateDaysLeft(member.expiryDate);
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Sync a single member to Google Sheets
 */
async function syncMemberToSheet(member: Member, sheetId: string, sheetName: string): Promise<void> {
  if (!sheetsClient) return;

  try {
    const cleanPhone = member.phone.replace(/\D/g, "");
    const daysLeft = getDaysLeft(member);
    const rowData = [
      cleanPhone, // Phone (Column A)
      member.name || "", // Name (Column B)
      member.planName || "No Plan", // Plan (Column C)
      daysLeft.toString(), // Days Left (Column D)
      member.status || "active", // Status (Column E)
      member.paymentStatus || "paid", // Payment Status (Column F)
    ];

    // Find existing row by phone
    const rowIndex = await findRowByPhone(sheetId, sheetName, member.phone);

    if (rowIndex) {
      // Update existing row
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A${rowIndex}:F${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [rowData],
        },
      });
    } else {
      // Append new row
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:F`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [rowData],
        },
      });
    }
  } catch (error) {
    console.error(`❌ Failed to sync member ${member.id} to Google Sheets:`, error);
    throw error;
  }
}

/**
 * Remove member from Google Sheets by phone
 */
async function removeMemberFromSheet(phone: string, sheetId: string, sheetName: string): Promise<void> {
  if (!sheetsClient) return;

  try {
    const rowIndex = await findRowByPhone(sheetId, sheetName, phone);
    if (rowIndex) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheetId, sheetName),
                  dimension: "ROWS",
                  startIndex: rowIndex - 1, // Convert to 0-indexed
                  endIndex: rowIndex,
                },
              },
            },
          ],
        },
      });
    }
  } catch (error) {
    console.error(`❌ Failed to remove member from Google Sheets:`, error);
    throw error;
  }
}

/**
 * Get sheet ID by name
 */
async function getSheetId(spreadsheetId: string, sheetName: string): Promise<number> {
  if (!sheetsClient) throw new Error("Sheets client not initialized");

  const spreadsheet = await sheetsClient.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );
  if (!sheet?.properties?.sheetId) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  return sheet.properties.sheetId;
}

/**
 * Sync all members to Google Sheets
 * @param members - Array of members to sync
 */
export async function syncMembersToGoogleSheets(members: Member[]): Promise<void> {
  if (!isInitialized || !sheetsClient) {
    console.log("⚠️  Google Sheets not initialized, skipping sync");
    return;
  }

  const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
  if (!sheetId) {
    console.log("⚠️  GOOGLE_SHEET_ID not set, skipping sync");
    return;
  }

  const sheetName = process.env.GOOGLE_SHEET_NAME || "Members";

  try {
    // Ensure sheet exists with headers
    await ensureSheetSetup(sheetId, sheetName);

    // Sync each member
    for (const member of members) {
      await syncMemberToSheet(member, sheetId, sheetName);
    }

    console.log(`✅ Synced ${members.length} members to Google Sheets`);
  } catch (error) {
    console.error("❌ Failed to sync members to Google Sheets:", error);
    // Don't throw - sync failures shouldn't break the app
  }
}

/**
 * Sync a single member to Google Sheets (for create/update operations)
 */
export async function syncMemberToGoogleSheets(member: Member): Promise<void> {
  if (!isInitialized || !sheetsClient) {
    return;
  }

  const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
  if (!sheetId) {
    return;
  }

  const sheetName = process.env.GOOGLE_SHEET_NAME || "Members";

  try {
    await ensureSheetSetup(sheetId, sheetName);
    await syncMemberToSheet(member, sheetId, sheetName);
    console.log(`✅ Synced member ${member.id} to Google Sheets`);
  } catch (error) {
    console.error(`❌ Failed to sync member ${member.id} to Google Sheets:`, error);
    // Don't throw - sync failures shouldn't break the app
  }
}

/**
 * Remove a member from Google Sheets (for delete operations)
 */
export async function removeMemberFromGoogleSheets(phone: string): Promise<void> {
  if (!isInitialized || !sheetsClient) {
    return;
  }

  const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
  if (!sheetId) {
    return;
  }

  const sheetName = process.env.GOOGLE_SHEET_NAME || "Members";

  try {
    await removeMemberFromSheet(phone, sheetId, sheetName);
    console.log(`✅ Removed member with phone ${phone} from Google Sheets`);
  } catch (error) {
    console.error(`❌ Failed to remove member from Google Sheets:`, error);
    // Don't throw - sync failures shouldn't break the app
  }
}

