import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Each test file runs in its own forked process with its own in-memory DB
    pool: 'forks',
    reporters: ['verbose'],
  },
});
