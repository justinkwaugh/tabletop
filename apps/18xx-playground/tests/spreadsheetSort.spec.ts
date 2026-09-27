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
    test(`${title} spreadsheet Player header toggles turn order in both orientations`, async ({
        page
    }) => {
        const sheet = await openSpreadsheet(page, title, 'opening')
        const corner = sheet.locator('thead th').first()
        const turnOrder = corner.getByRole('button', { name: 'Player', exact: true })
        const playerNames = sheet.locator('.player-label')
        const seats = ['Alex', 'Blair', 'Casey']
        await expect(corner).toHaveText('Player / Company')
        await expect(sheet.locator('thead th:has(.sort-header)').nth(1)).toHaveText('Cash')
        await expect(playerNames).toHaveText(seats)

        await turnOrder.click()
        await expect(turnOrder).toHaveAttribute('aria-pressed', 'true')
        // The opening's first player varies, and turn order follows the seats from there.
        const byTurn = (await playerNames.allTextContents()).map((name) => name.trim())
        const first = seats.indexOf(byTurn[0])
        expect(byTurn).toEqual([...seats.slice(first), ...seats.slice(0, first)])
        await turnOrder.click()
        await expect(turnOrder).toHaveAttribute('aria-pressed', 'false')
        await expect(playerNames).toHaveText(seats)

        await turnOrder.click()
        await page.getByRole('button', { name: 'Swap rows and columns' }).click()
        await expect(corner).toHaveText('Company / Player')
        await expect(turnOrder).toHaveAttribute('aria-pressed', 'true')
        await expect(playerNames).toHaveText(byTurn)
        await turnOrder.click()
        await expect(playerNames).toHaveText(seats)
    })
}

for (const title of ['TOP', '1889']) {
    test(`${title} spreadsheet turn order sort holds when a later player passes`, async ({
        page
    }) => {
        const sheet = await openSpreadsheet(page, title, 'trading')
        const playerNames = sheet.locator('tbody tr th .player-label')
        const stockActions = page.getByRole('navigation', { name: 'Stock actions' })
        const confirmation = page.getByRole('dialog', { name: 'Confirm share trade' })
        const actingPlayers = sheet.locator('tr.current-player th .player-label')
        await sheet.getByRole('button', { name: 'Player', exact: true }).click()
        await expect(playerNames).toHaveText(['Alex', 'Blair', 'Casey'])

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

        // Blair's pass changes next round's priority, not this round's turn order.
        await expect(playerNames).toHaveText(['Alex', 'Blair', 'Casey'])
    })
}
