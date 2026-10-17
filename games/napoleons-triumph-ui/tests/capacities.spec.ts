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
