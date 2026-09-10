import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: 'hosted-tests',
    workers: 1,
    timeout: 120000,
    use: {
        baseURL: process.env.HOSTED_SITE_URL ?? 'http://localhost:5174',
        viewport: { width: 1400, height: 1000 }
    }
})
