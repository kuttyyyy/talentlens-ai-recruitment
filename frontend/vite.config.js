// vite.config.js
// This file configures Vite (our build tool) and tells it to use Tailwind CSS.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // enables Tailwind CSS classes in our project
  ],
})