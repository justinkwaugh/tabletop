import { test } from '@playwright/test'
test.use({ baseURL: 'http://localhost:5191', viewport: { width: 900, height: 700 } })
test('frames', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    for (const v of (process.env.VARIANTS ?? 'A').split(',')) {
        await page.goto(`/prototype-city-flow?variant=${v}`)
        await page.waitForFunction(() => 'protoSet' in window)
        for (let s = 0; s < 4; s++)
            for (const ms of (process.env.TIMES ?? '0,200,400,600,2000').split(',').map(Number)) {
                await page.evaluate(([s, ms]) => (window as any).protoSet(s, ms), [s, ms])
                await page.waitForTimeout(80)
                await page.locator('svg').first().screenshot({ path: `/tmp/mgproto/${v}-${s}-${ms}.png` })
            }
    }
    console.log('errors', JSON.stringify(errors))
})
