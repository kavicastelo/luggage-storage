import { create } from "zustand";

export type ActiveMobileRole = "traveller" | "host";

interface MobileState {
  role: ActiveMobileRole;
  selectedHostLocationId: string | null;
  setRole: (role: ActiveMobileRole) => void;
  setSelectedHostLocationId: (locationId: string | null) => void;
  resetTransientState: () => void;
}

export const useMobileStore = create<MobileState>((set) => ({
  role: "traveller",
  selectedHostLocationId: null,
  setRole: (role) => set({ role }),
  setSelectedHostLocationId: (selectedHostLocationId) => set({ selectedHostLocationId }),
  resetTransientState: () => set({ role: "traveller", selectedHostLocationId: null })
}));
