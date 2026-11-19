import { expect, type Page } from '@playwright/test'
import type { HexGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        hexSession: HexGameSession
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
            body: body.replace('return getContext();', 'return window.hexSession = getContext();')
        })
    })
}

async function ready(page: Page) {
    await expect.poll(() => page.evaluate(() => !!window.hexSession)).toBe(true)
    await expect(page.getByRole('group', { name: 'Hex board' })).toBeVisible()
    await settle(page)
}

export async function openScenario(page: Page, name: string, { clock = false } = {}) {
    await exposeSession(page)
    if (clock) await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await ready(page)
}

// `board` names a choice of the form's Board option, 11 × 11 by default.
export async function createGame(page: Page, { board }: { board?: string } = {}) {
    await exposeSession(page)
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Table')
    if (board) {
        await page
            .locator('select')
            .filter({ has: page.locator('option', { hasText: board }) })
            .selectOption({ label: board })
    }
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    // The form's modal dialog keeps the board inert, out of reach of the keyboard, until it has
    // closed.
    await expect(page.locator('dialog[open][class*="backdrop:"]')).toHaveCount(0)
    await ready(page)
}

export async function settle(page: Page) {
    await expect.poll(() => page.evaluate(() => window.hexSession.updatingVisibleState)).toBe(false)
}

export function actionCount(page: Page) {
    return page.evaluate(() => window.hexSession.gameState.actionCount)
}

export function undoButton(page: Page) {
    return page.getByRole('button', { name: 'UNDO', exact: true })
}

// Taps a board button by keyboard, which reaches it wherever a piece stands over it.
export function press(page: Page, name: string) {
    return page.getByRole('button', { name, exact: true }).press('Enter')
}
