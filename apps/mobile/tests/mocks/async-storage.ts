const memoryStore = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return memoryStore.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    memoryStore.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    memoryStore.delete(key);
  },
  async clear(): Promise<void> {
    memoryStore.clear();
  },
  async getAllKeys(): Promise<readonly string[]> {
    return Array.from(memoryStore.keys());
  }
};

export function _resetMockAsyncStorage(): void {
  memoryStore.clear();
}

export default AsyncStorage;

