import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { t } from "@/lib/i18n";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

interface User {
  id: string;
  username: string;
  isPremium: boolean;
  createdAt: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  upgradeToPremium: () => Promise<void>;
  checkSubscriptionStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USERS_KEY = "guitartune_users";
const CURRENT_USER_KEY = "guitartune_current_user";

async function getStoredUsers(): Promise<Record<string, { id: string; username: string; passwordHash: string; isPremium: boolean; createdAt: string }>> {
  const data = await AsyncStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : {};
}

async function saveUsers(users: Record<string, any>) {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function hashPassword(password: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + "guitartune_salt_v1"
  );
  return digest;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const userData = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        checkServerSubscription(parsed.id, parsed);
      }
    } catch (e) {
      console.error("Failed to load user:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function checkServerSubscription(userId: string, currentUser: User) {
    try {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/subscription/status?userId=${encodeURIComponent(userId)}`, baseUrl);
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.isPremium && !currentUser.isPremium) {
          const updated = { ...currentUser, isPremium: true };
          setUser(updated);
          await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
          const users = await getStoredUsers();
          const userKey = currentUser.username.toLowerCase();
          if (users[userKey]) {
            users[userKey].isPremium = true;
            await saveUsers(users);
          }
        }
      }
    } catch (e) {
      // Server check failed, keep local state
    }
  }

  const checkSubscriptionStatus = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/subscription/status?userId=${encodeURIComponent(user.id)}`, baseUrl);
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.isPremium && !user.isPremium) {
          await upgradeToPremiumLocal();
        }
        return data.isPremium;
      }
    } catch (e) {
      // Server unreachable
    }
    return user.isPremium;
  }, [user]);

  async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const users = await getStoredUsers();
      const userKey = username.toLowerCase().trim();
      const stored = users[userKey];

      if (!stored) {
        return { success: false, error: t("authContext.userNotFound") };
      }

      const hash = await hashPassword(password);
      if (hash !== stored.passwordHash) {
        return { success: false, error: t("authContext.wrongPassword") };
      }

      const loggedInUser: User = {
        id: stored.id,
        username: stored.username,
        isPremium: stored.isPremium,
        createdAt: stored.createdAt,
      };

      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      checkServerSubscription(loggedInUser.id, loggedInUser);
      return { success: true };
    } catch (e) {
      return { success: false, error: t("authContext.loginError") };
    }
  }

  async function register(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (username.trim().length < 3) {
        return { success: false, error: t("authContext.usernameTooShort") };
      }
      if (password.length < 6) {
        return { success: false, error: t("authContext.passwordTooShort") };
      }

      const users = await getStoredUsers();
      const userKey = username.toLowerCase().trim();

      if (users[userKey]) {
        return { success: false, error: t("authContext.usernameTaken") };
      }

      const id = Crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      const createdAt = new Date().toISOString();

      users[userKey] = {
        id,
        username: username.trim(),
        passwordHash,
        isPremium: false,
        createdAt,
      };

      await saveUsers(users);

      const newUser: User = { id, username: username.trim(), isPremium: false, createdAt };
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
      setUser(newUser);
      return { success: true };
    } catch (e) {
      return { success: false, error: t("authContext.registerError") };
    }
  }

  async function logout() {
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
    setUser(null);
  }

  async function upgradeToPremiumLocal() {
    if (!user) return;
    const updatedUser = { ...user, isPremium: true };
    setUser(updatedUser);
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));

    const users = await getStoredUsers();
    const userKey = user.username.toLowerCase();
    if (users[userKey]) {
      users[userKey].isPremium = true;
      await saveUsers(users);
    }
  }

  async function upgradeToPremium() {
    await upgradeToPremiumLocal();
  }

  const value = useMemo(() => ({
    user,
    isLoading,
    login,
    register,
    logout,
    upgradeToPremium,
    checkSubscriptionStatus,
  }), [user, isLoading, checkSubscriptionStatus]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
