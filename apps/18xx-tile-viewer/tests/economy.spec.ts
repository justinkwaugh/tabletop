import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
    test(`orders and removes sale blocks before committing at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/economy')
        const trading = page.getByRole('region', { name: 'Stock trading', exact: true })
        const alex = page.getByRole('article', { name: 'Alex portfolio', exact: true })
        await page.locator('[data-sale-company="ML"][data-sale-shares="1"]').click()
        await page.locator('[data-sale-company="So"][data-sale-shares="1"]').click()
        const order = trading.locator('[aria-label="Confirm share sale"] ol li strong')
        const original = await order.allTextContents()
        expect(original).toHaveLength(2)
        await trading.getByRole('button', { name: 'Move So earlier', exact: true }).click()
        await expect(order).toHaveText([...original].reverse())
        await trading.getByRole('button', { name: 'Remove ML sale', exact: true }).click()
        await expect(order).toHaveText([original[1]])
        await expect(trading).toContainText('Total proceeds: 86')
        await expect(alex).toContainText('Cash 240')
        await page.locator('[data-sale-company="ML"][data-sale-shares="1"]').click()
        await expect(order).toHaveText([...original].reverse())
        await expect(trading).toContainText('Total proceeds: 178')
        await trading.getByRole('button', { name: 'Confirm sale', exact: true }).click()
        await expect(alex).toContainText('Cash 418')
        await expect(
            page.getByRole('list', { name: 'Stock history' }).locator('li > span')
        ).toHaveText([
            `${original[1]}: 1 shares at 86; market price 80.`,
            `${original[0]}: 1 shares at 92; market price 86.`
        ])
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(alex).toContainText('Cash 240')
        await expect(page.getByRole('list', { name: 'Stock history' })).toHaveCount(0)
    })

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
        ).toHaveCount(1)
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
    const previous = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('tabletop-local')
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
        const tx = db.transaction('games', 'readwrite')
        const request = tx.objectStore('games').getAll()
        const previous = await new Promise<{ id: string; name: string }>((resolve, reject) => {
            request.onsuccess = () => {
                const game = request.result.find((game) => game.typeId === 'the-old-prince')
                const original = { id: game.id, name: game.name }
                game.name = 'Finances example · 2'
                tx.objectStore('games').put(game)
                tx.oncomplete = () => resolve(original)
            }
            request.onerror = () => reject(request.error)
            tx.onabort = () => reject(tx.error)
        })
        db.close()
        return previous
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
    expect(saved).toContainEqual({ id: previous.id, name: 'Finances example · 2' })
    expect(saved.filter((game) => game.name === previous.name)).toHaveLength(1)
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
        const purchase = page.getByRole('region', { name: 'Stock trading', exact: true })
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
        await expect(purchase.getByRole('heading', { name: 'Stock round 2' })).toBeVisible()
        await expect(union).toContainText('Cash 0')
        await expect(union.locator('[data-certificate-id="ML:share:5"]')).toBeVisible()
        await expect(alex).toContainText('Cash 188')
        await expect(page.getByRole('list', { name: 'Stock history' })).toContainText(
            'Alex paid 52 to Bank.'
        )
        await page.reload()
        await expect(union).toContainText('Cash 0')
        await expect(alex).toContainText('Cash 188')
        await purchase.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(union).toContainText('Cash 40')
        await expect(alex).toContainText('Cash 240')
        await expect(union.locator('[data-certificate-id="ML:share:5"]')).toHaveCount(0)
        await expect(page.getByRole('list', { name: 'Stock history' })).toHaveCount(0)
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

for (const width of [1280, 390]) {
    test(`sells shares, transfers presidency, finishes and undoes a stock turn at ${width}px`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/economy')
        const trading = page.getByRole('region', { name: 'Stock trading', exact: true })
        const alex = page.getByRole('article', { name: 'Alex portfolio', exact: true })
        const sale = page.locator('[data-sale-company="ML"][data-sale-shares="2"]')
        await sale.click()
        await expect(trading).toContainText('Total proceeds: 184')
        await expect(trading).toContainText('President: Alex → Blair')
        await expect(alex).toContainText('Cash 240')
        await trading.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(alex).toContainText('Cash 240')
        await sale.click()
        await trading.getByRole('button', { name: 'Confirm sale', exact: true }).click()
        await expect(alex).toContainText('Cash 424')
        await expect(page.locator('[data-company-id="ML"]')).toContainText('President: Blair')
        await expect(page.locator('[data-market-space="2:1"] [data-market-company]')).toHaveText([
            'So',
            'ML'
        ])
        await expect(
            page.locator('[data-purchase-certificate="ML:share:5"][data-buyer="player"]')
        ).toBeDisabled()
        await page.reload()
        await expect(alex).toContainText('Cash 424')
        await page.locator('[data-purchase-certificate="So:share:5"][data-buyer="player"]').click()
        await trading.getByRole('button', { name: 'Confirm purchase' }).click()
        await expect(alex).toContainText('Cash 338')
        await trading.getByRole('button', { name: 'Finish turn' }).click()
        await expect(page.getByRole('region', { name: 'Round status' })).toContainText(
            'Blair’s stock turn'
        )
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Round status' })).toContainText(
            'Alex’s stock turn'
        )
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(alex).toContainText('Cash 424')
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(alex).toContainText('Cash 240')
        await expect(page.locator('[data-company-id="ML"]')).toContainText('President: Alex')
        await expect(page.locator('[data-market-space="1:1"] [data-market-company]')).toHaveText([
            'ML'
        ])
        await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.locator('[data-purchase-certificate="IR:share:5"]').click()
        await expect(trading).toContainText('President: Blair → Alex')
        await trading.getByRole('button', { name: 'Confirm purchase' }).click()
        await expect(page.locator('[data-company-id="IR"]')).toContainText('President: Alex')
        await expect(alex).toContainText('Cash 170')
        await page.locator('[data-sale-company="AR"][data-sale-shares="1"]').click()
        await trading.getByRole('button', { name: 'Confirm sale' }).click()
        await expect(alex).toContainText('Cash 260')
        await expect(page.locator('[data-market-space="2:3"] [data-market-company]')).toHaveText([
            'AR'
        ])
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(page.locator('[data-company-id="IR"]')).toContainText('President: Blair')
        await expect(alex).toContainText('Cash 240')
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            .toBe(true)
        expect(errors).toEqual([])
    })
}

test('preserves an incompatible saved state and opens a compatible finance example', async ({
    page
}) => {
    await page.goto('/economy')
    const union = page.getByRole('article', { name: 'Union Bank treasury', exact: true })
    await expect(union).toContainText('Cash 40')
    const previous = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('tabletop-local')
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
        const tx = db.transaction(['games', 'states'], 'readwrite')
        const games = tx.objectStore('games').getAll()
        const previous = await new Promise<{ id: string; state: unknown }>((resolve, reject) => {
            games.onsuccess = () => {
                const game = games.result.find((game) => game.typeId === 'the-old-prince')
                const states = tx.objectStore('states')
                const request = states.get(game.id)
                request.onsuccess = () => {
                    const state = request.result
                    state.machineState = 'TradingShares'
                    delete state.stockRound.completed
                    delete state.stockRound.passedPlayerIds
                    delete state.stockRound.turn.acted
                    states.put(state)
                    tx.oncomplete = () => resolve({ id: game.id, state })
                }
            }
            tx.onabort = () => reject(tx.error)
            tx.onerror = () => reject(tx.error)
        })
        db.close()
        return previous
    })
    await page.reload()
    await expect(union).toContainText('Cash 40')
    await page.getByRole('button', { name: 'Pass', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Round status' })).toContainText(
        'Blair’s stock turn'
    )
    await page.reload()
    await expect(page.getByRole('region', { name: 'Round status' })).toContainText(
        'Blair’s stock turn'
    )
    const saved = await page.evaluate(async (previousId) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('tabletop-local')
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
        const tx = db.transaction(['games', 'states'])
        const all = tx.objectStore('games').getAll()
        const old = tx.objectStore('states').get(previousId)
        const result = await new Promise<{ ids: string[]; previousState: unknown }>(
            (resolve, reject) => {
                tx.oncomplete = () =>
                    resolve({
                        ids: all.result
                            .filter((game) => game.typeId === 'the-old-prince')
                            .map((game) => game.id),
                        previousState: old.result
                    })
                tx.onabort = () => reject(tx.error)
            }
        )
        db.close()
        return result
    }, previous.id)
    expect(saved.ids).toHaveLength(2)
    expect(saved.ids).toContain(previous.id)
    expect(saved.previousState).toEqual(previous.state)
})
