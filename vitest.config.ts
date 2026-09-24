/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

// Only packages with a vitest config take part. SvelteKit packages' vite.config.ts files load
// sveltekit(), which resets Vite's root to the working directory; from the repo root that made
// those projects collect every test in the repo.
export default defineConfig({
    test: {
        projects: [
            'apps/*/vitest.config.ts',
            'games/*/vitest.config.ts',
            'libs/*/vitest.config.ts',
            'libs/18xx-ui/vitest.runes.config.ts',
            'apps/frontend/vitest.runes.config.ts'
        ]
    }
})
