import { fileURLToPath } from 'node:url'

// Prettier resolves plugin names from its working directory, so a bare name fails when it
// runs from the repo root or another package. A resolved path loads the plugin from here.
const sveltePlugin = fileURLToPath(import.meta.resolve('prettier-plugin-svelte'))

export default {
    singleQuote: true,
    semi: false,
    trailingComma: 'none',
    printWidth: 100,
    tabWidth: 4,
    plugins: [sveltePlugin],
    overrides: [{ files: '*.svelte', options: { parser: 'svelte' } }],
    svelteStrictMode: true
}
