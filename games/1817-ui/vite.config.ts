import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [sveltekit()],
    // Nothing ships from this harness build; Vite 7's bundled es-module-lexer misreads
    // some minified chunks (#209).
    build: { minify: false },
    server: { host: '0.0.0.0', port: 4192, strictPort: true }
})
