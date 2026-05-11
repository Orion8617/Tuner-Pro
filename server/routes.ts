import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { storage } from "./storage";

// ─── Input validation ────────────────────────────────────────────────────────
const USER_ID_REGEX = /^[a-zA-Z0-9_\-]{1,128}$/;
function isValidUserId(id: unknown): id is string {
  return typeof id === "string" && USER_ID_REGEX.test(id);
}

// ─── In-memory rate limiter (per IP, per route) ───────────────────────────────
const _rateMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, route: string, maxPerMinute: number): boolean {
  const key = `${ip}:${route}`;
  const now = Date.now();
  const entry = _rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    _rateMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true; // allowed
  }
  entry.count += 1;
  if (entry.count > maxPerMinute) return false; // blocked
  return true;
}

// ─── USDC mint on Solana mainnet ─────────────────────────────────────────────
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const PLAN_PRICES = {
  quarterly: { usdc: 4.99, sol: parseFloat(process.env.SOLANA_QUARTERLY_SOL || "0.035") },
  lifetime:  { usdc: 14.99, sol: parseFloat(process.env.SOLANA_LIFETIME_SOL || "0.10") },
};

let _solanaConnection: Connection | null = null;

function getSolanaConnection(): Connection {
  if (!_solanaConnection) {
    const rpc = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    _solanaConnection = new Connection(rpc, "confirmed");
  }
  return _solanaConnection;
}

