import { create } from "zustand";
import { api, type User } from "@/lib/mock-api";

type AuthState = {
  user: User | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  error: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  error: null,
  async init() {
    set({ status: "loading" });
    try {
      const user = await api.me();
      set({ user, status: "authenticated", error: null });
    } catch {
      set({ user: null, status: "unauthenticated" });
    }
  },
  async login(email, password) {
    set({ status: "loading", error: null });
    try {
      const { user } = await api.login({ email, password });
      set({ user, status: "authenticated" });
    } catch (e: any) {
      set({ error: e.message, status: "unauthenticated" });
      throw e;
    }
  },
  async register(name, email, password) {
    set({ status: "loading", error: null });
    try {
      await api.register({ name, email, password });
      const { user } = await api.login({ email, password });
      set({ user, status: "authenticated" });
    } catch (e: any) {
      set({ error: e.message, status: "unauthenticated" });
      throw e;
    }
  },
  logout() {
    api.logout();
    set({ user: null, status: "unauthenticated" });
  },
}));
