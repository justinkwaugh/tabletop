import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
    webServer: {
        command: 'pnpm run dev --port 5187',
        port: 5187,
        reuseExistingServer: !process.env.CI
    },
    use: { baseURL: 'http://localhost:5187', viewport: { width: 1280, height: 900 } },
    timeout: 60_000,
    testDir: 'tests',
    testMatch: /(.+\.)?(test|spec)\.[jt]s/
}

export default config
