import { create } from "zustand";

interface User {
  id: number;
  email: string;
  full_name: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isUnlocked: boolean;
  setUser: (user: User) => void;
  setUnlocked: (v: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isUnlocked: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
  setUnlocked: (isUnlocked) => set({ isUnlocked }),
  logout: () => set({ user: null, isAuthenticated: false, isUnlocked: false }),
}));
