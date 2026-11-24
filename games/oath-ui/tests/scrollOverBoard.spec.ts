import { expect, test, type Locator, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

// Scenario 59 — the Since your last turn card sits over the board, and rows past its height
// scroll inside it. A swipe or a wheel over those rows scrolls them; the board under the card
// stays where it is. Over the board beside the card, the board still pans.

type Point = { x: number; y: number }

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await page.evaluate(async (name) => {
        const fixture = await import(
            new URL('/src/lib/testing/tableFixture.ts', location.href).href
        )
        return fixture.open(name)
    }, name)
}

const card = (page: Page) => page.getByRole('dialog', { name: 'Since your last turn' })
const rows = (page: Page) => card(page).locator('.since-last-turn__rows')
const pane = (page: Page) => page.locator('.scaling-surface').first()

/** The board's view: the transform the board's wrapper gives the board (scale and translation). */
const boardView = (page: Page) =>
    pane(page).evaluate((surface) => {
        const content = surface.querySelector(':scope > div > div')
        if (!(content instanceof HTMLElement)) throw Error('The board is laid out')
        return content.style.transform
    })

/** A value once it has stopped changing: two reads 150 ms apart agree. */
async function settled<T>(read: () => Promise<T>): Promise<T> {
    const last: { value: T | undefined; seen: boolean } = { value: undefined, seen: false }
    await expect
        .poll(
            async () => {
                const value = await read()
                const same = last.seen && JSON.stringify(value) === JSON.stringify(last.value)
                last.value = value
                last.seen = true
                return same
            },
            { intervals: [150] }
        )
        .toBe(true)
    return last.value as T
}

const scrollTop = (locator: Locator) => locator.evaluate((element) => element.scrollTop)

/** The page and every scroller around the board, so a swipe that chains past the rows shows. */
const outerScroll = (page: Page) =>
    pane(page).evaluate((surface) => {
        const tops: number[] = [window.scrollY]
        for (let at = surface.parentElement; at; at = at.parentElement) tops.push(at.scrollTop)
        return tops
    })

async function middle(locator: Locator): Promise<Point> {
    const box = await locator.boundingBox()
    if (!box) throw Error('The element is laid out')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** One finger drawn from `from` by `by`, in steps, then lifted: a real touch, through the browser. */
async function swipe(page: Page, from: Point, by: Point, steps = 12) {
    const cdp = await page.context().newCDPSession(page)
    const at = (i: number) => ({
        x: from.x + (by.x * i) / steps,
        y: from.y + (by.y * i) / steps
    })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] })
    for (let i = 1; i <= steps; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i)] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
}

/** Two fingers around `center`, `from` px apart and then `to` (a pinch out when wider), through the browser. */
async function pinch(page: Page, center: Point, from: number, to: number, steps = 10) {
    const cdp = await page.context().newCDPSession(page)
    const points = (gap: number) => [
        { x: center.x, y: center.y - gap / 2, id: 0 },
        { x: center.x, y: center.y + gap / 2, id: 1 }
    ]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) })
    for (let i = 1; i <= steps; i++) {
        const gap = from + ((to - from) * i) / steps
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(gap) })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
}

/** A point on the board beside the card, at the card's height: the dimmed board, not the card. */
async function besideCard(page: Page): Promise<Point> {
    const cardBox = await card(page).boundingBox()
    const paneBox = await pane(page).boundingBox()
    if (!cardBox || !paneBox) throw Error('The card and the board are laid out')
    expect(cardBox.x - paneBox.x).toBeGreaterThanOrEqual(6)
    return { x: paneBox.x + (cardBox.x - paneBox.x) / 2, y: cardBox.y + cardBox.height / 2 }
}

/** Zooms the board in from beside the card, so it has room to pan; returns the zoomed view. */
async function zoomIn(page: Page, touch: boolean): Promise<string> {
    const beside = await besideCard(page)
    if (!touch) return zoomInAt(page, beside)
    const fitted = await settled(() => boardView(page))
    await pinch(page, beside, 20, 120)
    const zoomed = await settled(() => boardView(page))
    expect(zoomed).not.toBe(fitted)
    return zoomed
}

/** Zooms the board in with Ctrl and the wheel at `at`; returns the zoomed view. */
async function zoomInAt(page: Page, at: Point): Promise<string> {
    const fitted = await settled(() => boardView(page))
    await page.mouse.move(at.x, at.y)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -300)
    await page.keyboard.up('Control')
    const zoomed = await settled(() => boardView(page))
    expect(zoomed).not.toBe(fitted)
    return zoomed
}

