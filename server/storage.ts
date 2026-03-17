import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

export interface Subscription {
  id: string;
  userId: string;
  lemonSqueezyId: string;
  orderId: string;
  plan: "monthly" | "annual" | "lifetime";
  status: "active" | "cancelled" | "expired" | "paused";
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface SolanaPaySession {
  id: string;
  userId: string;
  reference: string;
  plan: "lifetime";
  amountUsdc: number;
  status: "pending" | "confirmed" | "expired";
  createdAt: string;
  expiresAt: string;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getSubscription(userId: string): Promise<Subscription | undefined>;
  getSubscriptionByLemonSqueezyId(lsId: string): Promise<Subscription | undefined>;
  upsertSubscription(sub: Omit<Subscription, "id" | "createdAt" | "updatedAt">): Promise<Subscription>;
  updateSubscriptionStatus(lemonSqueezyId: string, status: Subscription["status"]): Promise<void>;
  createSolanaSession(data: { userId: string; reference: string; amountUsdc: number }): Promise<SolanaPaySession>;
  getSolanaSession(reference: string): Promise<SolanaPaySession | undefined>;
  confirmSolanaSession(reference: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private subscriptions: Map<string, Subscription>;
  private solanaSessions: Map<string, SolanaPaySession>;

  constructor() {
    this.users = new Map();
    this.subscriptions = new Map();
    this.solanaSessions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    return Array.from(this.subscriptions.values()).find(
      (sub) => sub.userId === userId && sub.status === "active",
    );
  }

  async getSubscriptionByLemonSqueezyId(lsId: string): Promise<Subscription | undefined> {
    return Array.from(this.subscriptions.values()).find(
      (sub) => sub.lemonSqueezyId === lsId,
    );
  }

  async upsertSubscription(data: Omit<Subscription, "id" | "createdAt" | "updatedAt">): Promise<Subscription> {
    const existing = await this.getSubscriptionByLemonSqueezyId(data.lemonSqueezyId);
    const now = new Date().toISOString();

    if (existing) {
      const updated: Subscription = {
        ...existing,
        ...data,
        updatedAt: now,
      };
      this.subscriptions.set(existing.id, updated);
      return updated;
    }

    const id = randomUUID();
    const sub: Subscription = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(id, sub);
    return sub;
  }

  async updateSubscriptionStatus(lemonSqueezyId: string, status: Subscription["status"]): Promise<void> {
    const sub = await this.getSubscriptionByLemonSqueezyId(lemonSqueezyId);
    if (sub) {
      sub.status = status;
      sub.updatedAt = new Date().toISOString();
      this.subscriptions.set(sub.id, sub);
    }
  }

  async createSolanaSession(data: { userId: string; reference: string; amountUsdc: number }): Promise<SolanaPaySession> {
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    const session: SolanaPaySession = {
      id,
      userId: data.userId,
      reference: data.reference,
      plan: "lifetime",
      amountUsdc: data.amountUsdc,
      status: "pending",
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    this.solanaSessions.set(data.reference, session);
    return session;
  }

  async getSolanaSession(reference: string): Promise<SolanaPaySession | undefined> {
    return this.solanaSessions.get(reference);
  }

  async confirmSolanaSession(reference: string): Promise<void> {
    const session = this.solanaSessions.get(reference);
    if (session) {
      session.status = "confirmed";
      this.solanaSessions.set(reference, session);
    }
  }
}

export const storage = new MemStorage();
