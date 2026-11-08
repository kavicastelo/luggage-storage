import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const REFRESH_TOKEN_KEY = "luggage_storage_refresh_token";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};

// In-memory fallback for non-native test environments (e.g. vitest in node)
let inMemoryFallback: string | null = null;

function isSecureStoreAvailable(): boolean {
  try {
    return (
      Platform.OS !== "web" &&
      typeof SecureStore.getItemAsync === "function" &&
      typeof SecureStore.setItemAsync === "function"
    );
  } catch {
    return false;
  }
}

export const secureStorage = {
  /**
   * Retrieves the stored refresh token from hardware-backed secure storage.
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      if (isSecureStoreAvailable()) {
        return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, SECURE_STORE_OPTIONS);
      }
      return inMemoryFallback;
    } catch {
      return null;
    }
  },

  /**
   * Securely saves the refresh token in hardware-backed secure storage.
   * Throws an error if storage fails to prevent establishing a false session.
   */
  async setRefreshToken(token: string): Promise<void> {
    if (!token) {
      throw new Error("Cannot persist empty refresh token");
    }

    try {
      if (isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, SECURE_STORE_OPTIONS);
      } else {
        inMemoryFallback = token;
      }
    } catch (err) {
      throw new Error(
        `Failed to securely persist authentication credentials: ${err instanceof Error ? err.message : "Storage error"}`,
        { cause: err }
      );
    }
  },

  /**
   * Deletes the stored refresh token from secure storage.
   */
  async deleteRefreshToken(): Promise<void> {
    try {
      if (isSecureStoreAvailable()) {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, SECURE_STORE_OPTIONS);
      }
      inMemoryFallback = null;
    } catch {
      // Clear in-memory fallback regardless of native error
      inMemoryFallback = null;
    }
  },

  /**
   * Testing helper to reset in-memory fallback
   */
  _resetMemoryFallback(): void {
    inMemoryFallback = null;
  }
};
