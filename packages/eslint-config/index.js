import js from "@eslint/js";
import tseslint from "typescript-eslint";

export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn"
    }
  },
  {
    ignores: [
      "dist/**",
      "build/**",
      ".turbo/**",
      "node_modules/**",
      ".expo/**",
      "coverage/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts"
    ]
  }
);

export default baseConfig;
