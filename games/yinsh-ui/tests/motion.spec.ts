import { expect, test, type Page } from '@playwright/test'
import { expectNoErrors, openScenario, press, settle, watchErrors } from './harness.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale, so nothing on the board may be placed by a matrix() offset. Each
// step is sampled frame by frame on a paused clock.

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

// A matrix() is allowed only without an offset, after a translate() that places it.
function offsetMatrices(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('svg.yinsh-board *')]
            .map(
                (node) =>
                    `${node.getAttribute('transform') ?? ''} ${node.getAttribute('style') ?? ''}`
            )
            .filter((drawn) =>
                [...drawn.matchAll(/matrix\(([^)]*)\)/g)].some((match) => {
                    const terms = match[1].split(/[\s,]+/).map(Number)
                    return terms[4] !== 0 || terms[5] !== 0
                })
            )
    )
}

async function expectNoMatrix(page: Page, step: () => Promise<unknown>) {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.clock.runFor(20)
    await step()
    const drawn: string[] = []
    for (let i = 0; i <= 60; i++) {
        drawn.push(...(await offsetMatrices(page)))
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    drawn.push(...(await offsetMatrices(page)))
    expect(drawn).toEqual([])
}

test('a move, its row and ring, Undo and history steps move without matrix()', async ({ page }) => {
    await openScenario(page, 'Form a row', { clock: true })
    await expectNoMatrix(page, () => press(page, 'ring F3'))
    for (const name of ['move to D1', 'row B3', 'remove ring E9']) {
        await expectNoMatrix(page, () => press(page, name))
    }
    const history = (step: 'goToPreviousAction' | 'goToBeginning' | 'goToEnd') => () =>
        page.evaluate((name) => void window.yinshSession.history[name](), step)
    await expectNoMatrix(page, history('goToPreviousAction'))
    await expectNoMatrix(page, history('goToBeginning'))
    await expectNoMatrix(page, history('goToEnd'))
    await expectNoMatrix(page, () => page.evaluate(() => void window.yinshSession.undo()))
})
