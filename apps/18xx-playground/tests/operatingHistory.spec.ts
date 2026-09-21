import { expect, test, type Page } from '@playwright/test'

async function withholdThroughOperatingTurn(page: Page) {
    const action = page.getByRole('region', { name: 'Current action', exact: true })
    const steps = page.getByRole('navigation', { name: 'Operating steps' })
    const progress = async () =>
        `${(await steps.count()) ? await steps.innerText() : ''}|${await action.innerText()}`
    const step = action
        .getByRole('button', { name: /^(skip|Run trains|finish|Continue operating round)$|^Withhold/ })
        .first()
    for (;;) {
        await expect(step).toBeVisible()
        const name = (await step.innerText()).trim()
        const offered = await progress()
        // A click made while the previous company's turn is still settling is ignored.
        await expect(async () => {
            if ((await progress()) === offered) await step.click()
            await page.waitForTimeout(400)
            expect(await progress()).not.toBe(offered)
        }).toPass()
        if (name === 'finish') return
    }
}

for (const title of ['TOP', '1889']) {
    test(`${title} spreadsheet records OR income and keeps completed valuations through reload and Undo`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('operations')
        await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
        const period = page.getByRole('group', { name: 'Spreadsheet period' })
        await period.getByRole('button', { name: 'Income', exact: true }).click()
        await expect(page.getByText('No operating-round history recorded yet.', { exact: true })).toBeVisible()
        for (let turn = 0; turn < 4; turn++) await withholdThroughOperatingTurn(page)
        await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
        await period.getByRole('button', { name: 'Income', exact: true }).click()
        const history = page.getByRole('table', { name: 'Operating round history' })
        const rounds = history.getByRole('rowheader')
        await expect(rounds).toHaveText(['OR 1.1 *', 'OR 1.2'])
        await expect(history.getByRole('columnheader', { name: 'Income', exact: true })).toHaveCount(3)
        await expect(history.getByRole('columnheader', { name: 'Net worth', exact: true })).toHaveCount(3)
        const recorded = await history.locator('tbody td').allTextContents()
        await page.reload()
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('operations')
        await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
        await period.getByRole('button', { name: 'Income', exact: true }).click()
        await expect(history.locator('tbody td')).toHaveText(recorded)
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(rounds).toHaveText(['OR 1.1 *', 'OR 1.2 *'])
        expect(errors).toEqual([])
    })
}

for (const title of ['TOP', '1889']) {
    test(`${title} history separates gross train revenue from player dividends`, async ({ page }) => {
        const [revenue, dividend] = title === 'TOP' ? ['$70', '$21'] : ['¥90', '¥27']
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('routes')
        const action = page.getByRole('region', { name: 'Current action', exact: true })
        const steps = page.getByRole('navigation', { name: 'Operating steps' })
        await action.getByRole('button', { name: 'Run trains', exact: true }).click()
        await expect(steps.getByRole('button', { name: /^Run/ })).toContainText(`Ran for ${revenue}`)
        await action.getByRole('button', { name: 'Pay', exact: true }).click()
        await expect(steps.getByRole('button', { name: /^Payout/ })).toContainText('Paid out')
        await page.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
        await page.getByRole('group', { name: 'Spreadsheet period' }).getByRole('button', { name: 'Income', exact: true }).click()
        const history = page.getByRole('table', { name: 'Operating round history' })
        const round = history.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'OR 1.1 *', exact: true }) })
        await expect(round.getByRole('cell').first()).toHaveText(dividend)
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(page.getByText('No operating-round history recorded yet.', { exact: true })).toBeVisible()
    })
}
