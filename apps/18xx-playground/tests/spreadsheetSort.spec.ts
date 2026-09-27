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

for (const title of ['TOP', '1889']) {
    test(`${title} spreadsheet Order shows turn order and toggles an ascending sort`, async ({
        page
    }) => {
        const sheet = await openSpreadsheet(page, title, 'opening')
        const playerRows = sheet
            .locator('tbody tr')
            .filter({ has: page.locator('th .player-label') })
        const playerNames = playerRows.locator('th .player-label')
        const statHeaders = sheet.locator('thead th:has(.sort-header)')
        await expect(statHeaders).toHaveText(['Order', 'Cash', 'Shares', 'Certs', 'Net worth'])
        const order = sheet.getByRole('columnheader', { name: 'Order' })
        const orderCells = playerRows.locator('td:nth-last-child(5)')
        const seats = ['Alex', 'Blair', 'Casey']
        await expect(playerNames).toHaveText(seats)
        const orders = await amounts(orderCells)
        expect(orders.toSorted()).toEqual([1, 2, 3])
        const byTurn = seats.toSorted((a, b) => orders[seats.indexOf(a)] - orders[seats.indexOf(b)])

        await order.getByRole('button').click()
        await expect(order).toHaveAttribute('aria-sort', 'ascending')
        await expect(playerNames).toHaveText(byTurn)
        await expect(orderCells).toHaveText(['1', '2', '3'])

        await order.getByRole('button').click()
        await expect(order).not.toHaveAttribute('aria-sort')
        await expect(playerNames).toHaveText(seats)

        await page.getByRole('button', { name: 'Swap rows and columns' }).click()
        const statRows = sheet.locator('tbody tr.financial-row th:has(.sort-header)')
        await expect(statRows).toHaveText(['Order', 'Cash', 'Shares', 'Certs', 'Net worth'])
    })
}

for (const title of ['TOP', '1889']) {
    test(`${title} spreadsheet Order keeps the round's turn order when a later player passes`, async ({
        page
    }) => {
        const sheet = await openSpreadsheet(page, title, 'trading')
        const orderCells = sheet
            .locator('tbody tr')
            .filter({ has: page.locator('th .player-label') })
            .locator('td:nth-last-child(5)')
        await expect(orderCells).toHaveText(['1', '2', '3'])
        const stockActions = page.getByRole('navigation', { name: 'Stock actions' })
        const confirmation = page.getByRole('dialog', { name: 'Confirm share trade' })
        const actingPlayers = sheet.locator('tr.current-player th .player-label')

        await sheet
            .getByRole('button', { name: /Buy .* from Market/ })
            .first()
            .click()
        await confirmation.getByRole('button', { name: 'Yes' }).click()
        await expect(confirmation).toBeHidden()
        // A TOP purchase ends the turn; 1889 may still sell, so its turn ends explicitly.
        if (title === '1889')
            await stockActions.getByRole('button', { name: 'End turn', exact: true }).click()
        await expect(actingPlayers.filter({ hasText: 'Blair' })).toHaveCount(1)
        const passing = await actingPlayers.allTextContents()
        await stockActions.getByRole('button', { name: 'Pass', exact: true }).click()
        await expect.poll(() => actingPlayers.allTextContents()).not.toEqual(passing)

        // In pass order Blair passed first, so TOP notes Blair's next round position.
        await expect(orderCells).toHaveText(title === 'TOP' ? ['1', '2 (1)', '3'] : ['1', '2', '3'])
    })
}
