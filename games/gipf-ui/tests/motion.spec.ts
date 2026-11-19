import { expect, test, type Page } from '@playwright/test'
import type { GipfGameSession } from '../src/lib/model/session.svelte.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of the board's view-scale zoom, so
// nothing on the board may carry one while it moves.

declare global {
    interface Window {
        gipfSession: GipfGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function createGame(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.gipfSession = getContext();')
        })
    })
    await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Motion')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.gipfSession)).toBe(true)
    await settle(page)
}

async function settle(page: Page) {
    await expect
        .poll(() => page.evaluate(() => window.gipfSession.updatingVisibleState))
        .toBe(false)
}

async function act(page: Page, run: (label: string) => unknown, label = '') {
    await page.evaluate(run, label)
    await settle(page)
}

function press(label: string) {
    const node = document.querySelector(`[aria-label="${label}"]`)
    if (node === null) throw new Error(`no ${label} on the board`)
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

// Plays a motion frame by frame and returns every board transform that is a matrix().
async function matricesDuring(page: Page, start: (label: string) => unknown, label = '') {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.evaluate(start, label)
    const found: string[] = []
    for (let i = 0; i <= 30; i++) {
        found.push(
            ...(await page.evaluate(() =>
                [...document.querySelectorAll('svg.gipf-board *')]
                    .map((node) => node.getAttribute('transform') ?? '')
                    .filter((transform) => transform.includes('matrix('))
            ))
        )
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    return found
}

test('a push, its Undo and a history step move pieces without matrix()', async ({ page }) => {
    await createGame(page)
    for (const [dot, target] of [
        ['E1', 'E2'],
        ['A1', 'B2']
    ]) {
        await act(page, press, `dot ${dot}`)
        await act(page, press, `push to ${target}`)
    }
    expect(await matricesDuring(page, press, 'dot E1')).toEqual([])
    expect(await matricesDuring(page, press, 'push to E2')).toEqual([])
    const undo = () => void window.gipfSession.undo()
    expect(await matricesDuring(page, undo)).toEqual([])
    await act(page, press, 'push to E2')
    const back = () => void window.gipfSession.history.goToPreviousAction()
    expect(await matricesDuring(page, back)).toEqual([])
    const forward = () => void window.gipfSession.history.goToNextAction()
    expect(await matricesDuring(page, forward)).toEqual([])
})

test('turning piece badges on mid-push lands the push at once', async ({ page }) => {
    await createGame(page)
    await act(page, press, 'dot E1')
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.evaluate(press, 'push to E2')
    await page.clock.runFor(60)
    expect(await page.evaluate(() => window.gipfSession.updatingVisibleState)).toBe(true)

    await page.evaluate(() => window.gipfSession.togglePieceBadges())
    await page.clock.runFor(20)
    expect(await page.evaluate(() => window.gipfSession.updatingVisibleState)).toBe(false)
    await page.clock.resume()
})
