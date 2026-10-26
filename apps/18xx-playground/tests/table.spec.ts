import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Point } from '@tabletop/common'

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
        await expect(page.locator('[data-map-location]')).toHaveCount(title === 'TOP' ? 110 : 52, {
            timeout: 15000
        })
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
        const views = page.getByRole('tablist', { name: 'Table views' })
        const boardPane = page
            .getByRole('region', { name: /^Table views pane/ })
            .filter({ has: page.getByRole('tab', { name: 'Board', exact: true }) })
        const scene = page.locator('.map-scene')
        const marketPanel = page.getByRole('tabpanel', { name: 'Market', exact: true })
        await boardPane.getByRole('button', { name: /^Pane options/ }).click()
        await boardPane.getByRole('button', { name: 'Market', exact: true }).click()
        await expect(marketPanel).toBeVisible()
        await boardPane.getByRole('tab', { name: 'Board', exact: true }).click()
        await expect(scene).toBeVisible()
        await page.getByRole('tab', { name: 'Chat' }).click()
        await expect(page.getByRole('textbox')).toBeVisible()
        await page.getByRole('tab', { name: 'History' }).click()
        await expect(page.getByText('No actions yet.', { exact: true })).toBeVisible()
        await page.getByRole('tab', { name: 'Players' }).click()
        await page.locator(`[data-map-location="${title === 'TOP' ? 'K17' : 'E2'}"]`).click()
        await expect(page.locator('[data-map-tile-choice]')).not.toHaveCount(0)
        await expect(header.getByRole('button', { name: 'Undo' })).toBeEnabled()
        const transform = () =>
            scene.evaluate(
                (element) =>
                    element.parentElement?.closest<HTMLElement>('[style*="transform"]')?.style
                        .transform
            )
        const initialView = await transform()
        await page
            .getByRole('tabpanel', { name: 'Board', exact: true })
            .getByRole('button', { name: 'Zoom in', exact: true })
            .click()
        await expect.poll(transform).not.toBe(initialView)
        await page.waitForTimeout(300)
        const zoomedView = await transform()
        await boardPane.getByRole('tab', { name: 'Market', exact: true }).click()
        await expect(marketPanel).toBeVisible()
        await expect(
            marketPanel.getByRole('region', { name: 'Stock market board', exact: true })
        ).toBeVisible()
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
        await expect(spreadsheet.getByRole('columnheader').first()).toHaveText('Player / Company')
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
        await boardPane.getByRole('tab', { name: 'Market', exact: true }).press('ArrowRight')
        await expect(boardPane.getByRole('tab', { name: 'Board', exact: true })).toBeFocused()
        await boardPane.getByRole('tab', { name: 'Board', exact: true }).press('ArrowRight')
        await expect(boardPane.getByRole('tab', { name: 'Tiles', exact: true })).toBeFocused()
        await expect(page.getByRole('region', { name: 'Tile manifest', exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'green', exact: true }).click()
        await expect(
            page.locator('[data-manifest-tile]:not([data-tile-color="green"])')
        ).toHaveCount(0)
        await expect(
            page.locator('[data-manifest-tile][data-tile-color="green"]').first()
        ).toBeVisible()
        await boardPane.getByRole('tab', { name: 'Tiles', exact: true }).press('ArrowRight')
        await expect(boardPane.getByRole('tab', { name: 'Market', exact: true })).toBeFocused()
        await expect(marketPanel).toBeVisible()
        await boardPane.getByRole('tab', { name: 'Market', exact: true }).press('ArrowRight')
        await expect(boardPane.getByRole('tab', { name: 'Board', exact: true })).toBeFocused()
        await expect(scene).toBeVisible()
        expect(await transform()).toBe(zoomedView)

        await page.locator(`[data-map-location="${title === 'TOP' ? 'K17' : 'E2'}"]`).click()
        await header.getByRole('button', { name: 'Undo' }).click()
        await expect(page.locator('[data-map-tile-choice]')).toHaveCount(0)
        await page.getByLabel('Position', { exact: true }).selectOption('opening')
        await expect(
            page.getByRole('region', {
                name: title === 'TOP' ? 'Auction offers' : 'Private auction',
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
                name: 'PEIR details',
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

async function openFinishedGame(page: Page) {
    test.setTimeout(60000)
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByRole('heading', { name: 'Player 2 wins', exact: true })).toBeAttached({
        timeout: 30000
    })
}

async function expectHistoryAtNewest(page: Page) {
    const history = page.locator('.history-scroll')
    await expect(history).toBeVisible()
    await expect
        .poll(() => history.evaluate((element) => element.scrollHeight - element.clientHeight))
        .toBeGreaterThan(100)
    await expect
        .poll(() =>
            history.evaluate(
                (element) => element.scrollHeight - element.clientHeight - element.scrollTop
            )
        )
        .toBeLessThan(2)
}

async function closeHistory(page: Page) {
    const pane = page
        .getByRole('region')
        .filter({ has: page.getByRole('tab', { name: 'History', exact: true }) })
        .last()
    await pane.getByRole('button', { name: /^Pane options/ }).click()
    await page
        .locator('.widget-menu:popover-open')
        .getByRole('button', { name: 'Close History tab', exact: true })
        .click()
}

async function touchDown(page: Page, at: Point) {
    const touch = await page.context().newCDPSession(page)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] })
    let current = at
    return {
        async moveTo(to: Point, stepMs = 0) {
            const from = current
            for (let step = 1; step <= 10; step++) {
                if (stepMs) await page.waitForTimeout(stepMs)
                await touch.send('Input.dispatchTouchEvent', {
                    type: 'touchMove',
                    touchPoints: [
                        {
                            x: from.x + ((to.x - from.x) * step) / 10,
                            y: from.y + ((to.y - from.y) * step) / 10
                        }
                    ]
                })
            }
            current = to
        },
        lift: () => touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
}

test.describe('sidebar tabs on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('a sideways swipe on any sidebar tab moves the table', async ({ page }) => {
        await page.goto('/table')
        const scroller = page.locator('.table-scroller')
        for (const tab of ['Players', 'History', 'Chat']) {
            await page.getByRole('tab', { name: tab, exact: true }).click()
            await scroller.evaluate((element) => element.scrollTo({ left: 0, behavior: 'instant' }))
            const finger = await touchDown(page, { x: 250, y: 450 })
            await finger.moveTo({ x: 100, y: 450 })
            await finger.lift()
            await expect
                .poll(() => scroller.evaluate((element) => element.scrollLeft), { message: tab })
                .toBeGreaterThan(50)
        }
    })

    test('the History tab opens at the newest entry', async ({ page }) => {
        await openFinishedGame(page)
        await page.getByRole('tab', { name: 'History', exact: true }).click()
        await expectHistoryAtNewest(page)
    })

    test('History added back to the sidebar opens at the newest entry', async ({ page }) => {
        await openFinishedGame(page)
        await closeHistory(page)
        await page
            .locator('.widget-menu:popover-open')
            .getByRole('button', { name: 'History', exact: true })
            .click()
        await expectHistoryAtNewest(page)
    })

    test('History added to the view tabs opens at the newest entry', async ({ page }) => {
        await openFinishedGame(page)
        await closeHistory(page)
        await page
            .getByRole('button', { name: 'Pane options for Table views pane 1', exact: true })
            .click()
        await page
            .locator('.widget-menu:popover-open')
            .getByRole('button', { name: 'History', exact: true })
            .click()
        await expectHistoryAtNewest(page)
    })
})

