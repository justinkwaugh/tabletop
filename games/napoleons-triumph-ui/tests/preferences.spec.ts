import { expect, test } from '@playwright/test'
import { createGame, deployBothArmies, failOnPageErrors, openMapMenu } from './table.js'

failOnPageErrors()

test('the darker borders switch is kept for the player across a reload and into another game', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await openMapMenu(page)
    const darker = page.getByRole('button', { name: 'Darker borders' })
    await expect(darker).toHaveAttribute('aria-pressed', 'false')
    await darker.click()
    await expect(darker).toHaveAttribute('aria-pressed', 'true')
    await expect
        .poll(() => page.evaluate(() => JSON.stringify({ ...localStorage })))
        .toContain('darkBorders')

    await page.reload()
    await page.getByRole('button', { name: 'Games' }).click()
    await page.getByRole('button', { name: 'Austerlitz' }).click()
    await openMapMenu(page)
    await expect(darker).toHaveAttribute('aria-pressed', 'true')

    await createGame(page)
    await openMapMenu(page)
    await expect(darker).toHaveAttribute('aria-pressed', 'true')
    await darker.click()
    await expect(darker).toHaveAttribute('aria-pressed', 'false')
})
