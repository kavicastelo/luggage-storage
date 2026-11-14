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
      "expo-secure-store": path.resolve(__dirname, "./tests/mocks/expo-secure-store.ts"),
      "react-native-svg": path.resolve(__dirname, "./tests/mocks/react-native-svg.tsx"),
      "react-native-safe-area-context": path.resolve(
        __dirname,
        "./tests/mocks/react-native-safe-area-context.tsx"
      ),
      "@react-native-community/datetimepicker": path.resolve(
        __dirname,
        "./tests/mocks/datetimepicker.tsx"
      ),
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
        "./tests/mocks/async-storage.ts"
      ),
      "expo-document-picker": path.resolve(__dirname, "./tests/mocks/expo-document-picker.ts")
    }
  },
  test: {
    globals: true,
    environment: "node"
  }
});