test('History added to another pane of the pane layout opens at the newest entry', async ({
    page
}) => {
    await openFinishedGame(page)
    await closeHistory(page)
    await page.keyboard.press('Escape')
    await page
        .getByRole('button', { name: 'Pane options for Table views pane 1', exact: true })
        .click()
    await page
        .locator('.widget-menu:popover-open')
        .getByRole('button', { name: 'History', exact: true })
        .click()
    await expectHistoryAtNewest(page)
})

test.describe('sideways scrollers on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    async function showScroller(page: Page, scroller: Locator, left: number) {
        const table = page.locator('.table-scroller')
        await table.evaluate((element) =>
            element.scrollTo({ left: element.scrollWidth, behavior: 'instant' })
        )
        await scroller.evaluate(
            (element, left) => element.scrollTo({ left, behavior: 'instant' }),
            left
        )
        const box = await scroller.boundingBox()
        if (!box) throw new Error('Missing scroller')
        const scrollLeft = (element: Locator) =>
            element.evaluate((element) => Math.round(element.scrollLeft))
        return {
            scroller,
            y: box.y + box.height / 2,
            tableLeft: () => scrollLeft(table),
            scrollerLeft: () => scrollLeft(scroller),
            settled: () =>
                page.evaluate(
                    () =>
                        new Promise<void>((resolve) => {
                            let frames = 0
                            const wait = () =>
                                ++frames > 60 ? resolve() : requestAnimationFrame(wait)
                            wait()
                        })
                )
        }
    }

    async function openSheet(page: Page, left: number) {
        await page.goto('/table')
        await page.getByRole('tab', { name: 'Sheet', exact: true }).click()
        const sheet = page.locator('.table-scroll', {
            has: page.getByRole('table', { name: 'Company share ownership' })
        })
        return showScroller(page, sheet, left)
    }

    test('a swipe that starts inside the sheet stops at its edge, fling included', async ({
        page
    }) => {
        const sheet = await openSheet(page, 60)
        const tableStart = await sheet.tableLeft()
        const finger = await touchDown(page, { x: 100, y: sheet.y })
        await finger.moveTo({ x: 300, y: sheet.y })
        await finger.lift()
        await sheet.settled()
        expect(await sheet.scrollerLeft()).toBe(0)
        expect(await sheet.tableLeft()).toBe(tableStart)
    })

    test('a swipe that starts at the sheet edge moves the table both ways', async ({ page }) => {
        const sheet = await openSheet(page, 0)
        const tableStart = await sheet.tableLeft()
        const finger = await touchDown(page, { x: 100, y: sheet.y })
        await finger.moveTo({ x: 250, y: sheet.y })
        const tableOut = await sheet.tableLeft()
        expect(tableOut).toBeLessThan(tableStart - 100)
        await finger.moveTo({ x: 150, y: sheet.y })
        expect(await sheet.tableLeft()).toBe(tableOut + 100)
        expect(await sheet.scrollerLeft()).toBe(0)
        await finger.lift()
    })

    test('a swipe flings only when the finger lifts while moving', async ({ page }) => {
        const sheet = await openSheet(page, 200)
        const moving = await touchDown(page, { x: 100, y: sheet.y })
        await moving.moveTo({ x: 150, y: sheet.y })
        const movingLift = await sheet.scrollerLeft()
        await moving.lift()
        await sheet.settled()
        expect(await sheet.scrollerLeft()).toBeLessThan(movingLift - 20)

        await showScroller(page, sheet.scroller, 200)
        const resting = await touchDown(page, { x: 100, y: sheet.y })
        await resting.moveTo({ x: 150, y: sheet.y })
        await page.waitForTimeout(200)
        const restingLift = await sheet.scrollerLeft()
        await resting.lift()
        await sheet.settled()
        expect(await sheet.scrollerLeft()).toBe(restingLift)
    })

    test('touching the table stops a fling handed to it', async ({ page }) => {
        const sheet = await openSheet(page, 0)
        const above = await page.getByRole('tab', { name: 'Sheet', exact: true }).boundingBox()
        if (!above) throw new Error('Missing Sheet tab')
        const swipe = await touchDown(page, { x: 100, y: sheet.y })
        await swipe.moveTo({ x: 150, y: sheet.y }, 10)
        const lifted = await sheet.tableLeft()
        await swipe.lift()
        await expect.poll(() => sheet.tableLeft()).toBeLessThan(lifted)
        const hold = await touchDown(page, { x: 20, y: above.y + above.height + 8 })
        const held = await sheet.tableLeft()
        await sheet.settled()
        expect(await sheet.tableLeft()).toBe(held)
        await hold.lift()
    })

    test('the operating-order chips hand a swipe from their edge to the table', async ({
        page
    }) => {
        await page.goto('/table')
        const chips = page.getByRole('region', { name: 'Company order' }).locator('ol').first()
        await expect(chips).toBeVisible()
        const strip = await showScroller(page, chips, 40)
        const tableStart = await strip.tableLeft()

        const inside = await touchDown(page, { x: 100, y: strip.y })
        await inside.moveTo({ x: 300, y: strip.y })
        await inside.lift()
        await strip.settled()
        expect(await strip.scrollerLeft()).toBe(0)
        expect(await strip.tableLeft()).toBe(tableStart)

        const fromEdge = await touchDown(page, { x: 100, y: strip.y })
        await fromEdge.moveTo({ x: 250, y: strip.y })
        expect(await strip.tableLeft()).toBeLessThan(tableStart - 100)
        await fromEdge.lift()
    })

    test('touch stays native over a scroller whose content fits', async ({ page }) => {
        await page.goto('/table')
        await page.getByRole('tab', { name: 'Sheet', exact: true }).click()
        const sheet = page.locator('.table-scroll', {
            has: page.getByRole('table', { name: 'Company share ownership' })
        })
        await expect(sheet).toHaveCSS('touch-action', 'pan-y pinch-zoom')
        await page.setViewportSize({ width: 2200, height: 1000 })
        const fits = page.locator('.table-scroll', {
            has: page.getByRole('table', { name: 'Company share ownership' })
        })
        await expect(fits).toHaveCSS('touch-action', 'auto')
    })
})

