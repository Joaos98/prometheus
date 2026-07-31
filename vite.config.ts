import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: [
      'demo/**/*.test.ts',
      'domain/**/*.test.ts',
      'storage/**/*.test.ts',
      'server/**/*.test.ts',
      'ui/**/*.test.ts',
    ],
    environment: 'node',
  },
})
