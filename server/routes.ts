import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import { storage } from "./storage";

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

  const httpServer = createServer(app);
  return httpServer;
}
