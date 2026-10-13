import type { PlaywrightTestConfig } from '@playwright/test'

// Another checkout's harness may hold the usual port, so a run can name its own.
const port = Number(process.env.HARNESS_PORT ?? 5197)

const config: PlaywrightTestConfig = {
    webServer: {
        command: `pnpm run dev --port ${port}`,
        port,
        reuseExistingServer: !process.env.CI
    },
    use: { baseURL: `http://localhost:${port}`, viewport: { width: 1280, height: 900 } },
    timeout: 60_000,
    testDir: 'tests',
    testMatch: /(.+\.)?(test|spec)\.[jt]s/
}

export default config
