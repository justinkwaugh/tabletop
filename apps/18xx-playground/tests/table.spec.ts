import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} table keeps the sidebar and actions above an unframed scaling map`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.setViewportSize({ width: 1100, height: 960 })
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        const header = page.getByRole('banner', { name: 'Game phase' })
        const action = page.getByRole('region', { name: 'Current action' })
        await expect(page.locator('[data-map-location]')).toHaveCount(title === 'TOP' ? 110 : 52)
        await expect(page.getByRole('article', { name: 'Casey portfolio' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(1)
        await expect(header).toContainText(/Operating round\s*OR 1\.1/i)
        await expect(header).toContainText(title === 'TOP' ? 'Charlottetown' : 'Iyo Railway')
        await expect(action).toContainText('Choose a tile space')
        const steps = page.getByRole('navigation', { name: 'Operating steps' })
        await expect(steps.locator('[aria-current="step"]')).toHaveText(/Track/)

        const mapBounds = await page.locator('.map-area').boundingBox()
        const actionBounds = await action.boundingBox()
        expect(mapBounds).not.toBeNull()
        expect(actionBounds).not.toBeNull()
        if (!mapBounds || !actionBounds) throw new Error('Missing table regions')
        expect(mapBounds.y).toBeGreaterThanOrEqual(actionBounds.y + actionBounds.height - 1)
        expect(mapBounds.y + mapBounds.height).toBeLessThanOrEqual(962)
        await expect(page.locator('.map-viewport')).toHaveCount(0)
        await page.getByRole('tab', { name: 'Chat' }).click()
        await expect(page.getByRole('textbox')).toBeVisible()
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(page.getByText('No actions yet.', { exact: true })).toBeVisible()
        await page.getByRole('tab', { name: 'Players' }).click()
        await page.locator(`[data-map-location="${title === 'TOP' ? 'K17' : 'E2'}"]`).click()
        await expect(page.locator('[data-map-tile-choice]')).not.toHaveCount(0)
        await expect(header.getByRole('button', { name: 'Undo' })).toBeEnabled()
        const views = page.getByRole('tablist', { name: 'Table views' })
        const scene = page.locator('.map-scene')
        const transform = () =>
            scene.evaluate((element) => element.parentElement?.parentElement?.style.transform)
        const initialView = await transform()
        await page
            .getByRole('tabpanel', { name: 'Map', exact: true })
            .getByRole('button', { name: 'Zoom in', exact: true })
            .click()
        await expect.poll(transform).not.toBe(initialView)
        await page.waitForTimeout(300)
        const zoomedView = await transform()
        await views.getByRole('tab', { name: 'Market', exact: true }).click()
        await expect(page.getByRole('tabpanel', { name: 'Market', exact: true })).toBeVisible()
        await expect(
            page.getByRole('region', { name: 'Stock market board', exact: true })
        ).toBeVisible()
        const marketPanel = page.getByRole('tabpanel', { name: 'Market', exact: true })
        const marketBoard = marketPanel.getByRole('region', { name: 'Stock market board' })
        const marketTransform = () =>
            marketBoard.evaluate((element) => element.parentElement?.parentElement?.style.transform)
        const initialMarketView = await marketTransform()
        await marketPanel.getByRole('button', { name: 'Zoom in', exact: true }).click()
        await expect.poll(marketTransform).not.toBe(initialMarketView)
        await expect(marketPanel.locator('.scroll')).toHaveCount(0)
        await expect(scene).toBeHidden()
        await expect(page.locator('[data-map-tile-choice]')).toHaveCount(0)
        await views.getByRole('tab', { name: 'Spreadsheet', exact: true }).click()
        const spreadsheet = page.getByRole('table', { name: 'Company share ownership' })
        await expect(spreadsheet).toBeVisible()
        await expect(spreadsheet.getByRole('columnheader').first()).toHaveText('Player')
        await expect(
            spreadsheet.getByRole('rowheader').filter({ hasText: /^\s*(Alex|Blair|Casey)\s*$/ })
        ).toHaveCount(3)
        await expect(
            spreadsheet
                .getByRole('columnheader')
                .filter({ hasText: title === 'TOP' ? /\bC$/ : /\bIR$/ })
        ).toHaveCount(1)
        const matrix = await spreadsheet
            .locator('tbody tr')
            .evaluateAll((rows) =>
                rows.map((row) =>
                    [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim())
                )
            )
        await page
            .getByRole('group', { name: 'Spreadsheet view' })
            .getByRole('button', { name: 'Swap rows and columns', exact: true })
            .click()
        for (let index = 0; index < matrix[0].length; index++) {
            await expect(spreadsheet.locator('tbody tr').nth(index).getByRole('cell')).toHaveText(
                matrix.map((row) => row[index] ?? '')
            )
        }
        await page
            .getByRole('group', { name: 'Spreadsheet view' })
            .getByRole('button', { name: 'Swap rows and columns', exact: true })
            .click()
        await views.getByRole('tab', { name: 'Spreadsheet', exact: true }).press('ArrowRight')
        await expect(views.getByRole('tab', { name: 'Companies', exact: true })).toBeFocused()
        await views.getByRole('tab', { name: 'Companies', exact: true }).press('ArrowRight')
        await expect(views.getByRole('tab', { name: 'Tiles', exact: true })).toBeFocused()
        await expect(page.getByRole('region', { name: 'Tile manifest', exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'green', exact: true }).click()
        await expect(
            page.locator('[data-manifest-tile]:not([data-tile-color="green"])')
        ).toHaveCount(0)
        await expect(
            page.locator('[data-manifest-tile][data-tile-color="green"]').first()
        ).toBeVisible()
        await views.getByRole('tab', { name: 'Tiles', exact: true }).press('ArrowRight')
        await expect(views.getByRole('tab', { name: 'Player Aid', exact: true })).toBeFocused()
        await views.getByRole('tab', { name: 'Player Aid', exact: true }).press('ArrowRight')
        await expect(views.getByRole('tab', { name: 'Map', exact: true })).toBeFocused()
        await expect(scene).toBeVisible()
        expect(await transform()).toBe(zoomedView)

        await page.locator(`[data-map-location="${title === 'TOP' ? 'K17' : 'E2'}"]`).click()
        await header.getByRole('button', { name: 'Undo' }).click()
        await expect(page.locator('[data-map-tile-choice]')).toHaveCount(0)
        await page.getByLabel('Position', { exact: true }).selectOption('opening')
        await expect(
            page.getByRole('region', {
                name: title === 'TOP' ? 'Auction offers' : 'Opening auction',
                exact: true
            })
        ).toBeVisible()
        await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(1)
        expect(errors).toEqual([])
    })
}

test('table commits a lay and restores map, portfolio and controls through history, reload and Undo', async ({
    page
}) => {
    await page.goto('/table')
    const steps = page.getByRole('navigation', { name: 'Operating steps' })
    const undo = page.getByRole('button', { name: 'Undo', exact: true })
    const tileCount = page.locator('[data-manifest-tile="18xx:8"] .count')
    await expect(tileCount).toHaveText('∞')
    await page.locator('[data-map-location="K17"]').click()
    const mapBounds = await page.locator('.map-area').boundingBox()
    await page.locator('[data-map-tile-choice="18xx:8"]').click()
    await expect.poll(() => page.locator('.map-area').boundingBox()).toEqual(mapBounds)
    await page.getByRole('button', { name: 'Accept track lay', exact: true }).click()
    await expect(steps).toContainText('1 laid')
    await expect(tileCount).toHaveText('∞')
    await expect.poll(() => page.locator('.map-area').boundingBox()).toEqual(mapBounds)
    await expect(page.locator('[data-map-location="K17"]')).toHaveAttribute('data-placed', 'true')
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.getByRole('list', { name: 'Action history' })).toContainText(
        /Laid track at K17/
    )
    await page.getByRole('button', { name: 'step backwards', exact: true }).click()
    await expect(page.locator('[data-map-location="K17"]')).toHaveAttribute('data-placed', 'false')
    await expect(undo).toBeDisabled()
    await page.getByRole('button', { name: 'go to current', exact: true }).click()
    await page.reload()
    await expect(steps).toContainText('1 laid')
    await undo.click()
    await expect(steps).not.toContainText('laid')
    await expect(tileCount).toHaveText('∞')
    await expect(page.locator('[data-map-location="K17"]')).toHaveAttribute('data-placed', 'false')
})

for (const title of ['TOP', '1889']) {
    test(`${title} company details distinguish ownership and control`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByRole('tab', { name: 'Companies', exact: true }).click()
        const companies = page.getByRole('tabpanel', { name: 'Companies', exact: true })
        const first = companies.getByRole('article', {
            name: title === 'TOP' ? 'Charlottetown details' : 'Awa Railroad details',
            exact: true
        })
        const ownership = first.getByRole('table')
        await expect(ownership.getByRole('row', { name: /Alex(?: President)? 3$/ })).toBeVisible()
        await expect(first.locator('tr.president')).toContainText('Alex')
        await expect(
            ownership.getByRole('row', { name: title === 'TOP' ? /Market 2$/ : /IPO 4$/ })
        ).toBeVisible()
        if (title === 'TOP') {
            await expect(ownership.getByRole('row', { name: /Treasury 1$/ })).toBeVisible()
            const souris = companies.getByRole('article', { name: 'Souris details', exact: true })
            await expect(souris.locator('tr.president')).toContainText('Union Bank')
            const peir = companies.getByRole('article', {
                name: 'Prince Edward Island Railway details',
                exact: true
            })
            await expect(peir.locator('td[title="Certificate numbers"]').first()).toBeVisible()
            await expect(peir.getByRole('columnheader', { name: '%', exact: true })).toHaveCount(0)
            await expect(companies).toContainText('The King’s Mail')
        } else {
            await expect(companies).toContainText('Ehime Railroad')
            const iyo = companies.getByRole('article', { name: 'Iyo Railway details', exact: true })
            await expect(iyo.locator('tr.president')).toContainText('Blair')
        }
        expect(errors).toEqual([])
    })
}

for (const title of ['TOP', '1889']) {
    test(`${title} player panels show ownership, valuation and personal liquidity`, async ({
        page
    }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        const alex = page.getByRole('article', { name: 'Alex portfolio' })
        const casey = page.getByRole('article', { name: 'Casey portfolio' })
        await expect(alex).toBeVisible({ timeout: 15000 })
        await expect(alex.locator('dt')).toHaveText([
            'Cash',
            'Liquidity',
            'Shares',
            'Certs',
            'Net worth'
        ])
        await expect(alex.locator('dd').nth(2)).toHaveText(title === 'TOP' ? '5' : '6')
        await expect(
            alex.locator('dd').filter({ hasText: title === 'TOP' ? '$' : '¥' })
        ).toHaveText(title === 'TOP' ? ['$240', '$602', '$1,072'] : ['¥240', '¥630', '¥810'])
        if (title === '1889')
            await expect(alex.getByText('Priority deal', { exact: true })).toBeVisible()
        await expect(page.locator('.players article h3')).toHaveText(
            title === 'TOP' ? ['Alex', 'Blair', 'Casey', 'Union Bank'] : ['Alex', 'Blair', 'Casey']
        )
        await expect(alex.locator('.ownership .token svg')).toHaveCount(title === 'TOP' ? 3 : 2)
        await expect(alex.locator('.ownership .amount')).toHaveText(
            title === 'TOP' ? ['30%', '10%', '20%'] : ['30%', '30%']
        )
        await expect(casey.getByRole('table', { name: 'Casey private companies' })).toContainText(
            title === 'TOP' ? 'Vernon River Bridge' : 'Mitsubishi Ferry'
        )
        await expect(casey.locator('.privates td')).toHaveText(
            title === 'TOP' ? ['$10', '$40'] : ['¥5', '¥30']
        )
    })
}

for (const title of ['TOP', '1889']) {
    test(`${title} map tile picker previews, rotates and cancels without committing`, async ({
        page
    }) => {
        await page.setViewportSize({ width: 1100, height: 900 })
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        const hex = page.locator(`[data-map-location="${title === 'TOP' ? 'K17' : 'E2'}"]`)
        const wasPlaced = await hex.getAttribute('data-placed')
        await hex.click()
        const choices = page.locator('[data-map-tile-choice]')
        await expect(choices.first()).toBeVisible()
        await expect(page.getByRole('button', { name: 'Cancel track lay' })).toHaveCount(0)
        await page.getByRole('banner', { name: 'Game phase' }).click()
        await expect(choices).toHaveCount(0)
        await hex.click()
        await expect(choices.first()).toBeVisible()
        const bounds = await page.locator('.map-area').boundingBox()
        if (!bounds) throw new Error('Missing viewport')
        for (const choice of await choices.all()) {
            const box = await choice.boundingBox()
            if (!box) throw new Error('Missing tile choice')
            expect(box.x).toBeGreaterThanOrEqual(bounds.x)
            expect(box.y).toBeGreaterThanOrEqual(bounds.y)
            expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width)
            expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height)
        }
        await page
            .locator(`[data-map-tile-choice="${title === 'TOP' ? '18xx:8' : '18xx:15'}"]`)
            .click()
        await expect(page.getByRole('button', { name: 'Accept track lay' })).toBeVisible()
        await expect(page.locator('.picker')).toHaveAttribute('data-track-motion', 'false')
        const paths = () =>
            hex
                .locator('path[d]')
                .evaluateAll((elements) => elements.map((element) => element.getAttribute('d')))
        const first = await paths()
        await hex.click()
        if (title === 'TOP') await expect.poll(paths).not.toEqual(first)
        else await expect.poll(paths).toEqual(first)
        await expect(page.getByRole('navigation', { name: 'Operating steps' })).not.toContainText(
            'laid'
        )
        await page.getByRole('button', { name: 'Cancel track lay' }).click()
        await expect(hex).toHaveAttribute('data-placed', wasPlaced ?? 'false')
        await expect(page.locator('.picker')).toHaveCount(0)
    })
}

test('selected tile motion keeps alternatives, closes on cancel, and preserves the mask through accept and Undo', async ({
    page
}) => {
    await page.goto('/table')
    const hex = page.locator('[data-map-location="K17"]')
    await hex.click()
    const count = await page.locator('[data-map-tile-choice]').count()
    await page.locator('[data-map-tile-choice="18xx:8"]').click()
    await expect(page.locator('[data-map-tile-choice]')).toHaveCount(count - 1)
    await expect(page.locator('.picker')).toHaveAttribute('data-track-motion', 'false')
    await page.locator('[data-map-tile-choice]').first().click()
    await expect(page.locator('.picker')).toHaveAttribute('data-track-motion', 'false')
    await expect(page.locator('[data-map-tile-choice="18xx:8"]')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel track lay' }).click()
    await expect(page.locator('.picker')).toHaveCount(0)
    await expect(hex).toHaveAttribute('data-placed', 'false')
    await page.locator('.map-area').evaluate((area) => {
        new MutationObserver(() => {
            if (!area.querySelector('[data-map-layer="unavailable"]'))
                document.documentElement.dataset.maskMissing = 'true'
        }).observe(area, { childList: true, subtree: true })
    })
    await hex.click()
    await page.locator('[data-map-tile-choice="18xx:8"]').click()
    await page.getByRole('button', { name: 'Accept track lay' }).click()
    await expect(page.getByRole('navigation', { name: 'Operating steps' })).toContainText('1 laid')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(hex).toHaveAttribute('data-placed', 'false')
    await expect(page.locator('html')).not.toHaveAttribute('data-mask-missing', 'true')
})

test('double-town tile rotates on each click and revenue stays centered after opening', async ({
    page
}) => {
    await page.goto('/table')
    await page.locator('[data-map-location="L16"]').click()
    const revenue = page.locator('[data-map-tile-choice] [data-revenue-for]')
    await expect(revenue.first()).toBeVisible()
    await expect
        .poll(() =>
            page
                .locator('[data-map-tile-choice]')
                .evaluateAll(
                    (elements) => elements.flatMap((element) => element.getAnimations()).length
                )
        )
        .toBe(0)
    const offsets = () =>
        revenue.evaluateAll((elements) =>
            elements.map((element) => {
                const circle = element.querySelector('circle')?.getBoundingClientRect()
                const text = element.querySelector('text')?.getBoundingClientRect()
                if (!circle || !text) throw new Error('Missing revenue')
                return text.y + text.height / 2 - circle.y - circle.height / 2
            })
        )
    for (const offset of await offsets()) expect(Math.abs(offset)).toBeLessThan(0.2)
    await page.mouse.move(20, 20)
    for (const offset of await offsets()) expect(Math.abs(offset)).toBeLessThan(0.2)
    await page.locator('[data-map-location="K17"]').click()
    await page.locator('[data-map-tile-choice="18xx:7"]').click()
    await page.getByRole('button', { name: 'Accept track lay' }).click()
    await page.locator('[data-map-location="K15"]').click()
    await page.locator('[data-map-tile-choice="18xx:56"]').click()
    await expect(page.locator('.picker')).toHaveAttribute('data-track-motion', 'false')
    for (let index = 0; index < 5; index++) {
        const rotation = await page.locator('.chosen svg').getAttribute('data-tile-rotation')
        await page.locator('[data-map-location="K15"]').click()
        await expect(page.locator('.chosen svg')).not.toHaveAttribute(
            'data-tile-rotation',
            rotation ?? ''
        )
    }
})

test('auction offers separate map focus, descriptions and committed offers', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 950 })
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('opening')
    const offers = page.getByRole('region', { name: 'Auction offers' })
    const icon = offers.getByRole('button', { name: /Show PEIR/ }).first()
    await expect(icon).toBeVisible()
    for (const player of ['Alex', 'Blair', 'Casey']) {
        const pile = page.getByRole('region', { name: `${player} auction lot`, exact: true })
        await expect(pile).toBeVisible()
        await pile.locator('tr').first().getByRole('cell').click()
        await expect(page.locator('.description')).toBeVisible()
        await page.locator('.description').click()
        await expect(page.locator('.description')).toHaveCount(0)
    }
    const scene = page.locator('svg.map-scene')
    const mapWidth = () => scene.evaluate((element) => element.getBoundingClientRect().width)
    const initialWidth = await mapWidth()
    await icon.click()
    await expect.poll(mapWidth).toBeGreaterThan(initialWidth + 10)
    await expect(page.locator('.description')).toHaveCount(0)
    await icon.click()
    await expect.poll(async () => Math.abs((await mapWidth()) - initialWidth)).toBeLessThan(1)
    const row = offers
        .locator('tbody tr')
        .filter({ has: page.getByRole('button', { name: /Show PEIR 2/ }) })
    await row.locator('.value').click()
    await expect(page.locator('.description')).toContainText('numbered PEIR share')
    await page.locator('.description').click()
    await expect(page.locator('.description')).toHaveCount(0)
    await row.getByRole('button', { name: /^Offer / }).click()
    const auction = page.getByRole('article', { name: 'Current auction' })
    await expect(auction).toBeVisible()
    await expect(auction).toContainText('numbered PEIR share')
    await expect(page.locator('.description')).toHaveCount(0)
    const amount = auction.locator('output')
    const minimum = Number((await amount.innerText()).replace(/[^0-9]/g, ''))
    await expect(auction.getByRole('button', { name: 'Decrease bid' })).toBeDisabled()
    await auction.getByRole('button', { name: 'Increase bid' }).click()
    await expect(amount).toHaveText(`$${minimum + 5}`)
    await auction.getByRole('button', { name: 'Decrease bid' }).click()
    await expect(amount).toHaveText(`$${minimum}`)
    await auction.getByRole('button', { name: 'Bid', exact: true }).click()
    await expect(amount).toHaveText(`$${minimum + 5}`)
    await auction.getByRole('button', { name: 'Increase bid' }).click()
    await auction.getByRole('button', { name: 'Pass', exact: true }).click()
    await expect(offers).toBeVisible()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(auction).toBeVisible()
    await expect(amount).toHaveText(`$${minimum + 5}`)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(offers).toBeVisible()
})

for (const title of ['TOP', '1889']) {
    test(`${title} construction remains interactive in fullscreen`, async ({ page }) => {
        await page.setViewportSize({ width: 1100, height: 900 })
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        const hex = page.locator(`[data-map-location="${title === 'TOP' ? 'K17' : 'E2'}"]`)
        const undo = page.getByRole('button', { name: 'Undo', exact: true })
        await hex.click()
        await expect(page.locator('[data-map-tile-choice]').first()).toBeVisible()
        await page.keyboard.press('f')
        const tile = page.locator(
            `[data-map-tile-choice="${title === 'TOP' ? '18xx:8' : '18xx:15'}"]`
        )
        const drawn = async () => {
            const before = await tile.boundingBox()
            await page.waitForTimeout(120)
            const after = await tile.boundingBox()
            return !!after && after.width > 0 && JSON.stringify(before) === JSON.stringify(after)
        }
        await expect.poll(drawn).toBe(true)
        await tile.click()
        await expect(page.locator('.picker')).toHaveAttribute('data-track-motion', 'false')
        await hex.click()
        await page.getByRole('button', { name: 'Cancel track lay', exact: true }).click()
        await expect(page.locator('.picker')).toHaveCount(0)
        await hex.click()
        await tile.click()
        await page.getByRole('button', { name: 'Accept track lay', exact: true }).click()
        await expect(hex).toHaveAttribute('data-placed', 'true')
        await page.keyboard.press('Escape')
        await undo.click()
        await expect(undo).toBeDisabled()
        await hex.click()
        await expect(tile).toBeVisible()
        await page.keyboard.press('f')
        await expect.poll(drawn).toBe(true)
        await tile.click()
        await page.keyboard.press('f')
        await page.getByRole('button', { name: 'Cancel track lay', exact: true }).click()
        await expect(page.locator('.picker')).toHaveCount(0)
    })
}
