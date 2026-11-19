import { expect, test, type Page } from '@playwright/test'
import { expectNoErrors, openScenario, press, settle, watchErrors } from './harness.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale, so nothing on the board may move by a matrix() with an offset; a
// rocking stone's tip is an offset-free matrix() after a translate(). Each step is sampled frame
// by frame on a paused clock.

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

function offsetMatrices(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('svg.y-board *')]
            .flatMap(
                (node) =>
                    `${node.getAttribute('transform') ?? ''} ${node.getAttribute('style') ?? ''}`.match(
                        /matrix\([^)]*\)/g
                    ) ?? []
            )
            .filter((matrix) => {
                const values = matrix.slice(7, -1).split(/[ ,]+/).map(Number)
                return values[4] !== 0 || values[5] !== 0
            })
    )
}

async function expectNoOffsetMatrix(page: Page, step: () => Promise<unknown>) {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.clock.runFor(20)
    await step()
    const drawn: string[] = []
    for (let i = 0; i <= 45; i++) {
        drawn.push(...(await offsetMatrices(page)))
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    drawn.push(...(await offsetMatrices(page)))
    expect(drawn).toEqual([])
}

for (const flat of [true, false]) {
    test(`placements, Undo and history steps move without an offset matrix(), ${flat ? 'flat' : 'tilted'}`, async ({
        page
    }) => {
        await openScenario(page, 'Swap or place', { clock: true })
        await page.evaluate((want) => {
            if (window.ySession.flatBoard !== want) window.ySession.toggleFlatBoard()
        }, flat)
        await expectNoOffsetMatrix(page, () => press(page, 'place on F5'))
        await expectNoOffsetMatrix(page, () => press(page, 'place on D4'))
        const history = (step: 'goToPreviousAction' | 'goToBeginning' | 'goToEnd') => () =>
            page.evaluate((name) => void window.ySession.history[name](), step)
        await expectNoOffsetMatrix(page, history('goToPreviousAction'))
        await expectNoOffsetMatrix(page, history('goToEnd'))
        await expectNoOffsetMatrix(page, () => page.evaluate(() => void window.ySession.undo()))
    })
}

test('a winning move rings its chain without an offset matrix()', async ({ page }) => {
    await openScenario(page, 'One from a y', { clock: true })
    await expectNoOffsetMatrix(page, () => press(page, 'place on C1'))
})
