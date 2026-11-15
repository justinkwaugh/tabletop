import { expect } from '@playwright/test'
import { shot } from './helpers.js'
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
    const line = table.panel().locator('[data-rows="sulfur"]')
    const keep = table.panel().getByRole('button', { name: 'Keep the sulfur', exact: true })
    const toBarrel = table
        .panel()
        .getByRole('button', { name: 'Put the sulfur into the barrel', exact: true })
    /** Where each good stands in the goods row. */
    const goodsRow = () =>
        table
            .panel()
            .locator('[data-rows="goods"] [data-row]')
            .evaluateAll((rows) =>
                rows.map((row) => {
                    const { x, y } = row.getBoundingClientRect()
                    return `${row.getAttribute('data-row')} ${Math.round(x)},${Math.round(y)}`
                })
            )

    await table.press(table.rowStarting('Saltpeter'))
    const before = await goodsRow()
    await table.press(table.rowStarting('Sulfur'))
    await expect(line).toBeVisible()
    await expect(line).toContainText('Sulfur:')
    await expect(keep).toHaveText('Keep it')
    await expect(keep).toHaveAttribute('aria-pressed', 'true')
    await expect(toBarrel).toHaveText('Into the barrel')
    await expect(toBarrel).toHaveAttribute('aria-pressed', 'false')
    expect(await goodsRow()).toEqual(before)
    const lineAt = await line.boundingBox()
    const goodsAt = await table.panel().locator('[data-rows="goods"]').boundingBox()
    expect(lineAt?.y ?? 0).toBeGreaterThanOrEqual((goodsAt?.y ?? 0) + (goodsAt?.height ?? 0))

    await table.press(toBarrel)
    await table.press(table.rowStarting('Food'))
    await expect(toBarrel).toHaveAttribute('aria-pressed', 'true')
    expect(await goodsRow()).toEqual(before)
    expect(await line.boundingBox()).toEqual(lineAt)
    await table.press(table.rowStarting('Food'))
    await table.press(table.rowStarting('Iron'))
    await expect(toBarrel).toHaveAttribute('aria-pressed', 'true')
    expect(await line.boundingBox()).toEqual(lineAt)
    await expect(table.primary()).toHaveText('Take saltpeter, sulfur (barrel), iron')
    await shot(table.page, 'starting-sulfur')

    await table.press(table.undo())
    await expect(picked('Iron')).toHaveCount(0)
    await table.press(table.undo())
    await expect(picked('Food')).toHaveCount(1)
    await table.press(table.undo())
    await expect(picked('Food')).toHaveCount(0)
    await expect(toBarrel).toHaveAttribute('aria-pressed', 'true')
    await table.press(table.undo())
    await expect(keep).toHaveAttribute('aria-pressed', 'true')
    await table.press(table.undo())
    await expect(picked('Sulfur')).toHaveCount(0)
    await expect(line).toHaveCount(0)
    await expect(picked('Saltpeter')).toHaveCount(1)

    await table.press(table.rowStarting('Sulfur'))
    await table.press(table.rowStarting('Food'))
    await table.press(toBarrel)
    const flights = await table.flightsOf(() => table.press(table.primary()))
    expect(flights).toEqual(['goods: food', 'goods: saltpeter', 'goods: sulfur'])
    const panel = await table.seatPanel('p1')
    await expect(panel.locator('[data-barrel]')).toHaveAttribute('data-barrel', '1')
    await table.closeSeatPanel()
    await expect(table.waitingLine()).toHaveText('Bram chooses starting goods')
})

scenario('S2 R-1.4.9 PlaceStartingPawn, either order', 'setup-pawn', async (table) => {
    const knight = table.rowIn('characters', 'Knight, master')

    await expect(knight).toHaveAttribute('aria-label', 'Knight, master')
    await expect(knight.locator('[data-die="knight"] [data-badge]')).toHaveText('M')
    await expect(knight.locator('[data-die-caption]')).toHaveText('Knight')
    // The six dice stand in one row, at either width, their previews beneath them on a phone.
    const rows = await table
        .panel()
        .locator('[data-rows="characters"] [data-die]')
        .evaluateAll(
            (dice) => new Set(dice.map((die) => Math.round(die.getBoundingClientRect().top))).size
        )
    expect(rows).toBe(1)
    await table.press(knight)
    await expect(table.panel().locator('[data-row="Knight, master"][data-picked]')).toHaveCount(1)
    expect(Object.keys(await table.litChips()).sort()).toEqual(StartingSpaces)
    expect(await table.mapDims()).toBe(true)

    await table.press(table.undo())
    await expect(table.panel().locator('[data-row="Knight, master"][data-picked]')).toHaveCount(0)

    await table.press(knight)
    const flights = await table.flightsOf(() => table.pressPick('space:space.desert.3'))
    expect(flights).toEqual(["markers: Ana's influence marker", "pawns: Ana's knight pawn"])
    await expect(table.waitingLine()).toHaveText('Bram places a starting pawn')
    expect(await table.piecesNamed('rank:')).toEqual(['rank:guild.knight.track.master'])

    await table.showSeat('p2')
    await table.pressPick('space:space.forest.2')
    await expect(table.popup()).toBeVisible()
    await expect(table.panel().getByText('Choose who stands here')).toBeVisible()
    await expect(table.popup().locator('[data-popup-dice] [data-die]')).toHaveCount(6)
    await expect(table.popup().locator('[data-row="Knight, journeyman"] [data-badge]')).toHaveText(
        'J'
    )
    await table.press(table.undo())
    await expect(table.popup()).toHaveCount(0)
    await table.pressPick('space:space.forest.2')
    await table.press(table.popupRow('Knight, journeyman'))
    await expect(table.waitingLine()).toHaveText('Cleo places a starting pawn')
})

scenario('S3 R-4.5 Rank badges follow the tracks', 'setup-third-knight', async (table) => {
    const knight = table.panel().locator('[data-rows="characters"] [data-row^="Knight, "]')
    await expect(knight).toHaveAttribute('data-row', 'Knight, apprentice')
    await expect(knight.locator('[data-badge]')).toHaveText('A')
    await table.press(table.rowIn('characters', 'Knight, apprentice'))
    await expect(knight.locator('[data-badge]')).toHaveText('A')
    await table.pressPick('space:space.forest.2')
    await table.showSeat('p4')
    await expect(knight).toHaveAttribute('data-row', 'Knight, no rank')
    await expect(knight.locator('[data-badge]')).toHaveText('–')
})
