import { expect, test, type Page } from '@playwright/test'
import type { MatrxGameSession } from '../src/lib/model/session.svelte.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one, so nothing on the board may be moved by a matrix(): each frame of a move is
// sampled from a paused page clock.

declare global {
    interface Window {
        matrxSession: MatrxGameSession
    }
}

const BOARD = 'svg[aria-label="MATRX GIPF board"]'
const FRAME = 16

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function openScenario(page: Page, name: string) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.matrxSession = getContext();')
        })
    })
    // Before the page loads, so GSAP's ticker runs on the page clock.
    await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.matrxSession)).toBe(true)
    await settle(page)
}

async function settle(page: Page) {
    await expect
        .poll(() => page.evaluate(() => window.matrxSession.updatingVisibleState))
        .toBe(false)
}

// Every transform on the board, frame by frame, while `start` plays.
async function framesOf(page: Page, start: () => Promise<unknown>): Promise<string[][]> {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    await start()
    // The page's own timers stand still, so the start is polled from here.
    await expect
        .poll(() => page.evaluate(() => window.matrxSession.updatingVisibleState))
        .toBe(true)
    const frames: string[][] = []
    for (let frame = 0; frame < 40; frame++) {
        frames.push(
            await page.evaluate((board) => {
                const nodes = document.querySelectorAll(`${board} [transform]`)
                return [...nodes].map((node) => node.getAttribute('transform') ?? '')
            }, BOARD)
        )
        await page.clock.runFor(FRAME)
    }
    await page.clock.resume()
    await settle(page)
    return frames
}

function expectMovedWithoutMatrix(frames: string[][]) {
    expect(new Set(frames.map((frame) => frame.join('|'))).size).toBeGreaterThan(1)
    for (const frame of frames) {
        expect(frame.filter((transform) => transform.includes('matrix('))).toEqual([])
    }
}

test('a push, the row it takes, the GIPF piece back to its dot, and Undo', async ({ page }) => {
    await openScenario(page, 'Gipf piece back')
    await page.locator('[aria-label="dot E1"]').click()
    expectMovedWithoutMatrix(
        await framesOf(page, () => page.locator('[aria-label="push to E2"]').press('Enter'))
    )
    expectMovedWithoutMatrix(
        await framesOf(page, () => page.evaluate(() => void window.matrxSession.removeChosenRow()))
    )
    expectMovedWithoutMatrix(
        await framesOf(page, () => page.evaluate(() => void window.matrxSession.undo()))
    )
})

test('potentials hop, bounce and skid', async ({ page }) => {
    await openScenario(page, 'Potentials')
    for (const [from, to] of [
        ['C4', 'F3'],
        ['E3', 'H3']
    ]) {
        await page.locator(`[aria-label="stack ${from}"]`).click()
        expectMovedWithoutMatrix(
            await framesOf(page, () => page.locator(`[aria-label="move to ${to}"]`).press('Enter'))
        )
        expectMovedWithoutMatrix(
            await framesOf(page, () => page.evaluate(() => void window.matrxSession.undo()))
        )
    }
})
