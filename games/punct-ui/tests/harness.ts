import { expect, type Page } from '@playwright/test'
import { assertExists } from '@tabletop/common'
import type { PunctGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        punctSession: PunctGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

export function watchErrors(page: Page) {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
    // The session reports a listener's failure on the console and goes on.
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
    })
}

export function expectNoErrors(page: Page) {
    expect(pageErrors.get(page)).toEqual([])
}

// Exposes the session on the window, as the harness keeps it in a Svelte context.
async function exposeSession(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.punctSession = getContext();')
        })
    })
}

export async function openScenario(page: Page, name: string, { clock = false } = {}) {
    await exposeSession(page)
    if (clock) await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.punctSession)).toBe(true)
    await expect(page.getByRole('group', { name: 'PÜNCT board' })).toBeVisible()
    await settle(page)
}

export async function settle(page: Page) {
    await expect
        .poll(() => page.evaluate(() => window.punctSession.updatingVisibleState))
        .toBe(false)
}

export function actionCount(page: Page) {
    return page.evaluate(() => window.punctSession.gameState.actionCount)
}

export function staged(page: Page) {
    return page.evaluate(() => window.punctSession.staged)
}

export function undoButton(page: Page) {
    return page.getByRole('button', { name: 'UNDO', exact: true })
}

export function button(page: Page, name: string) {
    return page.getByRole('button', { name, exact: true })
}

export async function centreOf(page: Page, name: string) {
    const box = await button(page, name).boundingBox()
    assertExists(box, `${name} is on screen`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// Clicks the centre of a board button, which reaches whatever is drawn there.
export async function clickCentre(page: Page, name: string) {
    const { x, y } = await centreOf(page, name)
    await page.mouse.click(x, y)
}

// Taps a board button by keyboard, which reaches it wherever a piece stands over it.
export function press(page: Page, name: string) {
    return button(page, name).press('Enter')
}

// In the Opening, White places a triangle on K10, then Black moves its piece from J12 to J9.
export async function placeAndMove(page: Page) {
    await press(page, 'space K10')
    await button(page, 'Place').click()
    await settle(page)
    await press(page, 'piece at J12')
    await press(page, 'space J9')
    await button(page, 'Drop').click()
    await settle(page)
}
