import { expect, test } from '@playwright/test'
import { expectNoErrors, openScenario, settle, watchErrors } from './harness.js'

// Overlaps between the pointer, the keyboard, toggles, view switches and a move playing.

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

// A cell drawn as it fills or drains.
const growing = '.hex-board .stone [clip-path]'

test('pointer fill shows on hover and hides at the click', async ({ page }) => {
    await openScenario(page, 'Swap or place')
    const target = page.getByRole('button', { name: 'place on G5' })
    await target.hover()
    await expect(page.locator('.hex-board .ghost')).toHaveCount(1)
    await page.mouse.move(5, 5)
    await expect(page.locator('.hex-board .ghost')).toHaveCount(0)
    await target.hover()
    await page.mouse.down()
    await page.mouse.up()
    await expect(page.locator('.hex-board .ghost')).toHaveCount(0)
    await settle(page)
    await expect(page.locator('.hex-board .ghost')).toHaveCount(0)
})

test('keyboard focus and Enter fill a cell', async ({ page }) => {
    await openScenario(page, 'Swap or place')
    const stones = await page.locator('.hex-board g.stone').count()
    await page.getByRole('button', { name: 'place on G5' }).focus()
    await page.keyboard.press('Enter')
    await settle(page)
    expect(await page.locator('.hex-board g.stone').count()).toBe(stones + 1)
    expect(await page.getByRole('button', { name: /^place on / }).count()).toBeGreaterThan(0)
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
    expect(focused ?? '').toMatch(/^place on |^$/)
})

for (const toggle of ['Upright board', 'Coordinates']) {
    test(`${toggle} mid-move lands the move at once`, async ({ page }) => {
        await openScenario(page, 'Middle game')
        const cell = await page
            .getByRole('button', { name: /^place on / })
            .nth(10)
            .getAttribute('aria-label')
        await page.evaluate(
            (name) => void window.hexSession.placeStone(name!.replace('place on ', '')),
            cell
        )
        await expect(page.locator(growing).first()).toBeAttached()
        await page.getByRole('button', { name: toggle }).click()
        await expect(page.locator(growing)).toHaveCount(0, { timeout: 100 })
        await settle(page)
    })
}

test('a switch of view mid-move stops it and shows the switched state', async ({ page }) => {
    await openScenario(page, 'Middle game')
    const cell = await page
        .getByRole('button', { name: /^place on / })
        .nth(10)
        .getAttribute('aria-label')
    await page.evaluate(
        (name) => void window.hexSession.placeStone(name!.replace('place on ', '')),
        cell
    )
    await expect(page.locator(growing).first()).toBeAttached()
    // As a change of representation publishes: the same game, shown at once.
    await page.evaluate(() => {
        const session = window.hexSession
        const context = Reflect.get(session, 'gameContext')
        Reflect.get(session, 'presenter').publishNow('view-switch', () =>
            context.restoreFrom(context.clone())
        )
    })
    await expect(page.locator(growing)).toHaveCount(0, { timeout: 100 })
    await settle(page)
    const shown = await page.locator('.hex-board g.stone').count()
    expect(shown).toBe(await page.evaluate(() => window.hexSession.gameState.board.stones.length))
})

test('opening a game shows the board at rest', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText('Middle game', { exact: true }).click()
    const board = page.locator('svg.hex-board').first()
    await board.waitFor()
    await page.waitForTimeout(100)
    const early = await board.screenshot()
    await page.waitForTimeout(900)
    const late = await board.screenshot()
    expect(early.equals(late)).toBe(true)
})
