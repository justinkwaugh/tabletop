import { expect } from '@playwright/test'
import { scenario } from './scenarioTable.js'

/** The contract's setup scenarios, sentence by sentence, on the real table at both widths. */

const StartingSpaces = [
    'space:space.badlands.1',
    'space:space.badlands.4',
    'space:space.desert.3',
    'space:space.desert.4',
    'space:space.forest.2',
    'space:space.forest.3'
]

scenario('S1 R-1.4.8 ChooseStartingGoods', 'setup-goods', async (table) => {
    const picked = (label: string) =>
        table.panel().locator(`[data-rows="goods"] [data-row^="${label}"][data-picked]`)
    const toBarrel = table.panel().getByRole('button', { name: 'To barrel', exact: true })

    await table.press(table.rowStarting('Saltpeter'))
    await table.press(table.rowStarting('Sulfur'))
    await expect(
        table.panel().getByRole('button', { name: 'To supply', exact: true })
    ).toBeVisible()
    await expect(toBarrel).toBeVisible()
    await table.press(table.rowStarting('Food'))
    await expect(toBarrel).toBeVisible()
    await table.press(toBarrel)
    await expect(table.primary()).toHaveText('Take saltpeter, sulfur (barrel), food')

    await table.press(table.undo())
    await expect(toBarrel).toBeVisible()
    await expect(picked('Food')).toHaveCount(1)
    await table.press(table.undo())
    await expect(picked('Food')).toHaveCount(0)
    await expect(picked('Sulfur')).toHaveCount(1)
    await table.press(table.undo())
    await expect(picked('Sulfur')).toHaveCount(0)
    await expect(picked('Saltpeter')).toHaveCount(1)

    await table.press(table.rowStarting('Sulfur'))
    await table.press(table.rowStarting('Food'))
    await table.press(toBarrel)
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights).toEqual(['goods: food', 'goods: saltpeter', 'goods: sulfur'])
    const panel = await table.seatPanel('p1')
    await expect(panel.locator('[data-barrel]')).toContainText('sulfur')
    await table.closeSeatPanel()
    await expect(table.waitingLine()).toHaveText('Bram chooses starting goods')
})

scenario('S2 R-1.4.9 PlaceStartingPawn, either order', 'setup-pawn', async (table) => {
    const knight = table.rowIn('characters', 'Knight')

    await expect(table.panel().locator('[data-row="Knight"]')).toContainText('master')
    await table.press(knight)
    await expect(table.panel().locator('[data-row="Knight"][data-picked]')).toHaveCount(1)
    expect(Object.keys(await table.litChips()).sort()).toEqual(StartingSpaces)
    expect(await table.mapDims()).toBe(true)

    await table.press(table.undo())
    await expect(table.panel().locator('[data-row="Knight"][data-picked]')).toHaveCount(0)

    await table.press(knight)
    const flights = await table.flightsOf(() => table.pressPick('space:space.desert.3'))
    expect(flights).toEqual(["markers: Ana's influence marker", "pawns: Ana's knight pawn"])
    await expect(table.waitingLine()).toHaveText('Bram places a starting pawn')
    expect(await table.piecesNamed('rank:')).toEqual(['rank:guild.knight.track.master'])

    await table.showSeat('p2')
    await table.pressPick('space:space.forest.2')
    await expect(table.popup()).toBeVisible()
    await expect(table.panel().getByText('Choose who stands here')).toBeVisible()
    await expect(table.popup().locator('[data-row="Knight"]')).toContainText('journeyman')
    await table.press(table.undo())
    await expect(table.popup()).toHaveCount(0)
    await table.pressPick('space:space.forest.2')
    await table.press(table.popupRow('Knight'))
    await expect(table.waitingLine()).toHaveText('Cleo places a starting pawn')
})

scenario('S3 R-4.5 Rank chips follow the tracks', 'setup-third-knight', async (table) => {
    const knight = table.panel().locator('[data-row="Knight"]')
    await expect(knight).toContainText('apprentice')
    await table.press(table.rowIn('characters', 'Knight'))
    await expect(knight).toContainText('apprentice')
    await table.pressPick('space:space.forest.2')
    await table.showSeat('p4')
    await expect(knight).toContainText('no rank')
})
