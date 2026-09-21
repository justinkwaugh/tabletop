import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} sells immediately from quantity choices and single-share companies`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('trading')
        const strip = page.getByRole('navigation', { name: 'Stock actions' })
        const panel = page.getByRole('region', { name: 'Stock trading', exact: true })
        await strip.getByRole('button', { name: 'Sell', exact: true }).click()
        const companyId = title === 'TOP' ? 'ML' : 'IR'
        const company = panel.locator(`[data-sale-company="${companyId}"]`)
        const owned = company.locator('.owned-shares')
        const initialCount = Number(await owned.innerText())
        expect(initialCount).toBeGreaterThan(1)
        await company.click()
        await expect(owned).toHaveText(String(initialCount))
        await expect(panel.getByText('HOW MANY', { exact: true })).toBeVisible()
        await expect(panel.locator('button.confirm')).toHaveCount(0)
        await panel.locator('[data-sale-shares="1"]').click()
        await expect(owned).toHaveText(String(initialCount - 1))
        const soldCount = panel.locator(`[data-sold-company="${companyId}"] td`)
        await expect(soldCount).toHaveText('1')
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await strip.getByRole('button', { name: 'Sell', exact: true }).click()
        await expect(owned).toHaveText(String(initialCount))
        await expect(panel.getByRole('table', { name: 'Sales this turn' })).toHaveCount(0)
        for (let count = initialCount; count > 1; count--) {
            await company.click()
            await panel.locator('[data-sale-shares="1"]').click()
            await expect(owned).toHaveText(String(count - 1))
        }
        await company.click()
        await expect(company).toHaveCount(0)
        await expect(soldCount).toHaveText(String(initialCount))
        await expect(panel.locator('[data-sale-shares]')).toHaveCount(0)
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await strip.getByRole('button', { name: 'Sell', exact: true }).click()
        await expect(owned).toHaveText('1')
        await expect(soldCount).toHaveText(String(initialCount - 1))
        await strip.getByRole('button', { name: 'End turn', exact: true }).click()
        await expect(panel.getByRole('table', { name: 'Sales this turn' })).toHaveCount(0)
    })
}

test('sales summary moves to a full-height strip only in wide panes', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    await page.getByRole('navigation', { name: 'Stock actions' }).getByRole('button', { name: 'Sell', exact: true }).click()
    await page.locator('[data-sale-company="ML"]').click()
    await page.locator('[data-sale-shares="1"]').click()
    const summary = page.getByRole('complementary', { name: 'Sales summary' })
    await expect(summary).toBeVisible()
    for (const width of [700, 500, 499, 500]) {
        await page.locator('.actions-area').evaluate((element, width) => { element.style.width = `${width}px` }, width)
        await expect.poll(() => summary.evaluate((element) => {
            const bounds = element.getBoundingClientRect()
            const panel = element.closest('.action-panel')!.getBoundingClientRect()
            const controls = element.parentElement!.querySelector('.stock-controls')!.getBoundingClientRect()
            return bounds.left >= controls.right && Math.abs(bounds.top - panel.top) < 1 && Math.abs(bounds.bottom - panel.bottom) < 2
        })).toBe(width >= 500)
    }
    await page.setViewportSize({ width: 800, height: 960 })
    await expect(summary).toBeVisible()
    await expect.poll(() => summary.evaluate((element) => {
        const controls = element.parentElement!.querySelector('.stock-controls')!.getBoundingClientRect()
        return element.getBoundingClientRect().top >= controls.bottom
    })).toBe(true)
})
