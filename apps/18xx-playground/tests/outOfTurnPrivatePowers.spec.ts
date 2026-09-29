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
    await expect(
        powers.getByRole('button', { name: 'Exchange Dôgo Railway for Iyo Railway' })
    ).toHaveCount(0)

    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(turn).toHaveText(['Blair'])
    await expect(card).toContainText('Dôgo Railway')
    await card.getByRole('button', { name: 'Exchange Dôgo Railway for Iyo Railway' }).click()
    await expect(turn).toHaveText(['Alex'])
})

test('1889 Mitsubishi’s owner requests a pause and gets the window only before a rival company', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 950 })
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption('transfers')
    const turn = page.locator('.player-name')
    await expect(turn).toHaveText(['Blair'])
    const powers = page.getByRole('group', { name: 'Private powers' })
    const request = powers.getByRole('button', {
        name: 'Pause before the next company for Casey'
    })
    await expect(request).toHaveAttribute('aria-pressed', 'false')
    await request.click()
    await expect(request).toHaveAttribute('aria-pressed', 'true')
    await request.click()
    await expect(request).toHaveAttribute('aria-pressed', 'false')
    await request.click()
    await expect(request).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'finish', exact: true }).click()
    await expect(turn).toHaveText(['Casey'])
    await page.getByRole('button', { name: 'Continue operating round' }).click()
    await expect(turn).not.toHaveText(['Casey'])
    await expect(request).toHaveAttribute('aria-pressed', 'false')
})

test('1889 Mitsubishi’s owner places the port off-turn during a stock round', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 })
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    const turn = page.locator('.player-name')
    await expect(turn.first()).toBeVisible()
    const before = await turn.allTextContents()
    expect(before).not.toContain('Casey')
    const powers = page.getByRole('group', { name: 'Private powers' })
    await powers.getByRole('button', { name: 'Use Mitsubishi Ferry' }).click()
    await expect(powers).toContainText('Choose a location on the map')
    await page.locator('[data-map-location="B11"]').click()
    await page.getByRole('button', { name: 'Accept track lay', exact: true }).click()
    await expect(page.locator('[data-map-location="B11"]')).toHaveAttribute('data-placed', 'true')
    await expect(turn).toHaveText(before)
    await expect(powers.getByRole('button', { name: 'Use Mitsubishi Ferry' })).toHaveCount(0)
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.getByRole('list', { name: 'Action history' })).toContainText(
        'Casey laid track at B11 with Mitsubishi Ferry'
    )
})
