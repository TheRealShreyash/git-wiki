import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), viteReact()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})

export default config