/** The long card open, its rows taller than the room they have, and the board zoomed in under it. */
async function openLongCard(page: Page, touch: boolean) {
    await openTable(page, 'sinceLastTurnLong')
    await expect(card(page)).toBeVisible()
    const list = rows(page)
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight + 40)).toBe(true)
    const view = await zoomIn(page, touch)
    return { list, view, outer: await outerScroll(page) }
}

test.describe('on a phone at 375 × 812, with touch', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

    test('a swipe up over the card’s rows scrolls them; the board under the card does not move', async ({
        page
    }) => {
        const { list, view, outer } = await openLongCard(page, true)

        await swipe(page, await middle(list), { x: 0, y: -160 })

        expect(await settled(() => scrollTop(list))).toBeGreaterThan(40)
        expect(await settled(() => boardView(page))).toBe(view)
        expect(await outerScroll(page)).toEqual(outer)
    })

    test('a sideways swipe over the rows does not move the board either', async ({ page }) => {
        const { list, view } = await openLongCard(page, true)
        await swipe(page, await middle(list), { x: -120, y: 0 })
        expect(await settled(() => boardView(page))).toBe(view)
    })

    test('a swipe over the board beside the card still pans the board', async ({ page }) => {
        const { list, view } = await openLongCard(page, true)
        await swipe(page, await besideCard(page), { x: 0, y: -120 })
        expect(await settled(() => boardView(page))).not.toBe(view)
        expect(await scrollTop(list)).toBe(0)
    })

    test('with the rows at their end, a further flick neither moves the board nor scrolls the page', async ({
        page
    }) => {
        const { list, view, outer } = await openLongCard(page, true)
        await list.evaluate((el) => (el.scrollTop = el.scrollHeight))
        const end = await settled(() => scrollTop(list))
        expect(end).toBeGreaterThan(0)

        // A quick flick past the end: nothing takes what the rows cannot use.
        await swipe(page, await middle(list), { x: 0, y: -200 }, 4)

        expect(await settled(() => boardView(page))).toBe(view)
        expect(await scrollTop(list)).toBe(end)
        expect(await outerScroll(page)).toEqual(outer)
    })

    test('a pinch that starts on the rows zooms the board, as it does beside the card, and not the page', async ({
        page
    }) => {
        const { list, view } = await openLongCard(page, true)
        await pinch(page, await middle(list), 120, 40)
        expect(await settled(() => boardView(page))).not.toBe(view)
        expect(await page.evaluate(() => visualViewport?.scale ?? 1)).toBe(1)
        expect(await scrollTop(list)).toBe(0)
    })

    test('a tap on the pig still clears the card', async ({ page }) => {
        await openLongCard(page, true)
        await card(page).getByRole('button', { name: 'The pig foresaw this: clear' }).tap()
        await expect(card(page)).toHaveCount(0)
    })
})

test.describe('on a phone held sideways at 812 × 375, with touch', () => {
    test.use({ viewport: { width: 812, height: 375 }, hasTouch: true, isMobile: true })

    test('a swipe up over the card’s rows scrolls them; the board under the card does not move', async ({
        page
    }) => {
        const { list, view, outer } = await openLongCard(page, true)
        await swipe(page, await middle(list), { x: 0, y: -80 })
        expect(await settled(() => scrollTop(list))).toBeGreaterThan(20)
        expect(await settled(() => boardView(page))).toBe(view)
        expect(await outerScroll(page)).toEqual(outer)
    })
})

