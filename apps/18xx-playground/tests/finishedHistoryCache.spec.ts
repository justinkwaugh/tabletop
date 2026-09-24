import { expect, test } from '@playwright/test'

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
    await page.evaluate(
        () =>
            new Promise<void>((resolve, reject) => {
                const open = indexedDB.open('tabletop-local')
                open.onerror = () => reject(open.error)
                open.onsuccess = () => {
                    const db = open.result
                    const transaction = db.transaction('actions', 'readwrite')
                    const store = transaction.objectStore('actions')
                    const request = store.get('top-finished')
                    request.onsuccess = () => {
                        const record = request.result
                        for (const sale of record.actions.filter(
                            (action: { type: string }) => action.type === 'SellFundingShares'
                        )) {
                            Reflect.deleteProperty(sale.metadata, 'requiredContribution')
                            Reflect.deleteProperty(sale.metadata, 'cashShortfall')
                        }
                        store.put(record)
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
