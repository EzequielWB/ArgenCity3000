import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { port: 5273 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
