import { test, expect } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} Undo unwinds the stock menu one stage at a time before game history`, async ({
        page
    }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('trading')
        const strip = page.getByRole('navigation', { name: 'Stock actions' })
        const panel = page.getByRole('region', { name: 'Stock trading', exact: true })
        const undo = page.getByRole('button', { name: 'Undo', exact: true })
        const sell = strip.getByRole('button', { name: 'Sell', exact: true })
        const company = panel.locator(`[data-sale-company="${title === 'TOP' ? 'ML' : 'IR'}"]`)
        const owned = company.locator('.owned-shares')
        const quantity = panel.getByText('HOW MANY', { exact: true })

        await sell.click()
        await expect(sell).toHaveAttribute('aria-pressed', 'true')
        const initialCount = await owned.innerText()
        await company.click()
        await expect(quantity).toBeVisible()

        await undo.click()
        await expect(quantity).toHaveCount(0)
        await expect(sell).toHaveAttribute('aria-pressed', 'true')
        await expect(company).toBeVisible()

        await undo.click()
        await expect(sell).toHaveAttribute('aria-pressed', 'false')

        await sell.click()
        await company.click()
        await panel.locator('[data-sale-shares="1"]').click()
        await expect(owned).toHaveText(String(Number(initialCount) - 1))
        await undo.click()
        await sell.click()
        await expect(owned).toHaveText(initialCount)
    })
}

for (const title of ['TOP', '1889']) {
    test(`${title} starts a company through company and price stages`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('starting')
        const strip = page.getByRole('navigation', { name: 'Stock actions' })
        const panel = page.getByRole('region', { name: 'Stock trading', exact: true })
        const undo = page.getByRole('button', { name: 'Undo', exact: true })
        const start = strip.getByRole('button', { name: 'Start', exact: true })

        await start.click()
        await panel.locator('[data-start-company]').first().click()
        await expect(panel.locator('[data-start-price]').first()).toBeVisible()

        await undo.click()
        await expect(panel.locator('[data-start-price]')).toHaveCount(0)
        await expect(start).toHaveAttribute('aria-pressed', 'true')

        await panel.locator('[data-start-company]').first().click()
        await panel.locator('[data-start-price]').first().click()
        await expect(start).toHaveCount(0)
        await undo.click()
        await expect(start).toBeVisible()
    })
}
