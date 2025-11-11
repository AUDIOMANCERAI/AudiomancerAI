// vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // *** CRITICAL FIX: Explicitly set the root and build directory ***
  root: './', // Tells Vite to look for index.html in the current folder (root)
  build: {
    outDir: 'dist', // Standard output directory
    // Ensure all paths resolve from the root
    rollupOptions: {
      input: {
        main: 'index.html' 
      }
    }
  }
});