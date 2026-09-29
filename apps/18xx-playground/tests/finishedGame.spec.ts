import { expect, test } from '@playwright/test'

test('finished TOP supports saved history navigation back to the opening auction', async ({
    page
}) => {
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeVisible({
        timeout: 30000
    })
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const history = page.getByRole('list', { name: 'Action history' })
    await history.getByRole('button', { name: 'Jump to Auction in history', exact: true }).click()
    const action = page.getByRole('region', { name: 'Current action', exact: true })
    await expect(action).toContainText('Auction offerings', { ignoreCase: true })
    await page.getByRole('button', { name: 'step backwards', exact: true }).click()
    await expect(action).toContainText('Auction bidding', { ignoreCase: true })
    await page.getByRole('button', { name: 'step forwards', exact: true }).click()
    await expect(action).not.toContainText('Auction bidding', { ignoreCase: true })
    await page.getByRole('button', { name: 'go to current', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeVisible({
        timeout: 30000
    })
    await page.reload()
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeVisible({
        timeout: 30000
    })
    expect(errors).toEqual([])
})

test('finished 1889 steps back and forward across its bank-break payout', async ({ page }) => {
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    const winner = page.getByRole('heading', { name: 'Player 2 wins', exact: true })
    await expect(winner).toBeVisible({ timeout: 30000 })
    const back = page.getByRole('button', { name: 'step backwards', exact: true })
    const forward = page.getByRole('button', { name: 'step forwards', exact: true })
    // The bank breaks during the final set; step back past it and replay forward.
    for (let step = 0; step < 12; step++) await back.click()
    await expect(winner).toHaveCount(0)
    for (let step = 0; step < 12; step++) await forward.click()
    await expect(winner).toBeVisible()
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const history = page.getByRole('list', { name: 'Action history' })
    await history.getByRole('button', { name: 'Jump to Auction in history', exact: true }).click()
    await page.getByRole('button', { name: 'go to current', exact: true }).click()
    await expect(winner).toBeVisible({ timeout: 30000 })
    expect(errors).toEqual([])
})
