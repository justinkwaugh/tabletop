import { expect, test } from '@playwright/test'

test('finished TOP supports saved history navigation back to the opening auction', async ({
    page
}) => {
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByText('Winner: Player 2', { exact: true })).toBeVisible({
        timeout: 30000
    })
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const history = page.getByRole('list', { name: 'Action history' })
    await history.getByRole('article').last().getByRole('button').first().click()
    await expect(page.getByRole('article', { name: 'Current auction' })).toBeVisible()
    await page.getByRole('button', { name: 'step backwards', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Auction offers' })).toBeVisible()
    await page.getByRole('button', { name: 'step forwards', exact: true }).click()
    await expect(page.getByRole('article', { name: 'Current auction' })).toBeVisible()
    await page.getByRole('button', { name: 'go to current', exact: true }).click()
    await expect(page.getByText('Winner: Player 2', { exact: true })).toBeVisible({ timeout: 30000 })
    await page.reload()
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByText('Winner: Player 2', { exact: true })).toBeVisible({ timeout: 30000 })
    expect(errors).toEqual([])
})
