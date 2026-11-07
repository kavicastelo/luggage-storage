import { create } from "zustand";

interface AppState {
  theme: "light" | "dark";
  activeRole: "traveller" | "host" | "admin";
  toggleTheme: () => void;
  setActiveRole: (role: "traveller" | "host" | "admin") => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: "light",
  activeRole: "traveller",
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
  setActiveRole: (role) => set({ activeRole: role })
}));
