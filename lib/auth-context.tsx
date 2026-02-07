import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

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
        setUser(JSON.parse(userData));
      }
    } catch (e) {
      console.error("Failed to load user:", e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const users = await getStoredUsers();
      const userKey = username.toLowerCase().trim();
      const stored = users[userKey];

      if (!stored) {
        return { success: false, error: "Usuario no encontrado" };
      }

      const hash = await hashPassword(password);
      if (hash !== stored.passwordHash) {
        return { success: false, error: "Contraseña incorrecta" };
      }

      const loggedInUser: User = {
        id: stored.id,
        username: stored.username,
        isPremium: stored.isPremium,
        createdAt: stored.createdAt,
      };

      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      return { success: true };
    } catch (e) {
      return { success: false, error: "Error al iniciar sesión" };
    }
  }

  async function register(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (username.trim().length < 3) {
        return { success: false, error: "El nombre de usuario debe tener al menos 3 caracteres" };
      }
      if (password.length < 6) {
        return { success: false, error: "La contraseña debe tener al menos 6 caracteres" };
      }

      const users = await getStoredUsers();
      const userKey = username.toLowerCase().trim();

      if (users[userKey]) {
        return { success: false, error: "Este nombre de usuario ya existe" };
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
      return { success: false, error: "Error al crear la cuenta" };
    }
  }

  async function logout() {
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
    setUser(null);
  }

  async function upgradeToPremium() {
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

  const value = useMemo(() => ({
    user,
    isLoading,
    login,
    register,
    logout,
    upgradeToPremium,
  }), [user, isLoading]);

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
