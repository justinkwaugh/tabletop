import { expect, test } from '@playwright/test'
import { createGame, deployBothArmies, failOnPageErrors, pickUp, tap } from './table.js'

failOnPageErrors()

const DESTINATION = 94
const BY_ONE_ROAD = 105
const BY_THE_OTHER = 106

test('a corps chooses the road to a place two roads lead to', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    const places = page.locator('svg [aria-label^="March by road to"]')
    const ways = page.locator('svg [data-way]')
    const orders = page.getByRole('group', { name: 'Dokhturov’s corps' })

    await pickUp(page, 'dokhturov')
    await expect(places).not.toHaveCount(0)
    await tap(page, `svg [aria-label^="March by road to"][data-locale="${DESTINATION}"]`)

    await expect(orders).toContainText('More than one road leads there')
    await expect(places).toHaveCount(0)
    await expect(ways).toHaveCount(2)
    await expect(page.locator(`svg [data-way="${BY_ONE_ROAD}"]`)).toBeVisible()
    await expect(page.locator(`svg [data-way="${BY_THE_OTHER}"]`)).toBeVisible()

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(ways).toHaveCount(0)
    await expect(places).not.toHaveCount(0)

    await tap(page, `svg [aria-label^="March by road to"][data-locale="${DESTINATION}"]`)
    await tap(page, `svg [data-way="${BY_ONE_ROAD}"]`)
    await expect(page.getByText(/^Choose a corps/)).toBeVisible()

    await pickUp(page, 'langeron')
    await expect(page.locator('svg [aria-label^="Move to"]')).not.toHaveCount(0)
    await expect(page.locator(`svg [data-locale="${BY_ONE_ROAD}"]`)).toHaveCount(0)
})

const ENTRY_LOCALE = 89

test('reinforcements choose the road they come on by where several meet in a locale', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await page.getByRole('button', { name: 'End turn' }).click()
    await page.getByRole('button', { name: 'Bring on Bernadotte' }).click()
    await tap(page, `svg [aria-label^="March by road to"][data-locale="${ENTRY_LOCALE}"]`)

    await expect(page.getByRole('group', { name: 'Bernadotte’s corps' })).toContainText(
        'More than one road comes on there'
    )
    await expect(page.locator('svg [data-entry]')).toHaveCount(3)

    await tap(page, 'svg [data-entry="F6"]')
    await expect(page.locator('[data-commander="bernadotte"]')).toBeVisible()
    await expect(page.locator('svg [data-entry]')).toHaveCount(0)
})
