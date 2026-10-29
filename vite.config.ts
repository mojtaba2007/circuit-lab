import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  // در توسعه، درخواست‌های /api به سرور حساب کاربری (npm run server) می‌رود
  server: { strictPort: true, proxy: { '/api': 'http://localhost:8787' } },
});
