import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'], // text = terminal, html = navegável
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/generated/**']
    }
  }
});
