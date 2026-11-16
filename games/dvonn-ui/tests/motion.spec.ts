import { expect, test, type Page } from '@playwright/test'
import { expectNoErrors, openScenario, press, settle, watchErrors } from './harness.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale, so nothing on the board may move by matrix(). Each step is
// sampled frame by frame on a paused clock.

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

function matrices(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('svg.dvonn-board *')]
            .map(
                (node) =>
                    `${node.getAttribute('transform') ?? ''} ${node.getAttribute('style') ?? ''}`
            )
            .filter((drawn) => drawn.includes('matrix('))
    )
}

async function expectNoMatrix(page: Page, step: () => Promise<unknown>) {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.clock.runFor(20)
    await step()
    const drawn: string[] = []
    for (let i = 0; i <= 60; i++) {
        drawn.push(...(await matrices(page)))
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    drawn.push(...(await matrices(page)))
    expect(drawn).toEqual([])
}

test('a placement, a move that cuts off, Undo and history steps move without matrix()', async ({
    page
}) => {
    await openScenario(page, 'Cut off', { clock: true })
    await expectNoMatrix(page, () => press(page, 'stack C2'))
    await expectNoMatrix(page, () => press(page, 'move onto D2'))
    const history = (step: 'goToPreviousAction' | 'goToBeginning' | 'goToEnd') => () =>
        page.evaluate((name) => void window.dvonnSession.history[name](), step)
    await expectNoMatrix(page, history('goToPreviousAction'))
    await expectNoMatrix(page, history('goToEnd'))
    await expectNoMatrix(page, () => page.evaluate(() => void window.dvonnSession.undo()))
})

test('a stack past the full height shrinks without matrix()', async ({ page }) => {
    await openScenario(page, 'Past the full height', { clock: true })
    await page.evaluate(() => {
        if (!window.dvonnSession.shrinkStacks) window.dvonnSession.toggleShrinkStacks()
    })
    await expectNoMatrix(page, () =>
        page.evaluate(async () => {
            const session = window.dvonnSession
            const [from] = session.movable
            await session.chooseSpace(from)
            await session.chooseSpace(session.destinations[0])
        })
    )
})
