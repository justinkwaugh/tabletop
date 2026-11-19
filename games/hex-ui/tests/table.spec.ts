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
    return page.evaluate(() => window.hexSession.gameState.activePlayerIds[0])
}

test('filling a cell hands the turn on, and Undo takes it back', async ({ page }) => {
    await createGame(page)
    const mover = await activePlayer(page)
    await press(page, 'place on F6')
    await expect.poll(() => actionCount(page)).toBe(1)
    expect(await activePlayer(page)).not.toBe(mover)

    await undoButton(page).click()
    await expect.poll(() => actionCount(page)).toBe(0)
    await expect(page.getByRole('button', { name: 'place on F6' })).toHaveCount(1)
})

for (const upright of [false, true]) {
    test(`a tap on a cell's centre fills it, among filled cells, ${upright ? 'upright' : 'across'}`, async ({
        page
    }) => {
        await openScenario(page, 'Middle game')
        if (upright) {
            await page.getByRole('button', { name: 'Upright board' }).click()
            await settle(page)
        }
        const target = page.getByRole('button', { name: /^place on / }).nth(20)
        const name = (await target.getAttribute('aria-label'))?.replace('place on ', '')
        const box = await target.boundingBox()
        expect(box).not.toBeNull()
        if (box === null || name === undefined) return
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        await settle(page)
        expect(
            await page.evaluate((cell) => !!window.hexSession.gameState.board.stoneAt(cell), name)
        ).toBe(true)
    })
}

test("Blue may take Red's first stone, and Undo offers the swap again", async ({ page }) => {
    await openScenario(page, 'Swap or place')
    const swapper = await activePlayer(page)
    await page.getByRole('button', { name: 'Swap', exact: true }).click()
    await settle(page)
    expect(await page.evaluate((id) => window.hexSession.colorOf(id), swapper)).toBe('red')
    expect(await activePlayer(page)).not.toBe(swapper)

    await undoButton(page).click()
    await settle(page)
    await expect(page.getByRole('button', { name: 'Swap', exact: true })).toBeVisible()
})

test('joining your edges wins at once and draws a line along the winning chain', async ({
    page
}) => {
    await openScenario(page, 'Red one from a win')
    await press(page, 'place on D6')
    await settle(page)
    expect(await page.evaluate(() => window.hexSession.gameState.winningPlayerIds)).toHaveLength(1)
    await expect(page.locator('svg.hex-board .win-line .over')).toHaveCount(1)
    await expect(page.locator('svg.hex-board .mark.last')).toHaveCount(0)
    await expect(page.getByText('joins both red edges')).toBeVisible()
})

for (const [board, cells] of [
    ['9 × 9', 81],
    ['19 × 19', 361]
] as const) {
    test(`the ${board} board offers all its cells`, async ({ page }) => {
        await createGame(page, { board })
        expect(await page.getByRole('button', { name: /^place on / }).count()).toBe(cells)
        await press(page, 'place on A1')
        await expect.poll(() => actionCount(page)).toBe(1)
    })
}

test('the board turns upright and back, and labels hide, mid-game', async ({ page }) => {
    await openScenario(page, 'Middle game')
    const cells = await page.locator('svg.hex-board g.stone').count()
    for (const toggle of ['Upright board', 'Coordinates']) {
        await page.getByRole('button', { name: toggle }).click()
        await settle(page)
        await page.getByRole('button', { name: toggle }).click()
        await settle(page)
    }
    expect(await page.locator('svg.hex-board g.stone').count()).toBe(cells)
})
