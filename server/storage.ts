import {
  type User,
  type InsertUser,
  type Member,
  type InsertMember,
  type Payment,
  type InsertPayment,
  type Equipment,
  type InsertEquipment,
  type Attendance,
  type InsertAttendance,
  type Plan,
  type InsertPlan,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { getDb } from "./db-factory";
import { syncToTurso } from "./auto-sync";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // members
  listMembers(): Promise<Member[]>;
  getMember(id: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(id: string, member: Partial<InsertMember>): Promise<Member | undefined>;
  deleteMember(id: string): Promise<boolean>;

  // payments
  listPayments(): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: string): Promise<boolean>;
  getMemberHistory(memberId: string): Promise<any[]>;

  // equipment
  listEquipment(): Promise<Equipment[]>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: string, equipment: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: string): Promise<boolean>;

  // attendance
  listAttendance(): Promise<Attendance[]>;
  createAttendance(record: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, record: Partial<InsertAttendance>): Promise<Attendance | undefined>;
  deleteAttendance(id: string): Promise<boolean>;

  // settings
  getSettings(): Promise<Record<string, any>>;
  updateSettings(settings: Record<string, any>): Promise<Record<string, any>>;
  getMemberByLoginCode(loginCode: string): Promise<Member | undefined>;

  // plans
  listPlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, plan: Partial<InsertPlan>): Promise<Plan | undefined>;
  deletePlan(id: string): Promise<boolean>;
}

export class TursoStorage implements IStorage {
  private db = getDb();
  private ensuredUpgrades = false;

  private async ensureSchemaUpgrades() {
    if (this.ensuredUpgrades) return;
    try {
      // Simple approach: try to add columns, ignore if already exists
      const addColIfMissing = async (table: string, col: string, type: string) => {
        try {
          await this.db.execute({ sql: `ALTER TABLE ${table} ADD COLUMN ${col} ${type}`, args: [] });
          console.log(`✓ Added column ${table}.${col}`);
        } catch (e: any) {
          // Column already exists - that's fine, ignore
          const msg = String(e?.message || e || "");
          if (msg.includes("duplicate column") || msg.includes("already exists")) {
            // Expected - column exists
          } else {
            console.log(`Column ${table}.${col} may already exist or table doesn't exist yet`);
          }
        }
      };
      
      // Add biometric_id to members
      try {
        await this.db.execute({ sql: `ALTER TABLE members ADD COLUMN biometric_id TEXT`, args: [] });
        console.log(`✓ Added column members.biometric_id`);
      } catch (e: any) {
        // Ignore if already exists
      }
      
      // Add updated_at and deleted_at to all core tables
      const coreTables = ["members", "payments", "attendance", "equipment", "plans"];
      for (const t of coreTables) {
        await addColIfMissing(t, "updated_at", "TEXT");
        await addColIfMissing(t, "deleted_at", "TEXT");
      }
      
      // Add plan_status to payments table for history tracking
      await addColIfMissing("payments", "plan_status", "TEXT");
      
      console.log("✅ Schema upgrades completed");
      this.ensuredUpgrades = true;
    } catch (e) {
      console.error("❌ Schema upgrade failed:", e);
      // Don't mark as ensured if it failed - allow retry
      // But don't throw - let operations continue (they might work if columns already exist)
    }
  }

