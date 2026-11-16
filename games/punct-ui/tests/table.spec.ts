import { expect, test } from '@playwright/test'
import { assertExists } from '@tabletop/common'
import {
    actionCount,
    button,
    centreOf,
    clickCentre,
    expectNoErrors,
    openScenario,
    placeAndMove,
    press,
    settle,
    staged,
    undoButton,
    watchErrors
} from './harness.js'

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

test('a piece turned and placed, taken back by Undo one choice at a time', async ({ page }) => {
    await openScenario(page, 'Opening')
    await press(page, 'space K10')
    const unturned = (await staged(page))?.rotation
    await button(page, 'turn').click()
    const turned = (await staged(page))?.rotation
    expect(turned).not.toBe(unturned)
    await button(page, 'Place').click()
    await settle(page)
    expect(await actionCount(page)).toBe(1)

    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(0)
    expect((await staged(page))?.rotation).toBe(turned)

    await undoButton(page).click()
    expect((await staged(page))?.rotation).toBe(unturned)
    await undoButton(page).click()
    expect(await staged(page)).toBeUndefined()
    expect(await actionCount(page)).toBe(0)
})

test('a piece moved, taken back by Undo, then let go by a tap off the choices', async ({
    page
}) => {
    await openScenario(page, 'Opening')
    await placeAndMove(page)
    expect(await actionCount(page)).toBe(2)

    await undoButton(page).click()
    await settle(page)
    expect(await actionCount(page)).toBe(1)
    expect(await staged(page)).toMatchObject({ from: { q: 1, r: -4 } })
    await expect(page.getByRole('button', { name: 'Drop', exact: true })).toBeVisible()

    await page.getByRole('group', { name: 'PÜNCT board' }).click({ position: { x: 12, y: 12 } })
    expect(await staged(page)).toBeUndefined()
    expect(await actionCount(page)).toBe(1)
})

test('a tap on a space reaches it past the empty corners of a piece drawn near it', async ({
    page
}) => {
    await openScenario(page, 'Opening')
    const space = await centreOf(page, 'space I3')
    const piece = await button(page, 'piece at K3').boundingBox()
    assertExists(piece, 'K3 holds a piece in the Opening')
    expect(space.x).toBeGreaterThan(piece.x)
    expect(space.x).toBeLessThan(piece.x + piece.width)
    expect(space.y).toBeGreaterThan(piece.y)
    expect(space.y).toBeLessThan(piece.y + piece.height)
    await clickCentre(page, 'space I3')
    expect(await staged(page)).toMatchObject({ punct: { q: 0, r: 5 } })
})

test('a tap beside the staged piece moves it there rather than turning it', async ({ page }) => {
    await openScenario(page, 'Opening', { clock: true })
    await press(page, 'space K10')
    await page.clock.runFor(1000)
    const unturned = (await staged(page))?.rotation
    await clickCentre(page, 'space L11')
    expect(await staged(page)).toMatchObject({ punct: { q: 3, r: -5 }, rotation: unturned })
})
