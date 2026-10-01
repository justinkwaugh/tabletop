import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)))
await page.goto('http://localhost:4188/table')
await page.selectOption('select[aria-label="Game"]', '1830')
await page.selectOption('select[aria-label="Position"]', 'opening')
await page.waitForTimeout(5000)
for (let i = 0; i < 6; i++) {
    await page.getByText('Buy', { exact: true }).first().click()
    await page.waitForTimeout(700)
}
await page.waitForTimeout(1000)
await page.mouse.click(1036, 333)
await page.waitForTimeout(800)
await page.mouse.click(704, 375)
await page.waitForTimeout(800)
for (let i = 0; i < 4; i++) {
    await page.mouse.click(917, 176)
    await page.waitForTimeout(700)
    await page.mouse.click(959, 384)
    await page.waitForTimeout(1000)
}
for (let i = 0; i < 6; i++) {
    const header = await page.locator('body').innerText()
    if (!header.includes('STOCK ROUND')) break
    await page.mouse.click(1551, 176)
    await page.waitForTimeout(1000)
}
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/shots/drive3.png' })
await page.locator('[data-home-node="city-1"]').click()
await page.waitForTimeout(2000)
await page.screenshot({ path: '/tmp/shots/drive4.png' })
await browser.close()
