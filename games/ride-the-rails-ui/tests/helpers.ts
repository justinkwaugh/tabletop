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
    await expect.poll(() => page.evaluate(() => window.rtrSession !== undefined)).toBe(true)
    await settled(page)
}

export function board(page: Page): Locator {
    return page.getByRole('group', { name: 'Map of the USA' })
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
    const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true })
    for (let step = 0; step < 6 && !(await onScreen(page, hex)); step++) {
        await zoomOut.tap()
        await page.waitForTimeout(300)
    }
    expect(await onScreen(page, hex)).toBe(true)
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

/** Waits for every flight to land and the engine to answer. */
export async function settled(page: Page) {
    await expect
        .poll(() =>
            page.evaluate(
                () => window.rtrSession.flights.flyers.length === 0 && !window.rtrSession.busy
            )
        )
        .toBe(true)
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
