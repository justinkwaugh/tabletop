import { expect, test, type Locator, type Page } from '@playwright/test'
import type { RideTheRailsGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        rtrSession: RideTheRailsGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

/** Fails a test on any error the page throws. */
export function collectPageErrors() {
    test.beforeEach(({ page }) => {
        const errors: string[] = []
        pageErrors.set(page, errors)
        page.on('pageerror', (error) => errors.push(error.message))
    })

    test.afterEach(({ page }) => {
        expect(pageErrors.get(page)).toEqual([])
    })
}

/** Loads a named table from the harness's Scenarios menu, with the session on `window`. */
export async function openScenario(page: Page, name: string) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.rtrSession = getContext();')
        })
    })
    await page.goto('/')
    // The dev server hydrates slowly, so a click before hydration is ignored.
    await expect(async () => {
        await page.getByRole('button', { name: 'Scenarios' }).click()
        await page.getByRole('button', { name, exact: true }).click({ timeout: 2_000 })
    }).toPass()
    await expect(page.getByRole('navigation')).toContainText(name)
    // The harness's navigation bar is a little wider than a phone, so the phone's page can scroll,
    // and reaching a scenario low in the menu scrolls it. Scrolled, Playwright checks what a tap
    // will hit at a point off by that scroll, finds the board over the zoom control, and scrolls
    // the table sideways to retry. Bring the page back to its top.
    await page.getByRole('navigation').scrollIntoViewIfNeeded()
    await expect.poll(() => page.evaluate(() => window.rtrSession !== undefined)).toBe(true)
    // The emulated phone still clicks with a mouse, which would rest over whatever the menu
    // covered (a railroad entry hovers its spotlight); park it in the corner.
    await page.mouse.move(0, 0)
    await expect
        .poll(() => page.evaluate(() => window.rtrSession.spotlightRailroadId))
        .toBe(undefined)
    await settled(page)
}

/** The board, on whichever map the table plays: "Map of the USA", "Map of Canada" and so on. */
export function board(page: Page): Locator {
    return page.getByRole('group', { name: /^Map of / })
}

/** The lit hexes, by their accessible names. */
export function litHexes(page: Page): Locator {
    return board(page).locator('[data-hex-id][role="button"]')
}

export function litHex(page: Page, label: string): Locator {
    return board(page).getByRole('button', { name: label, exact: true })
}

/** The lit hex at a map position, such as `hex.usa.8-54`. */
export function litHexAt(page: Page, hexId: string): Locator {
    return board(page).locator(`[data-hex-id="${hexId}"][role="button"]`)
}

/**
 * Presses a lit hex as a player would: a click on desktop, a tap on a touch screen. The phone's
 * board rests at cover fit, so a hex out of view is first brought in with Zoom out.
 */
export async function pressHex(page: Page, hex: Locator) {
    await expect(hex).toBeVisible()
    if (!test.info().project.use.hasTouch) {
        await hex.click()
        await settled(page)
        return
    }
    // The lit set redraws as a pick changes, so the hex is read again until it holds still.
    await settled(page)
    const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true })
    for (let step = 0; step < 6 && !(await onScreen(page, hex)); step++) {
        await zoomOut.tap()
        await page.waitForTimeout(300)
    }
    await expect.poll(() => onScreen(page, hex)).toBe(true)
    await hex.tap()
    await settled(page)
}

async function onScreen(page: Page, hex: Locator): Promise<boolean> {
    const box = await hex.boundingBox()
    const view = page.viewportSize()
    if (!box || !view) return false
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    if (x < 0 || y < 0 || x > view.width || y > view.height) return false
    // Something drawn over the board, such as the action area, can cover the hex's centre.
    return hex.evaluate(
        (element, [px, py]) => {
            const top = document.elementFromPoint(px ?? 0, py ?? 0)
            return top === element
        },
        [x, y]
    )
}

/** The accessible names of every lit hex, in map order. */
export async function litLabels(page: Page): Promise<string[]> {
    await settled(page)
    const labels = await litHexes(page).evaluateAll((hexes) =>
        hexes.map((hex) => hex.getAttribute('aria-label') ?? '')
    )
    return labels
}

export async function undo(page: Page) {
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await settled(page)
}

/**
 * Waits for every flight to land, the engine to answer and the board to hold still, and returns
 * where the board rests.
 */
export async function settled(page: Page): Promise<BoardBox> {
    await expect
        .poll(() =>
            page.evaluate(
                () => window.rtrSession.flights.flyers.length === 0 && !window.rtrSession.busy
            )
        )
        .toBe(true)
    return steadyBoard(page)
}

export type BoardBox = { left: number; top: number; width: number; height: number }

/** Where the board is drawn on screen, to the half pixel. */
export function boardBox(page: Page): Promise<BoardBox> {
    return board(page).evaluate((root) => {
        const box = root.getBoundingClientRect()
        const half = (value: number) => Math.round(value * 2) / 2
        return {
            left: half(box.left),
            top: half(box.top),
            width: half(box.width),
            height: half(box.height)
        }
    })
}

