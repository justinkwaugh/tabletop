/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        projects: [
            'apps/*',
            'games/*',
            'libs/*',
            'libs/18xx-ui/vitest.runes.config.ts',
            'apps/frontend/vitest.runes.config.ts'
        ]
    }
})
