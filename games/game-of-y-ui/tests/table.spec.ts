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

function activePlayer(page: import('@playwright/test').Page) {
    return page.evaluate(() => window.ySession.gameState.activePlayerIds[0])
}

test('placing a stone hands the turn on, and Undo takes it back', async ({ page }) => {
    await createGame(page)
    const mover = await activePlayer(page)
    await press(page, 'place on E5')
    await expect.poll(() => actionCount(page)).toBe(1)
    expect(await activePlayer(page)).not.toBe(mover)

    await undoButton(page).click()
    await expect.poll(() => actionCount(page)).toBe(0)
    await expect(page.getByRole('button', { name: 'place on E5' })).toHaveCount(1)
})

test("a tap on a point's centre places there, among stones on every side", async ({ page }) => {
    await openScenario(page, 'Crowded board')
    const target = page.getByRole('button', { name: /^place on / }).first()
    const name = (await target.getAttribute('aria-label'))?.replace('place on ', '')
    const box = await target.boundingBox()
    expect(box).not.toBeNull()
    if (box === null || name === undefined) return
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await settle(page)
    expect(
        await page.evaluate((point) => !!window.ySession.gameState.board.stoneAt(point), name)
    ).toBe(true)
})

test("White may take Black's first stone, and Undo offers the swap again", async ({ page }) => {
    await openScenario(page, 'Swap or place')
    const swapper = await activePlayer(page)
    await page.getByRole('button', { name: 'Swap', exact: true }).click()
    await settle(page)
    expect(await page.evaluate((id) => window.ySession.colorOf(id), swapper)).toBe('black')
    expect(await activePlayer(page)).not.toBe(swapper)

    await undoButton(page).click()
    await settle(page)
    await expect(page.getByRole('button', { name: 'Swap', exact: true })).toBeVisible()
})

test('completing a Y wins at once and rings the winning chain', async ({ page }) => {
    await openScenario(page, 'One from a y')
    await press(page, 'place on C1')
    await settle(page)
    expect(await page.evaluate(() => window.ySession.gameState.winningPlayerIds)).toHaveLength(1)
    expect(await page.locator('svg.y-board .mark.won').count()).toBeGreaterThan(3)
})

test('a hex board is played in cells named as on a Hex board', async ({ page }) => {
    await createGame(page, { board: 'Hex board, 9 a side' })
    expect(await page.getByRole('button', { name: /^place on / }).count()).toBe(45)
    await expect(page.getByText('on any empty cell')).toBeVisible()

    // Drawn as lines, the cells are points again.
    await page.getByRole('button', { name: 'Hexagons' }).click()
    await expect(page.getByText('on any empty point')).toBeVisible()
    await page.getByRole('button', { name: 'Hexagons' }).click()

    await press(page, 'place on A9')
    await expect.poll(() => actionCount(page)).toBe(1)
})

test('the board turns flat or tilted and the stones lie loose, mid-game', async ({ page }) => {
    await openScenario(page, 'Crowded board')
    const stones = await page.locator('svg.y-board g.stone').count()
    for (const toggle of ['Flat board', 'Loose stones', 'Coordinates']) {
        await page.getByRole('button', { name: toggle }).click()
        await settle(page)
        await page.getByRole('button', { name: toggle }).click()
        await settle(page)
    }
    expect(await page.locator('svg.y-board g.stone').count()).toBe(stones)
})
