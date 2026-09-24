import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
    preprocess: vitePreprocess({ script: true }),
    kit: { adapter: adapter({ fallback: 'index.html' }) }
}
