import { expect, test, type Locator, type Page } from '@playwright/test'

function amounts(cells: Locator) {
    return cells.evaluateAll((elements) =>
        elements.map((element) => Number(element.textContent?.replace(/[^\d-]/g, '')))
    )
}

function companyOrder(sheet: Locator) {
    return sheet
        .locator('thead th[aria-label]')
        .evaluateAll((headers) => headers.map((header) => header.getAttribute('aria-label')))
}

async function openSpreadsheet(page: Page, title: string, position?: string) {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption(title)
    if (position) await page.getByLabel('Position', { exact: true }).selectOption(position)
    await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
    return page.getByRole('table', { name: 'Company share ownership' })
}

function sortedCopy(values: number[], direction: 'ascending' | 'descending') {
    return values.toSorted((a, b) => (direction === 'ascending' ? a - b : b - a))
}

for (const title of ['TOP', '1889']) {
    test(`${title} spreadsheet headers cycle player and company sorts`, async ({ page }) => {
        const sheet = await openSpreadsheet(page, title)
        const playerRows = sheet
            .locator('tbody tr')
            .filter({ has: page.locator('th .player-label') })
        const playerNames = playerRows.locator('th .player-label')
        await expect(playerNames).toHaveText(['Alex', 'Blair', 'Casey'])

        const netWorth = sheet.getByRole('columnheader', { name: 'Net worth' })
        const playerNetWorth = () => amounts(playerRows.locator('td:last-child'))
        for (const direction of ['descending', 'ascending'] as const) {
            await netWorth.getByRole('button').click()
            await expect(netWorth).toHaveAttribute('aria-sort', direction)
            const values = await playerNetWorth()
            expect(values).toEqual(sortedCopy(values, direction))
        }
        await netWorth.getByRole('button').click()
        await expect(netWorth).not.toHaveAttribute('aria-sort')
        await expect(playerNames).toHaveText(['Alex', 'Blair', 'Casey'])

        const initialCompanies = await companyOrder(sheet)
        const cash = sheet.getByRole('rowheader', { name: 'Cash' })
        const companyCash = () => amounts(cash.locator('xpath=..').locator('td.bright-cell'))
        await cash.getByRole('button').click()
        await expect(cash).toHaveAttribute('aria-sort', 'descending')
        const descending = await companyCash()
        expect(descending).toEqual(sortedCopy(descending, 'descending'))
        await cash.getByRole('button').click()
        await cash.getByRole('button').click()
        await expect(cash).not.toHaveAttribute('aria-sort')

        expect(await companyOrder(sheet)).toEqual(initialCompanies)
    })
}

test('TOP spreadsheet sorts companies by last run', async ({ page }) => {
    const sheet = await openSpreadsheet(page, 'TOP', 'finished')
    const lastRun = sheet.getByRole('rowheader', { name: 'Last run' })
    const runs = lastRun.locator('xpath=..').locator('.last-run')
    await expect(runs.first()).toBeVisible()
    for (const direction of ['descending', 'ascending'] as const) {
        await lastRun.getByRole('button').click()
        await expect(lastRun).toHaveAttribute('aria-sort', direction)
        const revenues = await amounts(runs)
        expect(new Set(revenues).size).toBeGreaterThan(1)
        expect(revenues).toEqual(sortedCopy(revenues, direction))
    }
})

test('TOP market value ties follow operating order in both directions', async ({ page }) => {
    const sheet = await openSpreadsheet(page, 'TOP', 'finished')
    const value = sheet.getByRole('rowheader', { name: 'Value' })
    await expect(sheet.locator('thead th[aria-label]')).toHaveCount(8)
    const initial = await companyOrder(sheet)
    expect(initial.indexOf('Murray River')).toBeLessThan(initial.indexOf('Belfast Branch'))
    await value.getByRole('button').click()
    await expect(value).toHaveAttribute('aria-sort', 'descending')
    expect(await companyOrder(sheet)).toEqual([
        'Mount Stewart',
        'Alberton',
        'Summerside',
        'Souris',
        'Belfast Branch',
        'Murray River',
        'Charlottetown',
        'Georgetown'
    ])
    await value.getByRole('button').click()
    await expect(value).toHaveAttribute('aria-sort', 'ascending')
    expect(await companyOrder(sheet)).toEqual([
        'Georgetown',
        'Charlottetown',
        'Belfast Branch',
        'Murray River',
        'Souris',
        'Summerside',
        'Alberton',
        'Mount Stewart'
    ])
})
