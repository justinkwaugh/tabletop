import { expect, test } from '@playwright/test'
import {
    actionCount,
    createGame,
    expectNoErrors,
    openScenario,
    press,
    settle,
    undoButton,
    watchErrors
} from './harness.js'

test.use({ reducedMotion: 'reduce' })

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

test('placing a piece hands the turn on, and Undo takes it back', async ({ page }) => {
    await createGame(page)
    const mover = await page.evaluate(() => window.dvonnSession.gameState.activePlayerIds[0])
    await press(page, 'place on F3')
    await expect.poll(() => actionCount(page)).toBe(1)
    expect(await page.evaluate(() => window.dvonnSession.gameState.activePlayerIds[0])).not.toBe(
        mover
    )

    await undoButton(page).click()
    await expect.poll(() => actionCount(page)).toBe(0)
    await expect(page.getByRole('button', { name: 'place on F3' })).toHaveCount(1)
})

test('choosing a stack shows where it can land, and Undo lets it go', async ({ page }) => {
    await openScenario(page, 'Cut off')
    await expect(page.getByRole('button', { name: /^move onto / })).toHaveCount(0)

    await press(page, 'stack C2')
    expect(await page.getByRole('button', { name: /^move onto / }).count()).toBeGreaterThan(0)

    await undoButton(page).click()
    await expect(page.getByRole('button', { name: /^move onto / })).toHaveCount(0)
    expect(await actionCount(page)).toBe(0)
})

test('a move cuts stacks off, and Undo takes it back with the stack chosen', async ({ page }) => {
    await openScenario(page, 'Cut off')
    const before = await page.evaluate(() => window.dvonnSession.gameState.board.stacks.length)
    await press(page, 'stack C2')
    await press(page, 'move onto D2')
    await settle(page)
    expect(
        await page.evaluate(() => window.dvonnSession.gameState.board.stacks.length)
    ).toBeLessThan(before - 1)

    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(0)
    expect(await page.evaluate(() => window.dvonnSession.chosenFrom)).toEqual({ q: -3, r: 1 })
})

test('the gaps between pieces down a hole are as light in a tall stack as in a short one', async ({
    page
}) => {
    // Stacks from one to ten high on the board, and tallies of three and ten on the cards.
    await openScenario(page, 'Midgame')
    const shades = await page
        .locator('path.hole-shadow')
        .evaluateAll((paths) => paths.map((path) => path.getAttribute('fill-opacity')))
    expect(shades.length).toBeGreaterThan(0)
    expect(new Set(shades)).toEqual(new Set([shades[0]]))
})
