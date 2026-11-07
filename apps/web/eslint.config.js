import baseConfig from "@luggage-storage/eslint-config";

export default [
  ...baseConfig,
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"]
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off"
    }
  }
];

