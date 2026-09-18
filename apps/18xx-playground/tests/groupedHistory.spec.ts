import { expect, test } from '@playwright/test'

test('compact stock rows and operating groups retain details and action navigation', async ({
    page
}) => {
    test.setTimeout(60000)
    await page.goto('/table')
    await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByText('Winner: Player 2', { exact: true })).toBeVisible({
        timeout: 30000
    })
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await page.getByRole('button', { name: 'Scroll to SR 6', exact: true }).click()
    const stock = page
        .getByRole('list', { name: 'SR 6 actions', exact: true })
        .locator('article.stock')
        .last()
    await expect(stock).toContainText('Split BR:BB from Summerside')
    const row = page
        .getByRole('list', { name: 'SR 6 actions', exact: true })
        .locator('.stock-action')
        .first()
    expect((await row.boundingBox())!.height).toBeLessThan(25)
    await expect(stock.locator('header')).toHaveCount(0)
    await expect(stock.getByRole('button', { name: /^Details/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Scroll to OR 6.1', exact: true }).click()
    const company = page
        .getByRole('list', { name: 'OR 6.1 actions', exact: true })
        .getByRole('article', { name: 'C operation history', exact: true })
    await expect(company).toContainText('Withheld')
    await expect(company.getByText('Finished track', { exact: true })).toHaveCount(0)
    await expect(company.getByRole('button', { name: 'Details', exact: true })).toHaveCount(0)
    await expect(company.getByText('Finished track', { exact: true })).toHaveCount(0)
    await expect(company.getByText(/^Tile /)).toHaveCount(0)
    await company.getByRole('button', { name: /Laid track at Q13/ }).click()
    await expect(page.getByText('Winner: Player 2', { exact: true })).not.toBeVisible()
})