test.describe('player cards below the pane layout', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('open the company card from anywhere in a holding and close it on any tap', async ({
        page
    }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption('TOP')
        const alex = page.getByRole('article', { name: 'Alex portfolio' })
        const holdings = alex.locator('.ownership tbody')
        await expect(holdings.first()).toBeVisible({ timeout: 15000 })
        const card = page.locator('dialog.lightbox')

        await holdings.first().locator('.amount').tap()
        await expect(card.locator('.company-detail.vertical')).toBeVisible()
        await card.locator('.company-detail').tap({ force: true })
        await expect(card).toHaveCount(0)

        const shareRow = page.locator('.players .ownership .numbered-share').first()
        await shareRow.scrollIntoViewIfNeeded()
        await shareRow.tap()
        await expect(card).toHaveAttribute('aria-label', /PEIR|Prince Edward Island/)
        await page.touchscreen.tap(8, 8)
        await expect(card).toHaveCount(0)

        await alex
            .getByRole('button', { name: /^Show .+ card$/ })
            .first()
            .focus()
        await page.keyboard.press('Enter')
        await expect(card).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(card).toHaveCount(0)

        await alex.getByRole('button', { name: 'Compact Alex card' }).tap()
        await alex.locator('.compact-holding .holding-amount').first().tap()
        await expect(card).toBeVisible()
        await page.touchscreen.tap(8, 8)
        await expect(card).toHaveCount(0)
    })

    test('use the card on tablets and map focus in the pane layout', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 })
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption('TOP')
        const alex = page.getByRole('article', { name: 'Alex portfolio' })
        const card = page.locator('dialog.lightbox')
        await alex.locator('.ownership tbody .amount').first().tap({ timeout: 15000 })
        await expect(card).toBeVisible()

        await page.setViewportSize({ width: 1100, height: 900 })
        await expect(card).toHaveCount(0)
        await expect(alex.getByRole('button', { name: /^Show .+ card$/ })).toHaveCount(0)
        await alex.locator('.ownership tbody .amount').first().click()
        await alex
            .getByRole('button', { name: /^Show .+ network$/ })
            .first()
            .click()
        await expect(card).toHaveCount(0)
    })
})

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
        await page.getByRole('banner', { name: 'Game phase' }).click({ position: { x: 8, y: 8 } })
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
                const badge = element.querySelector('rect')?.getBoundingClientRect()
                const text = element.querySelector('text')?.getBoundingClientRect()
                if (!badge || !text) throw new Error('Missing revenue')
                return text.y + text.height / 2 - badge.y - badge.height / 2
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
        .filter({ has: page.getByRole('button', { name: /Show PEIR/ }) })
        .first()
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

