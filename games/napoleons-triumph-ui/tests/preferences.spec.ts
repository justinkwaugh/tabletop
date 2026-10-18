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

test('the moves this turn and locale capacities switches are kept for the player across a reload', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)
    await openMapMenu(page)
    const trails = page.getByRole('button', { name: 'Moves this turn' })
    const capacities = page.getByRole('button', { name: 'Locale capacities' })
    await expect(trails).toHaveAttribute('aria-pressed', 'false')
    await expect(capacities).toHaveAttribute('aria-pressed', 'false')
    await trails.click()
    await capacities.click()
    await expect
        .poll(() => page.evaluate(() => JSON.stringify({ ...localStorage })))
        .toContain('localeCapacities')

    await page.reload()
    await page.getByRole('button', { name: 'Games' }).click()
    await page.getByRole('button', { name: 'Austerlitz' }).click()
    await openMapMenu(page)
    await expect(trails).toHaveAttribute('aria-pressed', 'true')
    await expect(capacities).toHaveAttribute('aria-pressed', 'true')
})
