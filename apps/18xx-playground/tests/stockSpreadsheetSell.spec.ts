import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} lists legal sale amounts and proceeds in the spreadsheet`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('trading')
        await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()

        const spreadsheet = page.getByRole('table', { name: 'Company share ownership' })
        const confirmation = page.getByRole('dialog', { name: 'Confirm share trade' })
        const seller = spreadsheet.getByRole('button', { name: /^Sell .* shares$/ }).first()
        await seller.click()
        if (title === 'TOP') {
            await expect(confirmation).toContainText(/Sell\s+shares\?/)
            await expect(confirmation.locator('[data-sale-shares="1"]')).toContainText(/[¥$]\d+/)
        } else {
            await expect(confirmation).toContainText(/Sell\s+share\?/)
            await expect(confirmation).toContainText(/Proceeds ¥\d+/)
        }
        await confirmation.getByRole('button', { name: 'No' }).click()
        await expect(confirmation).toBeHidden()
    })
}

test('TOP confirms a single share sale with Yes and No', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()

    const spreadsheet = page.getByRole('table', { name: 'Company share ownership' })
    const seller = spreadsheet.getByRole('button', { name: 'Sell Souris shares' }).first()
    const confirmation = page.getByRole('dialog', { name: 'Confirm share trade' })
    await seller.click()
    await expect(confirmation).toContainText(/Sell\s+share\?/)
    await expect(confirmation).toContainText(/Proceeds \$\d+/)
    await confirmation.getByRole('button', { name: 'No' }).click()
    await expect(seller).toBeVisible()

    await seller.click()
    await confirmation.getByRole('button', { name: 'Yes' }).click()
    await expect(seller).toHaveCount(0)
})

test('TOP commits the selected multi-share amount', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()

    const spreadsheet = page.getByRole('table', { name: 'Company share ownership' })
    const marketCell = spreadsheet
        .getByRole('row', { name: /^Market/ })
        .getByRole('cell')
        .first()
    const before = Number(await marketCell.innerText())
    await spreadsheet.getByRole('button', { name: 'Sell Charlottetown shares' }).first().click()
    const confirmation = page.getByRole('dialog', { name: 'Confirm share trade' })
    await confirmation.locator('[data-sale-shares="2"]').click()
    await expect(marketCell).toHaveText(String(before + 2))
})

test('TOP sell choices remain available with spreadsheet axes flipped', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
    await page
        .getByRole('group', { name: 'Spreadsheet view' })
        .getByRole('button', { name: 'Swap rows and columns' })
        .click()

    const spreadsheet = page.getByRole('table', { name: 'Company share ownership' })
    await spreadsheet.getByRole('button', { name: 'Sell Charlottetown shares' }).first().click()
    const confirmation = page.getByRole('dialog', { name: 'Confirm share trade' })
    await expect(confirmation.locator('[data-sale-shares="2"]')).toBeVisible()
})
