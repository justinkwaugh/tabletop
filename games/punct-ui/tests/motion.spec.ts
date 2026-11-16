import { expect, test, type Page } from '@playwright/test'
import { button, expectNoErrors, openScenario, press, settle, watchErrors } from './harness.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale, so nothing on the board may move by matrix(). Each step is
// sampled frame by frame on a paused clock.

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

function matrices(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('svg.punct-board *')]
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

test('a placement, a move, their Undo and history steps move without matrix()', async ({
    page
}) => {
    await openScenario(page, 'Opening', { clock: true })
    await expectNoMatrix(page, () => press(page, 'space K10'))
    await expectNoMatrix(page, () => button(page, 'turn').click())
    await expectNoMatrix(page, () => button(page, 'Place').click())
    await expectNoMatrix(page, () => press(page, 'piece at J12'))
    await expectNoMatrix(page, () => press(page, 'space J9'))
    await expectNoMatrix(page, () => button(page, 'Drop').click())
    const session =
        (step: 'undo' | 'goToPreviousAction' | 'goToNextAction' | 'goToBeginning') => () =>
            page.evaluate(
                (name) =>
                    void (name === 'undo'
                        ? window.punctSession.undo()
                        : window.punctSession.history[name]()),
                step
            )
    await expectNoMatrix(page, session('undo'))
    await expectNoMatrix(page, () => button(page, 'Drop').click())
    await expectNoMatrix(page, session('goToPreviousAction'))
    await expectNoMatrix(page, session('goToBeginning'))
    await expectNoMatrix(page, session('goToNextAction'))
})