  private mapMember(row: any): Member {
    // Handle both snake_case (DB) and camelCase (already mapped) formats
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      photoUrl: row.photo_url ?? row.photoUrl ?? null,
      loginCode: row.login_code ?? row.loginCode,
      biometricId: row.biometric_id ?? row.biometricId ?? null,
      planId: row.plan_id ?? row.planId ?? null,
      planName: row.plan_name ?? row.planName ?? null,
      startDate: row.start_date ?? row.startDate ?? null,
      expiryDate: row.expiry_date ?? row.expiryDate ?? null,
      status: row.status,
      paymentStatus: row.payment_status ?? row.paymentStatus,
      lastCheckIn: row.last_check_in ?? row.lastCheckIn ?? null,
      emergencyContact: row.emergency_contact ?? row.emergencyContact ?? null,
      trainerId: row.trainer_id ?? row.trainerId ?? null,
      notes: row.notes ?? null,
      gender: row.gender ?? null,
      age: row.age ?? null,
    } as any;
  }

  async getMemberHistory(memberId: string): Promise<any[]> {
    await this.ensureSchemaUpgrades();
    const r = await this.db.execute({
      sql: `SELECT * FROM payments WHERE member_id = ? AND (deleted_at IS NULL OR deleted_at = '') ORDER BY COALESCE(paid_date, due_date, updated_at) DESC`,
      args: [memberId],
    });
    return (r.rows as unknown[]).map((x: any, index: number) => {
      const mapped = this.mapPayment(x);
      return {
        ...mapped,
        srNo: index + 1,
        date: (mapped as any).paidDate || (mapped as any).dueDate || (mapped as any).updatedAt,
        membershipPlan: (mapped as any).planName || "N/A",
        planStatus: (mapped as any).planStatus || (mapped as any).status || "pending",
        paymentMethod: (mapped as any).paymentMethod || "N/A",
        paid: (mapped as any).status === "paid" ? "YES" : "NOT YET",
      };
    }) as any;
  }

  private mapPayment(row: any): Payment {
    return {
      id: row.id,
      memberId: row.member_id,
      amount: row.amount,
      paymentMethod: row.payment_method,
      status: row.status,
      dueDate: row.due_date ?? null,
      paidDate: row.paid_date ?? null,
      planName: row.plan_name ?? null,
      planStatus: row.plan_status ?? null,
    } as any;
  }

  private mapAttendance(row: any): Attendance {
    return {
      id: row.id,
      memberId: row.member_id,
      checkInTime: row.check_in_time,
      checkOutTime: row.check_out_time ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      markedVia: row.marked_via,
    } as any;
  }

  private mapEquipment(row: any): Equipment {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      purchaseDate: row.purchase_date ?? null,
      warrantyExpiry: row.warranty_expiry ?? null,
      lastMaintenance: row.last_maintenance ?? null,
      nextMaintenance: row.next_maintenance ?? null,
      status: row.status,
    } as any;
  }

  async getUser(id: string): Promise<User | undefined> {
    const r = await this.db.execute({ sql: `SELECT id, username, password FROM users WHERE id = ?`, args: [id] });
    return r.rows[0] as any;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const r = await this.db.execute({ sql: `SELECT id, username, password FROM users WHERE username = ?`, args: [username] });
    return r.rows[0] as any;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    await this.db.execute({ sql: `INSERT INTO users (id, username, password) VALUES (?, ?, ?)`, args: [id, user.username, user.password] });
    return { id, username: user.username, password: user.password } as any;
  }

  async listMembers(): Promise<Member[]> {
    try {
      await this.ensureSchemaUpgrades();
      console.log("listMembers: executing query");
      const r = await this.db.execute(`SELECT * FROM members WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY name`);
      console.log("listMembers: got rows", r.rows.length);
      const mapped = (r.rows as unknown[]).map((x: any) => {
        try {
          return this.mapMember(x);
        } catch (e) {
          console.error("Error mapping member row:", x, e);
          throw e;
        }
      });
      console.log("listMembers: mapped successfully", mapped.length);
      return mapped as any;
    } catch (error) {
      console.error("listMembers error:", error);
      throw error;
    }
  }

  async getMember(id: string): Promise<Member | undefined> {
    await this.ensureSchemaUpgrades();
    const r = await this.db.execute({ sql: `SELECT * FROM members WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    return row ? this.mapMember(row) : undefined;
  }

  async createMember(member: InsertMember): Promise<Member> {
    try {
      await this.ensureSchemaUpgrades();
      // Generate readable member ID: member_001, member_002, etc.
      let id = "member_001";
      try {
        const maxIdResult = await this.db.execute({
          sql: `SELECT MAX(CAST(SUBSTR(id, 8) AS INTEGER)) as max_num FROM members WHERE id LIKE 'member_%'`,
        });
        const maxNum = maxIdResult.rows[0]?.max_num ? Number(maxIdResult.rows[0].max_num) : 0;
        id = `member_${String(maxNum + 1).padStart(3, '0')}`;
      } catch {
        // If parsing fails, count total members and add 1
        try {
          const countResult = await this.db.execute({
            sql: `SELECT COUNT(*) as total FROM members WHERE id LIKE 'member_%'`,
          });
          const total = countResult.rows[0]?.total ? Number(countResult.rows[0].total) : 0;
          id = `member_${String(total + 1).padStart(3, '0')}`;
        } catch {
          // Fallback: use timestamp-based ID
          id = `member_${Date.now().toString().slice(-6)}`;
        }
      }
      
      console.log("Creating member:", id, member.name);
      const result = await this.db.execute({
        sql: `INSERT INTO members (
          id, name, email, phone, photo_url, login_code, biometric_id, plan_id, plan_name,
          start_date, expiry_date, status, payment_status, last_check_in,
          emergency_contact, trainer_id, notes, gender, age, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          member.name,
          member.email,
          member.phone,
          (member as any).photoUrl ?? null,
          member.loginCode,
          (member as any).biometricId ?? null,
          (member as any).planId ?? null,
          (member as any).planName ?? null,
          (member as any).startDate ?? null,
          (member as any).expiryDate ?? null,
          member.status,
          (member as any).paymentStatus,
          (member as any).lastCheckIn ?? null,
          (member as any).emergencyContact ?? null,
          (member as any).trainerId ?? null,
          (member as any).notes ?? null,
          (member as any).gender ?? null,
          (member as any).age ?? null,
          new Date().toISOString(),
          null,
        ],
      });
      console.log("Member inserted, rowsAffected:", result.rowsAffected);
      const created = await this.getMember(id);
      if (!created) throw new Error("Failed to retrieve created member");
      
      // Auto-sync to Turso (non-blocking)
      syncToTurso("members", id).catch(err => 
        console.error("Failed to auto-sync new member to Turso:", err)
      );
      
      return created as Member;
    } catch (error) {
      console.error("createMember error:", error);
      throw error;
    }
  }

  async updateMember(id: string, member: Partial<InsertMember>): Promise<Member | undefined> {
    await this.ensureSchemaUpgrades();
    const current = await this.getMember(id);
    if (!current) return undefined;
    const merged = { ...current, ...member } as any;
    await this.db.execute({
      sql: `UPDATE members SET name=?, email=?, phone=?, photo_url=?, login_code=?, biometric_id=?, plan_id=?, plan_name=?, start_date=?, expiry_date=?, status=?, payment_status=?, last_check_in=?, emergency_contact=?, trainer_id=?, notes=?, gender=?, age=?, updated_at=? WHERE id=?`,
      args: [
        merged.name,
        merged.email,
        merged.phone,
        merged.photoUrl ?? null,
        merged.loginCode,
        merged.biometricId ?? null,
        merged.planId ?? null,
        merged.planName ?? null,
        merged.startDate ?? null,
        merged.expiryDate ?? null,
        merged.status,
        merged.paymentStatus,
        merged.lastCheckIn ?? null,
        merged.emergencyContact ?? null,
        merged.trainerId ?? null,
        merged.notes ?? null,
        merged.gender ?? null,
        merged.age ?? null,
        new Date().toISOString(),
        id,
      ],
    });
    const updated = await this.getMember(id);
    
    // Auto-sync to Turso (non-blocking)
    if (updated) {
      syncToTurso("members", id).catch(err => 
        console.error("Failed to auto-sync updated member to Turso:", err)
      );
    }
    
    return updated;
  }

  async deleteMember(id: string): Promise<boolean> {
    await this.ensureSchemaUpgrades();
    const r = await this.db.execute({ sql: `UPDATE members SET deleted_at = ?, updated_at = ? WHERE id = ?`, args: [new Date().toISOString(), new Date().toISOString(), id] });
    const deleted = (r.rowsAffected ?? 0) > 0;
    
    // Auto-sync deletion to Turso (non-blocking)
    if (deleted) {
      syncToTurso("members", id).catch(err => 
        console.error("Failed to auto-sync member deletion to Turso:", err)
      );
    }
    
    return deleted;
  }

  async listPayments(): Promise<Payment[]> {
    await this.ensureSchemaUpgrades();
    const r = await this.db.execute(`SELECT * FROM payments WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY COALESCE(paid_date, due_date) DESC`);
    return (r.rows as unknown[]).map((x: any) => this.mapPayment(x)) as any;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    await this.ensureSchemaUpgrades();
    const r = await this.db.execute({ sql: `SELECT * FROM payments WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`, args: [id] });
    const row = r.rows[0];
    return row ? this.mapPayment(row) as any : undefined;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    await this.ensureSchemaUpgrades();
    const id = randomUUID();
    // Get member's current plan status to store in history
    const member = await this.getMember(payment.memberId);
    const planStatus = member?.status || "pending";
    
    // Convert Date objects to ISO strings for database binding
    const dueDate = (payment as any).dueDate instanceof Date 
      ? (payment as any).dueDate.toISOString() 
      : ((payment as any).dueDate ?? null);
    const paidDate = (payment as any).paidDate instanceof Date 
      ? (payment as any).paidDate.toISOString() 
      : ((payment as any).paidDate ?? null);
    
    await this.db.execute({
      sql: `INSERT INTO payments (id, member_id, amount, payment_method, status, due_date, paid_date, plan_name, plan_status, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        payment.memberId,
        String((payment as any).amount ?? "0"),
        (payment as any).paymentMethod,
        (payment as any).status,
        dueDate,
        paidDate,
        (payment as any).planName ?? null,
        (payment as any).planStatus ?? planStatus,
        new Date().toISOString(),
        null,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM payments WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    const created = row ? this.mapPayment(row) as any : {
      id,
      memberId: payment.memberId,
      amount: String((payment as any).amount ?? "0"),
      paymentMethod: (payment as any).paymentMethod,
      status: (payment as any).status,
      dueDate: (payment as any).dueDate ?? null,
      paidDate: (payment as any).paidDate ?? null,
      planName: (payment as any).planName ?? null,
      planStatus: (payment as any).planStatus ?? planStatus,
    } as any;
    
    // Auto-sync to Turso (non-blocking)
    syncToTurso("payments", id).catch(err => 
      console.error("Failed to auto-sync new payment to Turso:", err)
    );
    
    return created;
  }

  async updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const current = await this.db.execute({ sql: `SELECT * FROM payments WHERE id = ?`, args: [id] });
    const cur = current.rows[0] as any;
    if (!cur) return undefined;
    const merged = { ...cur, ...payment } as any;
    
    // Convert Date objects to ISO strings for database binding
    const dueDate = merged.dueDate instanceof Date 
      ? merged.dueDate.toISOString() 
      : (merged.dueDate ?? null);
    const paidDate = merged.paidDate instanceof Date 
      ? merged.paidDate.toISOString() 
      : (merged.paidDate ?? null);
    
    await this.db.execute({
      sql: `UPDATE payments SET member_id=?, amount=?, payment_method=?, status=?, due_date=?, paid_date=?, plan_name=?, plan_status=?, updated_at=? WHERE id=?`,
      args: [
        merged.memberId,
        String(merged.amount ?? "0"),
        merged.paymentMethod,
        merged.status,
        dueDate,
        paidDate,
        merged.planName ?? null,
        merged.planStatus ?? null,
        new Date().toISOString(),
        id,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM payments WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    const updated = row ? this.mapPayment(row) as any : undefined;
    
    // Auto-sync to Turso (non-blocking)
    if (updated) {
      syncToTurso("payments", id).catch(err => 
        console.error("Failed to auto-sync updated payment to Turso:", err)
      );
    }
    
    return updated;
  }

  async deletePayment(id: string): Promise<boolean> {
    await this.ensureSchemaUpgrades();
    const r = await this.db.execute({ sql: `UPDATE payments SET deleted_at = ?, updated_at = ? WHERE id = ?`, args: [new Date().toISOString(), new Date().toISOString(), id] });
    const deleted = (r.rowsAffected ?? 0) > 0;
    
    // Auto-sync deletion to Turso (non-blocking)
    if (deleted) {
      syncToTurso("payments", id).catch(err => 
        console.error("Failed to auto-sync payment deletion to Turso:", err)
      );
    }
    
    return deleted;
  }

  async listEquipment(): Promise<Equipment[]> {
    const r = await this.db.execute(`SELECT * FROM equipment ORDER BY name`);
    return (r.rows as unknown[]).map((x: any) => this.mapEquipment(x)) as any;
  }

  async createEquipment(equipment: InsertEquipment): Promise<Equipment> {
    const id = randomUUID();
    await this.db.execute({
      sql: `INSERT INTO equipment (id, name, category, purchase_date, warranty_expiry, last_maintenance, next_maintenance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        equipment.name,
        (equipment as any).category,
        (equipment as any).purchaseDate ?? null,
        (equipment as any).warrantyExpiry ?? null,
        (equipment as any).lastMaintenance ?? null,
        (equipment as any).nextMaintenance ?? null,
        (equipment as any).status,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM equipment WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    const created = row ? this.mapEquipment(row) as any : {
      id,
      name: equipment.name,
      category: (equipment as any).category,
      purchaseDate: (equipment as any).purchaseDate ?? null,
      warrantyExpiry: (equipment as any).warrantyExpiry ?? null,
      lastMaintenance: (equipment as any).lastMaintenance ?? null,
      nextMaintenance: (equipment as any).nextMaintenance ?? null,
      status: (equipment as any).status,
    } as any;
    
    // Auto-sync to Turso (non-blocking)
    syncToTurso("equipment", id).catch(err => 
      console.error("Failed to auto-sync new equipment to Turso:", err)
    );
    
    return created;
  }

  async updateEquipment(id: string, equipment: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const current = await this.db.execute({ sql: `SELECT * FROM equipment WHERE id = ?`, args: [id] });
    const cur = current.rows[0] as any;
    if (!cur) return undefined;
    // Map DB row (snake_case) to camelCase before merging to avoid losing fields
    const curMapped = this.mapEquipment(cur) as any;
    const merged = { ...curMapped, ...equipment } as any;
    await this.db.execute({
      sql: `UPDATE equipment SET name=?, category=?, purchase_date=?, warranty_expiry=?, last_maintenance=?, next_maintenance=?, status=? WHERE id=?`,
      args: [
        merged.name,
        merged.category,
        merged.purchaseDate ?? null,
        merged.warrantyExpiry ?? null,
        merged.lastMaintenance ?? null,
        merged.nextMaintenance ?? null,
        merged.status,
        id,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM equipment WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    const updated = row ? this.mapEquipment(row) as any : undefined;
    
    // Auto-sync to Turso (non-blocking)
    if (updated) {
      syncToTurso("equipment", id).catch(err => 
        console.error("Failed to auto-sync updated equipment to Turso:", err)
      );
    }
    
    return updated;
  }

  async deleteEquipment(id: string): Promise<boolean> {
    const r = await this.db.execute({ sql: `DELETE FROM equipment WHERE id = ?`, args: [id] });
    const deleted = (r.rowsAffected ?? 0) > 0;
    
    // Auto-sync deletion to Turso (non-blocking)
    if (deleted) {
      syncToTurso("equipment", id).catch(err => 
        console.error("Failed to auto-sync equipment deletion to Turso:", err)
      );
    }
    
    return deleted;
  }

  async listAttendance(): Promise<Attendance[]> {
    await this.ensureSchemaUpgrades();
    const r = await this.db.execute(`SELECT * FROM attendance WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY COALESCE(check_out_time, check_in_time) DESC`);
    return (r.rows as unknown[]).map((x: any) => this.mapAttendance(x)) as any;
  }

  async createAttendance(record: InsertAttendance): Promise<Attendance> {
    await this.ensureSchemaUpgrades();
    const id = randomUUID();
    await this.db.execute({
      sql: `INSERT INTO attendance (id, member_id, check_in_time, check_out_time, latitude, longitude, marked_via, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        record.memberId,
        (record as any).checkInTime ?? new Date().toISOString(),
        (record as any).checkOutTime ?? null,
        (record as any).latitude ?? null,
        (record as any).longitude ?? null,
        (record as any).markedVia ?? "manual",
        new Date().toISOString(),
        null,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM attendance WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    const created = row ? this.mapAttendance(row) as any : {
      id,
      memberId: record.memberId,
      checkInTime: (record as any).checkInTime ?? new Date().toISOString(),
      checkOutTime: (record as any).checkOutTime ?? null,
      latitude: (record as any).latitude ?? null,
      longitude: (record as any).longitude ?? null,
      markedVia: (record as any).markedVia ?? "manual",
    } as any;
    
    // Auto-sync to Turso (non-blocking)
    syncToTurso("attendance", id).catch(err => 
      console.error("Failed to auto-sync new attendance to Turso:", err)
    );
    
    return created;
  }

  async updateAttendance(id: string, record: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const current = await this.db.execute({ sql: `SELECT * FROM attendance WHERE id = ?`, args: [id] });
    const cur = current.rows[0] as any;
    if (!cur) return undefined;
    const merged = { ...cur, ...record } as any;
    await this.db.execute({
      sql: `UPDATE attendance SET member_id=?, check_in_time=?, check_out_time=?, latitude=?, longitude=?, marked_via=?, updated_at=? WHERE id=?`,
      args: [
        merged.memberId,
        merged.checkInTime ?? cur.check_in_time,
        merged.checkOutTime ?? null,
        merged.latitude ?? null,
        merged.longitude ?? null,
        merged.markedVia ?? cur.marked_via,
        new Date().toISOString(),
        id,
      ],
    });
    const r = await this.db.execute({ sql: `SELECT * FROM attendance WHERE id = ?`, args: [id] });
    const row = r.rows[0];
    const updated = row ? this.mapAttendance(row) as any : undefined;
    
    // Auto-sync to Turso (non-blocking)
    if (updated) {
      syncToTurso("attendance", id).catch(err => 
        console.error("Failed to auto-sync updated attendance to Turso:", err)
      );
    }
    
    return updated;
  }

  async deleteAttendance(id: string): Promise<boolean> {
    await this.ensureSchemaUpgrades();
    const r = await this.db.execute({ sql: `UPDATE attendance SET deleted_at = ?, updated_at = ? WHERE id = ?`, args: [new Date().toISOString(), new Date().toISOString(), id] });
    const deleted = (r.rowsAffected ?? 0) > 0;
    
    // Auto-sync deletion to Turso (non-blocking)
    if (deleted) {
      syncToTurso("attendance", id).catch(err => 
        console.error("Failed to auto-sync attendance deletion to Turso:", err)
      );
    }
    
    return deleted;
  }

  // Settings - simple key-value storage
  async getSettings(): Promise<Record<string, any>> {
    try {
      // Check if settings table exists, if not create it
      await this.db.execute({
        sql: `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`,
      });
      
      const result = await this.db.execute({ sql: `SELECT key, value FROM settings` });
      const settings: Record<string, any> = {};
      
      for (const row of result.rows as any[]) {
        const key = row.key;
        let value = row.value;
        // Try to parse JSON, otherwise use as string
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string
        }
        settings[key] = value;
      }
      
      return settings;
    } catch (err) {
      console.error("Error getting settings:", err);
      return {};
    }
  }

  async updateSettings(newSettings: Record<string, any>): Promise<Record<string, any>> {
    try {
      await this.db.execute({
        sql: `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`,
      });

      // Update or insert each setting
      for (const [key, value] of Object.entries(newSettings)) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await this.db.execute({
          sql: `INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          args: [key, valueStr],
        });
      }

      return await this.getSettings();
    } catch (err) {
      console.error("Error updating settings:", err);
      throw err;
    }
  }

  async getMemberByLoginCode(loginCode: string): Promise<Member | undefined> {
    const result = await this.db.execute({
      sql: `SELECT * FROM members WHERE login_code = ?`,
      args: [loginCode],
    });
    const row = result.rows[0];
    return row ? (this.mapMember(row) as any) : undefined;
  }

  // Plans CRUD
  async listPlans(): Promise<Plan[]> {
    try {
      await this.ensureSchemaUpgrades();
      const result = await this.db.execute({
        sql: `SELECT * FROM plans WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY name`,
      });
      return result.rows.map((row: any) => this.mapPlan(row)) as Plan[];
    } catch (error) {
      console.error("listPlans error:", error);
      return [];
    }
  }

  async getPlan(id: string): Promise<Plan | undefined> {
    const result = await this.db.execute({
      sql: `SELECT * FROM plans WHERE id = ?`,
      args: [id],
    });
    const row = result.rows[0];
    return row ? (this.mapPlan(row) as any) : undefined;
  }

  private mapPlan(row: any): Plan {
    return {
      id: row.id,
      name: row.name,
      duration: Number(row.duration || 0),
      price: String(row.price || "0"),
      features: row.features ? (typeof row.features === 'string' ? JSON.parse(row.features) : row.features) : [],
      isActive: Boolean(row.is_active ?? row.isActive ?? true),
    };
  }

  async createPlan(plan: InsertPlan): Promise<Plan> {
    try {
      const id = `plan_${Date.now().toString().slice(-8)}`;
      const featuresJson = plan.features ? JSON.stringify(plan.features) : null;
      await this.db.execute({
        sql: `INSERT INTO plans (id, name, duration, price, features, is_active, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          plan.name,
          plan.duration,
          plan.price,
          featuresJson,
          plan.isActive !== undefined ? (plan.isActive ? 1 : 0) : 1,
          new Date().toISOString(),
          null,
        ],
      });
      const created = await this.getPlan(id);
      if (!created) throw new Error("Failed to retrieve created plan");
      
      // Auto-sync to Turso (non-blocking)
      syncToTurso("plans", id).catch(err => 
        console.error("Failed to auto-sync new plan to Turso:", err)
      );
      
      return created;
    } catch (error) {
      console.error("createPlan error:", error);
      throw error;
    }
  }

  async updatePlan(id: string, plan: Partial<InsertPlan>): Promise<Plan | undefined> {
    const current = await this.getPlan(id);
    if (!current) return undefined;
    
    const updates: string[] = [];
    const args: any[] = [];
    
    if (plan.name !== undefined) {
      updates.push("name = ?");
      args.push(plan.name);
    }
    if (plan.duration !== undefined) {
      updates.push("duration = ?");
      args.push(plan.duration);
    }
    if (plan.price !== undefined) {
      updates.push("price = ?");
      args.push(plan.price);
    }
    if (plan.features !== undefined) {
      updates.push("features = ?");
      args.push(JSON.stringify(plan.features));
    }
    if (plan.isActive !== undefined) {
      updates.push("is_active = ?");
      args.push(plan.isActive ? 1 : 0);
    }
    
    if (updates.length === 0) return current;
    
    args.push(id);
    updates.push("updated_at = ?");
    args.push(new Date().toISOString());
    await this.db.execute({
      sql: `UPDATE plans SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });
    const updated = await this.getPlan(id);
    
    // Auto-sync to Turso (non-blocking)
    if (updated) {
      syncToTurso("plans", id).catch(err => 
        console.error("Failed to auto-sync updated plan to Turso:", err)
      );
    }
    
    return updated;
  }

  async deletePlan(id: string): Promise<boolean> {
    await this.ensureSchemaUpgrades();
    const result = await this.db.execute({
      sql: `UPDATE plans SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      args: [new Date().toISOString(), new Date().toISOString(), id],
    });
    const deleted = (result.rowsAffected ?? 0) > 0;
    
    // Auto-sync deletion to Turso (non-blocking)
    if (deleted) {
      syncToTurso("plans", id).catch(err => 
        console.error("Failed to auto-sync plan deletion to Turso:", err)
      );
    }
    
    return deleted;
  }
}

export const storage = new TursoStorage();