test('1889 board keeps hexes under the market panel selectable', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    const board = page.getByRole('tabpanel', { name: 'Board', exact: true })
    await expect(board).toBeVisible()
    const market = board.getByRole('region', { name: 'Stock market', exact: true })
    const nested = board.locator('[data-map-location="E2"]')
    const [panel, hex] = await Promise.all([market.boundingBox(), nested.boundingBox()])
    if (!panel || !hex) throw new Error('Missing market panel or hex')
    expect(hex.x + hex.width / 2).toBeLessThan(panel.x + panel.width)
    expect(hex.y + hex.height / 2).toBeLessThan(panel.y + panel.height)
    const spaces = market.locator('[data-market-space]')
    const exposedSpace = await spaces.evaluateAll((elements) =>
        elements.findIndex((element) => {
            const bounds = element.getBoundingClientRect()
            return element.contains(
                document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
            )
        })
    )
    expect(exposedSpace).toBeGreaterThanOrEqual(0)
    await spaces.nth(exposedSpace).hover()
    await nested.click()
    await expect(board.locator('[data-map-tile-choice]').first()).toBeVisible()
})

test('OR strips give private actions a row of their own at every width', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption({ label: 'Buy privates' })
    const strip = page.getByRole('navigation', { name: 'Operating steps' })
    const buy = strip.getByRole('button', { name: 'Buy privates', exact: true })
    const use = strip.getByRole('button', { name: 'Use privates', exact: true })
    for (const width of [320, 600, 1280]) {
        await page.setViewportSize({ width, height: 800 })
        await expect(buy).toBeVisible()
        await expect(use).toBeVisible()
        const [track, buyBox] = await Promise.all([
            strip.getByRole('button', { name: 'Track' }).boundingBox(),
            buy.boundingBox()
        ])
        if (!track || !buyBox) throw new Error('Missing strip buttons')
        expect(buyBox.y).toBeGreaterThanOrEqual(track.y + track.height)
        const clipped = await strip
            .locator('.steps button > span')
            .evaluateAll((labels) =>
                labels
                    .filter((label) => label.scrollWidth > (label.parentElement?.clientWidth ?? 0))
                    .map((label) => label.textContent)
            )
        expect(clipped).toHaveLength(0)
    }
})

