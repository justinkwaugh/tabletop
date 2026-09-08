import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
    webServer: {
        command: 'pnpm run dev --port 5179',
        port: 5179,
        reuseExistingServer: !process.env.CI
    },
    use: {
        baseURL: 'http://localhost:5179',
        viewport: { width: 1280, height: 900 },
        launchOptions: {
            args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        }
    },
    timeout: 60_000,
    testDir: 'tests',
    testMatch: /(.+\.)?(test|spec)\.[jt]s/
}

export default config
