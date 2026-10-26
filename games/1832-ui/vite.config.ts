import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [sveltekit()],
    // Vite 8 resolves an SSR-externalized CSS @import as a relative file (vitejs/vite#23096).
    ssr: { noExternal: ['tailwindcss'] },
    server: { host: '0.0.0.0', port: 4194, strictPort: true }
})
