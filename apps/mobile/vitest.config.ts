import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  define: {
    __DEV__: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react-native": "react-native-web",
      "expo-secure-store": path.resolve(__dirname, "./tests/mocks/expo-secure-store.ts")
    }
  },
  test: {
    globals: true,
    environment: "node"
  }
});
