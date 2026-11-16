import { expect, type Page } from '@playwright/test'
import type { TzaarGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        tzaarSession: TzaarGameSession
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
            body: body.replace('return getContext();', 'return window.tzaarSession = getContext();')
        })
    })
}

export async function openScenario(page: Page, name: string, { clock = false } = {}) {
    await exposeSession(page)
    if (clock) await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.tzaarSession)).toBe(true)
    await expect(page.getByRole('group', { name: 'TZAAR board' })).toBeVisible()
    await settle(page)
}

export async function settle(page: Page) {
    await expect
        .poll(() => page.evaluate(() => window.tzaarSession.updatingVisibleState))
        .toBe(false)
}

export function actionCount(page: Page) {
    return page.evaluate(() => window.tzaarSession.gameState.actionCount)
}

export function undoButton(page: Page) {
    return page.getByRole('button', { name: 'UNDO', exact: true })
}

// Taps a board button by keyboard, which reaches it wherever a piece stands over it.
export function press(page: Page, name: string) {
    return page.getByRole('button', { name, exact: true }).press('Enter')
}

// In Two Tzaars left, Alice's stack on D1 captures Bob's Tzaar on D2.
export async function captureD2(page: Page) {
    await press(page, 'move D1')
    await press(page, 'capture D2')
    await settle(page)
}
