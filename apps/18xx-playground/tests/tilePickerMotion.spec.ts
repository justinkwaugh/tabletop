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

test('1889 accepted upgrade stays on the map while the lay publishes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 })
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption('construction')
    const hex = page.locator('g[data-map-location="E2"]').first()
    const before = await hex.evaluate((node) => node.querySelectorAll('path').length)
    await hex.click({ force: true })
    await page.locator('[data-map-tile-choice]').first().click()
    await expect(page.locator('.picker')).toHaveAttribute('data-track-motion', 'false')
    const preview = await hex.evaluate((node) => node.querySelectorAll('path').length)
    expect(preview).not.toBe(before)
    await hex.evaluate((node) => {
        const seen: number[] = []
        Object.assign(window, { seenPathCounts: seen })
        new MutationObserver(() => {
            const current = document.querySelector('g[data-map-location="E2"]')
            seen.push(current?.querySelectorAll('path').length ?? 0)
        }).observe(node.ownerSVGElement!, { subtree: true, childList: true, attributes: true })
    })
    await page.getByRole('button', { name: 'Accept track lay', exact: true }).click()
    await expect(page.locator('.picker')).toHaveCount(0)
    await expect(hex).toHaveAttribute('data-placed', 'true')
    const seen = await page.evaluate(
        () => (window as unknown as { seenPathCounts: number[] }).seenPathCounts
    )
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.filter((count) => count !== preview)).toEqual([])
})
