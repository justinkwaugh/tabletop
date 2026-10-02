import { expect, test } from '@playwright/test'
import { putLocalRecords, readLocalRecords } from './localGameStore.js'

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

test('a scenario abandoned mid-load saves nothing under another scenario’s name', async ({
    page
}) => {
    test.setTimeout(60000)
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('funding-chain')
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 20000 })
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 20000 })
    const games = await readLocalRecords(page, 'games')
    expect(games.length).toBeGreaterThan(0)
    for (const game of games) expect(game.name).toContain(` ${game.config?.examplePosition} `)
})

test('finished 1889 ignores an unfinished game saved under its name', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption('opening')
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 20000 })
    const opening = (await readLocalRecords(page, 'games')).find(
        (game) => game.typeId === 'shikoku-1889'
    )
    if (!opening) throw new Error('The 1889 opening example was not saved')
    await putLocalRecords(page, 'games', [
        { ...opening, name: 'Finances example · 26 · finished · default' }
    ])
    await page.reload()
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeVisible({
        timeout: 30000
    })
})

test('finished 1817 steps back across its last acquisition round and jumps to its merger round', async ({
    page
}) => {
    test.setTimeout(120000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1817')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    const winner = page.getByRole('heading', { name: 'Player 4 wins', exact: true })
    await expect(winner).toBeVisible({ timeout: 90000 })
    const back = page.getByRole('button', { name: 'step backwards', exact: true })
    const forward = page.getByRole('button', { name: 'step forwards', exact: true })
    for (let step = 0; step < 12; step++) await back.click()
    await expect(winner).toHaveCount(0)
    for (let step = 0; step < 12; step++) await forward.click()
    await expect(winner).toBeVisible()
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const history = page.getByRole('list', { name: 'Action history' })
    await history.getByRole('button', { name: 'Jump to MR 7.2 in history', exact: true }).click()
    await expect(winner).toHaveCount(0)
    await page.getByRole('button', { name: 'go to current', exact: true }).click()
    await expect(winner).toBeVisible({ timeout: 30000 })
    expect(errors).toEqual([])
})
