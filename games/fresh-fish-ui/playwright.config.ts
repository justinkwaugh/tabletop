import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
    webServer: {
        command: 'pnpm exec vite dev --host 127.0.0.1 --port 4173',
        port: 4173
    },
    testDir: 'tests',
    testMatch: /(.+\.)?(test|spec)\.[jt]s/,
    use: {
        baseURL: 'http://127.0.0.1:4173'
    }
}

export default config
