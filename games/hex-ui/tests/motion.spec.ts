import { expect, test, type Page } from '@playwright/test'
import { expectNoErrors, openScenario, press, settle, watchErrors } from './harness.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale, so nothing on the board may move by a matrix() with an offset.
// Each step is sampled frame by frame on a paused clock.

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

function offsetMatrices(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('svg.hex-board *')]
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

for (const upright of [false, true]) {
    test(`fills, Undo and history steps move without an offset matrix(), ${upright ? 'upright' : 'across'}`, async ({
        page
    }) => {
        await openScenario(page, 'Swap or place', { clock: true })
        await page.evaluate((want) => {
            if (window.hexSession.upright !== want) window.hexSession.toggleUpright()
        }, upright)
        // From nothing, then from a neighbour, then from an edge.
        await expectNoOffsetMatrix(page, () => press(page, 'place on C3'))
        await expectNoOffsetMatrix(page, () => press(page, 'place on F7'))
        await expectNoOffsetMatrix(page, () => press(page, 'place on A3'))
        const history = (step: 'goToPreviousAction' | 'goToBeginning' | 'goToEnd') => () =>
            page.evaluate((name) => void window.hexSession.history[name](), step)
        await expectNoOffsetMatrix(page, history('goToPreviousAction'))
        await expectNoOffsetMatrix(page, history('goToEnd'))
        await expectNoOffsetMatrix(page, () => page.evaluate(() => void window.hexSession.undo()))
    })
}

test('a winning move marks its chain without an offset matrix()', async ({ page }) => {
    await openScenario(page, 'Red one from a win', { clock: true })
    await expectNoOffsetMatrix(page, () => press(page, 'place on D6'))
})
