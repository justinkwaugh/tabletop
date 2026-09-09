import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
    test(`inspects both finance examples and restores local state at ${width}px`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/economy')
        const alex = page.getByRole('article', { name: 'Alex portfolio', exact: true })
        const union = page.getByRole('article', { name: 'Union Bank treasury', exact: true })
        await expect(alex).toContainText('Cash 240')
        await expect(union).toContainText('Cash 40')
        await expect(union.locator('[data-certificate-id="So:president"]')).toContainText(
            '20% · 2 shares'
        )
        await expect(alex.locator('[data-certificate-id="So:president"]')).toHaveCount(0)
        await expect(page.locator('[data-company-id="So"]')).toContainText('President: Union Bank')
        await expect(page.locator('[data-company-id="So"]')).toContainText(
            'Controlling owner: Alex'
        )
        await expect(page.locator('[data-certificate-id="PEIR:share:1"]')).toContainText('1/5')
        await expect(page.getByText('PEIR: 5 outstanding shares.', { exact: false })).toContainText(
            'President: Blair'
        )
        await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await expect(alex.locator('[data-certificate-id="AR:president"]')).toContainText(
            '20% · 2 shares'
        )
        await expect(alex.locator('[data-certificate-id="AR:president"]')).toContainText(
            'Counts as 1'
        )
        const bank = page.getByRole('article', { name: 'Bank certificates', exact: true })
        await expect(bank.locator('[data-pool-id="initial-offering"]')).toContainText('IPO')
        await expect(bank.locator('[data-pool-id="open-market"]')).toContainText('Market')
        await expect(
            bank.locator('[data-pool-id="initial-offering"] [data-certificate-id]')
        ).toHaveCount(8)
        await expect(
            bank.locator('[data-pool-id="open-market"] [data-certificate-id]')
        ).toHaveCount(2)
        await expect(page.locator('[data-company-id="ER"]')).toContainText('Owner: Iyo Railway')
        await expect(page.locator('[data-company-id="ER"]')).toContainText(
            'Controlling owner: Blair'
        )
        await page.getByRole('button', { name: 'The Old Prince 1871', exact: true }).click()
        await expect(union).toContainText('Cash 40')
        await page.reload()
        await expect(union).toContainText('Cash 40')
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            .toBe(true)
        expect(errors).toEqual([])
    })
}

test('preserves earlier examples and reuses the current fixture on reload', async ({ page }) => {
    await page.goto('/economy')
    const union = page.getByRole('article', { name: 'Union Bank treasury', exact: true })
    await expect(union).toContainText('Cash 40')
    const previousId = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('tabletop-local')
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
        const tx = db.transaction('games', 'readwrite')
        const request = tx.objectStore('games').getAll()
        const previousId = await new Promise<string>((resolve, reject) => {
            request.onsuccess = () => {
                const game = request.result.find((game) => game.typeId === 'the-old-prince')
                game.name = 'Finances example · 2'
                tx.objectStore('games').put(game)
                tx.oncomplete = () => resolve(game.id)
            }
            request.onerror = () => reject(request.error)
            tx.onabort = () => reject(tx.error)
        })
        db.close()
        return previousId
    })
    await page.reload()
    await expect(union).toContainText('Cash 40')
    const examples = async () =>
        page.evaluate(async () => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open('tabletop-local')
                request.onsuccess = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            })
            const request = db.transaction('games').objectStore('games').getAll()
            const games = await new Promise<{ id: string; name: string }[]>((resolve, reject) => {
                request.onsuccess = () =>
                    resolve(
                        request.result
                            .filter((game) => game.typeId === 'the-old-prince')
                            .map((game) => ({
                                id: game.id,
                                name: game.name
                            }))
                    )
                request.onerror = () => reject(request.error)
            })
            db.close()
            return games
        })
    const saved = await examples()
    expect(saved).toHaveLength(2)
    expect(saved).toContainEqual({ id: previousId, name: 'Finances example · 2' })
    expect(saved.filter((game) => game.name === 'Finances example · 3')).toHaveLength(1)
    await page.reload()
    await expect(union).toContainText('Cash 40')
    expect(await examples()).toEqual(saved)
})

for (const width of [1280, 390]) {
    test(`buys shares, cancels selection, restores purchases and undoes at ${width}px`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/economy')
        const purchase = page.getByRole('region', { name: 'Buy shares', exact: true })
        const union = page.getByRole('article', { name: 'Union Bank treasury', exact: true })
        const alex = page.getByRole('article', { name: 'Alex portfolio', exact: true })
        const chooseUnion = () =>
            page.locator('[data-purchase-certificate="ML:share:5"][data-buyer="UB"]').click()
        await expect(
            page.locator('[data-purchase-certificate="ML:share:8"][data-buyer="player"]')
        ).toBeDisabled()
        await chooseUnion()
        await expect(purchase).toContainText('Union Bank pays 40 to Bank.')
        await expect(purchase).toContainText('Alex pays 52 to Bank.')
        await purchase.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(union).toContainText('Cash 40')
        await expect(purchase.getByRole('button', { name: 'Confirm purchase' })).toHaveCount(0)
        await chooseUnion()
        await purchase.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(purchase.getByRole('button', { name: 'Confirm purchase' })).toHaveCount(0)
        await expect(alex).toContainText('Cash 240')
        await chooseUnion()
        await purchase.getByRole('button', { name: 'Confirm purchase' }).click()
        await expect(purchase.getByRole('heading', { name: 'Purchase complete' })).toBeVisible()
        await expect(union).toContainText('Cash 0')
        await expect(union.locator('[data-certificate-id="ML:share:5"]')).toBeVisible()
        await expect(alex).toContainText('Cash 188')
        await expect(page.getByRole('list', { name: 'Purchase history' })).toContainText(
            'Alex paid 52 to Bank.'
        )
        await page.reload()
        await expect(union).toContainText('Cash 0')
        await expect(alex).toContainText('Cash 188')
        await purchase.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(union).toContainText('Cash 40')
        await expect(alex).toContainText('Cash 240')
        await expect(union.locator('[data-certificate-id="ML:share:5"]')).toHaveCount(0)
        await expect(page.getByRole('list', { name: 'Purchase history' })).toHaveCount(0)
        await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await expect(page.locator('[data-purchase-certificate="AR:share:5"]')).toContainText(
            'Buy for 65'
        )
        await expect(page.locator('[data-purchase-certificate="AR:share:4"]')).toContainText(
            'Buy for 90'
        )
        await page.locator('[data-purchase-certificate="AR:share:5"]').click()
        await purchase.getByRole('button', { name: 'Confirm purchase' }).click()
        await expect(alex).toContainText('Cash 175')
        await expect(alex.locator('[data-certificate-id="AR:share:5"]')).toBeVisible()
        await expect(
            page.getByRole('article', { name: 'Bank certificates', exact: true })
        ).toContainText('Cash 6185')
        await purchase.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(alex).toContainText('Cash 240')
        await page.locator('[data-purchase-certificate="AR:share:4"]').click()
        await page.getByRole('button', { name: 'The Old Prince 1871', exact: true }).click()
        await expect(union).toContainText('Cash 40')
        await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await expect(purchase.getByRole('button', { name: 'Confirm purchase' })).toHaveCount(0)
        await expect(alex).toContainText('Cash 240')
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            .toBe(true)
        expect(errors).toEqual([])
    })
}
