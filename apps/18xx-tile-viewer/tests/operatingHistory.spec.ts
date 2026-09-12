import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} spreadsheet records OR income and keeps completed valuations through reload and Undo`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('operations')
        await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
        const period = page.getByRole('group', { name: 'Spreadsheet period' })
        const view = page.getByRole('group', { name: 'Spreadsheet view' })
        await period.getByRole('button', { name: 'Income', exact: true }).click()
        await expect(page.getByText('No operating-round history recorded yet.', { exact: true })).toBeVisible()
        const turns = title === 'TOP' ? 6 : 4
        for (let turn = 0; turn < turns; turn++) {
            if (title === '1889' && turn > 0)
                await page.getByRole('button', { name: 'Continue operating round', exact: true }).click()
            await page.getByRole('button', { name: 'Finish track', exact: true }).click()
            await page.getByRole('button', { name: 'Finish stations', exact: true }).click()
            await page.getByRole('button', { name: 'Confirm routes', exact: true }).click()
            await page.getByRole('button', { name: 'Withhold', exact: true }).click()
            await page.getByRole('button', { name: 'Confirm distribution', exact: true }).click()
            await page.getByRole('button', { name: 'Finish operating turn', exact: true }).click()
        }
        const history = page.getByRole('table', { name: 'Operating round history' })
        await expect(history.getByRole('columnheader', { name: 'OR 1.1 Partial', exact: true })).toBeVisible()
        await expect(history.getByRole('columnheader', { name: 'OR 1.2', exact: true })).toBeVisible()
        await expect(history.getByText('In progress')).toHaveCount(0)
        await view.getByRole('button', { name: 'Player', exact: true }).click()
        const recorded = await history.locator('tbody td').allTextContents()
        await expect(history.getByRole('columnheader', { name: 'Income', exact: true })).toHaveCount(2)
        await expect(history.getByRole('columnheader', { name: 'Net worth', exact: true })).toHaveCount(2)
        await page.reload()
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('operations')
        await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
        await period.getByRole('button', { name: 'Income', exact: true }).click()
        await view.getByRole('button', { name: 'Player', exact: true }).click()
        await expect(history.locator('tbody td')).toHaveText(recorded)
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(history.getByText('In progress')).toHaveCount(1)
        expect(errors).toEqual([])
    })
}

for (const title of ['TOP', '1889']) {
    test(`${title} history separates gross train revenue from player dividends`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('routes')
        const routes = page.getByRole('region', { name: 'Train routes', exact: true })
        await routes.getByRole('button', { name: /^Run / }).first().click()
        await routes.getByLabel('Starting revenue center').selectOption(JSON.stringify({ locationId: title === 'TOP' ? 'L16' : 'E2', nodeId: 'city' }))
        const paths = title === 'TOP' ? [['L16', 'edge-1'], ['K17', 'path-0'], ['K19', 'edge-2']] : [['E2', 'edge-1'], ['F3', 'edge-0']]
        for (const [location, path] of paths) await routes.getByRole('button', { name: `Add ${location} ${path}`, exact: true }).click()
        await routes.getByRole('button', { name: 'Save route', exact: true }).click()
        await routes.getByRole('button', { name: 'Confirm routes', exact: true }).click()
        await page.getByRole('button', { name: 'Pay dividends', exact: true }).click()
        await page.getByRole('button', { name: 'Confirm distribution', exact: true }).click()
        await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
        await page.getByRole('group', { name: 'Spreadsheet period' }).getByRole('button', { name: 'Income', exact: true }).click()
        const history = page.getByRole('table', { name: 'Operating round history' })
        await expect(history.getByRole('row').filter({ has: page.getByRole('rowheader', { name: title === 'TOP' ? 'Charlottetown · Mainline' : 'Iyo Railway', exact: true }) }).getByRole('cell')).toHaveText(['$40'])
        await page.getByRole('group', { name: 'Spreadsheet view' }).getByRole('button', { name: 'Player', exact: true }).click()
        await expect(history.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Alex', exact: true }) }).getByRole('cell').first()).toHaveText('$12')
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(history.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Alex', exact: true }) }).getByRole('cell').first()).toHaveText('$0')
    })
}
