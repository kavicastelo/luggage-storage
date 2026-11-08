// In-memory mock for expo-secure-store in Node test environment
const store = new Map<string, string>();

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS_THIS_DEVICE_ONLY = 2;
export const WHEN_UNLOCKED = 3;
export const AFTER_FIRST_UNLOCK = 4;
export const ALWAYS = 5;

export interface SecureStoreOptions {
  keychainAccessible?: number;
  keychainService?: string;
  requireAuthentication?: boolean;
}

export async function getItemAsync(key: string, _options?: SecureStoreOptions): Promise<string | null> {
  return store.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string, _options?: SecureStoreOptions): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string, _options?: SecureStoreOptions): Promise<void> {
  store.delete(key);
}

export function _resetMockStore(): void {
  store.clear();
}

