import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const appId = pkg.name.replace(/[^a-zA-Z0-9_-]/g, '-')

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://kit.svelte.dev/docs/integrations#preprocessors
    // for more information about preprocessors
    preprocess: vitePreprocess({ script: true }),
    compilerOptions: {
        cssHash: ({ css, hash }) => `svelte-${appId}-${hash(css)}`
    },
    kit: {
        adapter: adapter({
            fallback: 'index.html' // may differ from host to host
        })
    }
}

export default config
