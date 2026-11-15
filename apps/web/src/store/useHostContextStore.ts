import { create } from "zustand";

interface HostContextState {
  selectedBusinessId: string;
  selectedLocationId: string;
  setSelectedBusinessId: (businessId: string) => void;
  setSelectedLocationId: (locationId: string) => void;
  resetHostContext: () => void;
}

export const useHostContextStore = create<HostContextState>((set) => ({
  selectedBusinessId: "",
  selectedLocationId: "",

  setSelectedBusinessId: (selectedBusinessId: string) => set({ selectedBusinessId }),
  setSelectedLocationId: (selectedLocationId: string) => set({ selectedLocationId }),
  resetHostContext: () => set({ selectedBusinessId: "", selectedLocationId: "" })
}));
