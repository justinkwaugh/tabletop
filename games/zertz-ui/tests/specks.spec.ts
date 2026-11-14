import { expect, test, type Page } from '@playwright/test'
import type { ZertzGameSession } from '../src/lib/model/session.svelte.js'

// Each marble keeps its own specks through every step of history and exploration: on every frame
// of a step, a marble drawn over a ring shows the specks it shows there once the step has landed.

type Specks = Record<string, string>

declare global {
    interface Window {
        zertzSession: ZertzGameSession
        placeAway: () => Promise<void>
        specks: () => Specks
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

// A new game with four marbles placed, none beside another, so no capture is forced.
async function fourPlaced(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.zertzSession = getContext();')
        })
    })
    await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Specks')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.zertzSession)).toBe(true)
    await settle(page)
    await page.evaluate(() => {
        const session = () => window.zertzSession
        const apart = (a: { q: number; r: number }, b: { q: number; r: number }) =>
            Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r)) > 2
        window.placeAway = async () => {
            const s = session()
            const colors = s.placeableColors.filter((color) => color !== 'white')
            s.chooseColor(colors[s.gameState.actionCount % colors.length])
            const marbles = s.gameState.board.rings.filter((ring) => ring.marble !== undefined)
            const target =
                s.placementRings.find((coords) =>
                    marbles.every((ring) => apart(ring.coords, coords))
                ) ?? s.placementRings[0]
            await s.chooseRing(target)
            if (s.removableRings.length > 0) await s.chooseRing(s.removableRings[0])
        }
        window.specks = () => {
            const board = document.querySelector('svg.zertz-board')
            const drawn: Specks = {}
            for (const marble of board?.querySelectorAll('g.marble') ?? []) {
                const paths = [...marble.querySelectorAll('path')].map((path) =>
                    path.getAttribute('d')
                )
                drawn[marble.getAttribute('transform') ?? ''] = paths.join('|')
            }
            return drawn
        }
    })
    for (let i = 0; i < 4; i++) await act(page, () => window.placeAway())
}

async function settle(page: Page) {
    await expect
        .poll(() => page.evaluate(() => window.zertzSession.updatingVisibleState))
        .toBe(false)
}

async function act(page: Page, run: () => unknown) {
    await page.evaluate(run)
    await settle(page)
}

// Plays a step frame by frame and expects every marble drawn on a frame to match its ring's
// marble once the step has landed.
async function expectSpecksKept(page: Page, step: () => unknown) {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.clock.runFor(20)
    await page.evaluate(step)
    const frames: Specks[] = []
    for (let i = 0; i <= 12; i++) {
        frames.push(await page.evaluate(() => window.specks()))
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    const landed = await page.evaluate(() => window.specks())
    frames.forEach((frame, index) => {
        for (const [ring, specks] of Object.entries(frame)) {
            if (landed[ring] === undefined) continue
            expect(specks, `${ring} at ${index * 20} ms`).toBe(landed[ring])
        }
    })
}

for (const back of [1, 3]) {
    test(`${back} step${back > 1 ? 's' : ''} back, then Go to end`, async ({ page }) => {
        await fourPlaced(page)
        for (let i = 0; i < back; i++) {
            await act(page, () => window.zertzSession.history.goToPreviousAction())
        }
        await expectSpecksKept(page, () => void window.zertzSession.history.goToEnd())
    })
}

test('Go to beginning, then single steps forward out of history', async ({ page }) => {
    await fourPlaced(page)
    await act(page, () => window.zertzSession.history.goToBeginning())
    while (await page.evaluate(() => window.zertzSession.history.inHistory)) {
        await expectSpecksKept(page, () => void window.zertzSession.history.goToNextAction())
    }
})

test('inside an exploration, a step back then Go to end, and again once it ends', async ({
    page
}) => {
    await fourPlaced(page)
    await act(page, () => window.zertzSession.startExploring())
    await act(page, () => window.placeAway())
    await act(page, () => window.placeAway())
    await act(page, () => window.zertzSession.history.goToPreviousAction())
    await act(page, () => window.zertzSession.history.goToPreviousAction())
    await expectSpecksKept(page, () => void window.zertzSession.history.goToEnd())
    await act(page, () => window.zertzSession.explorations.endExploring())
    await act(page, () => window.zertzSession.history.goToPreviousAction())
    await expectSpecksKept(page, () => void window.zertzSession.history.goToEnd())
})
