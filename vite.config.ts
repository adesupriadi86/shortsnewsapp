import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0'
    },

    plugins: [react()],

    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    },

    // ==========================================
    // BUILD OPTIMIZATION (VERY IMPORTANT)
    // ==========================================
    build: {
      sourcemap: false,          // Lebih kecil & cepat
      outDir: "dist",            // Folder build
      assetsDir: "assets",       // File JS/CSS/Chunk
      minify: "esbuild",         // Default, super cepat
      cssMinify: true,           // Tailwind jadi kecil
      emptyOutDir: true,         // Bersihkan dist sebelum build
      rollupOptions: {
        output: {
          // Bikin nama file output ada hash → caching optimal
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]"
        }
      }
    }
  };
});
