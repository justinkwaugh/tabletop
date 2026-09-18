import { test, expect } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} stock menu stages purchases and sales with Back and Undo`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('trading')
        const panel = page.getByRole('region', { name: 'Stock trading', exact: true })
        const undo = page.getByRole('button', { name: 'Undo', exact: true })
        await panel.getByRole('button', { name: 'Buy', exact: true }).click()
        await panel.getByRole('button', { name: 'Back', exact: true }).click()
        await panel.getByRole('button', { name: 'Buy', exact: true }).click()
        await undo.click()
        await panel.getByRole('button', { name: 'Buy', exact: true }).click()
        await panel.locator('[data-purchase-certificate]').first().click()
        await expect(panel.getByRole('button', { name: 'End turn', exact: true })).toBeVisible()
        await undo.click()
        await panel.getByRole('button', { name: 'Sell', exact: true }).click()
        await panel.getByRole('button', { name: /^Sell / }).first().click()
        await panel.locator('[data-sale-company]').first().click()
        await panel.getByRole('button', { name: /^Sell for / }).click()
        await expect(panel.getByRole('button', { name: 'End turn', exact: true })).toBeVisible()
        await undo.click()
        await expect(panel.getByRole('button', { name: 'Pass', exact: true })).toBeVisible()
    })
}

for (const title of ['TOP', '1889']) {
    test(`${title} starts a company through company and price stages`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('starting')
        const panel = page.getByRole('region', { name: 'Stock trading', exact: true })
        await panel.getByRole('button', { name: 'Start', exact: true }).click()
        await panel.locator('[data-start-company]').first().click()
        await expect(panel.locator('[data-start-price]').first()).toBeVisible()
        await panel.getByRole('button', { name: 'Back', exact: true }).click()
        await panel.locator('[data-start-company]').first().click()
        await panel.locator('[data-start-price]').first().click()
        await expect(panel.getByRole('button', { name: 'End turn', exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(panel.getByRole('button', { name: 'Start', exact: true })).toBeVisible()
    })
}
