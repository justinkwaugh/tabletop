import { expect, test } from '@playwright/test'

test('auction abbreviation icons reserve their full width beside private names', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('opening')
    const offers = page.getByRole('region', { name: 'Auction offers' })
    await expect(offers).toBeVisible()
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 })
        const rows = offers.locator('.identity').filter({ has: page.locator('.private-icon') })
        expect(await rows.count()).toBeGreaterThan(0)
        for (const row of await rows.all()) {
            const icon = await row.locator('.private-icon').boundingBox()
            const button = await row.locator('.lot-icon').boundingBox()
            const name = await row.locator('.name').boundingBox()
            if (!icon || !button || !name) throw new Error('Missing auction identity')
            expect(button.width).toBe(26)
            expect(icon.width).toBe(26)
            expect(name.x - (icon.x + icon.width)).toBeCloseTo(9, 0)
        }
    }
})
