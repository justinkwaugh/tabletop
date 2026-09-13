import { expect, test } from '@playwright/test'

test('round dividers split, dock, rejoin, and scroll independently of game state', async ({
    page
}) => {
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await expect(page.getByText('Winner: Player 2', { exact: true })).toBeVisible({
        timeout: 30000
    })
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const headers = page.getByRole('navigation', { name: 'History rounds' })
    const later = headers.getByRole('button', { name: 'Scroll to OR 8.3', exact: true })
    const earlier = headers.getByRole('button', { name: 'Scroll to OR 8.2', exact: true })
    const y = async (locator: typeof later) => (await locator.boundingBox())!.y
    await expect.poll(async () => Math.abs((await y(later)) - (await y(earlier)))).toBeLessThan(1)
    const stock = headers.getByRole('button', { name: 'Scroll to SR 8', exact: true })
    await expect.poll(async () => Math.abs((await y(later)) - (await y(stock)))).toBeLessThan(1)
    expect((await stock.boundingBox())!.height).toBe(20)
    await later.hover()
    await page.mouse.wheel(0, 80)
    await expect
        .poll(() => page.locator('.history-scroll').evaluate((e) => e.scrollTop))
        .toBeGreaterThan(0)
    await later.click()
    await expect
        .poll(async () =>
            Math.abs(
                (await page.locator('[data-round-marker="OR 8.3"]').boundingBox())!.y -
                    (await y(later))
            )
        )
        .toBeLessThan(1)
    await page
        .locator('.history-scroll')
        .evaluate((e) => e.scrollTo({ top: e.scrollTop + 100, behavior: 'instant' }))
    await expect.poll(async () => (await y(earlier)) - (await y(later))).toBeGreaterThan(50)
    await headers.getByRole('button', { name: 'Scroll to SR 8', exact: true }).click()
    await expect.poll(async () => Math.abs((await y(later)) - (await y(earlier)))).toBeLessThan(1)
    await headers.getByRole('button', { name: 'Scroll to OR 7.1', exact: true }).click()
    await expect(page.getByText('Winner: Player 2', { exact: true })).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 850 })
    const viewport = await page.locator('.history-scroll').boundingBox()
    for (const button of await headers.getByRole('button').all()) {
        const bounds = (await button.boundingBox())!
        expect(bounds.y).toBeGreaterThanOrEqual(viewport!.y - 1)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport!.y + viewport!.height + 1)
    }
    await page
        .locator('.history-scroll')
        .evaluate((e) => e.scrollTo({ top: 0, behavior: 'instant' }))
    await expect.poll(async () => Math.abs((await y(later)) - (await y(earlier)))).toBeLessThan(1)
    expect(errors).toEqual([])
})
