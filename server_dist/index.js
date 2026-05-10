var __defProp = Object.defineProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import crypto from "node:crypto";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

// server/storage.ts
import { eq, and, desc, sql as sql2 } from "drizzle-orm";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  insertUserSchema: () => insertUserSchema,
  solanaSessionStatusEnum: () => solanaSessionStatusEnum,
  solanaSessions: () => solanaSessions,
  solanaTokenEnum: () => solanaTokenEnum,
  subscriptionPlanEnum: () => subscriptionPlanEnum,
  subscriptionStatusEnum: () => subscriptionStatusEnum,
  subscriptions: () => subscriptions,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id", { length: 128 }).primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var subscriptionPlanEnum = pgEnum("subscription_plan", [
  "monthly",
  "quarterly",
  "annual",
  "lifetime"
]);
var subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "expired",
  "paused"
]);
var subscriptions = pgTable("subscriptions", {
  id: varchar("id", { length: 128 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 128 }).notNull(),
  lemonSqueezyId: varchar("lemon_squeezy_id", { length: 255 }).notNull().unique(),
  orderId: varchar("order_id", { length: 255 }).notNull().default(""),
  plan: subscriptionPlanEnum("plan").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});
var solanaTokenEnum = pgEnum("solana_token", ["usdc", "sol"]);
var solanaSessionStatusEnum = pgEnum("solana_session_status", [
  "pending",
  "confirmed",
  "expired"
]);
var solanaSessions = pgTable("solana_sessions", {
  id: varchar("id", { length: 128 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 128 }).notNull(),
  reference: varchar("reference", { length: 255 }).notNull().unique(),
  plan: subscriptionPlanEnum("plan").notNull(),
  token: solanaTokenEnum("token").notNull().default("usdc"),
  amountUsdc: decimal("amount_usdc", { precision: 10, scale: 4 }).notNull(),
  amountSol: decimal("amount_sol", { precision: 10, scale: 6 }),
  status: solanaSessionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  expiresAt: timestamp("expires_at").notNull()
});

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Database must be provisioned first.");
}
var pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 5e3
});
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { randomUUID } from "crypto";
var DbStorage = class {
  async getUser(id) {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }
  async getUserByUsername(username) {
    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return rows[0];
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const rows = await db.insert(users).values({ ...insertUser, id }).returning();
    return rows[0];
  }
  async getSubscription(userId) {
    const rows = await db.select().from(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))).limit(1);
    return rows[0];
  }
  async getSubscriptionByLemonSqueezyId(lsId) {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.lemonSqueezyId, lsId)).limit(1);
    return rows[0];
  }
  async upsertSubscription(data) {
    const now = /* @__PURE__ */ new Date();
    const periodEnd = new Date(data.currentPeriodEnd);
    const existing = await this.getSubscriptionByLemonSqueezyId(data.lemonSqueezyId);
    if (existing) {
      const rows2 = await db.update(subscriptions).set({
        userId: data.userId,
        orderId: data.orderId,
        plan: data.plan,
        status: data.status,
        currentPeriodEnd: periodEnd,
        updatedAt: now
      }).where(eq(subscriptions.id, existing.id)).returning();
      return rows2[0];
    }
    const id = randomUUID();
    const rows = await db.insert(subscriptions).values({
      id,
      userId: data.userId,
      lemonSqueezyId: data.lemonSqueezyId,
      orderId: data.orderId,
      plan: data.plan,
      status: data.status,
      currentPeriodEnd: periodEnd,
      createdAt: now,
      updatedAt: now
    }).returning();
    return rows[0];
  }
  async updateSubscriptionStatus(lemonSqueezyId, status) {
    await db.update(subscriptions).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq(subscriptions.lemonSqueezyId, lemonSqueezyId));
  }
  async createSolanaSession(data) {
    const id = randomUUID();
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1e3);
    const rows = await db.insert(solanaSessions).values({
      id,
      userId: data.userId,
      reference: data.reference,
      plan: data.plan,
      token: data.token,
      amountUsdc: String(data.amountUsdc),
      amountSol: data.amountSol !== void 0 ? String(data.amountSol) : null,
      status: "pending",
      createdAt: now,
      expiresAt
    }).returning();
    return rows[0];
  }
  async getSolanaSession(reference) {
    const rows = await db.select().from(solanaSessions).where(eq(solanaSessions.reference, reference)).limit(1);
    return rows[0];
  }
  async confirmSolanaSession(reference) {
    await db.update(solanaSessions).set({ status: "confirmed" }).where(eq(solanaSessions.reference, reference));
  }
  async getAdminStats() {
    const rows = await db.select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      count: sql2`cast(count(*) as int)`
    }).from(subscriptions).groupBy(subscriptions.plan, subscriptions.status);
    const byPlan = {};
    let activeTotal = 0;
    for (const row of rows) {
      if (row.status === "active") {
        byPlan[row.plan] = (byPlan[row.plan] ?? 0) + row.count;
        activeTotal += row.count;
      }
    }
    const MRR_MAP = {
      monthly: 1.99,
      quarterly: 4.99 / 3,
      annual: 9.99 / 12,
      lifetime: 0
    };
    const mrr = Object.entries(byPlan).reduce(
      (sum, [plan, cnt]) => sum + (MRR_MAP[plan] ?? 0) * cnt,
      0
    );
    const solanaRows = await db.select({ count: sql2`cast(count(*) as int)` }).from(solanaSessions).where(eq(solanaSessions.status, "confirmed"));
    const solanaConfirmed = solanaRows[0]?.count ?? 0;
    return { activeTotal, byPlan, mrr, solanaConfirmed };
  }
  async getRecentSubscriptions(limit) {
    return db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(limit);
  }
  async getRecentSolanaSessions(limit) {
    return db.select().from(solanaSessions).orderBy(desc(solanaSessions.createdAt)).limit(limit);
  }
  async grantPremium(userId, plan) {
    const lsId = `admin-grant-${userId}-${Date.now()}`;
    const periodEnd = plan === "lifetime" ? (/* @__PURE__ */ new Date("2099-12-31")).toISOString() : plan === "annual" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString() : plan === "quarterly" ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1e3).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
    return this.upsertSubscription({
      userId,
      lemonSqueezyId: lsId,
      orderId: lsId,
      plan,
      status: "active",
      currentPeriodEnd: periodEnd
    });
  }
};
var storage = new DbStorage();

