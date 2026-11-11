import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'

export const VitestConfig = defineProject({
    // Vite 8 resolves an SSR-externalized CSS @import as a relative file (vitejs/vite#23096).
    ssr: { noExternal: ['tailwindcss'] },
    test: {
        // Specs never run on Google Cloud; without this, every Firestore client waits 3 s for
        // google-auth-library's metadata server probe before reaching the emulator.
        env: { METADATA_SERVER_DETECTION: 'none' },
        include: ['src/**/*.{test,spec}.{js,ts}'],
        exclude: [
            '**/node_modules/**',
            '**/esm/**',
            '**/dist/**',
            '**/build/**',
            '**/cypress/**',
            '**/.{idea,git,cache,output,temp}/**',
            '**/{karma,rollup,rolldown,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
        ]
    }
})

/**
 * The directory of the config file at `configUrl` (its `import.meta.url`), for a project's `root`.
 *
 * Vitest 5 sets a project's root only after plugins have configured, so when the suite runs from
 * the repo root, vite-plugin-svelte reads the root package.json and misses the package's Svelte
 * libraries (runed, flowbite-svelte, ...). Vitest then hands them to Node uncompiled. A project
 * that loads the Svelte plugin sets `root` itself.
 */
export function projectRoot(configUrl: string): string {
    return fileURLToPath(new URL('.', configUrl))
}
