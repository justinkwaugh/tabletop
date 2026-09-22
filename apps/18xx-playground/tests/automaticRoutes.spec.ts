import { expect, test } from '@playwright/test'

for (const [title, revenue, paths] of [
    ['TOP', 70, 5],
    ['1889', 90, 4]
] as const) {
    test(`${title} previews automatic routes, commits once, and recomputes after Undo`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/table')
        await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('routes')
        const panel = page.getByRole('region', { name: 'Run trains', exact: true })
        const run = panel.getByRole('button', { name: 'Run trains', exact: true })
        const undo = page.getByRole('button', { name: 'Undo', exact: true })
        await expect(run).toBeEnabled()
        await expect(panel.getByRole('row', { name: /Total/ }).getByRole('cell')).toHaveText(
            `${title === 'TOP' ? '$' : '¥'}${revenue}`
        )
        await expect(panel.locator('[data-route-train]')).toHaveCount(2)
        await expect(page.locator('[data-map-route]')).toHaveCount(paths)
        await expect(undo).toBeDisabled()
        await run.click()
        await expect(panel).toHaveCount(0)
        await expect(page.locator('[data-map-route]')).toHaveCount(paths)
        await page.reload()
        await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('routes')
        await expect(page.locator('[data-map-route]')).toHaveCount(paths)
        await expect(panel).toHaveCount(0)
        await undo.click()
        await expect(run).toBeEnabled()
        await expect(panel.getByRole('row', { name: /Total/ }).getByRole('cell')).toHaveText(
            `${title === 'TOP' ? '$' : '¥'}${revenue}`
        )
        await expect(undo).toBeDisabled()
        await expect(page.locator('[data-map-route]')).toHaveCount(paths)
        expect(errors).toEqual([])
    })
}

test('leaving a running search discards its result', async ({ page }) => {
    await page.route('**/*.wasm*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 600))
        await route.continue().catch(() => {})
    })
    await page.goto('/table')
    await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
    await page.getByLabel('Position', { exact: true }).selectOption('routes')
    await expect(page.getByRole('status').filter({ hasText: 'Calculating routes' })).toBeVisible()
    await page.getByLabel('Position', { exact: true }).selectOption('construction')
    await expect(page.getByRole('region', { name: 'Run trains', exact: true })).toHaveCount(0)
    await expect(page.locator('[data-map-route]')).toHaveCount(0)
    await page.getByLabel('Position', { exact: true }).selectOption('routes')
    await expect(page.getByRole('button', { name: 'Run trains', exact: true })).toBeEnabled()
    await expect(
        page
            .getByRole('table', { name: 'Train income' })
            .getByRole('row', { name: /Total/ })
            .getByRole('cell')
    ).toHaveText('$70')
})

test('a failed solver load offers a working retry', async ({ page }) => {
    let fail = true
    await page.route('**/*.wasm*', async (route) => {
        if (fail) {
            fail = false
            await route.abort()
        } else await route.continue()
    })
    await page.goto('/table')
    await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
    await page.getByLabel('Position', { exact: true }).selectOption('routes')
    const panel = page.getByRole('region', { name: 'Run trains', exact: true })
    await expect(panel.getByRole('alert')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Run trains', exact: true })).toHaveCount(0)
    await panel.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Run trains', exact: true })).toBeEnabled()
    await expect(panel.getByRole('row', { name: /Total/ }).getByRole('cell')).toHaveText('$70')
})
