import { expect, test, type Page } from '@playwright/test'
import { spaceFromName, spaceKey } from '@tabletop/tzaar'
import { expectNoErrors, openScenario, press, settle, watchErrors } from './harness.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale, so nothing on the board may move by matrix(). Each step is
// sampled frame by frame on a paused clock.

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

function matrices(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('svg.tzaar-board *')]
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

const history = (page: Page, step: 'goToPreviousAction' | 'goToBeginning' | 'goToEnd') => () =>
    page.evaluate((name) => void window.tzaarSession.history[name](), step)

test('a capture, a stacking, Undo and history steps move without matrix()', async ({ page }) => {
    await openScenario(page, 'Tall stacks', { clock: true })
    await press(page, 'move F1')
    await expectNoMatrix(page, () => press(page, 'capture F2'))
    await press(page, 'move D2')
    await expectNoMatrix(page, () => press(page, 'stack onto D3'))
    await expectNoMatrix(page, history(page, 'goToPreviousAction'))
    await expectNoMatrix(page, history(page, 'goToBeginning'))
    await expectNoMatrix(page, history(page, 'goToEnd'))
    await expectNoMatrix(page, () => page.evaluate(() => void window.tzaarSession.undo()))
})

test('a stack over the limit lands whole, then shrinks to it', async ({ page }) => {
    await openScenario(page, 'Tall stacks', { clock: true })
    await page.evaluate(() => window.tzaarSession.toggleShrinkStacks())
    await press(page, 'move F1')
    await press(page, 'capture F2')
    await settle(page)
    await press(page, 'move D2')
    // How high the top piece of the stack on D3 stands above its space.
    const topOfD3 = () =>
        page.evaluate(
            (id) => {
                const images = document.querySelectorAll(`[id="${id}"] image`)
                const top = images[images.length - 1]?.parentElement?.getAttribute('transform')
                return -Number(/translate\(0 (-?[\d.]+)\)/.exec(top ?? '')?.[1])
            },
            `tzaar-stack-${spaceKey(spaceFromName('D3'))}`
        )
    const before = await topOfD3()
    const heights: number[] = []
    const drawn: string[] = []
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await press(page, 'stack onto D3')
    for (let i = 0; i <= 60; i++) {
        heights.push(await topOfD3())
        drawn.push(...(await matrices(page)))
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    const after = await topOfD3()
    expect(drawn).toEqual([])
    expect(after).toBeCloseTo(before)
    expect(Math.max(...heights)).toBeGreaterThan(after + 5)
    expect(
        await page.evaluate(() => window.tzaarSession.gameState.board.heightAt({ q: -1, r: 2 }))
    ).toBe(11)
})
