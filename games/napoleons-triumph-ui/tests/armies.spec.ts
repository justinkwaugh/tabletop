import { expect, test } from '@playwright/test'
import { createGame, deployBothArmies, failOnPageErrors } from './table.js'

failOnPageErrors()

test('the armies panel lists the viewing player’s own army first', async ({ page }) => {
    await createGame(page)
    await deployBothArmies(page)
    const armies = page.locator('section.nt-army')

    await expect(page.getByText('Allies’ turn')).toBeVisible()
    await expect(armies.first()).toContainText('Allied Army')

    await page.getByRole('button', { name: 'End turn' }).click()
    await expect(page.getByText('French turn')).toBeVisible()
    await expect(armies.first()).toContainText('Grande Armée')
})
