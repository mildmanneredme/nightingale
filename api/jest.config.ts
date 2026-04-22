import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testMatch: ["**/__tests__/**/*.test.ts"],
  // Run tests serially — they share a real DB
  maxWorkers: 1,
  setupFiles: ["<rootDir>/__tests__/helpers/setupEnv.ts"],
  globalSetup: "<rootDir>/__tests__/helpers/globalSetup.ts",
  globalTeardown: "<rootDir>/__tests__/helpers/globalTeardown.ts",
};

export default config;
