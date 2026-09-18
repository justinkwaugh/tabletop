import { expect, test } from '@playwright/test'

for (const newestFirst of [false, true]) {
    test(`async history opens at the newest end with newest ${newestFirst ? 'first' : 'last'}`, async ({ page }) => {
        await page.goto('/')
        await page.evaluate(async (first) => {
            const fixture = await import(new URL('/src/demo/historyLoading.fixture.ts', location.href).href)
            fixture.mountHistory(first)
        }, newestFirst)
        const scroll = page.getByRole('region', { name: 'Scrollable history' })
        await expect(scroll.getByText('No actions yet.')).toBeVisible()
        await page.getByRole('button', { name: 'Complete history', exact: true }).click()
        await expect.poll(() => scroll.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(500)
        await expect.poll(() => scroll.evaluate((element, first) => first
            ? element.scrollTop
            : element.scrollHeight - element.clientHeight - element.scrollTop, newestFirst)).toBeLessThan(2)

        await scroll.evaluate((element) => element.scrollTop = 400)
        await page.getByRole('button', { name: 'Update history', exact: true }).click()
        await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(400)
        await page.getByRole('button', { name: newestFirst ? 'Newest last' : 'Newest first', exact: true }).click()
        await expect.poll(() => scroll.evaluate((element, first) => first
            ? element.scrollHeight - element.clientHeight - element.scrollTop
            : element.scrollTop, newestFirst)).toBeLessThan(2)
    })
}
