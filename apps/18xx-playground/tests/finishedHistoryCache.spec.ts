import { expect, test } from '@playwright/test'
import { putLocalRecords, readLocalRecords } from './localGameStore.js'

test('rebuilds a finished example with outdated funding-sale metadata', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeVisible({
        timeout: 30000
    })
    await page.getByLabel('Position', { exact: true }).selectOption('construction')
    await expect(
        page.getByRole('heading', { name: 'Player 2 wins', exact: true })
    ).not.toBeVisible()
    const recorded = (await readLocalRecords(page, 'actions')).find(
        (record) => record.gameId === 'top-finished'
    )
    if (!recorded) throw new Error('The finished TOP actions were not saved')
    for (const sale of recorded.actions.filter((action) => action.type === 'SellFundingShares')) {
        if (!sale.metadata) throw new Error('Funding sales record their metadata')
        Reflect.deleteProperty(sale.metadata, 'requiredContribution')
        Reflect.deleteProperty(sale.metadata, 'cashShortfall')
    }
    await putLocalRecords(page, 'actions', [recorded])
    await page.reload()
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeVisible({
        timeout: 30000
    })
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const history = page.getByRole('list', { name: 'Action history' })
    const operation = history
        .getByRole('article', { name: 'S operation history', exact: true })
        .filter({ hasText: 'Sold 2 Murray River for $158' })
    await expect(operation).toContainText('President owes $400 and is short $135')
    await expect(operation).toContainText(/Bought\s*Diesel/)
    await expect(history).not.toContainText('Sell Funding Shares')
})
