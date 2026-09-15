import { expect, test } from '@playwright/test'

test('history shows recorded auction details without action controls', async ({ page }) => {
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await page.getByRole('button', { name: 'goto my last turn', exact: true }).click()
    const panel = page.getByRole('region', { name: 'Current action', exact: true })
    await expect(panel.getByLabel('Position summary')).toBeVisible()
    await page.getByRole('button', { name: 'step forwards', exact: true }).click()
    await expect(panel).toContainText('offered')
    await expect(panel).not.toContainText('Offer Auction Lot')
    await expect(panel.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Stock actions' })).toHaveCount(0)
    await page.getByRole('button', { name: 'go to current', exact: true }).click()
    await expect(page.getByRole('table', { name: 'Final wealth', exact: true })).toBeVisible()
    expect(errors).toEqual([])
})

test('a local spectator sees stock-round information instead of stock actions', async ({
    page
}) => {
    test.setTimeout(60000)
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    await expect(page.getByRole('navigation', { name: 'Stock actions' })).toBeVisible()
    await page.evaluate(
        () =>
            new Promise<void>((resolve, reject) => {
                const request = indexedDB.open('tabletop-local')
                request.onerror = () => reject(request.error)
                request.onsuccess = () => {
                    const db = request.result
                    const transaction = db.transaction('games', 'readwrite')
                    const store = transaction.objectStore('games')
                    const read = store.getAll()
                    read.onsuccess = () => {
                        for (const game of read.result) {
                            game.hotseat = false
                            for (const player of game.players) player.userId = 'another-user'
                            store.put(game)
                        }
                    }
                    transaction.oncomplete = () => {
                        db.close()
                        resolve()
                    }
                    transaction.onerror = () => {
                        db.close()
                        reject(transaction.error)
                    }
                }
            })
    )
    await page.reload()
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    const panel = page.getByRole('region', { name: 'Current action', exact: true })
    await expect(panel.getByLabel('Position summary')).toBeVisible()
    await expect(panel).not.toContainText('Stock round')
    await expect(panel.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Stock actions' })).toHaveCount(0)
})

test('backward navigation separates the last payout from its train run', async ({ page }) => {
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const panel = page.getByRole('region', { name: 'Current action', exact: true })
    const back = page.getByRole('button', { name: 'step backwards', exact: true })
    await back.click()
    await expect(panel).toContainText('Paid out')
    await expect(panel).not.toContainText('Georgetown')
    await expect(page.locator('.map-area [data-map-route]')).toHaveCount(0)
    await expect(panel.getByRole('table', { name: 'Recorded train runs' })).toHaveCount(0)
    const steps = page.getByRole('navigation', { name: 'Operating steps' })
    await expect(steps).toBeVisible()
    await expect(steps.locator('[aria-current=step]')).toContainText('Payout')
    await expect(panel).not.toContainText('Cash')
    await expect(steps.locator('button:enabled')).toHaveCount(0)
    await back.click()
    await expect(panel.getByRole('table', { name: 'Recorded train runs' })).toBeVisible()
    await expect(panel).not.toContainText('Paid out')
    await expect(page.locator('.map-area [data-map-route]').first()).toBeVisible()
    await expect(steps.locator('[aria-current=step]')).toContainText('Run')
    await page.getByRole('button', { name: 'step forwards', exact: true }).click()
    await expect(steps.locator('[aria-current=step]')).toContainText('Payout')
    await expect(page.locator('.map-area [data-map-route]')).toHaveCount(0)
    await expect(panel).not.toContainText('Cash')
    expect(errors).toEqual([])
})
