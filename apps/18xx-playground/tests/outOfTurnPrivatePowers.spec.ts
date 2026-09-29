import { expect, test } from '@playwright/test'

test('1889 Dôgo is exchanged off-turn from the player card or the action area, and undone', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 950 })
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption('powers')
    const turn = page.locator('.player-name')
    await expect(turn).toHaveText(['Blair'])

    const powers = page.getByRole('group', { name: 'Private powers' })
    await expect(powers).toContainText('Alex · Dôgo Railway')
    const card = page.getByRole('table', { name: 'Alex private companies' })
    await expect(
        card.getByRole('button', { name: 'Exchange Dôgo Railway for Iyo Railway' })
    ).toBeVisible()

    await powers.getByRole('button', { name: 'Exchange Dôgo Railway for Iyo Railway' }).click()
    await expect(turn).toHaveText(['Alex'])
    await expect(card).not.toContainText('Dôgo Railway')
    await expect(powers).toHaveCount(0)

    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(turn).toHaveText(['Blair'])
    await expect(card).toContainText('Dôgo Railway')
    await card.getByRole('button', { name: 'Exchange Dôgo Railway for Iyo Railway' }).click()
    await expect(turn).toHaveText(['Alex'])
})
