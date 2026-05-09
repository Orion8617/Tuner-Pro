import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, subscriptions, solanaSessions,
  type User, type InsertUser, type Subscription, type SolanaSession,
} from "@shared/schema";
import { randomUUID } from "crypto";

// ─── Re-export types for routes.ts ──────────────────────────────────────────
export type { User, InsertUser, Subscription, SolanaSession };

// ─── Storage interface ───────────────────────────────────────────────────────
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getSubscription(userId: string): Promise<Subscription | undefined>;
  getSubscriptionByLemonSqueezyId(lsId: string): Promise<Subscription | undefined>;
  upsertSubscription(sub: {
    userId: string;
    lemonSqueezyId: string;
    orderId: string;
    plan: "monthly" | "quarterly" | "annual" | "lifetime";
    status: "active" | "cancelled" | "expired" | "paused";
    currentPeriodEnd: string;
  }): Promise<Subscription>;
  updateSubscriptionStatus(lemonSqueezyId: string, status: Subscription["status"]): Promise<void>;
  createSolanaSession(data: {
    userId: string;
    reference: string;
    plan: "quarterly" | "lifetime";
    token: "usdc" | "sol";
    amountUsdc: number;
    amountSol?: number;
  }): Promise<SolanaSession>;
  getSolanaSession(reference: string): Promise<SolanaSession | undefined>;
  confirmSolanaSession(reference: string): Promise<void>;
  // ─── Admin ────────────────────────────────────────────────────────────────
  getAdminStats(): Promise<{
    activeTotal: number;
    byPlan: Record<string, number>;
    mrr: number;
    solanaConfirmed: number;
  }>;
  getRecentSubscriptions(limit: number): Promise<Subscription[]>;
  getRecentSolanaSessions(limit: number): Promise<SolanaSession[]>;
  grantPremium(userId: string, plan: "monthly" | "quarterly" | "annual" | "lifetime"): Promise<Subscription>;
}

// ─── PostgreSQL implementation ───────────────────────────────────────────────
class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const rows = await db.insert(users).values({ ...insertUser, id }).returning();
    return rows[0];
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const rows = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
      .limit(1);
    return rows[0];
  }

  async getSubscriptionByLemonSqueezyId(lsId: string): Promise<Subscription | undefined> {
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.lemonSqueezyId, lsId))
      .limit(1);
    return rows[0];
  }

  async upsertSubscription(data: {
    userId: string;
    lemonSqueezyId: string;
    orderId: string;
    plan: "monthly" | "quarterly" | "annual" | "lifetime";
    status: "active" | "cancelled" | "expired" | "paused";
    currentPeriodEnd: string;
  }): Promise<Subscription> {
    const now = new Date();
    const periodEnd = new Date(data.currentPeriodEnd);

    const existing = await this.getSubscriptionByLemonSqueezyId(data.lemonSqueezyId);

    if (existing) {
      const rows = await db
        .update(subscriptions)
        .set({
          userId: data.userId,
          orderId: data.orderId,
          plan: data.plan,
          status: data.status,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing.id))
        .returning();
      return rows[0];
    }

    const id = randomUUID();
    const rows = await db
      .insert(subscriptions)
      .values({
        id,
        userId: data.userId,
        lemonSqueezyId: data.lemonSqueezyId,
        orderId: data.orderId,
        plan: data.plan,
        status: data.status,
        currentPeriodEnd: periodEnd,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return rows[0];
  }

  async updateSubscriptionStatus(lemonSqueezyId: string, status: Subscription["status"]): Promise<void> {
    await db
      .update(subscriptions)
      .set({ status, updatedAt: new Date() })
      .where(eq(subscriptions.lemonSqueezyId, lemonSqueezyId));
  }

  async createSolanaSession(data: {
    userId: string;
    reference: string;
    plan: "quarterly" | "lifetime";
    token: "usdc" | "sol";
    amountUsdc: number;
    amountSol?: number;
  }): Promise<SolanaSession> {
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    const rows = await db
      .insert(solanaSessions)
      .values({
        id,
        userId: data.userId,
        reference: data.reference,
        plan: data.plan,
        token: data.token,
        amountUsdc: String(data.amountUsdc),
        amountSol: data.amountSol !== undefined ? String(data.amountSol) : null,
        status: "pending",
        createdAt: now,
        expiresAt,
      })
      .returning();
    return rows[0];
  }

  async getSolanaSession(reference: string): Promise<SolanaSession | undefined> {
    const rows = await db
      .select()
      .from(solanaSessions)
      .where(eq(solanaSessions.reference, reference))
      .limit(1);
    return rows[0];
  }

  async confirmSolanaSession(reference: string): Promise<void> {
    await db
      .update(solanaSessions)
      .set({ status: "confirmed" })
      .where(eq(solanaSessions.reference, reference));
  }

  async getAdminStats(): Promise<{
    activeTotal: number;
    byPlan: Record<string, number>;
    mrr: number;
    solanaConfirmed: number;
  }> {
    const rows = await db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(subscriptions)
      .groupBy(subscriptions.plan, subscriptions.status);

    const byPlan: Record<string, number> = {};
    let activeTotal = 0;

    for (const row of rows) {
      if (row.status === "active") {
        byPlan[row.plan] = (byPlan[row.plan] ?? 0) + row.count;
        activeTotal += row.count;
      }
    }

    const MRR_MAP: Record<string, number> = {
      monthly: 1.99,
      quarterly: 4.99 / 3,
      annual: 9.99 / 12,
      lifetime: 0,
    };
    const mrr = Object.entries(byPlan).reduce(
      (sum, [plan, cnt]) => sum + (MRR_MAP[plan] ?? 0) * cnt,
      0
    );

    const solanaRows = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(solanaSessions)
      .where(eq(solanaSessions.status, "confirmed"));
    const solanaConfirmed = solanaRows[0]?.count ?? 0;

    return { activeTotal, byPlan, mrr, solanaConfirmed };
  }

  async getRecentSubscriptions(limit: number): Promise<Subscription[]> {
    return db
      .select()
      .from(subscriptions)
      .orderBy(desc(subscriptions.createdAt))
      .limit(limit);
  }

  async getRecentSolanaSessions(limit: number): Promise<SolanaSession[]> {
    return db
      .select()
      .from(solanaSessions)
      .orderBy(desc(solanaSessions.createdAt))
      .limit(limit);
  }

  async grantPremium(
    userId: string,
    plan: "monthly" | "quarterly" | "annual" | "lifetime"
  ): Promise<Subscription> {
    const lsId = `admin-grant-${userId}-${Date.now()}`;
    const periodEnd =
      plan === "lifetime"
        ? new Date("2099-12-31").toISOString()
        : plan === "annual"
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : plan === "quarterly"
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return this.upsertSubscription({
      userId,
      lemonSqueezyId: lsId,
      orderId: lsId,
      plan,
      status: "active",
      currentPeriodEnd: periodEnd,
    });
  }
}

export const storage = new DbStorage();
