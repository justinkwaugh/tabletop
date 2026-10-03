import { test } from '@playwright/test'
test.use({ baseURL: 'http://localhost:5191', viewport: { width: 1150, height: 800 }, deviceScaleFactor: 2 })
test('gallery', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/prototype-oracle')
    await page.waitForTimeout(800)
    await page.locator('svg').first().screenshot({ path: '/tmp/mgproto/oracle-gallery.png' })
    console.log('errors', JSON.stringify(errors))
})