/** The view skips a new layout within 1% of its scale; rounding adds a little. */
const RENDER_SCALE_TOLERANCE = 0.011

/** Whether the board's view has laid its content out again at the scale it shows it at. */
function renderScaleCommitted(page: Page): Promise<boolean> {
    return board(page).evaluate((root, tolerance) => {
        let content: HTMLElement | null = root.parentElement
        while (content && !content.style.transform.includes('translate3d')) {
            content = content.parentElement
        }
        const scale = /scale\(([^)]+)\)/.exec(content?.style.transform ?? '')?.[1]
        return scale !== undefined && Math.abs(Number(scale) - 1) < tolerance
    }, RENDER_SCALE_TOLERANCE)
}

/**
 * Waits until the board holds still on screen, and returns where it rests: the same box on two
 * reads at least 100 ms apart, and the view's content laid out again at its scale. A glide of
 * the view (the building zoom's first fit, a held spotlight) is neither a flight nor the engine,
 * so a hex read or pressed before this may be read or pressed on a moving board.
 */
async function steadyBoard(page: Page): Promise<BoardBox> {
    let last: BoardBox | undefined
    await expect
        .poll(
            async () => {
                const next = await boardBox(page)
                const same =
                    last !== undefined &&
                    JSON.stringify(next) === JSON.stringify(last) &&
                    (await renderScaleCommitted(page))
                last = next
                return same
            },
            { intervals: [150] }
        )
        .toBe(true)
    return boardBox(page)
}

/** Records each kind of flyer, with a coin's amount, while `act` runs and its motion plays. */
export async function flyersDuring(page: Page, act: () => Promise<void>): Promise<string[]> {
    await page.evaluate(() => {
        const seen = new Set<string>()
        const watch = () => {
            for (const flyer of window.rtrSession.flights.flyers) {
                seen.add(flyer.kind === 'coin' ? `coin $${flyer.amount}` : flyer.kind)
            }
            Reflect.set(window, 'rtrFlyers', [...seen])
            requestAnimationFrame(watch)
        }
        watch()
    })
    await act()
    await settled(page)
    return page.evaluate(() => {
        const seen: unknown = Reflect.get(window, 'rtrFlyers')
        return Array.isArray(seen) ? seen.map(String) : []
    })
}

/** The seat whose decision the table waits on. */
export function activePlayerId(page: Page): Promise<string | undefined> {
    return page.evaluate(() => window.rtrSession.gameState.activePlayerIds[0])
}

export function moneyOf(page: Page, playerId: string): Promise<number | undefined> {
    return page.evaluate(
        (id) => window.rtrSession.gameState.players.find((player) => player.playerId === id)?.money,
        playerId
    )
}

/** The lit hexes whose whole box lies inside the board's frame, where the view shows it. */
export function litInView(page: Page): Promise<string[]> {
    return board(page).evaluate((root) => {
        let frame: Element | null = root.parentElement
        while (frame && getComputedStyle(frame).overflow === 'visible') {
            frame = frame.parentElement
        }
        const clip = frame?.getBoundingClientRect()
        const left = Math.max(0, clip?.left ?? 0)
        const top = Math.max(0, clip?.top ?? 0)
        const right = Math.min(innerWidth, clip?.right ?? innerWidth)
        const bottom = Math.min(innerHeight, clip?.bottom ?? innerHeight)
        return [...root.querySelectorAll('g.hits [role="button"]')].flatMap((hit) => {
            const box = hit.getBoundingClientRect()
            const inside =
                box.left >= left && box.right <= right && box.top >= top && box.bottom <= bottom
            return inside ? [hit.getAttribute('data-hex-id') ?? ''] : []
        })
    })
}

/**
 * Safari 26.0 and older report the box of anything inside CSS zoom divided by the zoom, as the
 * board's view (`renderAtViewScale`) draws it; this page does the same. The box as drawn stays on
 * `window.rtrDrawnRect`.
 */
export async function reportRectsUnzoomed(page: Page) {
    await page.addInitScript(() => {
        const drawn = Element.prototype.getBoundingClientRect
        Reflect.set(window, 'rtrDrawnRect', (element: Element) => drawn.call(element))
        const zoomAbove = (element: Element) => {
            let zoom = 1
            for (let node: Element | null = element; node; node = node.parentElement) {
                zoom *= Number.parseFloat(getComputedStyle(node).zoom) || 1
            }
            return zoom
        }
        Element.prototype.getBoundingClientRect = function () {
            const box = drawn.call(this)
            const zoom = zoomAbove(this)
            if (zoom === 1) return box
            return new DOMRect(box.x / zoom, box.y / zoom, box.width / zoom, box.height / zoom)
        }
    })
}
