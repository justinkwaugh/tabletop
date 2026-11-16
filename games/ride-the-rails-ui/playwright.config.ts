import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
    webServer: {
        command: 'pnpm run dev --port 4219',
        port: 4219,
        reuseExistingServer: !process.env.CI
    },
    use: { baseURL: 'http://localhost:4219', browserName: 'chromium' },
    projects: [
        { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
        {
            name: 'phone',
            use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true }
        }
    ],
    timeout: 60_000,
    testDir: 'tests',
    testMatch: /(.+\.)?(test|spec)\.[jt]s/
}

export default config
