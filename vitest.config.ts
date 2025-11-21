/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        projects: [
            'apps/*',
            'games/*',
            'libs/*',
            'libs/!(config-*)',
            'libs/!(frontend-games)',
            'libs/!(backend-games)'
        ]
    }
})
