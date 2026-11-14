import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const SAVED_LOCATIONS_KEY = "bagbox_saved_location_ids_v1";

interface SavedLocationsState {
  savedIds: string[];
  hasHydrated: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  toggleSaved: (locationId: string) => Promise<boolean>;
  removeSaved: (locationId: string) => Promise<void>;
  isSaved: (locationId: string) => boolean;
  clearSaved: () => Promise<void>;
}

async function persistIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(ids));
  } catch {
    // Best-effort local persistence
  }
}

export const useSavedLocationsStore = create<SavedLocationsState>((set, get) => ({
  savedIds: [],
  hasHydrated: false,
  isLoading: false,

  hydrate: async () => {
    if (get().hasHydrated || get().isLoading) {
      return;
    }
    set({ isLoading: true });
    try {
      const raw = await AsyncStorage.getItem(SAVED_LOCATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const validIds = parsed.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          );
          set({ savedIds: Array.from(new Set(validIds)), hasHydrated: true, isLoading: false });
          return;
        }
      }
    } catch {
      // Ignore malformed storage entries
    }
    set({ savedIds: [], hasHydrated: true, isLoading: false });
  },

  toggleSaved: async (locationId: string) => {
    const trimmed = locationId.trim();
    if (!trimmed) {
      return false;
    }
    const existing = get().savedIds;
    const isCurrentlySaved = existing.includes(trimmed);
    const next = isCurrentlySaved
      ? existing.filter((id) => id !== trimmed)
      : [trimmed, ...existing];
    set({ savedIds: next, hasHydrated: true });
    await persistIds(next);
    return !isCurrentlySaved;
  },

  removeSaved: async (locationId: string) => {
    const next = get().savedIds.filter((id) => id !== locationId);
    set({ savedIds: next, hasHydrated: true });
    await persistIds(next);
  },

  isSaved: (locationId: string) => get().savedIds.includes(locationId),

  clearSaved: async () => {
    set({ savedIds: [], hasHydrated: true });
    try {
      await AsyncStorage.removeItem(SAVED_LOCATIONS_KEY);
    } catch {
      // Best-effort clear
    }
  }
}));
