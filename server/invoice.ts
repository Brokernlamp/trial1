import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export type BusinessInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoPath?: string | null;
  currency?: string | null; // e.g. INR, USD
  taxRatePercent?: number | null; // e.g. 18 for 18%
};

export type InvoiceInput = {
  invoiceNumber: string;
  invoiceDateISO: string;
  member: { name: string; email?: string | null; phone?: string | null };
  plan: { name: string; durationDays?: number | null; startDateISO?: string | null; expiryDateISO?: string | null; price: number };
  discountPercent?: number | null; // if provided, applied over plan price
  discountAmount?: number | null; // fixed amount off
  business: BusinessInfo;
};

export async function generateInvoicePdfBuffer(input: InvoiceInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", (e) => reject(e));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    // Header
    if (input.business.logoPath) {
      try {
        const absLogo = path.isAbsolute(input.business.logoPath)
          ? input.business.logoPath
          : path.join(process.cwd(), input.business.logoPath);
        if (fs.existsSync(absLogo)) {
          doc.image(absLogo, 40, 40, { width: 90 });
        }
      } catch {}
    }

    doc
      .fontSize(20)
      .text(input.business.name || "Invoice", 140, 46)
      .fontSize(10)
      .fillColor("#555")
      .text(input.business.address || "", 140, 72)
      .text([input.business.phone, input.business.email].filter(Boolean).join("  ·  "), 140, 86)
      .fillColor("#000");

    // Invoice meta
    doc
      .fontSize(12)
      .text(`Invoice #: ${input.invoiceNumber}`, 400, 40, { align: "left" })
      .text(`Date: ${new Date(input.invoiceDateISO).toLocaleDateString()}`, 400, 58, { align: "left" });

    doc.moveDown(3);
    doc.fontSize(14).text("Bill To", { underline: true });
    doc.fontSize(12).text(input.member.name);
    if (input.member.email) doc.text(input.member.email);
    if (input.member.phone) doc.text(input.member.phone);

    doc.moveDown();
    doc.fontSize(14).text("Membership", { underline: true });
    doc.fontSize(12)
      .text(`Plan: ${input.plan.name}`)
      .text(`Duration: ${input.plan.durationDays ?? "-"} days`)
      .text(`Start: ${input.plan.startDateISO ? new Date(input.plan.startDateISO).toLocaleDateString() : "-"}`)
      .text(`Expiry: ${input.plan.expiryDateISO ? new Date(input.plan.expiryDateISO).toLocaleDateString() : "-"}`);

    // Totals
    const currency = input.business.currency || "INR";
    const subtotal = Number(input.plan.price || 0);
    const discountP = Math.max(0, Math.min(100, Number(input.discountPercent ?? 0)));
    const discountFromPercent = (subtotal * discountP) / 100;
    const discountFixed = Math.max(0, Number(input.discountAmount ?? 0));
    const discount = Math.min(subtotal, discountFromPercent + discountFixed);
    const taxable = Math.max(0, subtotal - discount);
    const taxRate = Math.max(0, Number(input.business.taxRatePercent ?? 0));
    const taxAmount = (taxable * taxRate) / 100;
    const total = taxable + taxAmount;

    const toMoney = (n: number) => `${currency} ${n.toFixed(2)}`;

    doc.moveDown();
    doc.fontSize(14).text("Summary", { underline: true });
    doc.fontSize(12);
    const startX = 40;
    const startY = doc.y + 6;
    const labelWidth = 200;
    const valueX = startX + labelWidth + 160;

    const row = (label: string, value: string, bold = false) => {
      const currentY = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").text(label, startX, currentY, { width: labelWidth });
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").text(value, valueX, currentY, { align: "right" });
      doc.moveDown(0.6);
    };

    row("Subtotal", toMoney(subtotal));
    row("Discount", `-${toMoney(discount)}${discountP ? ` (${discountP}%)` : ""}`);
    row(`Tax (${taxRate}%)`, toMoney(taxAmount));
    row("Total", toMoney(total), true);

    doc.moveDown(2);
    doc.fontSize(10).fillColor("#666").text("Thank you for your membership!", { align: "center" });

    doc.end();
  });
}


