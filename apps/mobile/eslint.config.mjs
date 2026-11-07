import baseConfig from "@luggage-storage/eslint-config";

export default [
  ...baseConfig,
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        __DEV__: "readonly"
      }
    }
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off"
    }
  }
];

