import { create } from "zustand";

interface MobileState {
  role: "traveller" | "host";
  setRole: (role: "traveller" | "host") => void;
}

export const useMobileStore = create<MobileState>((set) => ({
  role: "traveller",
  setRole: (role) => set({ role })
}));
