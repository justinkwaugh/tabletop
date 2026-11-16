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

test('placing a ring hands the turn on, and Undo takes it back', async ({ page }) => {
    await createGame(page)
    const mover = await page.evaluate(() => window.yinshSession.gameState.activePlayerIds[0])
    await press(page, 'place F6')
    await expect.poll(() => actionCount(page)).toBe(1)
    expect(await page.evaluate(() => window.yinshSession.gameState.activePlayerIds[0])).not.toBe(
        mover
    )

    await undoButton(page).click()
    await expect.poll(() => actionCount(page)).toBe(0)
    await expect(page.getByRole('button', { name: 'place F6' })).toHaveCount(1)
})

test('choosing a ring shows where it can move, and Undo lets it go', async ({ page }) => {
    await openScenario(page, 'Form a row')
    await expect(page.getByRole('button', { name: /^move to / })).toHaveCount(0)

    await press(page, 'ring F3')
    expect(await page.getByRole('button', { name: /^move to / }).count()).toBeGreaterThan(0)

    await undoButton(page).click()
    await expect(page.getByRole('button', { name: /^move to / })).toHaveCount(0)
    expect(await actionCount(page)).toBe(0)
})

test('a move that makes a row has the mover take it and a ring', async ({ page }) => {
    await openScenario(page, 'Form a row')
    await press(page, 'ring F3')
    for (const name of ['move to D1', 'row B3', 'remove ring E9']) {
        await press(page, name)
        await settle(page)
    }
    expect(await actionCount(page)).toBe(3)
    const removed = await page.evaluate(() =>
        window.yinshSession.gameState.players.map((player) => player.ringsRemoved)
    )
    expect(removed.toSorted()).toEqual([0, 1])
})
