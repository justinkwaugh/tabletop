import { expect, test, type Page } from '@playwright/test'

async function openCompanies(page: Page, title: string) {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption(title)
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    await page.getByRole('tab', { name: 'Companies', exact: true }).first().click()
}

function ownerShares(page: Page, company: string, owner: string) {
    return page
        .getByRole('table', { name: `${company} share ownership` })
        .getByRole('row', { name: new RegExp(`^${owner}\\b`) })
        .getByRole('cell')
        .last()
}

test('TOP buys a market share from the company card in one press', async ({ page }) => {
    await openCompanies(page, 'TOP')
    const card = page.getByRole('article', { name: 'Charlottetown details' })
    await expect(card.getByRole('button', { name: 'Trade Charlottetown shares' })).toHaveText(
        'Buy · Sell'
    )

    await card.getByRole('heading', { name: 'Charlottetown' }).click()
    const trades = page.getByRole('dialog', { name: 'Trade Charlottetown shares' })
    await expect(trades).toBeVisible()
    await expect(trades.getByRole('button', { name: /^Buy from / })).toHaveText([
        /Market\s*\$92/,
        /Treasury\s*\$92/
    ])
    await expect(trades.getByRole('button', { name: /^Sell / })).toHaveText([
        /1\s*\$92/,
        /2\s*\$184/,
        /3\s*\$276/
    ])

    await trades.getByRole('button', { name: 'Buy from Market for $92' }).click()
    await expect(trades).toBeHidden()
    await expect(ownerShares(page, 'Charlottetown', 'Market')).toHaveText('1')
    await expect(ownerShares(page, 'Charlottetown', 'Alex')).toHaveText('4')
})

test('TOP buys for the Union Bank, showing what its owner pays', async ({ page }) => {
    await openCompanies(page, 'TOP')
    await page
        .getByRole('article', { name: 'Charlottetown details' })
        .getByRole('heading', { name: 'Charlottetown' })
        .click()
    const trades = page.getByRole('dialog', { name: 'Trade Charlottetown shares' })
    await trades.getByRole('group', { name: 'Buy as' }).getByRole('button', { name: 'UB' }).click()
    const market = trades.getByRole('button', { name: 'Buy from Market for $92' })
    await expect(market).toContainText('you + $52')

    await market.click()
    await expect(ownerShares(page, 'Charlottetown', 'Union Bank')).toHaveText('2')
})

test('1830 sells from the company card through its keyboard opener', async ({ page }) => {
    await openCompanies(page, '1830')
    const opener = page.getByRole('button', { name: 'Trade Pennsylvania Railroad shares' })
    await opener.focus()
    await page.keyboard.press('Enter')
    const trades = page.getByRole('dialog', { name: 'Trade Pennsylvania Railroad shares' })
    await expect(trades).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(trades.getByRole('button', { name: 'Buy from IPO for $100' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trades).toBeHidden()
    await expect(opener).toBeFocused()

    await page.keyboard.press('Enter')
    await trades.getByRole('button', { name: 'Sell 2 shares for $200' }).click()
    await expect(trades).toBeHidden()
    await expect(page.getByText('Available Sales')).toHaveCount(0)
    await expect(ownerShares(page, 'Pennsylvania Railroad', 'Alex')).toHaveText('1')
    await expect(ownerShares(page, 'Pennsylvania Railroad', 'Market')).toHaveText('2')
})

test('a card offers no trades for a company the player cannot trade', async ({ page }) => {
    await openCompanies(page, 'TOP')
    const card = page.getByRole('article', { name: 'PEIR details' })
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: /^Trade / })).toHaveCount(0)
    await card.getByRole('heading', { name: 'PEIR' }).click()
    await expect(page.getByRole('dialog', { name: /^Trade / })).toHaveCount(0)
})

test('a spreadsheet sale still reopens the Sell menu, unlike a card sale', async ({ page }) => {
    await openCompanies(page, '1830')
    await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).first().click()
    await page.getByRole('button', { name: 'Sell Pennsylvania Railroad shares' }).first().click()
    await page
        .getByRole('dialog', { name: 'Confirm share trade' })
        .getByRole('button', { name: /^Sell 1 share for/ })
        .click()
    await expect(page.getByText('Available Sales')).toBeVisible()
})
