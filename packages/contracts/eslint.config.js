import baseConfig from "@luggage-storage/eslint-config";

export default [
  ...baseConfig,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"]
  }
];

