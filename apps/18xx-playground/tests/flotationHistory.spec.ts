import { expect, test } from '@playwright/test'

test('history groups a share purchase with its flotation in both directions', async ({ page }) => {
    await page.goto('/table')
    const steps = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/demo/flotationHistory.fixture.ts', location.href).href
        )
        return fixture.flotationHistorySteps()
    })
    expect(steps.beginning).toEqual({ actionTypes: [], floated: false })
    expect(steps.purchase).toEqual({
        actionTypes: ['BuyShares', 'FloatCompany'],
        floated: true
    })
    expect(steps.next.actionTypes.at(-1)).toBe('FinishStockTurn')
    expect(steps.previous).toEqual(steps.purchase)
})

test('finished SR 3 skips automatic turn completion after its first purchase', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/table')
    const steps = await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/demo/flotationHistory.fixture.ts', location.href).href
        )
        return fixture.finishedStockTurnHistorySteps()
    })
    expect(steps.beforePurchase.index).toBe(steps.purchaseIndex - 1)
    expect(steps.purchasePosition).toEqual({
        index: steps.purchaseIndex,
        type: 'BuyShares',
        source: 'user',
        passed: undefined
    })
    expect(steps.followingPass).toEqual({
        index: steps.purchaseIndex + 2,
        type: 'FinishStockTurn',
        source: 'user',
        passed: true
    })
    expect(steps.previous).toEqual(steps.purchasePosition)
    expect(steps.exactPurchase.index).toBe(steps.purchaseIndex)
    expect(steps.afterExactPurchase).toEqual(steps.followingPass)
})

test('the position panel describes the purchase and flotation in the same step', async ({
    page
}) => {
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('flotation')
    const stock = page.getByRole('region', { name: 'Stock trading', exact: true })
    await page
        .getByRole('navigation', { name: 'Stock actions' })
        .getByRole('button', { name: 'Buy', exact: true })
        .click()
    await stock.locator('[data-purchase-certificate="A:share:4"]').click()
    await page
        .getByRole('navigation', { name: 'Stock actions' })
        .getByRole('button', { name: 'Pass', exact: true })
        .click()
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await page.getByRole('button', { name: 'step backwards', exact: true }).click()
    await page.getByRole('button', { name: 'step backwards', exact: true }).click()
    await page.getByRole('button', { name: 'step forwards', exact: true }).click()
    const panel = page.getByRole('region', { name: 'Current action', exact: true })
    await expect(panel).toContainText('Bought')
    await expect(panel).toContainText('floated')
})
