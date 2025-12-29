import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'frontend', // フロントエンドのソースがここにあることを指定
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
});