// server/routes.ts
var USER_ID_REGEX = /^[a-zA-Z0-9_\-]{1,128}$/;
function isValidUserId(id) {
  return typeof id === "string" && USER_ID_REGEX.test(id);
}
var _rateMap = /* @__PURE__ */ new Map();
function rateLimit(ip, route, maxPerMinute) {
  const key = `${ip}:${route}`;
  const now = Date.now();
  const entry = _rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    _rateMap.set(key, { count: 1, resetAt: now + 6e4 });
    return true;
  }
  entry.count += 1;
  if (entry.count > maxPerMinute) return false;
  return true;
}
var USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
var PLAN_PRICES = {
  quarterly: { usdc: 4.99, sol: parseFloat(process.env.SOLANA_QUARTERLY_SOL || "0.035") },
  lifetime: { usdc: 14.99, sol: parseFloat(process.env.SOLANA_LIFETIME_SOL || "0.10") }
};
var _solanaConnection = null;
function getSolanaConnection() {
  if (!_solanaConnection) {
    const rpc = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    _solanaConnection = new Connection(rpc, "confirmed");
  }
  return _solanaConnection;
}
async function checkSolanaPaymentConfirmed(reference) {
  try {
    const connection = getSolanaConnection();
    const refPubkey = new PublicKey(reference);
    const signatures = await connection.getSignaturesForAddress(refPubkey, { limit: 1 });
    return signatures.length > 0 && !signatures[0].err;
  } catch (e) {
    console.error("Solana check error:", e);
    return false;
  }
}
function verifyWebhookSignature(rawBody, signature, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
function getPlanExpiry(plan) {
  if (plan === "lifetime") return (/* @__PURE__ */ new Date("2099-12-31")).toISOString();
  const days = plan === "quarterly" ? 90 : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1e3).toISOString();
}
async function registerRoutes(app2) {
  app2.get("/klonos-monitor", (_req, res) => {
    res.sendFile("klonos-monitor.html", { root: "./server/templates" });
  });
  app2.get("/api/subscription/status", async (req, res) => {
    const userId = req.query.userId;
    if (!isValidUserId(userId)) return res.status(400).json({ error: "Invalid userId" });
    const ip = req.ip || "unknown";
    if (!rateLimit(ip, "subscription-status", 30)) {
      return res.status(429).json({ error: "Too many requests" });
    }
    const subscription = await storage.getSubscription(userId);
    if (subscription && subscription.status === "active") {
      return res.json({
        isPremium: true,
        plan: subscription.plan,
        currentPeriodEnd: subscription.currentPeriodEnd,
        status: subscription.status
      });
    }
    return res.json({ isPremium: false });
  });
  app2.get("/api/checkout/url", (req, res) => {
    const plan = req.query.plan;
    const userId = req.query.userId;
    if (!isValidUserId(userId)) return res.status(400).json({ error: "Invalid userId" });
    if (!plan || !["monthly", "annual", "lifetime"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    const ip = req.ip || "unknown";
    if (!rateLimit(ip, "checkout-url", 10)) {
      return res.status(429).json({ error: "Too many requests" });
    }
    const monthlyUrl = process.env.LEMONSQUEEZY_CHECKOUT_URL_MONTHLY;
    const annualUrl = process.env.LEMONSQUEEZY_CHECKOUT_URL_ANNUAL;
    const lifetimeUrl = process.env.LEMONSQUEEZY_CHECKOUT_URL_LIFETIME;
    if (!monthlyUrl || !annualUrl) return res.status(500).json({ error: "Payment not configured" });
    let baseUrl;
    if (plan === "lifetime") {
      if (!lifetimeUrl) return res.status(500).json({ error: "Lifetime payment not configured" });
      baseUrl = lifetimeUrl;
    } else {
      baseUrl = plan === "annual" ? annualUrl : monthlyUrl;
    }
    const checkoutUrl = `${baseUrl}?checkout[custom][user_id]=${encodeURIComponent(userId)}`;
    return res.json({ checkoutUrl });
  });
  app2.post("/api/webhooks/lemonsqueezy", async (req, res) => {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ error: "Webhook not configured" });
    const signature = req.headers["x-signature"];
    if (!signature) return res.status(401).json({ error: "Missing signature" });
    const rawBody = req.rawBody;
    if (!rawBody) return res.status(400).json({ error: "Missing body" });
    try {
      if (!verifyWebhookSignature(rawBody, signature, secret)) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    } catch (e) {
      return res.status(401).json({ error: "Signature verification failed" });
    }
    const event = req.body;
    const eventName = event.meta?.event_name;
    const userId = event.meta?.custom_data?.user_id;
    if (!userId) return res.status(200).json({ received: true });
    const attrs = event.data?.attributes;
    const lemonSqueezyId = String(event.data?.id || "");
    switch (eventName) {
      case "subscription_created":
      case "subscription_updated": {
        const variantId = String(attrs?.variant_id || "");
        const annualVariantId = process.env.LEMONSQUEEZY_VARIANT_ANNUAL || "";
        const lifetimeVariantId = process.env.LEMONSQUEEZY_VARIANT_LIFETIME || "";
        const plan = variantId === lifetimeVariantId ? "lifetime" : variantId === annualVariantId ? "annual" : "monthly";
        const statusMap = {
          active: "active",
          cancelled: "cancelled",
          expired: "expired",
          paused: "paused",
          on_trial: "active",
          past_due: "active",
          unpaid: "expired"
        };
        const status = statusMap[attrs?.status] || "active";
        const renewsAt = attrs?.renews_at || attrs?.ends_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
        await storage.upsertSubscription({ userId, lemonSqueezyId, orderId: String(attrs?.order_id || ""), plan, status, currentPeriodEnd: renewsAt });
        break;
      }
      case "subscription_cancelled":
        await storage.updateSubscriptionStatus(lemonSqueezyId, "cancelled");
        break;
      case "subscription_expired":
        await storage.updateSubscriptionStatus(lemonSqueezyId, "expired");
        break;
      case "subscription_paused":
        await storage.updateSubscriptionStatus(lemonSqueezyId, "paused");
        break;
      case "subscription_resumed":
      case "subscription_unpaused":
        await storage.updateSubscriptionStatus(lemonSqueezyId, "active");
        break;
      case "order_created": {
        const orderVariantId = String(attrs?.first_order_item?.variant_id || "");
        const lifetimeVarId = process.env.LEMONSQUEEZY_VARIANT_LIFETIME || "";
        if (orderVariantId === lifetimeVarId && lifetimeVarId !== "") {
          await storage.upsertSubscription({
            userId,
            lemonSqueezyId,
            orderId: String(event.data?.id || ""),
            plan: "lifetime",
            status: "active",
            currentPeriodEnd: (/* @__PURE__ */ new Date("2099-12-31")).toISOString()
          });
        }
        break;
      }
    }
    return res.status(200).json({ received: true });
  });
  app2.post("/api/checkout/solana/create", async (req, res) => {
    const { userId, plan, token = "usdc" } = req.body;
    if (!isValidUserId(userId) || !["quarterly", "lifetime"].includes(plan)) {
      return res.status(400).json({ error: "userId and plan (quarterly|lifetime) required" });
    }
    if (!["usdc", "sol"].includes(token)) {
      return res.status(400).json({ error: "Invalid token type" });
    }
    const ip = req.ip || "unknown";
    if (!rateLimit(ip, "solana-create", 5)) {
      return res.status(429).json({ error: "Too many requests" });
    }
    const recipientAddress = process.env.SOLANA_WALLET_ADDRESS;
    if (!recipientAddress) return res.status(503).json({ error: "Solana payments not configured" });
    try {
      new PublicKey(recipientAddress);
    } catch {
      return res.status(500).json({ error: "Invalid SOLANA_WALLET_ADDRESS" });
    }
    const referenceKeypair = Keypair.generate();
    const reference = referenceKeypair.publicKey.toBase58();
    const prices = PLAN_PRICES[plan];
    const amountUsdc = prices.usdc;
    const amountSol = prices.sol;
    await storage.createSolanaSession({ userId, reference, plan, token, amountUsdc, amountSol });
    const planLabel = plan === "lifetime" ? "Lifetime Access" : "3-Month Access";
    const planMemo = `${plan}-${userId}`;
    let url;
    if (token === "sol") {
      const params = new URLSearchParams({
        amount: String(amountSol),
        reference,
        label: "GuitarTune Pro",
        message: planLabel,
        memo: planMemo
      });
      url = `solana:${recipientAddress}?${params.toString()}`;
    } else {
      const params = new URLSearchParams({
        "spl-token": USDC_MINT,
        amount: String(amountUsdc),
        reference,
        label: "GuitarTune Pro",
        message: planLabel,
        memo: planMemo
      });
      url = `solana:${recipientAddress}?${params.toString()}`;
    }
    const phantomUrl = `https://phantom.app/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent("https://guitartune.app")}`;
    console.log(`Solana checkout created: plan=${plan} token=${token} amount=${token === "sol" ? amountSol + " SOL" : amountUsdc + " USDC"} user=${userId}`);
    return res.json({ url, phantomUrl, reference, plan, token, amountUsdc, amountSol });
  });
  app2.get("/api/checkout/solana/verify", async (req, res) => {
    const { reference, userId } = req.query;
    if (!isValidUserId(userId) || !reference || typeof reference !== "string") {
      return res.status(400).json({ error: "reference and userId required" });
    }
    const ip = req.ip || "unknown";
    if (!rateLimit(ip, "solana-verify", 20)) {
      return res.status(429).json({ error: "Too many requests" });
    }
    const session = await storage.getSolanaSession(reference);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    if (/* @__PURE__ */ new Date() > new Date(session.expiresAt)) return res.json({ status: "expired" });
    if (session.status === "confirmed") return res.json({ status: "confirmed" });
    const confirmed = await checkSolanaPaymentConfirmed(reference);
    if (confirmed) {
      await storage.confirmSolanaSession(reference);
      await storage.upsertSubscription({
        userId,
        lemonSqueezyId: `solana-${reference}`,
        orderId: reference,
        plan: session.plan,
        status: "active",
        currentPeriodEnd: getPlanExpiry(session.plan)
      });
      console.log(`Solana ${session.plan} confirmed (${session.token}) for user ${userId}`);
      return res.json({ status: "confirmed" });
    }
    return res.json({ status: "pending" });
  });
  app2.post("/api/webhooks/revenuecat", async (req, res) => {
    const authHeader = req.headers["authorization"];
    const webhookSecret = process.env.REVENUECAT_SECRET_API_KEY;
    if (webhookSecret) {
      const token = authHeader?.replace("Bearer ", "").trim();
      if (!token || token !== webhookSecret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    const event = req.body;
    const eventType = event.event?.type || "";
    const appUserId = event.event?.app_user_id || "";
    const aliases = event.event?.aliases || [];
    const userId = appUserId || aliases[0];
    if (!userId || !isValidUserId(userId)) {
      return res.status(200).json({ received: true });
    }
    const productId = event.event?.product_id || "";
    const expiresAt = event.event?.expiration_at_ms ? new Date(event.event.expiration_at_ms).toISOString() : null;
    function rcProductToPlan(pid) {
      if (pid.includes("annual") || pid.includes("yearly")) return "annual";
      if (pid.includes("lifetime")) return "lifetime";
      return "monthly";
    }
    const plan = rcProductToPlan(productId);
    const lsId = `rc-${userId}-${productId}`;
    const periodEnd = expiresAt || (plan === "lifetime" ? (/* @__PURE__ */ new Date("2099-12-31")).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString());
    try {
      switch (eventType) {
        case "INITIAL_PURCHASE":
        case "RENEWAL":
        case "UNCANCELLATION":
        case "NON_SUBSCRIPTION_PURCHASE":
          await storage.upsertSubscription({
            userId,
            lemonSqueezyId: lsId,
            orderId: event.event?.transaction_id || lsId,
            plan,
            status: "active",
            currentPeriodEnd: periodEnd
          });
          console.log(`[RC Webhook] ${eventType} \u2192 user=${userId} plan=${plan}`);
          break;
        case "CANCELLATION":
          await storage.updateSubscriptionStatus(lsId, "cancelled");
          console.log(`[RC Webhook] CANCELLATION \u2192 user=${userId}`);
          break;
        case "EXPIRATION":
          await storage.updateSubscriptionStatus(lsId, "expired");
          console.log(`[RC Webhook] EXPIRATION \u2192 user=${userId}`);
          break;
        case "BILLING_ISSUE":
          console.warn(`[RC Webhook] BILLING_ISSUE \u2192 user=${userId}`);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("[RC Webhook] Error processing event:", err);
      return res.status(500).json({ error: "Internal error" });
    }
    return res.status(200).json({ received: true });
  });
  const ADMIN_ID = "admin-juanjose-klonengine-2025";
  function requireAdmin(req, res) {
    const adminId = req.headers["x-admin-id"];
    if (adminId !== ADMIN_ID) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
    return true;
  }
  app2.get("/api/admin/dashboard", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const [stats, recentSubs, recentSolana] = await Promise.all([
        storage.getAdminStats(),
        storage.getRecentSubscriptions(20),
        storage.getRecentSolanaSessions(20)
      ]);
      return res.json({ stats, recentSubs, recentSolana });
    } catch (err) {
      console.error("[Admin] dashboard error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });
  app2.post("/api/admin/grant-premium", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { userId, plan } = req.body;
    if (!isValidUserId(userId)) return res.status(400).json({ error: "Invalid userId" });
    if (!["monthly", "quarterly", "annual", "lifetime"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    try {
      const sub = await storage.grantPremium(userId, plan);
      console.log(`[Admin] Granted ${plan} premium to user ${userId}`);
      return res.json({ success: true, subscription: sub });
    } catch (err) {
      console.error("[Admin] grant-premium error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/seo-data.ts
var COMPETITORS = [
  {
    slug: "guitartuna",
    name: "GuitarTuna",
    shortName: "GuitarTuna",
    appStoreRating: "4.8",
    annualPrice: "$47.99/yr",
    hasAds: true,
    freeAds: true,
    tuningCount: "50+",
    bilingual: true,
    description: "GuitarTuna is the market-leading guitar tuner app with over 50 million downloads. It offers a large library of tunings and a metronome but monetizes heavily through ads in the free tier \u2014 showing full-screen ads every 30 seconds, including during active tuning sessions.",
    mainComplaint: "Aggressive ads that appear every 30 seconds \u2014 even while you're in the middle of tuning a string. Users on Reddit (r/guitar) consistently cite this as their main pain point.",
    gtAdvantage: "GuitarTune never shows ads during tuning \u2014 not even in the free tier. Same pitch accuracy, same core tunings, 78% cheaper for Pro ($9.99/yr vs $47.99/yr).",
    faqs: [
      { q: "Does GuitarTuna have ads?", a: "Yes. GuitarTuna's free tier shows full-screen ads approximately every 30 seconds, including while you're actively tuning strings. Removing ads requires GuitarTuna Premium at $47.99/year." },
      { q: "What is a good GuitarTuna alternative with no ads?", a: "GuitarTune is a direct GuitarTuna alternative with zero ads \u2014 even on the free tier. It offers the same pitch accuracy, Drop D, Open G, DADGAD and more tunings, and Pro costs $9.99/year (78% cheaper)." },
      { q: "Is GuitarTuna free?", a: "GuitarTuna has a free tier but it shows ads frequently during use. To remove ads you need GuitarTuna Premium ($47.99/year or $3.99/month)." },
      { q: "How does GuitarTune compare to GuitarTuna?", a: "Both apps use real-time pitch detection for guitar tuning. GuitarTune's key differences: no ads ever (including free tier), $9.99/year vs $47.99/year for Pro, bilingual English/Spanish, tuning history, and Solana Pay support." }
    ]
  },
  {
    slug: "fender-tune",
    name: "Fender Tune",
    shortName: "Fender Tune",
    appStoreRating: "4.7",
    annualPrice: "$35.99/yr",
    hasAds: false,
    freeAds: false,
    tuningCount: "22",
    bilingual: true,
    description: "Fender Tune is the official tuner from Fender Musical Instruments, designed primarily for beginners and Fender guitar owners. It integrates with Fender Play lessons and has a clean UI, but its free tier locks most alternate tunings behind a paywall and focuses heavily on upselling Fender Play subscriptions.",
    mainComplaint: "Heavy upselling to Fender Play ($9.99/mo) and limited free tunings. The app feels like a funnel for the Fender ecosystem rather than a standalone tuning tool.",
    gtAdvantage: "GuitarTune is a standalone tuner with no ecosystem lock-in. More free tunings (3 free alternates vs Fender Tune's standard-only free), cheaper Pro ($9.99/yr vs $35.99/yr), and bilingual without requiring a Fender account.",
    faqs: [
      { q: "Is Fender Tune free?", a: "Fender Tune has a free tier for standard tuning but most alternate tunings and features require Fender Play ($9.99/month) or Fender Tone+ Pro ($35.99/year)." },
      { q: "What's better: Fender Tune or GuitarTune?", a: "For standalone tuning, GuitarTune offers more free tunings, no upsells, no ecosystem lock-in, and cheaper Pro pricing ($9.99/yr vs $35.99/yr). Fender Tune is better if you're already in the Fender Play ecosystem." },
      { q: "Does Fender Tune have Drop D?", a: "Yes, but Drop D is locked behind Fender Pro in Fender Tune. In GuitarTune, Drop D is a Pro feature at $9.99/year \u2014 less than a third of Fender's price." }
    ]
  },
  {
    slug: "boss-tuner",
    name: "Boss Tuner",
    shortName: "Boss",
    appStoreRating: "4.5",
    annualPrice: "$29.99 one-time",
    hasAds: false,
    freeAds: false,
    tuningCount: "10",
    bilingual: false,
    description: "Boss Tuner is the official app from Boss (Roland Corporation), a legendary name in guitar effects pedals. It's targeted at experienced musicians and offers a clean, pedal-style UI. It's a paid-only app (one-time purchase) with no free tier, which means zero ads \u2014 but also zero trial.",
    mainComplaint: "No free tier \u2014 requires upfront payment with no trial. English-only. Limited tuning selection. No ongoing development updates. The UI mimics hardware pedals but can feel dated.",
    gtAdvantage: "GuitarTune has a fully functional free tier (no payment required to start), bilingual EN/ES, tuning history, and custom themes in Pro. The $9.99/year Pro is also cheaper than Boss Tuner's $29.99 one-time fee in value terms over 3+ years.",
    faqs: [
      { q: "Is Boss Tuner free?", a: "No. Boss Tuner requires a one-time purchase (approximately $29.99) with no free tier. GuitarTune is free to download with a fully functional ad-free tuner, no payment required." },
      { q: "Boss Tuner vs GuitarTune \u2014 which is better?", a: "Both are ad-free tuners. GuitarTune is free to start, has more tunings, is bilingual, and offers tuning history. Boss Tuner has a strong hardware-inspired UI and Boss brand credibility. For value, GuitarTune wins." },
      { q: "Does Boss Tuner work for alternate tunings?", a: "Boss Tuner supports a limited set of tunings. GuitarTune supports 15 tunings including Drop D, DADGAD, Open G, and Nashville in Pro, plus tuning history and custom themes." }
    ]
  },
  {
    slug: "pano-tuner",
    name: "Pano Tuner",
    shortName: "Pano",
    appStoreRating: "4.7",
    annualPrice: "$19.99 one-time",
    hasAds: false,
    freeAds: false,
    tuningCount: "Chromatic only",
    bilingual: false,
    description: "Pano Tuner is a well-regarded chromatic tuner known for its accuracy and clean design. Unlike guitar-specific tuners, it's a universal chromatic tuner \u2014 it tunes any instrument but has no guitar-specific presets, string selectors, or alternate tuning libraries.",
    mainComplaint: "Not guitar-specific \u2014 no string selector, no alternate tuning presets, no Drop D or DADGAD. Works as a chromatic reference but requires the user to know their target note. English-only.",
    gtAdvantage: "GuitarTune is designed specifically for guitarists with a string selector, 10 named guitar tuning presets, and a guitar-oriented dial UI. Pano Tuner is better for multi-instrument use; GuitarTune is better for guitarists who want a guitar-first experience.",
    faqs: [
      { q: "Is Pano Tuner good for guitar?", a: "Pano Tuner is accurate for chromatic tuning but has no guitar-specific features like tuning presets, string selectors, or alternate tuning libraries. GuitarTune is built specifically for guitar with 10 named tunings, a string selector, and cents-accuracy display." },
      { q: "Pano Tuner vs GuitarTune \u2014 which should I use?", a: "If you play multiple instruments, Pano Tuner's chromatic approach works across all of them. If you're primarily a guitarist \u2014 especially one who uses alternate tunings like Drop D or Open G \u2014 GuitarTune is the better choice." },
      { q: "Does Pano Tuner have Drop D?", a: "No. Pano Tuner is chromatic \u2014 you tune to any note manually. GuitarTune has Drop D as a named preset (Pro tier, $9.99/year) where all 6 strings are pre-configured for Drop D tuning." }
    ]
  },
  {
    slug: "chromatic-guitar-tuner",
    name: "Chromatic Guitar Tuner",
    shortName: "Chromatic Tuner",
    appStoreRating: "4.3",
    annualPrice: "Free (ads)",
    hasAds: true,
    freeAds: true,
    tuningCount: "6",
    bilingual: false,
    description: "Various generic 'Chromatic Guitar Tuner' apps exist across the App Store and Google Play, typically built by small developers with heavy ad monetization. They offer basic tuning functionality but suffer from poor UI, aggressive ads, and infrequent updates.",
    mainComplaint: "Heavy ad load, poor UI design, infrequent updates, and inconsistent accuracy. Many are abandoned apps with no active development.",
    gtAdvantage: "GuitarTune is actively maintained, has a professional UI, no ads in the free tier, and offers genuine technical features (autocorrelation engine, cents readout, tuning history) that generic tuner apps lack.",
    faqs: [
      { q: "Are free chromatic guitar tuner apps accurate?", a: "Accuracy varies. Many free chromatic tuner apps use basic pitch detection that can be inconsistent. GuitarTune uses autocorrelation-based pitch detection, the same algorithm used in professional tuning software, accurate to \xB11 cent." },
      { q: "What is the best free guitar tuner app with no ads?", a: "GuitarTune offers a free guitar tuner with zero ads \u2014 not reduced ads, but literally no ads. Standard tuning plus three alternate tunings (Double Drop D, Open C, All Fourths) are free forever." }
    ]
  },
  {
    slug: "guitar-tuna-pro",
    name: "GuitarTuna Pro",
    shortName: "GuitarTuna Pro",
    appStoreRating: "4.8",
    annualPrice: "$47.99/yr",
    hasAds: false,
    freeAds: false,
    tuningCount: "50+",
    bilingual: true,
    description: "GuitarTuna Pro is the paid tier of GuitarTuna that removes ads and unlocks the full tuning library. While it delivers a genuinely good product, the price ($47.99/year) is the primary friction point \u2014 more than 4x the cost of GuitarTune Pro.",
    mainComplaint: "High price point. At $47.99/year, GuitarTuna Pro is one of the most expensive tuner subscriptions available, competing unfavorably against GuitarTune's $9.99/year for core functionality.",
    gtAdvantage: "GuitarTune Pro at $9.99/year delivers the same core accuracy, 15 tunings, tuning history, and bilingual support at 79% of the price savings. For players who only need guitar tuning (not the full GuitarTuna ecosystem), GuitarTune Pro is the smarter value.",
    faqs: [
      { q: "Is GuitarTuna Pro worth it?", a: "GuitarTuna Pro removes ads and unlocks 50+ tunings for $47.99/year. If you need a large tuning library or use other GuitarTuna features, it may be worth it. If you just need accurate guitar tuning with alternate tunings, GuitarTune Pro ($9.99/year) delivers the same core value at 79% less." },
      { q: "What does GuitarTuna Pro include?", a: "GuitarTuna Pro includes ad-free tuning, 50+ tunings, a chord library, and scale trainer. GuitarTune Pro ($9.99/yr) includes ad-free tuning, 15 guitar-specific tunings, tuning history, and custom themes \u2014 focused purely on the tuning experience." }
    ]
  },
  {
    slug: "ultimate-guitar-tuner",
    name: "Ultimate Guitar Tuner",
    shortName: "UG Tuner",
    appStoreRating: "4.5",
    annualPrice: "Part of UG subscription ($49.99/yr)",
    hasAds: true,
    freeAds: true,
    tuningCount: "Standard + common alternates",
    bilingual: false,
    description: "Ultimate Guitar's built-in tuner is part of the Ultimate Guitar tabs and chords platform. It's functional but primarily designed as a feature within the UG ecosystem rather than a standalone tuner. Access to the tuner without ads requires an Ultimate Guitar Pro subscription.",
    mainComplaint: "Not a standalone app \u2014 requires the full UG ecosystem. UG Pro is $49.99/year for tabs + tuner + metronome. Excessive for users who just need a tuner.",
    gtAdvantage: "GuitarTune is a dedicated tuner app. If you just need a tuner (not tabs or chord libraries), GuitarTune Pro at $9.99/year is purpose-built and nearly 80% cheaper than UG Pro.",
    faqs: [
      { q: "Does Ultimate Guitar have a free tuner?", a: "Yes, Ultimate Guitar includes a tuner but it shows ads in the free tier. Removing ads requires Ultimate Guitar Pro ($49.99/year), which is designed for tab and chord access \u2014 not just tuning." },
      { q: "Ultimate Guitar tuner vs GuitarTune \u2014 which is better?", a: "For pure tuning, GuitarTune wins. It's faster to open, has more guitar-specific tuning presets, no ads in the free tier, and Pro is $9.99/year vs $49.99/year for UG Pro." }
    ]
  },
  {
    slug: "n-track-tuner",
    name: "n-Track Tuner",
    shortName: "n-Track",
    appStoreRating: "4.4",
    annualPrice: "Free / $4.99 one-time",
    hasAds: true,
    freeAds: true,
    tuningCount: "Chromatic",
    bilingual: false,
    description: "n-Track Tuner is a chromatic tuner from the n-Track Studio team, known for its DAW software. It's a functional utility tuner with decent accuracy but shows ads in the free version and lacks guitar-specific presets.",
    mainComplaint: "Ads in free version, no guitar-specific tuning presets, basic UI with no string selector or alternate tuning library.",
    gtAdvantage: "GuitarTune is guitar-specific with named presets, a string selector, and an ad-free free tier. n-Track Tuner requires a paid upgrade ($4.99) to remove ads; GuitarTune's core tuner is always ad-free.",
    faqs: [
      { q: "Is n-Track Tuner any good?", a: "n-Track Tuner is a functional chromatic tuner but lacks guitar-specific features like tuning presets and string selectors. GuitarTune is built specifically for guitarists with 10 named tunings and an ad-free free tier." }
    ]
  }
];
var TUNINGS = [
  {
    slug: "standard",
    name: "Standard Tuning",
    shorthand: "EADGBE",
    strings: ["E2", "A2", "D3", "G3", "B3", "E4"],
    notes: ["E", "A", "D", "G", "B", "E"],
    genre: "All genres",
    difficulty: "Beginner",
    description: "Standard tuning (EADGBE) is the default tuning for 6-string guitar and the foundation of virtually all guitar instruction. From low to high, the strings are tuned to E, A, D, G, B, and E. The intervals between strings are mostly fourths (with a major third between G and B), creating a comfortable range for chords and scales.",
    howTo: [
      "Start with the low E string (thickest). It should sound like the lowest E note.",
      "Tune the A string: press the low E string at fret 5 \u2014 it should match the open A string.",
      "Tune the D string: press the A string at fret 5 \u2014 match to open D string.",
      "Tune the G string: press the D string at fret 5 \u2014 match to open G string.",
      "Tune the B string: press the G string at fret 4 (not 5) \u2014 match to open B string.",
      "Tune the high E string: press the B string at fret 5 \u2014 match to open high E string.",
      "Or use GuitarTune: open the app, select Standard, pluck each string, and follow the dial."
    ],
    commonSongs: ["Wonderwall (Oasis)", "Hotel California (Eagles)", "Smoke on the Water (Deep Purple)", "Sweet Home Alabama (Lynyrd Skynyrd)"],
    isPremium: false,
    faqs: [
      { q: "What is standard guitar tuning?", a: "Standard guitar tuning is EADGBE \u2014 from the thickest (lowest) string to the thinnest (highest): E2, A2, D3, G3, B3, E4. It's the default tuning for 6-string electric and acoustic guitar." },
      { q: "How do I tune my guitar to standard tuning?", a: "Use a chromatic tuner app like GuitarTune. Open the app, select Standard tuning, pluck each string, and follow the dial until each string shows green (in tune). Start from the low E and work up to the high E." },
      { q: "Why is standard tuning EADGBE?", a: "Standard tuning evolved from lute and guitar traditions, designed to minimize hand movement for the most common chord shapes and scales. The interval pattern (mostly perfect fourths with one major third between G and B) makes it versatile for both chords and lead playing." }
    ]
  },
  {
    slug: "drop-d",
    name: "Drop D Tuning",
    shorthand: "DADGBE",
    strings: ["D2", "A2", "D3", "G3", "B3", "E4"],
    notes: ["D", "A", "D", "G", "B", "E"],
    genre: "Rock, Metal, Blues",
    difficulty: "Beginner",
    description: "Drop D tuning lowers the low E string one full step down to D, creating a D-A-D-G-B-E tuning. It's the most popular alternate tuning in rock and metal because it enables powerful one-finger power chords on the lowest three strings and adds a heavier, deeper sound to the guitar.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Only the low E string (thickest) needs to change \u2014 drop it down one full step to D.",
      "Reference: the low E string in Drop D should sound the same as the open D string (two strings up) \u2014 just an octave lower.",
      "In GuitarTune Pro: select 'Drop D' from the tuning menu, pluck the low E string, and follow the dial down until it reads D (green).",
      "The other 5 strings stay the same as standard tuning."
    ],
    commonSongs: ["Killing in the Name (Rage Against the Machine)", "Everlong (Foo Fighters)", "Heart-Shaped Box (Nirvana)", "Black Hole Sun (Soundgarden)", "Moby Dick (Led Zeppelin)"],
    isPremium: true,
    faqs: [
      { q: "What is Drop D tuning?", a: "Drop D tuning (DADGBE) lowers the thickest guitar string from E down to D. The other five strings stay in standard tuning. Drop D makes power chords easier and gives the guitar a heavier, deeper sound." },
      { q: "How do I tune to Drop D?", a: "Start in standard tuning. Only the low E string changes \u2014 tune it down one whole step to D. You can match it to the open D string (one octave higher) or use GuitarTune Pro's Drop D preset for automatic detection." },
      { q: "What songs use Drop D tuning?", a: "Many rock and metal songs use Drop D: 'Everlong' by Foo Fighters, 'Killing in the Name' by Rage Against the Machine, 'Heart-Shaped Box' by Nirvana, and 'Moby Dick' by Led Zeppelin are all played in Drop D." },
      { q: "Is Drop D the same as open D?", a: "No. Drop D (DADGBE) only lowers the low E string to D \u2014 the rest stay in standard. Open D (DADF#AD) retunes all strings to form a D major chord when played open. They sound very different." }
    ]
  },
  {
    slug: "open-g",
    name: "Open G Tuning",
    shorthand: "DGDGBD",
    strings: ["D2", "G2", "D3", "G3", "B3", "D4"],
    notes: ["D", "G", "D", "G", "B", "D"],
    genre: "Blues, Slide, Country, Rock",
    difficulty: "Intermediate",
    description: "Open G tuning (DGDGBD) forms a G major chord when all strings are played open. It's the quintessential tuning for slide guitar and blues, and has been used on some of the most iconic rock recordings in history. Keith Richards of The Rolling Stones famously uses Open G tuning \u2014 with the low D string removed \u2014 for rhythm guitar parts.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Lower string 6 (low E) from E down to D \u2014 one whole step down.",
      "Leave string 5 (A) unchanged.",
      "Leave string 4 (D) unchanged.",
      "Leave string 3 (G) unchanged.",
      "Leave string 2 (B) unchanged.",
      "Lower string 1 (high E) from E down to D \u2014 one whole step down.",
      "Result: D-G-D-G-B-D. Use GuitarTune Pro's Open G preset for automatic tuning guidance."
    ],
    commonSongs: ["Brown Sugar (Rolling Stones)", "Honky Tonk Women (Rolling Stones)", "Little Wing (Jimi Hendrix)", "Prodigal Son (Robert Johnson)", "Start Me Up (Rolling Stones)"],
    isPremium: true,
    faqs: [
      { q: "What is Open G tuning?", a: "Open G tuning (DGDGBD) is an alternate guitar tuning where strumming all open strings produces a G major chord. It's popular for slide guitar, blues, and was Keith Richards' tuning of choice for many Rolling Stones songs." },
      { q: "How do I tune to Open G?", a: "From standard tuning, lower strings 6 (low E\u2192D) and 1 (high E\u2192D) by one whole step each. Leave strings 5, 4, 3, and 2 unchanged. The result is D-G-D-G-B-D. Use GuitarTune Pro's Open G preset for automatic detection." },
      { q: "Is Open G good for beginners?", a: "Open G is approachable for intermediate players. Chords become simpler (major chords are just a barre), but the retuning changes familiar chord shapes. It's especially rewarding for slide guitar and blues." },
      { q: "What's the difference between Open G and Open D?", a: "Open G (DGDGBD) forms a G major chord open. Open D (DADF#AD) forms a D major chord open. Open G is more commonly used in rock and blues; Open D is popular in folk, Delta blues, and acoustic slide playing." }
    ]
  },
  {
    slug: "dadgad",
    name: "DADGAD Tuning",
    shorthand: "DADGAD",
    strings: ["D2", "A2", "D3", "G3", "A3", "D4"],
    notes: ["D", "A", "D", "G", "A", "D"],
    genre: "Folk, Celtic, Fingerpicking, World Music",
    difficulty: "Intermediate",
    description: "DADGAD tuning (D-A-D-G-A-D) creates an ambiguous, modal sound \u2014 neither major nor minor \u2014 that's ideal for Celtic music, folk fingerpicking, and atmospheric compositions. It was developed by guitarist Davy Graham in the 1960s after hearing Moroccan music, and has since become a cornerstone of Celtic and acoustic guitar playing.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Lower the low E string (string 6) from E to D \u2014 one whole step down.",
      "Leave the A string (string 5) unchanged.",
      "Leave the D string (string 4) unchanged.",
      "Leave the G string (string 3) unchanged.",
      "Lower the B string (string 2) from B to A \u2014 one whole step down.",
      "Lower the high E string (string 1) from E to D \u2014 one whole step down.",
      "Result: D-A-D-G-A-D. Use GuitarTune Pro's DADGAD preset for automatic guidance."
    ],
    commonSongs: ["Kashmir (Led Zeppelin)", "Bron-Y-Aur Stomp (Led Zeppelin)", "Black Mountain Side (Led Zeppelin)", "The Galway Girl (traditional Irish)", "Various Celtic and Irish folk tunes"],
    isPremium: true,
    faqs: [
      { q: "What is DADGAD tuning?", a: "DADGAD is an alternate guitar tuning (D-A-D-G-A-D) that creates a suspended, modal sound commonly used in Celtic, folk, and world music. Strumming open strings creates a Dsus4 chord." },
      { q: "What songs use DADGAD tuning?", a: "Led Zeppelin's 'Kashmir' and 'Bron-Y-Aur Stomp' are famously played in DADGAD (or variations close to it). It's also widely used in Celtic, Irish, and Scottish folk music." },
      { q: "How do I tune to DADGAD?", a: "From standard tuning, lower strings 6, 2, and 1 by one whole step each (E\u2192D for strings 6 and 1, B\u2192A for string 2). Strings 5, 4, and 3 stay unchanged. Use GuitarTune Pro's DADGAD preset for automatic detection." },
      { q: "Is DADGAD hard to learn?", a: "DADGAD requires relearning chord shapes since the familiar positions all change. However, the tuning is very guitar-friendly for fingerpicking patterns and pentatonic riffs. Most intermediate guitarists can get comfortable within a few weeks of practice." }
    ]
  },
  {
    slug: "open-d",
    name: "Open D Tuning",
    shorthand: "DADF#AD",
    strings: ["D2", "A2", "D3", "F#3", "A3", "D4"],
    notes: ["D", "A", "D", "F#", "A", "D"],
    genre: "Blues, Folk, Slide Guitar, Acoustic",
    difficulty: "Intermediate",
    description: "Open D tuning (DADF#AD) forms a D major chord when all strings are played open. It's one of the oldest alternate tunings and a favorite for Delta blues slide guitar. The lower tension and resonant D major voicing make it ideal for bottleneck slide playing and acoustic fingerpicking.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Lower the low E string (string 6) from E to D (one whole step).",
      "Leave the A string (string 5) unchanged.",
      "Leave the D string (string 4) unchanged.",
      "Lower the G string (string 3) from G to F# (one half step).",
      "Lower the B string (string 2) from B to A (one whole step).",
      "Lower the high E string (string 1) from E to D (one whole step).",
      "Result: D-A-D-F#-A-D. Use GuitarTune Pro's Open D preset."
    ],
    commonSongs: ["The Sky Is Crying (Elmore James)", "Slide guitar blues standards", "Big Yellow Taxi (Joni Mitchell)", "Sonny Boy Williamson \u2014 various tracks"],
    isPremium: true,
    faqs: [
      { q: "What is Open D tuning?", a: "Open D tuning (DADF#AD) tunes the guitar so that strumming all open strings produces a D major chord. It's popular for slide guitar, Delta blues, and acoustic fingerpicking." },
      { q: "How do I tune to Open D?", a: "From standard tuning, lower strings 6, 3, 2, and 1 (while keeping strings 5 and 4 the same). String 6: E\u2192D, String 3: G\u2192F#, String 2: B\u2192A, String 1: E\u2192D. Use GuitarTune Pro's Open D preset." },
      { q: "What's the difference between Open D and Open G?", a: "Open D (DADF#AD) produces a D major chord open and is common in Delta blues and folk. Open G (DGDGBD) produces a G major chord and is more common in rock and classic blues. Both are used for slide guitar." }
    ]
  },
  {
    slug: "open-e",
    name: "Open E Tuning",
    shorthand: "EBE G#BE",
    strings: ["E2", "B2", "E3", "G#3", "B3", "E4"],
    notes: ["E", "B", "E", "G#", "B", "E"],
    genre: "Blues, Slide Guitar, Rock",
    difficulty: "Intermediate",
    description: "Open E tuning (EBEG#BE) tunes the guitar to form an E major chord when all strings are played open. It's particularly popular for slide guitar and is associated with legends like Duane Allman and Derek Trucks. Unlike Open D, which tunes down, Open E requires tuning three strings up \u2014 which increases string tension. Many players use lighter strings with Open E.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Leave the low E string (string 6) unchanged.",
      "Tune the A string (string 5) up from A to B (one whole step up).",
      "Tune the D string (string 4) up from D to E (one whole step up).",
      "Tune the G string (string 3) up from G to G# (one half step up).",
      "Leave the B string (string 2) unchanged.",
      "Leave the high E string (string 1) unchanged.",
      "Note: Tuning up increases string tension \u2014 use lighter gauge strings to avoid damage.",
      "Use GuitarTune Pro's Open E preset for automatic guidance."
    ],
    commonSongs: ["Statesboro Blues (Allman Brothers)", "Midnight Rider (Allman Brothers)", "Jumpin' Jack Flash (Rolling Stones)", "Derek Trucks Band \u2014 various recordings"],
    isPremium: true,
    faqs: [
      { q: "What is Open E tuning?", a: "Open E tuning (EBEG#BE) tunes the guitar to form an E major chord when all strings are strummed open. It's popular for slide guitar and closely associated with Duane Allman." },
      { q: "Is Open E hard on guitar strings?", a: "Yes. Open E requires tuning three strings up from standard, which increases tension. Many guitarists recommend using a lighter string gauge (10s instead of 11s) when playing in Open E to reduce stress on the neck and strings." },
      { q: "What's the difference between Open E and Open D?", a: "Open E forms an E major chord open; Open D forms a D major chord. Open E is tuned up (higher tension), while Open D is tuned down (lower tension). Both are used for slide guitar, but Open D is considered easier on the guitar." }
    ]
  },
  {
    slug: "drop-c",
    name: "Drop C Tuning",
    shorthand: "CADGBE (low C)",
    strings: ["C2", "G2", "C3", "F3", "A3", "D4"],
    notes: ["C", "G", "C", "F", "A", "D"],
    genre: "Metal, Heavy Rock, Hardcore",
    difficulty: "Intermediate",
    description: "Drop C tuning takes Drop D and shifts everything down one additional whole step, resulting in a C-G-C-F-A-D tuning. It delivers an extremely heavy, low-end sound favored in metal, metalcore, and heavy rock. Like Drop D, it allows one-finger power chords on the lowest three strings, now at an even lower pitch.",
    howTo: [
      "Method 1 (from standard): Tune all strings down one whole step to D-G-C-F-A-D, then drop the low D string down one more step to C.",
      "Method 2 (from Drop D): Lower every string by one whole step \u2014 low D becomes C, A becomes G, D becomes C, G becomes F, B becomes A, high E becomes D.",
      "Result: C-G-C-F-A-D. The guitar will feel much looser \u2014 heavier strings (11s or 12s) are recommended.",
      "Use GuitarTune Pro's Drop C preset for automatic detection."
    ],
    commonSongs: ["Chop Suey (System of a Down)", "Down with the Sickness (Disturbed)", "Numb (Linkin Park)", "B.Y.O.B. (System of a Down)"],
    isPremium: true,
    faqs: [
      { q: "What is Drop C tuning?", a: "Drop C tuning (CGCFAD) lowers all guitar strings by one whole step from Drop D tuning. It creates a heavier, lower sound popular in metal and heavy rock. The low C string allows powerful one-finger power chords." },
      { q: "How do I tune to Drop C?", a: "Start from Drop D tuning (DADGBE), then lower every string by one additional whole step. The result is C-G-C-F-A-D. Use GuitarTune Pro's Drop C preset for automatic detection." },
      { q: "What gauge strings should I use for Drop C?", a: "For Drop C, heavier gauge strings (0.011\u20130.054 or 0.012\u20130.056) are recommended to maintain playable tension at the lower pitch. Standard 0.009s or 0.010s will be too loose and floppy in Drop C." }
    ]
  },
  {
    slug: "double-drop-d",
    name: "Double Drop D Tuning",
    shorthand: "DADGBD",
    strings: ["D2", "A2", "D3", "G3", "B3", "D4"],
    notes: ["D", "A", "D", "G", "B", "D"],
    genre: "Folk, Rock, Blues",
    difficulty: "Beginner",
    description: "Double Drop D tunes both the low and high E strings down to D, resulting in D-A-D-G-B-D. It retains the familiar feel of standard tuning while adding D-chord resonance to both ends of the guitar. Neil Young is the most notable user of Double Drop D, giving his acoustic playing its distinctive droning quality.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Lower the low E string (string 6) from E to D \u2014 one whole step down.",
      "Leave strings 5, 4, 3, and 2 unchanged.",
      "Lower the high E string (string 1) from E to D \u2014 one whole step down.",
      "Result: D-A-D-G-B-D. This is a free tuning in GuitarTune."
    ],
    commonSongs: ["Cinnamon Girl (Neil Young)", "Ohio (CSNY)", "Down by the River (Neil Young)", "The Needle and the Damage Done (Neil Young)"],
    isPremium: false,
    faqs: [
      { q: "What is Double Drop D tuning?", a: "Double Drop D (DADGBD) lowers both the low and high E strings from E to D. It's closely associated with Neil Young and creates a droning, resonant quality for acoustic and electric guitar." },
      { q: "How is Double Drop D different from Drop D?", a: "Drop D (DADGBE) only lowers the low E string. Double Drop D (DADGBD) also lowers the high E string to D. Both share the same low D; Double Drop D adds D resonance on the top string as well." }
    ]
  },
  {
    slug: "open-c",
    name: "Open C Tuning",
    shorthand: "CGCGCE",
    strings: ["C2", "G2", "C3", "G3", "C4", "E4"],
    notes: ["C", "G", "C", "G", "C", "E"],
    genre: "Folk, Fingerpicking, Alternative",
    difficulty: "Intermediate",
    description: "Open C tuning (CGCGCE) forms a C major chord when all strings are played open. It's popular for fingerpicking and acoustic guitar because of its warm, resonant sound and the ease of playing suspended and add9 chords. The tuning creates an especially rich, piano-like sound for solo acoustic pieces.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Lower string 6 (low E) from E to C \u2014 a minor third down (three half steps).",
      "Lower string 5 (A) from A to G \u2014 one whole step down.",
      "Lower string 4 (D) from D to C \u2014 one whole step down.",
      "Leave string 3 (G) unchanged.",
      "Raise string 2 (B) from B to C \u2014 one half step up.",
      "Leave string 1 (high E) unchanged.",
      "Result: C-G-C-G-C-E. Use GuitarTune's free Open C preset for automatic guidance."
    ],
    commonSongs: ["Friends (Led Zeppelin)", "Bron-Y-Aur (Led Zeppelin)", "Many John Fahey acoustic pieces", "Various folk and fingerpicking compositions"],
    isPremium: false,
    faqs: [
      { q: "What is Open C tuning?", a: "Open C tuning (CGCGCE) tunes the guitar so that all open strings form a C major chord. It's popular for acoustic fingerpicking and creates a warm, rich sound especially suited to solo guitar pieces." },
      { q: "How do I tune to Open C?", a: "From standard, lower strings 6 (E\u2192C), 5 (A\u2192G), and 4 (D\u2192C), raise string 2 (B\u2192C), and leave strings 3 and 1 unchanged. Use GuitarTune's free Open C preset for automatic guidance." }
    ]
  },
  {
    slug: "all-fourths",
    name: "All Fourths Tuning",
    shorthand: "EADGCF",
    strings: ["E2", "A2", "D3", "G3", "C4", "F4"],
    notes: ["E", "A", "D", "G", "C", "F"],
    genre: "Jazz, Progressive, Music Theory",
    difficulty: "Advanced",
    description: "All Fourths tuning (EADGCF) extends the standard tuning pattern \u2014 which is mostly fourths \u2014 to be perfectly consistent across all six strings. The only change from standard is raising the B string to C and the high E string to F. This creates a logically consistent pattern where all chord shapes and scale patterns are symmetrical across every string pair, making it highly valued by music theorists and jazz guitarists.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Leave strings 6, 5, 4, and 3 unchanged (E-A-D-G).",
      "Raise string 2 (B) up from B to C \u2014 one half step up.",
      "Raise string 1 (high E) from E up to F \u2014 one half step up.",
      "Result: E-A-D-G-C-F. All intervals between adjacent strings are now perfect fourths.",
      "Use GuitarTune's free All Fourths preset."
    ],
    commonSongs: ["Used by Robert Fripp (King Crimson)", "Used by Stanley Jordan for jazz", "Common in progressive and avant-garde guitar"],
    isPremium: false,
    faqs: [
      { q: "What is All Fourths tuning?", a: "All Fourths tuning (EADGCF) makes every string-to-string interval a perfect fourth, unlike standard tuning which has a major third between G and B. This makes chord shapes and scales symmetrical across all string pairs." },
      { q: "Who plays in All Fourths tuning?", a: "Robert Fripp of King Crimson and Stanley Jordan have both used All Fourths tuning. It's also popular among musicians with a strong theory background who want consistent patterns across the fretboard." },
      { q: "Is All Fourths tuning good for beginners?", a: "All Fourths is more advanced \u2014 standard chord shapes don't transfer, requiring you to relearn most shapes. It's rewarding for theoretically-oriented players but not ideal for beginners starting out." }
    ]
  },
  {
    slug: "drop-b",
    name: "Drop B Tuning",
    shorthand: "BF#BEG#C#",
    strings: ["B1", "F#2", "B2", "E3", "G#3", "C#4"],
    notes: ["B", "F#", "B", "E", "G#", "C#"],
    genre: "Metal, Djent, Progressive Metal",
    difficulty: "Advanced",
    description: "Drop B tuning (B-F#-B-E-G#-C#) drops all strings down one and a half steps from standard, then drops the low string an additional step to B. It produces an extremely heavy, ultra-low sound used in modern metal, djent, and progressive metal. Bands like Slipknot and Bullet for My Valentine have used Drop B for its crushing low end.",
    howTo: [
      "Method 1 \u2014 from Drop C tuning: Lower every string by one additional half step.",
      "Drop C is C-G-C-F-A-D. Lowering each string one half step gives B-F#-B-E-G#-C#.",
      "Method 2 \u2014 from standard: Lower all strings three half steps (one and a half steps), then lower string 6 one additional half step.",
      "Result: B-F#-B-E-G#-C#. Use very heavy strings (12\u201356 or 13\u201362) \u2014 standard gauge strings will feel unplayably loose.",
      "GuitarTune Pro's chromatic dial can guide you for Drop B tuning."
    ],
    commonSongs: ["Psychosocial (Slipknot)", "Hand of Blood (Bullet for My Valentine)", "Various Architects songs", "Modern metalcore and djent compositions"],
    isPremium: true,
    faqs: [
      { q: "What is Drop B tuning?", a: "Drop B tuning (BF#BEG#C#) lowers all strings one and a half steps from standard, then drops the low string an additional step to B. It creates an extremely heavy, low sound used in modern metal and djent." },
      { q: "What strings should I use for Drop B?", a: "Drop B requires heavy gauge strings \u2014 at minimum 0.012\u20130.056, ideally 0.013\u20130.062. Standard 10s or 11s will be unplayably floppy. Many players use a dedicated guitar setup for Drop B." },
      { q: "What bands play in Drop B?", a: "Slipknot have used Drop B on tracks like 'Psychosocial.' Bullet for My Valentine and various metalcore and djent artists also use Drop B for its ultra-heavy low end." }
    ]
  },
  {
    slug: "open-a",
    name: "Open A Tuning",
    shorthand: "EAE A C#E",
    strings: ["E2", "A2", "E3", "A3", "C#4", "E4"],
    notes: ["E", "A", "E", "A", "C#", "E"],
    genre: "Blues, Slide Guitar, Country",
    difficulty: "Intermediate",
    description: "Open A tuning (E-A-E-A-C#-E) forms an A major chord when all strings are played open. It's closely related to Open G \u2014 essentially the same chord shape shifted up a whole step \u2014 and is widely used for slide guitar and Delta blues. The tuning is particularly effective for bottleneck playing in the key of A, which is central to the blues tradition.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Leave string 6 (low E) unchanged.",
      "Leave string 5 (A) unchanged.",
      "Raise string 4 (D) from D to E \u2014 one whole step up.",
      "Raise string 3 (G) from G to A \u2014 one whole step up.",
      "Raise string 2 (B) from B to C# \u2014 one whole step up.",
      "Leave string 1 (high E) unchanged.",
      "Result: E-A-E-A-C#-E. Increased tension on strings 4, 3, and 2 \u2014 consider lighter gauges."
    ],
    commonSongs: ["Dust My Broom (Elmore James)", "Open A blues standards", "Country slide guitar", "Various Robert Johnson-influenced recordings"],
    isPremium: true,
    faqs: [
      { q: "What is Open A tuning?", a: "Open A tuning (EAEAC#E) tunes the guitar so all open strings form an A major chord. It's popular for slide guitar and blues in the key of A, closely related to Open G tuning shifted up one step." },
      { q: "Is Open A the same as Open G?", a: "Open A and Open G produce the same major chord voicing on all open strings, but in different keys. Open A (EAEAC#E) is one whole step higher than Open G (DGDGBD). Both are used for slide guitar." },
      { q: "How do I tune to Open A?", a: "From standard, raise strings 4, 3, and 2 each by one whole step (D\u2192E, G\u2192A, B\u2192C#). Leave strings 6, 5, and 1 unchanged. Use lighter gauge strings to handle the increased tension." }
    ]
  },
  {
    slug: "half-step-down",
    name: "Half Step Down (Eb)",
    shorthand: "Eb Ab Db Gb Bb Eb",
    strings: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"],
    notes: ["Eb", "Ab", "Db", "Gb", "Bb", "Eb"],
    genre: "Rock, Blues, Classical, All Genres",
    difficulty: "Beginner",
    description: "Half step down tuning lowers all six strings by one half step from standard, resulting in Eb-Ab-Db-Gb-Bb-Eb (also written as D#-G#-C#-F#-A#-D#). It's one of the most common alternate tunings in rock, used extensively by Jimi Hendrix, Slash, and Stevie Ray Vaughan. The slightly lower pitch is easier to sing over for many vocalists and reduces string tension for easier bending.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Lower every string by one half step: E\u2192Eb, A\u2192Ab, D\u2192Db, G\u2192Gb, B\u2192Bb, E\u2192Eb.",
      "All strings move down by the same amount \u2014 the chord shapes and scale patterns stay identical to standard.",
      "In GuitarTune Pro, select the Eb/Half Step Down preset and pluck each string to follow the dial.",
      "The guitar will feel slightly looser \u2014 string bending becomes easier."
    ],
    commonSongs: ["Purple Haze (Jimi Hendrix)", "November Rain (Guns N' Roses)", "Pride and Joy (Stevie Ray Vaughan)", "Cult of Personality (Living Colour)", "Black Magic Woman (Santana)"],
    isPremium: true,
    faqs: [
      { q: "What is half step down tuning?", a: "Half step down tuning lowers all guitar strings by one half step from standard, resulting in Eb-Ab-Db-Gb-Bb-Eb. Chord shapes and scale patterns are identical to standard tuning \u2014 everything just sounds a half step lower." },
      { q: "Why do guitarists tune half a step down?", a: "Common reasons: easier string bending (lower tension), matching a vocalist's key, matching the sound of classic recordings (Hendrix, SRV, Guns N' Roses), or personal preference for the slightly darker tone." },
      { q: "What famous songs are in half step down tuning?", a: "Jimi Hendrix's 'Purple Haze,' Stevie Ray Vaughan's 'Pride and Joy,' Guns N' Roses' 'November Rain,' and many other rock classics are recorded in Eb/half step down tuning." }
    ]
  },
  {
    slug: "whole-step-down",
    name: "Whole Step Down (D)",
    shorthand: "D G C F A D",
    strings: ["D2", "G2", "C3", "F3", "A3", "D4"],
    notes: ["D", "G", "C", "F", "A", "D"],
    genre: "Rock, Metal, Grunge, Alternative",
    difficulty: "Beginner",
    description: "Whole step down tuning (D-G-C-F-A-D) lowers all six strings by one full step from standard. Like half step down, the chord shapes and scale patterns are identical to standard tuning \u2014 everything sounds a whole step lower. It delivers a heavier, darker tone than standard and was a signature sound of grunge and early 2000s hard rock. Kurt Cobain, Alice in Chains, and many other artists recorded in this tuning.",
    howTo: [
      "Start from standard EADGBE tuning.",
      "Lower every string by one whole step: E\u2192D, A\u2192G, D\u2192C, G\u2192F, B\u2192A, E\u2192D.",
      "All shapes remain the same as standard tuning \u2014 a G chord shape produces an F chord, a C shape produces a Bb chord, etc.",
      "Use GuitarTune Pro's Whole Step Down preset for automatic detection.",
      "Heavier strings (11s or 12s) are recommended to maintain comfortable tension."
    ],
    commonSongs: ["In Bloom (Nirvana)", "Would? (Alice in Chains)", "Sad But True (Metallica \u2014 variations)", "Come as You Are (Nirvana)"],
    isPremium: true,
    faqs: [
      { q: "What is whole step down tuning?", a: "Whole step down tuning (DGCFAD) lowers all strings by one full step from standard. The result is a heavier, darker tone with the same chord and scale shapes as standard \u2014 just sounding one step lower." },
      { q: "What's the difference between Drop D and whole step down?", a: "Drop D only lowers the low E string to D. Whole step down lowers all six strings to D-G-C-F-A-D. In whole step down, the relationship between strings is identical to standard tuning; in Drop D, only the lowest string changes." },
      { q: "What bands use whole step down tuning?", a: "Nirvana used whole step down on several songs. Alice in Chains, early Metallica, and many grunge and alternative bands used it for a heavier, lower sound while keeping standard chord shapes." }
    ]
  },
  {
    slug: "nashville",
    name: "Nashville Tuning",
    shorthand: "E A D G B E (high strung)",
    strings: ["E3", "A3", "D4", "G3", "B3", "E4"],
    notes: ["E", "A", "D", "G", "B", "E"],
    genre: "Country, Pop, Studio Recording",
    difficulty: "Intermediate",
    description: "Nashville tuning (also called high-strung tuning) uses the same note names as standard tuning (EADGBE) but replaces the four lowest strings with lighter-gauge strings tuned one octave higher. The G, B, and high E strings stay the same. This creates a bright, shimmering, 12-string-like quality and is widely used in Nashville recording studios to layer with a standard-tuned guitar for a rich, full sound.",
    howTo: [
      "You need a special string set \u2014 use the octave strings from a 12-string guitar set (the thinner string from each pair) for strings 6, 5, 4, and 3.",
      "Tune string 6 to E3 (one octave above standard low E).",
      "Tune string 5 to A3 (one octave above standard A).",
      "Tune string 4 to D4 (one octave above standard D).",
      "Leave string 3 (G3), string 2 (B3), and string 1 (E4) at their standard pitches.",
      "Result: E3-A3-D4-G3-B3-E4. The note names match standard tuning but the low strings sound an octave higher."
    ],
    commonSongs: ["Used on countless Nashville country recordings", "Dust in the Wind (Kansas \u2014 layered with standard)", "Wild Horses (Rolling Stones \u2014 studio layering)", "Common in modern pop and indie production"],
    isPremium: true,
    faqs: [
      { q: "What is Nashville tuning?", a: "Nashville tuning (high-strung tuning) uses the same note names as standard EADGBE, but strings 6, 5, 4, and 3 are replaced with thinner strings tuned one octave higher. It creates a bright, chimey quality often used in studio recording." },
      { q: "Can I use regular strings for Nashville tuning?", a: "No. Regular strings tuned up an octave would break. You need the octave (thinner) strings from a 12-string set for the bottom four strings. The top two strings (B and high E) use standard strings." },
      { q: "Why is it called Nashville tuning?", a: "It's named after Nashville, Tennessee, where session guitarists commonly use it as a layering technique in recordings. A Nashville-tuned guitar played alongside a standard-tuned guitar creates a rich, 12-string-like sound without actually playing a 12-string." }
    ]
  }
];

// server/seo-routes.ts
var BRAND = "GuitarTune";
var BASE_URL = "https://guitartune.app";
function htmlEscape(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function buildHead(title, description, canonical, schemaJson) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${htmlEscape(title)}</title>
<meta name="description" content="${htmlEscape(description)}">
<link rel="canonical" href="${htmlEscape(canonical)}">
<meta property="og:title" content="${htmlEscape(title)}">
<meta property="og:description" content="${htmlEscape(description)}">
<meta property="og:url" content="${htmlEscape(canonical)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
${schemaJson}
</script>
${buildCss()}
</head>`;
}
function buildCss() {
  return `<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{--cyan:#4AEDC4;--bg:#0A0A0A;--surface:#111;--border:#1a1a1a}
  body{background:var(--bg);color:#fff;font-family:Arial,sans-serif;line-height:1.6}
  a{color:var(--cyan);text-decoration:none}
  a:hover{text-decoration:underline}
  nav{display:flex;align-items:center;justify-content:space-between;padding:20px 40px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:100}
  .logo{font-size:20px;font-weight:900;color:var(--cyan);letter-spacing:2px;font-family:'Arial Black',Arial,sans-serif}
  .nav-links{display:flex;gap:24px;font-size:14px;color:#555}
  .nav-links a{color:#555}
  .nav-links a:hover{color:var(--cyan)}
  .nav-cta{background:var(--cyan);color:#0A0A0A;font-size:14px;font-weight:900;padding:9px 22px;border-radius:50px;text-decoration:none;text-transform:uppercase;letter-spacing:1px}
  .wrap{max-width:960px;margin:0 auto;padding:0 24px}
  h1{font-size:clamp(32px,5vw,56px);font-weight:900;font-family:'Arial Black',Arial,sans-serif;line-height:1.05;letter-spacing:-1px}
  h2{font-size:28px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;margin:48px 0 16px}
  h2::before{content:'';display:block;width:32px;height:3px;background:var(--cyan);margin-bottom:12px}
  h3{font-size:18px;font-weight:700;margin:24px 0 10px;color:#ccc}
  p{color:#888;font-size:15px;line-height:1.75;margin-bottom:14px}
  .hero{padding:72px 0 56px;text-align:center}
  .hero h1 span{color:var(--cyan)}
  .hero .sub{font-size:18px;color:#777;max-width:600px;margin:20px auto 40px}
  .hero-cta{display:inline-block;background:var(--cyan);color:#0A0A0A;font-size:16px;font-weight:900;padding:16px 40px;border-radius:50px;text-transform:uppercase;letter-spacing:1px;margin-right:12px}
  .hero-sec{display:inline-block;color:#555;font-size:15px;font-weight:700;padding:16px 24px}
  .section{padding:60px 0}
  .section.alt{background:var(--surface)}
  .tag{display:inline-block;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--cyan);border:1px solid #1a3a2e;background:#0D1A17;padding:6px 16px;border-radius:4px;margin-bottom:24px}
  .compare-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:14px}
  .compare-table th{background:var(--surface);padding:12px 16px;text-align:left;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px;color:#555;border-bottom:2px solid var(--border)}
  .compare-table th.us{color:var(--cyan);background:#0D1A17}
  .compare-table td{padding:12px 16px;border-bottom:1px solid var(--border);color:#888;vertical-align:middle}
  .compare-table td.us-val{background:#0D1A17;color:#fff}
  .good{color:var(--cyan)}
  .bad{color:#ff4444}
  .mid{color:#FFD700}
  .faq-list{display:flex;flex-direction:column;gap:0}
  .faq-item{border-bottom:1px solid var(--border);padding:24px 0}
  .faq-q{font-size:16px;font-weight:700;color:#fff;margin-bottom:10px}
  .faq-a{font-size:15px;color:#888;line-height:1.7}
  .pill-grid{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}
  .pill{background:var(--surface);border:1px solid var(--border);border-radius:50px;padding:10px 20px;font-size:14px;color:#888;font-weight:700}
  .pill.active{border-color:var(--cyan);color:var(--cyan)}
  .steps{display:flex;flex-direction:column;gap:0;margin:24px 0}
  .step{display:flex;gap:20px;padding:20px 0;border-bottom:1px solid var(--border)}
  .step-num{font-size:36px;font-weight:900;color:#1a1a1a;min-width:48px;font-family:'Arial Black',Arial,sans-serif}
  .step-body h4{font-size:16px;font-weight:700;margin-bottom:6px;color:#fff}
  .step-body p{margin:0;font-size:14px}
  .internal-links{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}
  .internal-links a{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 18px;font-size:13px;color:#888;font-weight:700;transition:border-color .2s}
  .internal-links a:hover{border-color:var(--cyan);color:var(--cyan);text-decoration:none}
  .cta-block{background:#0D1A17;border:1px solid #1a3a2e;border-radius:16px;padding:48px;text-align:center;margin:60px 0}
  .cta-block h2{margin:0 0 12px;font-size:32px}
  .cta-block h2::before{display:none}
  .cta-block p{max-width:500px;margin:0 auto 28px;color:#777}
  .breadcrumb{padding:16px 0;font-size:13px;color:#444}
  .breadcrumb a{color:#555}
  .breadcrumb span{margin:0 8px;color:#333}
  footer{padding:40px;border-top:1px solid var(--border);text-align:center;color:#333;font-size:13px}
  footer a{color:#444;margin:0 12px}
  .songs-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin:16px 0}
  .song-item{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:13px;color:#888}
  @media(max-width:600px){nav{padding:16px 20px}.wrap{padding:0 16px}h1{font-size:28px}.hero{padding:48px 0 36px}.cta-block{padding:32px 20px}}
</style>`;
}
function buildNav(activePath) {
  return `<nav>
  <a href="/" class="logo">${BRAND}</a>
  <div class="nav-links">
    <a href="/compare">Compare</a>
    <a href="/tunings">Tunings</a>
  </div>
  <a href="/#download" class="nav-cta">Download Free</a>
</nav>`;
}
function buildFooter(relatedLinks) {
  const links = relatedLinks.map((l) => `<a href="${l.href}">${htmlEscape(l.label)}</a>`).join("");
  return `<footer>
  <div>${links}</div>
  <p style="margin-top:16px">\xA9 2026 ${BRAND} \xB7 <a href="/">guitartune.app</a> \xB7 <a href="/compare">Compare</a> \xB7 <a href="/tunings">Tunings</a></p>
</footer>`;
}
function competitorPage(c) {
  const title = `GuitarTune vs ${c.name}: Side-by-Side Comparison (2026)`;
  const desc2 = `Compare GuitarTune vs ${c.name}. Ad-free, $9.99/year, 10 guitar tunings. See feature matrix, pricing, and why guitarists are switching.`;
  const canonical = `${BASE_URL}/vs/${c.slug}`;
  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": BRAND,
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "iOS, Android",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free tier available. Pro from $9.99/year."
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "124"
    },
    "description": `GuitarTune is a free, ad-free guitar tuner app with 15 tunings, bilingual support, and Pro from $9.99/year.`
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": c.faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  };
  const combinedSchema = JSON.stringify([softwareAppSchema, faqSchema], null, 2);
  const relatedCompetitors = COMPETITORS.filter((x) => x.slug !== c.slug).slice(0, 4);
  const relatedTunings = TUNINGS.slice(0, 4);
  const adsFreeStr = c.freeAds ? '<span class="bad">\u2717 Ads in free tier</span>' : '<span class="good">\u2713 Ad-free</span>';
  const bilingualStr = c.bilingual ? '<span class="good">\u2713</span>' : '<span class="bad">\u2717 English only</span>';
  return `${buildHead(title, desc2, canonical, combinedSchema)}
<body>
${buildNav(`/vs/${c.slug}`)}
<div class="wrap">
  <div class="breadcrumb"><a href="/">Home</a><span>\u203A</span><a href="/compare">Compare</a><span>\u203A</span>vs ${htmlEscape(c.shortName)}</div>
  <section class="hero" style="text-align:left;padding-top:48px">
    <div class="tag">Head-to-Head Comparison</div>
    <h1>GuitarTune vs <span>${htmlEscape(c.name)}</span></h1>
    <p class="sub" style="margin-left:0;text-align:left">${desc2}</p>
    <a href="/#download" class="hero-cta">Try GuitarTune Free</a>
    <a href="#comparison" class="hero-sec">See comparison \u2193</a>
  </section>
</div>

<div class="section alt">
  <div class="wrap">
    <h2 id="comparison">Feature Comparison</h2>
    <table class="compare-table">
      <thead>
        <tr>
          <th>Feature</th>
          <th class="us">GuitarTune</th>
          <th>${htmlEscape(c.shortName)}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Ad-free experience</td>
          <td class="us-val"><span class="good">\u2713 Always ad-free</span></td>
          <td>${adsFreeStr}</td>
        </tr>
        <tr>
          <td>Annual Pro price</td>
          <td class="us-val"><span class="good">$9.99/year</span></td>
          <td><span class="${c.annualPrice.startsWith("$9") ? "mid" : "bad"}">${htmlEscape(c.annualPrice)}</span></td>
        </tr>
        <tr>
          <td>Lifetime purchase</td>
          <td class="us-val"><span class="good">\u2713 $14.99</span></td>
          <td>${c.slug === "boss-tuner" || c.slug === "pano-tuner" ? '<span class="mid">\u2713 (one-time)</span>' : '<span class="bad">\u2717 Not available</span>'}</td>
        </tr>
        <tr>
          <td>Guitar tunings</td>
          <td class="us-val"><span class="good">15 tunings (4 free)</span></td>
          <td>${htmlEscape(c.tuningCount)}</td>
        </tr>
        <tr>
          <td>Bilingual (EN/ES)</td>
          <td class="us-val"><span class="good">\u2713 Auto-detected</span></td>
          <td>${bilingualStr}</td>
        </tr>
        <tr>
          <td>Tuning history</td>
          <td class="us-val"><span class="good">\u2713 Pro feature</span></td>
          <td><span class="bad">\u2717 Not available</span></td>
        </tr>
        <tr>
          <td>Cents accuracy display</td>
          <td class="us-val"><span class="good">\u2713 Real-time</span></td>
          <td><span class="good">\u2713</span></td>
        </tr>
        <tr>
          <td>Crypto payment</td>
          <td class="us-val"><span class="good">\u2713 Solana/USDC</span></td>
          <td><span class="bad">\u2717</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<div class="section">
  <div class="wrap">
    <h2>About ${htmlEscape(c.name)}</h2>
    <p>${htmlEscape(c.description)}</p>
    <h3>Main user complaint with ${htmlEscape(c.shortName)}</h3>
    <p>${htmlEscape(c.mainComplaint)}</p>
    <h3>Why players switch to GuitarTune</h3>
    <p>${htmlEscape(c.gtAdvantage)}</p>
  </div>
</div>

<div class="section alt">
  <div class="wrap">
    <h2>Frequently Asked Questions</h2>
    <div class="faq-list">
      ${c.faqs.map((faq) => `<div class="faq-item"><div class="faq-q">${htmlEscape(faq.q)}</div><div class="faq-a">${htmlEscape(faq.a)}</div></div>`).join("")}
    </div>
  </div>
</div>

<div class="section">
  <div class="wrap">
    <div class="cta-block">
      <h2>Try GuitarTune Free</h2>
      <p>No ads. No sign-up. Download and tune your first string in under 10 seconds.</p>
      <a href="/#download" class="hero-cta">Download Free</a>
    </div>

    <h2>Compare More Apps</h2>
    <div class="internal-links">
      ${relatedCompetitors.map((r) => `<a href="/vs/${r.slug}">GuitarTune vs ${htmlEscape(r.shortName)}</a>`).join("")}
      <a href="/compare">All comparisons \u2192</a>
    </div>

    <h2>Guitar Tuning Guides</h2>
    <div class="internal-links">
      ${relatedTunings.map((t) => `<a href="/tunings/${t.slug}">How to tune to ${htmlEscape(t.name)}</a>`).join("")}
      <a href="/tunings">All tunings \u2192</a>
    </div>
  </div>
</div>

${buildFooter([
    { href: "/compare", label: "All Comparisons" },
    { href: "/tunings", label: "All Tunings" },
    { href: "/", label: "Home" }
  ])}
</body>
</html>`;
}
function tuningPage(t) {
  const title = `How to Tune Guitar to ${t.name} (${t.shorthand}) \u2014 Step-by-Step Guide`;
  const desc2 = `Learn how to tune your guitar to ${t.name} (${t.shorthand}). Step-by-step guide with string notes, common songs, and a free guitar tuner app.`;
  const canonical = `${BASE_URL}/tunings/${t.slug}`;
  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": BRAND,
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "iOS, Android",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": `Use GuitarTune to automatically tune your guitar to ${t.name}. ${t.isPremium ? "Available in GuitarTune Pro." : "Free in GuitarTune."}`
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": t.faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  };
  const combinedSchema = JSON.stringify([softwareAppSchema, faqSchema], null, 2);
  const relatedTunings = TUNINGS.filter((x) => x.slug !== t.slug).slice(0, 5);
  const relatedCompetitors = COMPETITORS.slice(0, 3);
  return `${buildHead(title, desc2, canonical, combinedSchema)}
<body>
${buildNav(`/tunings/${t.slug}`)}
<div class="wrap">
  <div class="breadcrumb"><a href="/">Home</a><span>\u203A</span><a href="/tunings">Tunings</a><span>\u203A</span>${htmlEscape(t.name)}</div>

  <section class="hero" style="text-align:left;padding-top:48px">
    <div class="tag">${htmlEscape(t.genre)} \xB7 ${t.difficulty}</div>
    <h1>How to Tune to <span style="color:var(--cyan)">${htmlEscape(t.name)}</span></h1>
    <p class="sub" style="margin-left:0;text-align:left">Tuning: <strong style="color:#fff;font-family:'Arial Black',Arial,sans-serif;letter-spacing:2px">${htmlEscape(t.shorthand)}</strong> \u2014 from low to high: ${t.notes.join(" \xB7 ")}</p>
    <div class="pill-grid">
      ${t.strings.map((s, i) => `<div class="pill active">String ${6 - i}: ${htmlEscape(s)}</div>`).join("")}
    </div>
    <a href="/#download" class="hero-cta">${t.isPremium ? "Get GuitarTune Pro" : "Tune Free in GuitarTune"}</a>
    <a href="#how-to" class="hero-sec">Step-by-step guide \u2193</a>
  </section>
</div>

<div class="section alt">
  <div class="wrap">
    <h2>About ${htmlEscape(t.name)}</h2>
    <p>${htmlEscape(t.description)}</p>
    ${t.isPremium ? `<p><strong style="color:var(--cyan)">${htmlEscape(t.name)}</strong> is available in <strong style="color:#fff">GuitarTune Pro</strong> ($9.99/year or $14.99 lifetime). The free tier includes Standard, Double Drop D, Open C, and All Fourths.</p>` : `<p><strong style="color:var(--cyan)">${htmlEscape(t.name)}</strong> is included in the <strong style="color:#fff">GuitarTune free tier</strong> \u2014 no payment required.</p>`}
  </div>
</div>

<div class="section">
  <div class="wrap">
    <h2 id="how-to">Step-by-Step: How to Tune to ${htmlEscape(t.name)}</h2>
    <div class="steps">
      ${t.howTo.map((step, i) => `
      <div class="step">
        <div class="step-num">0${i + 1}</div>
        <div class="step-body"><p>${htmlEscape(step)}</p></div>
      </div>`).join("")}
    </div>
  </div>
</div>

<div class="section alt">
  <div class="wrap">
    <h2>Songs in ${htmlEscape(t.name)}</h2>
    <p>These well-known songs use ${htmlEscape(t.name)} tuning:</p>
    <div class="songs-list">
      ${t.commonSongs.map((s) => `<div class="song-item">\u{1F3B5} ${htmlEscape(s)}</div>`).join("")}
    </div>
  </div>
</div>

<div class="section">
  <div class="wrap">
    <h2>Frequently Asked Questions</h2>
    <div class="faq-list">
      ${t.faqs.map((faq) => `<div class="faq-item"><div class="faq-q">${htmlEscape(faq.q)}</div><div class="faq-a">${htmlEscape(faq.a)}</div></div>`).join("")}
    </div>
  </div>
</div>

<div class="section alt">
  <div class="wrap">
    <div class="cta-block" style="margin-top:0">
      <h2>Tune to ${htmlEscape(t.name)} with GuitarTune</h2>
      <p>${t.isPremium ? `Available in GuitarTune Pro \u2014 $9.99/year or $14.99 lifetime. Includes all 15 tunings, tuning history, and custom themes.` : `Free in GuitarTune \u2014 no payment required. Open the app, select ${htmlEscape(t.name)}, and follow the dial.`}</p>
      <a href="/#download" class="hero-cta">${t.isPremium ? "Get GuitarTune Pro" : "Download Free"}</a>
    </div>

    <h2>More Guitar Tunings</h2>
    <div class="internal-links">
      ${relatedTunings.map((r) => `<a href="/tunings/${r.slug}">${htmlEscape(r.name)} (${htmlEscape(r.shorthand)})</a>`).join("")}
      <a href="/tunings">All tunings \u2192</a>
    </div>

    <h2>Compare GuitarTune vs Other Apps</h2>
    <div class="internal-links">
      ${relatedCompetitors.map((c) => `<a href="/vs/${c.slug}">GuitarTune vs ${htmlEscape(c.shortName)}</a>`).join("")}
      <a href="/compare">All comparisons \u2192</a>
    </div>
  </div>
</div>

${buildFooter([
    { href: "/tunings", label: "All Tunings" },
    { href: "/compare", label: "Compare Apps" },
    { href: "/", label: "Home" }
  ])}
</body>
</html>`;
}
function hubPage(type) {
  if (type === "compare") {
    const title2 = "GuitarTune vs Guitar Tuner Apps \u2014 Full Comparison Guide (2026)";
    const desc3 = "Compare GuitarTune against GuitarTuna, Fender Tune, Boss Tuner, and more. Feature matrix, pricing, and honest reviews.";
    const canonical2 = `${BASE_URL}/compare`;
    const schema2 = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "GuitarTune Competitor Comparisons",
      "itemListElement": COMPETITORS.map((c, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": `${BASE_URL}/vs/${c.slug}`,
        "name": `GuitarTune vs ${c.name}`
      }))
    }, null, 2);
    return `${buildHead(title2, desc3, canonical2, schema2)}
<body>
${buildNav("/compare")}
<div class="wrap">
  <section class="hero">
    <div class="tag">Comparison Hub</div>
    <h1>GuitarTune vs <span style="color:var(--cyan)">Every Major Guitar Tuner App</span></h1>
    <p class="sub">Head-to-head comparisons with pricing, features, and honest analysis. See why guitarists are switching.</p>
    <a href="/#download" class="hero-cta">Download GuitarTune Free</a>
  </section>

  <section class="section">
    <h2>All Comparisons</h2>
    <div class="internal-links" style="flex-direction:column;gap:0">
      ${COMPETITORS.map((c) => `
      <a href="/vs/${c.slug}" style="border-radius:8px;margin-bottom:8px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between">
        <span>GuitarTune vs <strong>${htmlEscape(c.name)}</strong></span>
        <span style="color:#333;font-size:12px">App Store ${htmlEscape(c.appStoreRating)}\u2605 \xB7 ${c.freeAds ? '<span class="bad">Ads in free</span>' : '<span class="good">No ads</span>'} \xB7 ${htmlEscape(c.annualPrice)}</span>
      </a>`).join("")}
    </div>
  </section>

  <section class="section alt" style="padding:60px 0;margin:0 -24px">
    <div class="wrap">
      <h2>Quick Price Comparison</h2>
      <table class="compare-table">
        <thead>
          <tr>
            <th>App</th>
            <th class="us">GuitarTune</th>
            ${COMPETITORS.slice(0, 4).map((c) => `<th>${htmlEscape(c.shortName)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Annual Pro</td>
            <td class="us-val"><span class="good">$9.99</span></td>
            ${COMPETITORS.slice(0, 4).map((c) => `<td>${htmlEscape(c.annualPrice)}</td>`).join("")}
          </tr>
          <tr>
            <td>Free ads</td>
            <td class="us-val"><span class="good">Never</span></td>
            ${COMPETITORS.slice(0, 4).map((c) => `<td>${c.freeAds ? '<span class="bad">Yes</span>' : '<span class="good">No</span>'}</td>`).join("")}
          </tr>
          <tr>
            <td>Bilingual</td>
            <td class="us-val"><span class="good">EN + ES</span></td>
            ${COMPETITORS.slice(0, 4).map((c) => `<td>${c.bilingual ? '<span class="good">\u2713</span>' : '<span class="bad">\u2717</span>'}</td>`).join("")}
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="section">
    <div class="cta-block">
      <h2>The ad-free guitar tuner that costs 78% less</h2>
      <p>Download GuitarTune free \u2014 no ads, no sign-up. Pro from $9.99/year.</p>
      <a href="/#download" class="hero-cta">Download Free</a>
    </div>
  </section>
</div>
${buildFooter([{ href: "/tunings", label: "All Tunings" }, { href: "/", label: "Home" }])}
</body>
</html>`;
  }
  const title = "Guitar Tunings Guide \u2014 Drop D, Open G, DADGAD & More | GuitarTune";
  const desc2 = "Complete guide to alternate guitar tunings: Drop D, Open G, DADGAD, Open D, Open E, Drop C, and more. Step-by-step instructions with a free guitar tuner app.";
  const canonical = `${BASE_URL}/tunings`;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Guitar Tuning Guides",
    "itemListElement": TUNINGS.map((t, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `${BASE_URL}/tunings/${t.slug}`,
      "name": `How to tune to ${t.name}`
    }))
  }, null, 2);
  return `${buildHead(title, desc2, canonical, schema)}
<body>
${buildNav("/tunings")}
<div class="wrap">
  <section class="hero">
    <div class="tag">Tuning Guides</div>
    <h1>Guitar Tunings:<br><span style="color:var(--cyan)">Complete Guide</span></h1>
    <p class="sub">Drop D, Open G, DADGAD, Open D, and more \u2014 step-by-step guides for every alternate tuning, plus a free guitar tuner app to follow along.</p>
    <a href="/#download" class="hero-cta">Tune Free with GuitarTune</a>
  </section>

  <section class="section">
    <h2>Free Tunings (GuitarTune Free Tier)</h2>
    <div class="internal-links">
      ${TUNINGS.filter((t) => !t.isPremium).map((t) => `
      <a href="/tunings/${t.slug}">
        <strong>${htmlEscape(t.name)}</strong> (${htmlEscape(t.shorthand)})
        <span style="display:block;font-size:11px;color:#444;margin-top:2px">${htmlEscape(t.genre)}</span>
      </a>`).join("")}
    </div>

    <h2>Pro Tunings (GuitarTune Pro \u2014 $9.99/yr)</h2>
    <div class="internal-links">
      ${TUNINGS.filter((t) => t.isPremium).map((t) => `
      <a href="/tunings/${t.slug}">
        <strong>${htmlEscape(t.name)}</strong> (${htmlEscape(t.shorthand)})
        <span style="display:block;font-size:11px;color:#444;margin-top:2px">${htmlEscape(t.genre)}</span>
      </a>`).join("")}
    </div>
  </section>

  <section class="section alt" style="margin:0 -24px;padding:60px 0">
    <div class="wrap">
      <h2>All Tuning Guides</h2>
      <table class="compare-table">
        <thead>
          <tr><th>Tuning</th><th>Notes</th><th>Genre</th><th>Difficulty</th><th>In GuitarTune</th></tr>
        </thead>
        <tbody>
          ${TUNINGS.map((t) => `
          <tr>
            <td><a href="/tunings/${t.slug}">${htmlEscape(t.name)}</a></td>
            <td style="font-family:'Arial Black',Arial,sans-serif;font-size:13px;color:#fff;letter-spacing:1px">${htmlEscape(t.shorthand)}</td>
            <td>${htmlEscape(t.genre)}</td>
            <td>${htmlEscape(t.difficulty)}</td>
            <td>${t.isPremium ? '<span class="mid">Pro ($9.99/yr)</span>' : '<span class="good">Free</span>'}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </section>

  <section class="section">
    <div class="cta-block">
      <h2>Tune with GuitarTune</h2>
      <p>Open the app, select your tuning, pluck each string. In tune in under 10 seconds. No ads, ever.</p>
      <a href="/#download" class="hero-cta">Download Free</a>
    </div>
  </section>
</div>
${buildFooter([{ href: "/compare", label: "Compare Apps" }, { href: "/", label: "Home" }])}
</body>
</html>`;
}
function registerSeoRoutes(app2) {
  app2.get("/compare", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(hubPage("compare"));
  });
  app2.get("/tunings", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(hubPage("tunings"));
  });
  app2.get("/vs/:slug", (req, res) => {
    const { slug } = req.params;
    const competitor = COMPETITORS.find((c) => c.slug === slug);
    if (!competitor) {
      return res.status(404).send("<h1>Not found</h1>");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(competitorPage(competitor));
  });
  app2.get("/tunings/:slug", (req, res) => {
    const { slug } = req.params;
    const tuning = TUNINGS.find((t) => t.slug === slug);
    if (!tuning) {
      return res.status(404).send("<h1>Not found</h1>");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(tuningPage(tuning));
  });
  app2.get("/sitemap.xml", (_req, res) => {
    const urls = [
      { loc: `${BASE_URL}/`, priority: "1.0", changefreq: "weekly" },
      { loc: `${BASE_URL}/compare`, priority: "0.9", changefreq: "monthly" },
      { loc: `${BASE_URL}/tunings`, priority: "0.9", changefreq: "monthly" },
      ...COMPETITORS.map((c) => ({ loc: `${BASE_URL}/vs/${c.slug}`, priority: "0.8", changefreq: "monthly" })),
      ...TUNINGS.map((t) => ({ loc: `${BASE_URL}/tunings/${t.slug}`, priority: "0.8", changefreq: "monthly" })),
      { loc: `${BASE_URL}/competitive-analysis`, priority: "0.5", changefreq: "yearly" }
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
  </url>`).join("\n")}
</urlset>`;
    res.setHeader("Content-Type", "application/xml");
    res.send(xml);
  });
  app2.get("/competitive-analysis", (_req, res) => {
    const fs2 = __require("fs");
    const path2 = __require("path");
    const filePath = path2.resolve(process.cwd(), "server", "templates", "competitive-analysis.html");
    if (fs2.existsSync(filePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(fs2.readFileSync(filePath, "utf-8"));
    } else {
      res.status(404).send("Not found");
    }
  });
  app2.get("/ad-copy", (_req, res) => {
    const fs2 = __require("fs");
    const path2 = __require("path");
    const filePath = path2.resolve(process.cwd(), "server", "templates", "ad-copy.html");
    if (fs2.existsSync(filePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(fs2.readFileSync(filePath, "utf-8"));
    } else {
      res.status(404).send("Not found");
    }
  });
  app2.get("/launch-playbook", (_req, res) => {
    const fs2 = __require("fs");
    const path2 = __require("path");
    const filePath = path2.resolve(process.cwd(), "server", "templates", "launch-playbook.html");
    if (fs2.existsSync(filePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(fs2.readFileSync(filePath, "utf-8"));
    } else {
      res.status(404).send("Not found");
    }
  });
  app2.get("/ads/:filename", (req, res) => {
    const fs2 = __require("fs");
    const path2 = __require("path");
    const filename = String(req.params.filename);
    if (!/^[a-z0-9-]+\.html$/.test(filename)) return res.status(400).send("Bad request");
    const filePath = path2.resolve(process.cwd(), "server", "templates", "ads", filename);
    if (fs2.existsSync(filePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(fs2.readFileSync(filePath, "utf-8"));
    } else {
      res.status(404).send("Not found");
    }
  });
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupSecurityHeaders(app2) {
  app2.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "microphone=*, camera=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
}
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = process.env.NODE_ENV !== "production" && (origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:"));
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, X-Signature");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  app.set("trust proxy", 1);
  setupSecurityHeaders(app);
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  registerSeoRoutes(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
