import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Subscriptions ────────────────────────────────────────────────────────────
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "monthly", "quarterly", "annual", "lifetime",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active", "cancelled", "expired", "paused",
]);

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 128 }).notNull(),
  lemonSqueezyId: varchar("lemon_squeezy_id", { length: 255 }).notNull().unique(),
  orderId: varchar("order_id", { length: 255 }).notNull().default(""),
  plan: subscriptionPlanEnum("plan").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export type Subscription = typeof subscriptions.$inferSelect;

// ─── Solana Pay Sessions ──────────────────────────────────────────────────────
export const solanaTokenEnum = pgEnum("solana_token", ["usdc", "sol"]);

export const solanaSessionStatusEnum = pgEnum("solana_session_status", [
  "pending", "confirmed", "expired",
]);

export const solanaSessions = pgTable("solana_sessions", {
  id: varchar("id", { length: 128 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 128 }).notNull(),
  reference: varchar("reference", { length: 255 }).notNull().unique(),
  plan: subscriptionPlanEnum("plan").notNull(),
  token: solanaTokenEnum("token").notNull().default("usdc"),
  amountUsdc: decimal("amount_usdc", { precision: 10, scale: 4 }).notNull(),
  amountSol: decimal("amount_sol", { precision: 10, scale: 6 }),
  status: solanaSessionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  expiresAt: timestamp("expires_at").notNull(),
});

export type SolanaSession = typeof solanaSessions.$inferSelect;
