import { expect, test } from '@playwright/test'

test('1889 tile choices keep animating after switching construction locations', async ({
    page
}) => {
    await page.setViewportSize({ width: 1440, height: 950 })
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption('construction')
    const choices = page.locator('.tile-choice')
    for (const location of ['D3', 'E4', 'D3']) {
        await page.locator(`[data-map-location="${location}"]`).first().click({ force: true })
        await expect(choices.first()).toBeVisible()
        await expect
            .poll(() =>
                choices.evaluateAll((nodes) =>
                    nodes.every((node) => node.getAnimations().length === 0)
                )
            )
            .toBe(true)
    }
    await page.locator('[data-map-location="E4"]').first().click({ force: true })
    const collapsing = await choices.evaluateAll(
        (nodes) => nodes.filter((node) => node.getAnimations().length === 2).length
    )
    expect(collapsing).toBeGreaterThan(0)
    await expect
        .poll(() =>
            choices.evaluateAll((nodes) => nodes.every((node) => node.getAnimations().length === 0))
        )
        .toBe(true)
    await page.locator('[data-map-tile-choice]').first().click()
    expect(
        await page.locator('.tile-choice.chosen').evaluate((node) => node.getAnimations().length)
    ).toBeGreaterThan(0)
})
