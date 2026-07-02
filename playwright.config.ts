import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // Electron-Apps mit Single-Instance-Lock vertragen keine Parallel-Starts.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: [['list']],
});
