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

function exposeSession(page: Page) {
    return page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.zertzSession = getContext();')
        })
    })
}

function readSpecks(page: Page) {
    return page.evaluate(() => {
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
}

// A new game with four marbles placed, none beside another, so no capture is forced.
async function fourPlaced(page: Page) {
    await exposeSession(page)
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
    })
    await readSpecks(page)
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

test('Go to beginning, then Go to end', async ({ page }) => {
    await fourPlaced(page)
    await act(page, () => window.zertzSession.history.goToBeginning())
    await expectSpecksKept(page, () => void window.zertzSession.history.goToEnd())
})

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

test('inside an exploration, Go to beginning then Go to end, and ending it at its beginning', async ({
    page
}) => {
    await fourPlaced(page)
    await act(page, () => window.zertzSession.startExploring())
    await act(page, () => window.placeAway())
    await act(page, () => window.zertzSession.history.goToBeginning())
    await expectSpecksKept(page, () => void window.zertzSession.history.goToEnd())
    await act(page, () => window.zertzSession.history.goToBeginning())
    await expectSpecksKept(page, () => void window.zertzSession.explorations.endExploring())
})

// A marble beside one already placed, with a ring beyond either of them vacant, so the next player
// must jump; the ring removed is clear of the four.
async function forceCapture(page: Page) {
    await act(page, async () => {
        const s = window.zertzSession
        const vacant = (q: number, r: number) =>
            s.gameState.board.isVacant({ q, r }) && s.gameState.board.hasRing({ q, r })
        const steps = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, -1],
            [-1, 1]
        ]
        const marbles = s.gameState.board.rings.filter((ring) => ring.marble !== undefined)
        let line: { q: number; r: number }[] | undefined
        for (const { coords } of marbles) {
            for (const [dq, dr] of steps) {
                const next = { q: coords.q + dq, r: coords.r + dr }
                const beyond = { q: coords.q + 2 * dq, r: coords.r + 2 * dr }
                if (vacant(next.q, next.r) && vacant(beyond.q, beyond.r)) {
                    line = [coords, next, beyond, { q: coords.q - dq, r: coords.r - dr }]
                }
            }
        }
        if (line === undefined) throw Error('No marble has two vacant rings in a line beside it')
        s.chooseColor(s.placeableColors[0])
        await s.chooseRing(line[1])
        const clear = s.removableRings.find((ring) =>
            line.every((coords) => coords.q !== ring.q || coords.r !== ring.r)
        )
        if (clear !== undefined) await s.chooseRing(clear)
    })
}

test('a jumping marble and the marble it captures keep their specks until they leave', async ({
    page
}) => {
    await fourPlaced(page)
    await forceCapture(page)
    await page.evaluate(() => {
        const s = window.zertzSession
        s.chooseJumper(s.jumpers[0])
    })
    const before = await page.evaluate(() => window.specks())
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.clock.runFor(20)
    await page.evaluate(() => {
        const s = window.zertzSession
        void s.chooseRing(s.landingRings[0])
    })
    for (let i = 0; i <= 12; i++) {
        const frame = await page.evaluate(() => window.specks())
        for (const [ring, specks] of Object.entries(frame)) {
            if (before[ring] === undefined) continue
            expect(specks, `${ring} at ${i * 20} ms`).toBe(before[ring])
        }
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
})

test('a placed marble keeps its specks from staged through its ring removal', async ({ page }) => {
    await fourPlaced(page)
    await page.evaluate(async () => {
        const s = window.zertzSession
        s.chooseColor(s.placeableColors[s.placeableColors.length - 1])
        const marbles = s.gameState.board.rings.filter((ring) => ring.marble !== undefined)
        const apart = (a: { q: number; r: number }, b: { q: number; r: number }) =>
            Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r)) > 2
        const target =
            s.placementRings.find((coords) =>
                marbles.every((ring) => apart(ring.coords, coords))
            ) ?? s.placementRings[0]
        await s.chooseRing(target)
    })
    await settle(page)
    await page.waitForTimeout(800)
    const before = await page.evaluate(() => window.specks())
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.clock.runFor(20)
    await page.evaluate(() => {
        const s = window.zertzSession
        void s.chooseRing(s.removableRings[0])
    })
    for (let i = 0; i <= 40; i++) {
        const frame = await page.evaluate(() => window.specks())
        for (const [ring, specks] of Object.entries(frame)) {
            if (before[ring] === undefined) continue
            expect(specks, `${ring} at ${i * 20} ms`).toBe(before[ring])
        }
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    const landed = await page.evaluate(() => window.specks())
    for (const [ring, specks] of Object.entries(landed)) {
        if (before[ring] === undefined) continue
        expect(specks, `${ring} once landed`).toBe(before[ring])
    }
})

// The placed marble's ring is claimed with its group, so it is not on the board the Undo leaves.
test('an undone placement that claimed its own ring comes back with its specks', async ({
    page
}) => {
    await exposeSession(page)
    await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText('Claim by placement', { exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.zertzSession)).toBe(true)
    await settle(page)
    await readSpecks(page)
    await act(page, async () => {
        const s = window.zertzSession
        // White marbles have no specks.
        const specked = s.placeableColors.find((color) => color !== 'white')
        if (specked === undefined) throw Error('No specked marble to place')
        s.chooseColor(specked)
        await s.chooseRing({ q: -2, r: 2 })
    })
    await page.waitForTimeout(800)
    const placed = await page.evaluate(() => window.specks())
    await act(page, () => {
        const s = window.zertzSession
        return s.chooseRing(s.removableRings[0])
    })
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.clock.runFor(20)
    await page.evaluate(() => void window.zertzSession.undo())
    const frames: Specks[] = []
    for (let i = 0; i <= 20; i++) {
        frames.push(await page.evaluate(() => window.specks()))
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    frames.push(await page.evaluate(() => window.specks()))
    expect(await page.evaluate(() => window.zertzSession.chosenPlace)).toEqual({ q: -2, r: 2 })
    let seen = 0
    frames.forEach((frame, index) => {
        for (const [ring, specks] of Object.entries(frame)) {
            if (placed[ring] === undefined) continue
            seen++
            expect(specks, `${ring} at frame ${index}`).toBe(placed[ring])
        }
    })
    expect(seen).toBeGreaterThan(0)
})
