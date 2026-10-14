import { expect, test } from '@playwright/test'
import {
    createGame,
    deployBothArmies,
    failOnPageErrors,
    openMapMenu,
    pickUp,
    tap,
    retreat
} from './table.js'

failOnPageErrors()

test('the map menu shows the moves of the turn in progress as arrows on the board', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await openMapMenu(page)
    const trails = page.locator('svg[data-board] [data-movement-trails] .nt-way-arrow')
    const numbers = page.locator('svg[data-board] [data-movement-trails] text')
    const shown = page.getByRole('button', { name: 'Moves this turn' })
    await pickUp(page, 'langeron')
    await tap(page, '[aria-label="Move to locale 94"]')
    await expect(shown).toHaveAttribute('aria-pressed', 'false')
    await expect(trails).toHaveCount(0)

    await shown.click()
    await expect(shown).toHaveAttribute('aria-pressed', 'true')
    await expect(trails).toHaveCount(1)
    await expect(numbers).toHaveText(['1'])

    await page.getByRole('button', { name: 'End turn' }).click()
    await expect(trails).toHaveCount(0)

    await pickUp(page, 'st-hilaire')
    await tap(page, '[aria-label="Threaten an attack across this approach"]')
    await page.getByRole('button', { name: 'Retreat before combat' }).click()
    await retreat(page)
    await expect(trails).toHaveCount(1)
    await page.getByRole('button', { name: 'Move into the locale' }).click()
    await expect(trails).toHaveCount(2)
    await expect(numbers).toHaveText(['1', '2'])

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(trails).toHaveCount(1)

    await shown.click()
    await expect(trails).toHaveCount(0)
})
