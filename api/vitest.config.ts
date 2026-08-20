import path from 'path';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'], // text = terminal, html = navegável
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/generated/**']
    }
  }
});