test.describe('on a desktop at 1280 × 800', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('a mouse wheel over the card’s rows scrolls them; the board under the card does not move', async ({
        page
    }) => {
        const { list, view, outer } = await openLongCard(page, false)

        const at = await middle(list)
        await page.mouse.move(at.x, at.y)
        await page.mouse.wheel(0, 120)

        expect(await settled(() => scrollTop(list))).toBeGreaterThan(40)
        expect(await settled(() => boardView(page))).toBe(view)
        expect(await outerScroll(page)).toEqual(outer)
    })

    test('a mouse wheel over the board beside the card still moves the board', async ({ page }) => {
        const { list, view } = await openLongCard(page, false)
        const beside = await besideCard(page)
        await page.mouse.move(beside.x, beside.y)
        await page.mouse.wheel(0, 120)
        expect(await settled(() => boardView(page))).not.toBe(view)
        expect(await scrollTop(list)).toBe(0)
    })

    test('with the rows at their end, a further wheel does not move the board', async ({
        page
    }) => {
        const { list, view, outer } = await openLongCard(page, false)
        await list.evaluate((el) => (el.scrollTop = el.scrollHeight))
        const end = await settled(() => scrollTop(list))

        const at = await middle(list)
        await page.mouse.move(at.x, at.y)
        await page.mouse.wheel(0, 240)

        expect(await settled(() => boardView(page))).toBe(view)
        expect(await scrollTop(list)).toBe(end)
        expect(await outerScroll(page)).toEqual(outer)
    })

    test('a mouse drag that starts on the rows leaves the board where it is; beside the card it pans', async ({
        page
    }) => {
        const { list, view } = await openLongCard(page, false)
        const drag = async (from: Point) => {
            await page.mouse.move(from.x, from.y)
            await page.mouse.down()
            await page.mouse.move(from.x + 10, from.y - 60, { steps: 6 })
            await page.mouse.up()
        }
        await drag(await middle(list))
        expect(await settled(() => boardView(page))).toBe(view)
        await drag(await besideCard(page))
        expect(await settled(() => boardView(page))).not.toBe(view)
    })

    test('Ctrl and the wheel over the rows still zoom the board; Escape still clears the card', async ({
        page
    }) => {
        const { list, view } = await openLongCard(page, false)
        const at = await middle(list)
        await page.mouse.move(at.x, at.y)
        await page.keyboard.down('Control')
        await page.mouse.wheel(0, 200)
        await page.keyboard.up('Control')
        expect(await settled(() => boardView(page))).not.toBe(view)
        await page.keyboard.press('Escape')
        await expect(card(page)).toHaveCount(0)
    })

    test('a click on the pig still clears the card', async ({ page }) => {
        await openLongCard(page, false)
        await card(page).getByRole('button', { name: 'The pig foresaw this: clear' }).click()
        await expect(card(page)).toHaveCount(0)
    })
})

// While the rows fit the card, they leave every gesture to the board, as beside the card.
test.describe('the short card on a desktop at 1280 × 800', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('a mouse wheel over rows that fit moves the board, as beside the card', async ({
        page
    }) => {
        await openTable(page, 'sinceLastTurn')
        await expect(card(page)).toBeVisible()
        const list = rows(page)
        await settled(async () => (await list.boundingBox())?.height)
        expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(false)
        const view = await zoomIn(page, false)

        const at = await middle(list)
        await page.mouse.move(at.x, at.y)
        await page.mouse.wheel(0, 120)

        expect(await settled(() => boardView(page))).not.toBe(view)
    })
})

test.describe('full screen at 1280 × 800', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('the card stays in full screen, and a wheel over its rows scrolls them, not the board', async ({
        page
    }) => {
        await openTable(page, 'sinceLastTurnLong')
        await expect(card(page)).toBeVisible()
        // The zoom buttons sit under the card's backdrop: the press goes to the button itself.
        await page.getByRole('button', { name: 'Enter full screen' }).dispatchEvent('click')
        const full = page.locator('dialog[aria-label="Full screen view"]')
        await expect(full.getByRole('dialog', { name: 'Since your last turn' })).toBeVisible()
        const list = rows(page)
        await settled(async () => (await list.boundingBox())?.height)
        expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight + 40)).toBe(true)
        const view = await zoomIn(page, false)

        const at = await middle(list)
        await page.mouse.move(at.x, at.y)
        await page.mouse.wheel(0, 120)

        expect(await settled(() => scrollTop(list))).toBeGreaterThan(40)
        expect(await settled(() => boardView(page))).toBe(view)
    })
})

test.describe('on a phone held sideways at 812 × 375, with touch: the open goals', () => {
    test.use({ viewport: { width: 812, height: 375 }, hasTouch: true, isMobile: true })

    test('the open goals sit outside the board’s wrapper and scroll under a swipe; the board does not move', async ({
        page
    }) => {
        await openTable(page, 'goalsRail')
        const fitted = await settled(() => boardView(page))
        await pinch(page, await middle(pane(page)), 20, 120)
        const view = await settled(() => boardView(page))
        expect(view).not.toBe(fitted)

        // The rail is on the board, zoomed off screen now: the press goes to its button itself.
        await page
            .getByRole('button', { name: 'Goals: open the enlarged view' })
            .dispatchEvent('click')
        const goals = page.getByRole('dialog', { name: 'Goals' })
        await expect(goals).toBeVisible()
        expect(await goals.evaluate((el) => el.closest('.scaling-surface'))).toBeNull()
        expect(await goals.evaluate((el) => el.scrollHeight > el.clientHeight + 40)).toBe(true)

        await swipe(page, await middle(goals), { x: 0, y: -120 })

        expect(await settled(() => scrollTop(goals))).toBeGreaterThan(40)
        expect(await settled(() => boardView(page))).toBe(view)
    })
})