async function checkSolanaPaymentConfirmed(reference: string): Promise<boolean> {
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

function verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

function getPlanExpiry(plan: "monthly" | "quarterly" | "annual" | "lifetime"): string {
  if (plan === "lifetime") return new Date("2099-12-31").toISOString();
  const days = plan === "annual" ? 365 : plan === "quarterly" ? 90 : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function registerRoutes(app: Express): Promise<Server> {

  app.get("/klonos-monitor", (_req: Request, res: Response) => {
    const ip = _req.ip || "unknown";
    if (!rateLimit(ip, "klonos-monitor", 30)) {
      return res.status(429).json({ error: "Too many requests" });
    }
    res.sendFile("klonos-monitor.html", { root: "./server/templates" });
  });

  app.get("/api/subscription/status", async (req: Request, res: Response) => {
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
        status: subscription.status,
      });
    }
    return res.json({ isPremium: false });
  });

  app.get("/api/checkout/url", (req: Request, res: Response) => {
    const plan = req.query.plan as string;
    const userId = req.query.userId;

    if (!isValidUserId(userId)) return res.status(400).json({ error: "Invalid userId" });
    if (!plan || !["monthly", "quarterly", "annual", "lifetime"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const ip = req.ip || "unknown";
    if (!rateLimit(ip, "checkout-url", 10)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    const monthlyUrl = process.env.LEMONSQUEEZY_CHECKOUT_URL_MONTHLY;
    const quarterlyUrl = process.env.LEMONSQUEEZY_CHECKOUT_URL_QUARTERLY;
    const annualUrl = process.env.LEMONSQUEEZY_CHECKOUT_URL_ANNUAL;
    const lifetimeUrl = process.env.LEMONSQUEEZY_CHECKOUT_URL_LIFETIME;

    if (!monthlyUrl || !annualUrl) return res.status(500).json({ error: "Payment not configured" });

    let baseUrl: string;
    if (plan === "lifetime") {
      if (!lifetimeUrl) return res.status(500).json({ error: "Lifetime payment not configured" });
      baseUrl = lifetimeUrl;
    } else if (plan === "quarterly") {
      if (!quarterlyUrl) return res.status(500).json({ error: "Quarterly payment not configured" });
      baseUrl = quarterlyUrl;
    } else {
      baseUrl = plan === "annual" ? annualUrl : monthlyUrl;
    }

    const checkoutUrl = `${baseUrl}?checkout[custom][user_id]=${encodeURIComponent(userId)}`;
    return res.json({ checkoutUrl });
  });

  app.post("/api/webhooks/lemonsqueezy", async (req: Request, res: Response) => {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ error: "Webhook not configured" });

    const signature = req.headers["x-signature"] as string;
    if (!signature) return res.status(401).json({ error: "Missing signature" });

    const rawBody = req.rawBody as Buffer;
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
        const quarterlyVariantId = process.env.LEMONSQUEEZY_VARIANT_QUARTERLY || "";
        const annualVariantId = process.env.LEMONSQUEEZY_VARIANT_ANNUAL || "";
        const lifetimeVariantId = process.env.LEMONSQUEEZY_VARIANT_LIFETIME || "";
        const plan = lifetimeVariantId !== "" && variantId === lifetimeVariantId ? "lifetime"
          : annualVariantId !== "" && variantId === annualVariantId ? "annual"
          : quarterlyVariantId !== "" && variantId === quarterlyVariantId ? "quarterly"
          : "monthly";

        const statusMap: Record<string, "active" | "cancelled" | "expired" | "paused"> = {
          active: "active", cancelled: "cancelled", expired: "expired",
          paused: "paused", on_trial: "active", past_due: "active", unpaid: "expired",
        };

        const status = statusMap[attrs?.status] || "active";
        const defaultExpiry = plan === "quarterly"
          ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const renewsAt = attrs?.renews_at || attrs?.ends_at || defaultExpiry;

        await storage.upsertSubscription({ userId, lemonSqueezyId, orderId: String(attrs?.order_id || ""), plan, status, currentPeriodEnd: renewsAt });
        break;
      }
      case "subscription_cancelled":
        await storage.updateSubscriptionStatus(lemonSqueezyId, "cancelled"); break;
      case "subscription_expired":
        await storage.updateSubscriptionStatus(lemonSqueezyId, "expired"); break;
      case "subscription_paused":
        await storage.updateSubscriptionStatus(lemonSqueezyId, "paused"); break;
      case "subscription_resumed":
      case "subscription_unpaused":
        await storage.updateSubscriptionStatus(lemonSqueezyId, "active"); break;
      case "order_created": {
        const orderVariantId = String(attrs?.first_order_item?.variant_id || "");
        const lifetimeVarId = process.env.LEMONSQUEEZY_VARIANT_LIFETIME || "";
        if (orderVariantId === lifetimeVarId && lifetimeVarId !== "") {
          await storage.upsertSubscription({
            userId, lemonSqueezyId, orderId: String(event.data?.id || ""),
            plan: "lifetime", status: "active", currentPeriodEnd: new Date("2099-12-31").toISOString(),
          });
        }
        break;
      }
    }

    return res.status(200).json({ received: true });
  });

  app.post("/api/checkout/solana/create", async (req: Request, res: Response) => {
    const { userId, plan, token = "usdc" } = req.body as {
      userId: string;
      plan: "quarterly" | "lifetime";
      token?: "usdc" | "sol";
    };

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

    try { new PublicKey(recipientAddress); } catch {
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

    let url: string;
    if (token === "sol") {
      const params = new URLSearchParams({
        amount: String(amountSol),
        reference,
        label: "GuitarTune Pro",
        message: planLabel,
        memo: planMemo,
      });
      url = `solana:${recipientAddress}?${params.toString()}`;
    } else {
      const params = new URLSearchParams({
        "spl-token": USDC_MINT,
        amount: String(amountUsdc),
        reference,
        label: "GuitarTune Pro",
        message: planLabel,
        memo: planMemo,
      });
      url = `solana:${recipientAddress}?${params.toString()}`;
    }

    const phantomUrl = `https://phantom.app/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent("https://guitartune.app")}`;

    console.log(`Solana checkout created: plan=${plan} token=${token} amount=${token === "sol" ? amountSol + " SOL" : amountUsdc + " USDC"} user=${userId}`);
    return res.json({ url, phantomUrl, reference, plan, token, amountUsdc, amountSol });
  });

  app.get("/api/checkout/solana/verify", async (req: Request, res: Response) => {
    const { reference, userId } = req.query as { reference: string; userId: string };

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
    if (new Date() > new Date(session.expiresAt)) return res.json({ status: "expired" });
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
        currentPeriodEnd: getPlanExpiry(session.plan),
      });
      console.log(`Solana ${session.plan} confirmed (${session.token}) for user ${userId}`);
      return res.json({ status: "confirmed" });
    }

    return res.json({ status: "pending" });
  });

  // ─── RevenueCat Webhook ─────────────────────────────────────────────────────
  app.post("/api/webhooks/revenuecat", async (req: Request, res: Response) => {
    const authHeader = req.headers["authorization"] as string | undefined;
    const webhookSecret = process.env.REVENUECAT_SECRET_API_KEY;

    // Validate bearer token if secret is configured
    if (webhookSecret) {
      const token = authHeader?.replace("Bearer ", "").trim();
      if (!token || token !== webhookSecret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const event = req.body;
    const eventType: string = event.event?.type || "";
    const appUserId: string = event.event?.app_user_id || "";
    const aliases: string[] = event.event?.aliases || [];

    // Use app_user_id or first alias as our userId
    const userId = appUserId || aliases[0];
    if (!userId || !isValidUserId(userId)) {
      return res.status(200).json({ received: true });
    }

    const productId: string = event.event?.product_id || "";
    const expiresAt: string | null = event.event?.expiration_at_ms
      ? new Date(event.event.expiration_at_ms).toISOString()
      : null;

    // Map RevenueCat product_id to plan
    function rcProductToPlan(pid: string): "monthly" | "annual" | "lifetime" {
      if (pid.includes("annual") || pid.includes("yearly")) return "annual";
      if (pid.includes("lifetime")) return "lifetime";
      return "monthly";
    }

    const plan = rcProductToPlan(productId);
    const lsId = `rc-${userId}-${productId}`;
    const periodEnd = expiresAt || (plan === "lifetime"
      ? new Date("2099-12-31").toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

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
            currentPeriodEnd: periodEnd,
          });
          console.log(`[RC Webhook] ${eventType} → user=${userId} plan=${plan}`);
          break;

        case "CANCELLATION":
          await storage.updateSubscriptionStatus(lsId, "cancelled");
          console.log(`[RC Webhook] CANCELLATION → user=${userId}`);
          break;

        case "EXPIRATION":
          await storage.updateSubscriptionStatus(lsId, "expired");
          console.log(`[RC Webhook] EXPIRATION → user=${userId}`);
          break;

        case "BILLING_ISSUE":
          // Keep active but log for monitoring
          console.warn(`[RC Webhook] BILLING_ISSUE → user=${userId}`);
          break;

        default:
          // PRODUCT_CHANGE, TRANSFER, etc. — no action needed
          break;
      }
    } catch (err) {
      console.error("[RC Webhook] Error processing event:", err);
      return res.status(500).json({ error: "Internal error" });
    }

    return res.status(200).json({ received: true });
  });

  // ─── Admin Routes ────────────────────────────────────────────────────────────
  function constantTimeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  }

  function requireAdmin(req: Request, res: Response): boolean {
    const configuredSecret = process.env.ADMIN_SECRET;
    if (!configuredSecret) {
      res.status(503).json({ error: "Admin access not configured" });
      return false;
    }

    const headerSecret = req.headers["x-admin-secret"] as string | undefined;
    const bearer = (req.headers["authorization"] as string | undefined)?.replace(/^Bearer\s+/i, "").trim();
    const providedSecret = headerSecret?.trim() || bearer;

    if (!providedSecret || !constantTimeEqual(providedSecret, configuredSecret)) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
    return true;
  }

  app.get("/api/admin/dashboard", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const [stats, recentSubs, recentSolana] = await Promise.all([
        storage.getAdminStats(),
        storage.getRecentSubscriptions(20),
        storage.getRecentSolanaSessions(20),
      ]);
      return res.json({ stats, recentSubs, recentSolana });
    } catch (err) {
      console.error("[Admin] dashboard error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/admin/grant-premium", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const { userId, plan } = req.body as {
      userId: string;
      plan: "monthly" | "quarterly" | "annual" | "lifetime";
    };
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

  const httpServer = createServer(app);
  return httpServer;
}
