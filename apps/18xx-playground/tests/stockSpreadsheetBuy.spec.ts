import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} buys a market share from the spreadsheet after confirmation`, async ({
        page
    }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('trading')
        await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()

        const spreadsheet = page.getByRole('table', { name: 'Company share ownership' })
        const cell = spreadsheet.getByRole('button', { name: /Buy .* from Market/ }).first()
        const marketCell = spreadsheet
            .getByRole('row', { name: /^Market/ })
            .getByRole('cell')
            .first()
        const confirmation = page.getByRole('dialog', { name: 'Confirm share trade' })
        const originalShares = await cell.innerText()

        await cell.click()
        await expect(confirmation).toBeVisible()
        await expect(confirmation).toContainText(/Buy 1\s+for [¥$]\d+\?/)
        if (title === '1889') {
            await expect(confirmation.locator('[data-purchase-buyer]')).toHaveCount(0)
        }
        await confirmation.getByRole('button', { name: 'No' }).click()
        await expect(confirmation).toBeHidden()
        await expect(cell).toHaveText(originalShares)

        await cell.click()
        await expect(confirmation.getByRole('button', { name: 'Yes' })).toHaveCSS(
            'background-color',
            'rgb(40, 116, 82)'
        )
        await confirmation.getByRole('button', { name: 'Yes' }).click()
        await expect(confirmation).toBeHidden()
        await expect(marketCell).toHaveText(
            Number(originalShares) === 1 ? '' : String(Number(originalShares) - 1)
        )
    })
}

test('TOP treasury share is buyable in the flipped spreadsheet', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
    await page
        .getByRole('group', { name: 'Spreadsheet view' })
        .getByRole('button', { name: 'Swap rows and columns' })
        .click()

    const spreadsheet = page.getByRole('table', { name: 'Company share ownership' })
    const treasury = spreadsheet.getByRole('button', {
        name: 'Buy Charlottetown from Treasury'
    })
    await treasury.click()
    const confirmation = page.getByRole('dialog', { name: 'Confirm share trade' })
    await expect(confirmation).toContainText('for $92?')
    await confirmation.getByRole('button', { name: 'Yes' }).click()
    await expect(treasury).toHaveCount(0)
})

test('TOP offers a Union Bank purchase with the owner contribution', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()

    const spreadsheet = page.getByRole('table', { name: 'Company share ownership' })
    const bankShare = spreadsheet
        .getByRole('row', { name: /^Union Bank/ })
        .getByRole('cell')
        .first()
    await spreadsheet.getByRole('button', { name: 'Buy Charlottetown from Market' }).click()

    const confirmation = page.getByRole('dialog', { name: 'Confirm share trade' })
    const bankBuy = confirmation.locator('[data-purchase-buyer="company:UB"]')
    await expect(bankBuy).toHaveText('As Bank + $52')
    const noBottom = await confirmation
        .getByRole('button', { name: 'No' })
        .evaluate((button) => button.getBoundingClientRect().bottom)
    const bankTop = await bankBuy.evaluate((button) => button.getBoundingClientRect().top)
    expect(bankTop).toBeGreaterThan(noBottom)
    await bankBuy.click()
    await expect(bankShare).toHaveText('2')
    await expect(spreadsheet.getByRole('row', { name: /^Alex/ })).toContainText('$188')
})
