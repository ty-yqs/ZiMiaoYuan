import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // 相对路径，方便部署到 CloudBase 静态托管的任意子路径
  base: './',
  server: {
    port: 5173,
  },
});
