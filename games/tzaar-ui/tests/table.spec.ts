import { expect, test } from '@playwright/test'
import {
    actionCount,
    captureD2,
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

const chosen = (page: import('@playwright/test').Page) =>
    page.evaluate(() => window.tzaarSession.chosenFrom)

test('choosing a stack shows what it can capture, and Undo lets it go', async ({ page }) => {
    await openScenario(page, 'Two tzaars left')
    await expect(page.getByRole('button', { name: /^capture / })).toHaveCount(0)

    await press(page, 'move D1')
    await expect(page.getByRole('button', { name: /^capture / })).toHaveCount(2)

    await undoButton(page).click()
    await expect(page.getByRole('button', { name: /^capture / })).toHaveCount(0)
    expect(await actionCount(page)).toBe(0)
})

test('a tap off the choices lets go of the chosen stack', async ({ page }) => {
    await openScenario(page, 'Two tzaars left')
    await press(page, 'move D1')
    await page.getByRole('group', { name: 'TZAAR board' }).click({ position: { x: 12, y: 12 } })
    await expect(page.getByRole('button', { name: /^capture / })).toHaveCount(0)
})

test('a capture, then Undo takes it back with the stack still chosen', async ({ page }) => {
    await openScenario(page, 'Two tzaars left')
    await captureD2(page)
    expect(await actionCount(page)).toBe(1)
    await expect(page.getByRole('button', { name: 'Pass' })).toBeVisible()

    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(0)
    expect(await chosen(page)).toEqual({ q: -1, r: 4 })
    await expect(page.getByRole('button', { name: 'capture D2' })).toBeVisible()

    await undoButton(page).click()
    expect(await chosen(page)).toBeUndefined()
    expect(await actionCount(page)).toBe(0)
})

test('a placement in the Tournament version, and Undo lifts it off', async ({ page }) => {
    await openScenario(page, 'Placement ends')
    const stacks = () => page.evaluate(() => window.tzaarSession.gameState.board.stacks.length)
    const before = await stacks()
    await press(page, 'place on F8')
    await settle(page)
    expect(await stacks()).toBe(before + 1)
    expect(await actionCount(page)).toBe(1)

    await undoButton(page).click()
    await settle(page)
    expect(await stacks()).toBe(before)
    await expect(page.getByRole('button', { name: 'place on F8' })).toBeVisible()
})
