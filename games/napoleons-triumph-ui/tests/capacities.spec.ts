import { expect, test } from '@playwright/test'
import { createGame, deployBothArmies, failOnPageErrors, openMapMenu } from './table.js'

failOnPageErrors()

test('a capacity the pieces cover is shown beside them, and every capacity with the switch on', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    const tags = page.locator('[data-capacity-tag]')
    await expect(tags).not.toHaveCount(0)
    const covered = await tags.count()
    expect(covered).toBeLessThan(40)
    await expect(page.locator('[data-capacity-tag]:not([data-moved])')).toHaveCount(0)

    await openMapMenu(page)
    await page.getByRole('button', { name: 'Locale capacities' }).click()
    await expect(tags).toHaveCount(168)
    expect(await page.locator('[data-capacity-tag][data-moved]').count()).toBeGreaterThanOrEqual(
        covered
    )

    await page.getByRole('button', { name: 'Locale capacities' }).click()
    await expect(tags).toHaveCount(covered)
})

test('hiding the units clears the pieces from the map and puts the capacities they covered back on their boxes, until a reload', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    const pieces = page.locator('[data-group]')
    const tags = page.locator('[data-capacity-tag]')
    await expect(pieces.first()).toBeVisible()
    await expect(tags).not.toHaveCount(0)

    await openMapMenu(page)
    const hide = page.getByRole('button', { name: 'Hide units' })
    await hide.click()
    await expect(hide).toHaveAttribute('aria-pressed', 'true')
    await expect(pieces.first()).toBeHidden()
    await expect(tags).toHaveCount(0)

    await page.reload()
    await page.getByRole('button', { name: 'Games' }).click()
    await page.getByRole('button', { name: 'Austerlitz' }).click()
    await expect(pieces.first()).toBeVisible()
    await openMapMenu(page)
    await expect(hide).toHaveAttribute('aria-pressed', 'false')
})
