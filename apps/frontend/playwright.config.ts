import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
    use: { baseURL: 'http://localhost:4173' },
    webServer: {
        command: 'pnpm run build && pnpm run preview',
        port: 4173
    },
    testDir: 'tests',
    testMatch: /(.+\.)?(test|spec)\.[jt]s/
}

export default config
