import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { storage } from "./storage";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const LIFETIME_USDC = 14.99;

function getSolanaConnection(): Connection {
  const rpc = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(rpc, "confirmed");
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

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/subscription/status", async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
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
    const userId = req.query.userId as string;

    if (!plan || !userId) {
      return res.status(400).json({ error: "plan and userId are required" });
    }

    const monthlyUrl = process.env.LEMONSQUEEZY_CHECKOUT_URL_MONTHLY;
    const annualUrl = process.env.LEMONSQUEEZY_CHECKOUT_URL_ANNUAL;
    const lifetimeUrl = process.env.LEMONSQUEEZY_CHECKOUT_URL_LIFETIME;

    if (!monthlyUrl || !annualUrl) {
      return res.status(500).json({ error: "Payment not configured" });
    }

    let baseUrl: string;
    if (plan === "lifetime") {
      if (!lifetimeUrl) {
        return res.status(500).json({ error: "Lifetime payment not configured" });
      }
      baseUrl = lifetimeUrl;
    } else {
      baseUrl = plan === "annual" ? annualUrl : monthlyUrl;
    }

    const checkoutUrl = `${baseUrl}?checkout[custom][user_id]=${encodeURIComponent(userId)}`;

    return res.json({ checkoutUrl });
  });

  app.post("/api/webhooks/lemonsqueezy", async (req: Request, res: Response) => {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("LEMONSQUEEZY_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook not configured" });
    }

    const signature = req.headers["x-signature"] as string;
    if (!signature) {
      return res.status(401).json({ error: "Missing signature" });
    }

    const rawBody = req.rawBody as Buffer;
    if (!rawBody) {
      return res.status(400).json({ error: "Missing body" });
    }

    try {
      const isValid = verifyWebhookSignature(rawBody, signature, secret);
      if (!isValid) {
        console.error("Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } catch (e) {
      console.error("Signature verification failed:", e);
      return res.status(401).json({ error: "Signature verification failed" });
    }

    const event = req.body;
    const eventName = event.meta?.event_name;
    const customData = event.meta?.custom_data;
    const userId = customData?.user_id;

    if (!userId) {
      console.error("Webhook missing user_id in custom_data");
      return res.status(200).json({ received: true });
    }

    const attrs = event.data?.attributes;
    const lemonSqueezyId = String(event.data?.id || "");

    console.log(`LemonSqueezy webhook: ${eventName} for user ${userId}`);

    switch (eventName) {
      case "subscription_created":
      case "subscription_updated": {
        const variantId = String(attrs?.variant_id || "");
        const annualVariantId = process.env.LEMONSQUEEZY_VARIANT_ANNUAL || "";
        const lifetimeVariantId = process.env.LEMONSQUEEZY_VARIANT_LIFETIME || "";
        const plan = variantId === lifetimeVariantId ? "lifetime" : variantId === annualVariantId ? "annual" : "monthly";

        const statusMap: Record<string, "active" | "cancelled" | "expired" | "paused"> = {
          active: "active",
          cancelled: "cancelled",
          expired: "expired",
          paused: "paused",
          on_trial: "active",
          past_due: "active",
          unpaid: "expired",
        };

        const status = statusMap[attrs?.status] || "active";
        const renewsAt = attrs?.renews_at || attrs?.ends_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        await storage.upsertSubscription({
          userId,
          lemonSqueezyId,
          orderId: String(attrs?.order_id || ""),
          plan,
          status,
          currentPeriodEnd: renewsAt,
        });

        console.log(`Subscription ${eventName}: user=${userId}, plan=${plan}, status=${status}`);
        break;
      }

      case "subscription_cancelled": {
        await storage.updateSubscriptionStatus(lemonSqueezyId, "cancelled");
        console.log(`Subscription cancelled: user=${userId}`);
        break;
      }

      case "subscription_expired": {
        await storage.updateSubscriptionStatus(lemonSqueezyId, "expired");
        console.log(`Subscription expired: user=${userId}`);
        break;
      }

      case "subscription_paused": {
        await storage.updateSubscriptionStatus(lemonSqueezyId, "paused");
        console.log(`Subscription paused: user=${userId}`);
        break;
      }

      case "subscription_resumed":
      case "subscription_unpaused": {
        await storage.updateSubscriptionStatus(lemonSqueezyId, "active");
        console.log(`Subscription resumed: user=${userId}`);
        break;
      }

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
            currentPeriodEnd: new Date("2099-12-31").toISOString(),
          });
          console.log(`Lifetime purchase activated for user ${userId}`);
        } else {
          console.log(`Order created for user ${userId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled LemonSqueezy event: ${eventName}`);
    }

    return res.status(200).json({ received: true });
  });

  app.post("/api/checkout/solana/create", async (req: Request, res: Response) => {
    const { userId, plan } = req.body;

    if (!userId || plan !== "lifetime") {
      return res.status(400).json({ error: "userId and plan=lifetime required" });
    }

    const recipientAddress = process.env.SOLANA_WALLET_ADDRESS;
    if (!recipientAddress) {
      return res.status(503).json({ error: "Solana payments not configured" });
    }

    try {
      new PublicKey(recipientAddress);
    } catch {
      return res.status(500).json({ error: "Invalid SOLANA_WALLET_ADDRESS" });
    }

    const referenceKeypair = Keypair.generate();
    const reference = referenceKeypair.publicKey.toBase58();

    await storage.createSolanaSession({ userId, reference, amountUsdc: LIFETIME_USDC });

    const params = new URLSearchParams({
      "spl-token": USDC_MINT,
      amount: String(LIFETIME_USDC),
      reference,
      label: "GuitarTune Pro",
      message: "Lifetime Access",
      memo: `lifetime-${userId}`,
    });

    const url = `solana:${recipientAddress}?${params.toString()}`;
    const phantomUrl = `https://phantom.app/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent("https://guitartune.app")}`;

    return res.json({ url, phantomUrl, reference });
  });

  app.get("/api/checkout/solana/verify", async (req: Request, res: Response) => {
    const { reference, userId } = req.query as { reference: string; userId: string };

    if (!reference || !userId) {
      return res.status(400).json({ error: "reference and userId required" });
    }

    const session = await storage.getSolanaSession(reference);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (new Date() > new Date(session.expiresAt)) {
      return res.json({ status: "expired" });
    }

    if (session.status === "confirmed") {
      return res.json({ status: "confirmed" });
    }

    const confirmed = await checkSolanaPaymentConfirmed(reference);

    if (confirmed) {
      await storage.confirmSolanaSession(reference);
      await storage.upsertSubscription({
        userId,
        lemonSqueezyId: `solana-${reference}`,
        orderId: reference,
        plan: "lifetime",
        status: "active",
        currentPeriodEnd: new Date("2099-12-31").toISOString(),
      });
      console.log(`Solana Lifetime purchase confirmed for user ${userId}`);
      return res.json({ status: "confirmed" });
    }

    return res.json({ status: "pending" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
