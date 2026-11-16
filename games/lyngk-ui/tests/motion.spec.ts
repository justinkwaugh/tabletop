import { expect, test, type Page } from '@playwright/test'
import { expectNoErrors, openScenario, press, settle, watchErrors } from './harness.js'

// Firefox 140 leaves the offset of an SVG matrix() transform out of a CSS zoom, and the board is
// drawn under one at view scale, so nothing on the board may move by matrix(). Each step is
// sampled frame by frame on a paused clock.

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

function matrices(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('svg.lyngk-board *')]
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
    for (let i = 0; i <= 80; i++) {
        drawn.push(...(await matrices(page)))
        await page.clock.runFor(20)
    }
    await page.clock.resume()
    await settle(page)
    drawn.push(...(await matrices(page)))
    expect(drawn).toEqual([])
}

test('a claim, a scoring chain, Undo and history steps move without matrix()', async ({ page }) => {
    await openScenario(page, 'Lyngk chain', { clock: true })
    await expectNoMatrix(page, () => press(page, 'claim black'))
    await press(page, 'move E7')
    await expectNoMatrix(page, () => press(page, 'land on G2'))
    const history = (step: 'goToPreviousAction' | 'goToBeginning' | 'goToEnd') => () =>
        page.evaluate((name) => void window.lyngkSession.history[name](), step)
    await expectNoMatrix(page, history('goToPreviousAction'))
    await expectNoMatrix(page, history('goToBeginning'))
    await expectNoMatrix(page, history('goToEnd'))
    await expectNoMatrix(page, () => page.evaluate(() => void window.lyngkSession.undo()))
})

test('a stack scored on the board is never drawn on a card at the same time', async ({ page }) => {
    await openScenario(page, 'Lyngk chain', { clock: true })
    await press(page, 'claim black')
    await settle(page)
    await press(page, 'move E7')
    const cards = () =>
        page.evaluate(() =>
            window.lyngkSession.gameState.players.reduce(
                (total, player) => total + window.lyngkSession.scoredOf(player.playerId).length,
                0
            )
        )
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await press(page, 'land on G2')
    await page.clock.runFor(300)
    // Mid-flight, the stack it completes is still on the board, not yet on a card.
    expect(await cards()).toBe(1)
    await page.clock.resume()
    await settle(page)
    expect(await cards()).toBe(2)
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500))
    await page.evaluate(() => void window.lyngkSession.undo())
    await page.clock.runFor(20)
    // As the Undo starts, the stack is taken off the card it drops back onto the board from.
    expect(await cards()).toBe(1)
    await page.clock.resume()
    await settle(page)
    expect(await cards()).toBe(1)
})
