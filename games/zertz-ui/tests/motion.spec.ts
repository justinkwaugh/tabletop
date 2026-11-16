import { expect, test, type Page } from '@playwright/test'
import type { AxialCoordinates } from '@tabletop/common'
import type { ZertzGameSession } from '../src/lib/model/session.svelte.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale, so nothing on the board may move by matrix(). Each move is
// sampled frame by frame on a paused clock.

declare global {
    interface Window {
        zertzSession: ZertzGameSession
        at: (name: string) => AxialCoordinates
        matrices: () => string[]
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

async function openScenario(page: Page, name: string) {
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
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.zertzSession)).toBe(true)
    await settle(page)
    await page.evaluate(() => {
        const session = window.zertzSession
        window.at = (name) => {
            const coords = session.view
                .frame(session.gameState.setup)
                .positions.find((position) => session.notation.name(position) === name)
            if (coords === undefined) throw new Error(`No point ${name}`)
            return coords
        }
        window.matrices = () =>
            [...document.querySelectorAll('svg.zertz-board *')]
                .map((node) => `${node.tagName} ${node.getAttribute('transform') ?? ''}`)
                .filter((drawn) => drawn.includes('matrix('))
    })
}

async function settle(page: Page) {
    await expect
        .poll(() => page.evaluate(() => window.zertzSession.updatingVisibleState))
        .toBe(false)
}

async function expectNoMatrix(page: Page, step: () => unknown) {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.clock.runFor(20)
    await page.evaluate(step)
    const drawn: string[] = []
    for (let i = 0; i <= 30; i++) {
        drawn.push(...(await page.evaluate(() => window.matrices())))
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    drawn.push(...(await page.evaluate(() => window.matrices())))
    expect(drawn).toEqual([])
}

test('a placement, its removal, Undo and history steps move without matrix()', async ({ page }) => {
    await openScenario(page, 'Claim by ring removal')
    await expectNoMatrix(page, async () => {
        const session = window.zertzSession
        const black = session.placeableColors.find((color) => color === 'black')
        if (black === undefined) throw new Error('No black marble to place')
        session.chooseColor(black)
        await session.chooseRing(window.at('D4'))
    })
    await expectNoMatrix(page, () => void window.zertzSession.chooseRing(window.at('B2')))
    await expectNoMatrix(page, () => void window.zertzSession.history.goToPreviousAction())
    await expectNoMatrix(page, () => void window.zertzSession.history.goToEnd())
    await expectNoMatrix(page, () => void window.zertzSession.undo())
})

test('a capture chain moves without matrix()', async ({ page }) => {
    await openScenario(page, 'Capture chain')
    await expectNoMatrix(page, async () => {
        const session = window.zertzSession
        session.chooseJumper(window.at('E3'))
        await session.chooseRing(session.landingRings[0])
    })
    await expectNoMatrix(page, async () => {
        const session = window.zertzSession
        if (session.chosenJumper === undefined) session.chooseJumper(session.jumpers[0])
        await session.chooseRing(session.landingRings[0])
    })
})
