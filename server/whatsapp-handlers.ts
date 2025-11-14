/**
 * Helper functions for WhatsApp message handling
 */

/**
 * Format phone number by removing all non-digit characters
 * @param phone - Raw phone number string
 * @returns Clean phone number with only digits
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== "string") {
    throw new Error("Phone number must be a non-empty string");
  }
  return phone.replace(/\D/g, "");
}

/**
 * Generate WhatsApp JID (Jabber ID) from phone number
 * @param phone - Phone number (will be formatted)
 * @returns WhatsApp JID in format: {phone}@s.whatsapp.net
 */
export function generateWhatsAppJID(phone: string): string {
  const cleanPhone = formatPhoneNumber(phone);
  if (!cleanPhone) {
    throw new Error("Invalid phone number: phone number is empty after formatting");
  }
  return `${cleanPhone}@s.whatsapp.net`;
}

/**
 * Calculate days until expiry date
 * @param expiryDate - Expiry date as Date object or ISO string
 * @returns Number of days until expiry (negative if already expired)
 */
export function calculateDaysLeft(expiryDate: Date | string | null | undefined): number {
  if (!expiryDate) {
    throw new Error("Expiry date is required");
  }

  let date: Date;
  if (typeof expiryDate === "string") {
    date = new Date(expiryDate);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date string format");
    }
  } else if (expiryDate instanceof Date) {
    date = expiryDate;
    if (isNaN(date.getTime())) {
      throw new Error("Invalid Date object");
    }
  } else {
    throw new Error("Expiry date must be a Date object or ISO string");
  }

  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

