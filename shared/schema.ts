import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const members = pgTable("members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  photoUrl: text("photo_url"),
  loginCode: text("login_code").notNull().unique(),
  biometricId: text("biometric_id"),
  planId: varchar("plan_id"),
  planName: text("plan_name"),
  startDate: timestamp("start_date"),
  expiryDate: timestamp("expiry_date"),
  status: text("status").notNull(),
  paymentStatus: text("payment_status").notNull(),
  lastCheckIn: timestamp("last_check_in"),
  emergencyContact: text("emergency_contact"),
  trainerId: varchar("trainer_id"),
  notes: text("notes"),
  gender: text("gender"),
  age: integer("age"),
});

export const insertMemberSchema = createInsertSchema(members, {
  startDate: z.coerce.date().nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  lastCheckIn: z.coerce.date().nullable().optional(),
}).omit({
  id: true,
});

export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof members.$inferSelect;

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull(),
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  planName: text("plan_name"),
  planStatus: text("plan_status"), // active/expired/pending - status of plan at time of payment
});

export const insertPaymentSchema = createInsertSchema(payments, {
  dueDate: z.coerce.date().nullable().optional(),
  paidDate: z.coerce.date().nullable().optional(),
}).omit({
  id: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  duration: integer("duration").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  features: text("features").array(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
});

// Settings schema (simple key-value store)
export const settingsSchema = z.object({
  gymName: z.string().optional(),
  gymAddress: z.string().optional(),
  gymPhone: z.string().optional(),
  gymEmail: z.string().email().optional(),
  gymGstNumber: z.string().optional(),
  weekdayOpen: z.string().optional(),
  weekdayClose: z.string().optional(),
  weekendOpen: z.string().optional(),
  weekendClose: z.string().optional(),
  gpsEnabled: z.boolean().optional(),
  gpsLatitude: z.string().optional(),
  gpsLongitude: z.string().optional(),
  gpsRadius: z.string().optional(),
  razorpayKey: z.string().optional(),
  stripeKey: z.string().optional(),
  taxRate: z.string().optional(),
});
export type Settings = z.infer<typeof settingsSchema>;

export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plans.$inferSelect;

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull(),
  checkInTime: timestamp("check_in_time").notNull(),
  checkOutTime: timestamp("check_out_time"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  markedVia: text("marked_via").notNull().default("manual"),
});

export const insertAttendanceSchema = createInsertSchema(attendance, {
  checkInTime: z.coerce.date().optional(),
  checkOutTime: z.coerce.date().nullable().optional(),
}).omit({
  id: true,
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

export const classes = pgTable("classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  trainerId: varchar("trainer_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  capacity: integer("capacity").notNull(),
  enrolled: integer("enrolled").notNull().default(0),
});

export const insertClassSchema = createInsertSchema(classes, {
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
}).omit({
  id: true,
});

export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classes.$inferSelect;

export const trainers = pgTable("trainers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  photoUrl: text("photo_url"),
  specializations: text("specializations").array(),
  certifications: text("certifications").array(),
  rating: decimal("rating", { precision: 3, scale: 2 }),
});

export const insertTrainerSchema = createInsertSchema(trainers).omit({
  id: true,
});

export type InsertTrainer = z.infer<typeof insertTrainerSchema>;
export type Trainer = typeof trainers.$inferSelect;

export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  purchaseDate: timestamp("purchase_date"),
  warrantyExpiry: timestamp("warranty_expiry"),
  lastMaintenance: timestamp("last_maintenance"),
  nextMaintenance: timestamp("next_maintenance"),
  status: text("status").notNull(),
});

export const insertEquipmentSchema = createInsertSchema(equipment, {
  purchaseDate: z.coerce.date().nullable().optional(),
  warrantyExpiry: z.coerce.date().nullable().optional(),
  lastMaintenance: z.coerce.date().nullable().optional(),
  nextMaintenance: z.coerce.date().nullable().optional(),
}).omit({
  id: true,
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;
