import { expect, test } from '@playwright/test'
import {
    actionCount,
    claimAndScore,
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

test('a dealt game starts with every point filled and a stack to move', async ({ page }) => {
    await createGame(page)
    expect(await page.evaluate(() => window.lyngkSession.gameState.board.stacks.length)).toBe(43)
    expect(await page.getByRole('button', { name: /^move / }).count()).toBeGreaterThan(0)
})

test('choosing a stack shows where it can land, and Undo lets it go', async ({ page }) => {
    await openScenario(page, 'Lyngk chain')
    await expect(page.getByRole('button', { name: /^land on / })).toHaveCount(0)

    await press(page, 'move E5')
    expect(await page.getByRole('button', { name: /^land on / }).count()).toBeGreaterThan(1)

    await undoButton(page).click()
    await expect(page.getByRole('button', { name: /^land on / })).toHaveCount(0)
    expect(await actionCount(page)).toBe(0)
})

test('a tap off the choices lets go of the chosen stack', async ({ page }) => {
    await openScenario(page, 'Lyngk chain')
    await press(page, 'move E5')
    await page.getByRole('group', { name: 'LYNGK board' }).click({ position: { x: 12, y: 12 } })
    await expect(page.getByRole('button', { name: /^land on / })).toHaveCount(0)
})

test('a claim opens a LYNGK chain, and the stack it completes is scored', async ({ page }) => {
    await openScenario(page, 'Lyngk chain')
    await claimAndScore(page)
    expect(await actionCount(page)).toBe(2)
    const scored = await page.evaluate(() =>
        window.lyngkSession.gameState.players.map((player) => player.scored.length)
    )
    expect(scored).toEqual([1, 1])

    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(1)
    expect(await page.evaluate(() => window.lyngkSession.chosenFrom)).toEqual({ q: 0, r: -3 })
})

test('a player with no move is passed, and the history says so', async ({ page }) => {
    await openScenario(page, 'Pass and end')
    await press(page, 'move E7')
    await press(page, 'land on E6')
    await settle(page)
    expect(await page.evaluate(() => window.lyngkSession.gameState.activePlayerIds[0])).toBe(
        'player-1'
    )
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.getByRole('tabpanel', { name: 'History' })).toContainText('Bob had to pass')
})