test("Buy privates opens on the player's own privates, empty once they are sold", async ({
    page
}) => {
    await page.setViewportSize({ width: 1100, height: 900 })
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption({ label: 'Buy privates' })
    const strip = page.getByRole('navigation', { name: 'Operating steps' })
    const purchases = page.getByRole('region', { name: 'Buy privates' })
    const mine = purchases.getByRole('button', { name: 'Mine', exact: true })
    const cards = purchases.locator('button.private')
    const entry = strip.getByRole('button', { name: 'Buy privates', exact: true })
    await expect(entry).not.toHaveClass(/quiet/)
    for (let bought = 0; ; bought++) {
        expect(bought).toBeLessThan(4)
        await entry.click()
        await expect(mine).toHaveAttribute('aria-pressed', 'true')
        if (!(await cards.count())) break
        await expect(cards.locator('.seller')).toHaveCount(0)
        await cards.first().click()
        await purchases.getByRole('button', { name: 'Buy', exact: true }).click()
        await expect(mine).toBeHidden()
    }
    await expect(purchases.getByText('You have no privates to sell')).toBeVisible()
    await expect(entry).toHaveClass(/quiet/)
    await purchases.getByRole('button', { name: 'Other players’', exact: true }).click()
    await expect(cards.first()).toBeVisible()
    await expect(cards.first().locator('.seller')).toContainText('owned by')
})
