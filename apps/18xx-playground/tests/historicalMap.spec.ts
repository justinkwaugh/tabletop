import { expect, test, type Page } from '@playwright/test'

const viewer = (page: Page) => page.getByRole('dialog', { name: 'Historical map' })
const tableTiles = (page: Page) =>
    page.locator('[data-map-location][data-placed="true"]:not([aria-label="Historical map"] *)')
const open = (page: Page, label: RegExp) =>
    page
        .getByRole('button', { name: label })
        .last()
        .evaluate((element: HTMLButtonElement) => element.click())

test('finished-game map inspection shows past track and routes without changing the table', async ({
    page
}) => {
    test.setTimeout(90000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
    await page.getByLabel('Position', { exact: true }).selectOption('finished')
    await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const header = page.locator('header[aria-label="Game phase"]')
    const currentHeader = await header.innerText()
    await expect.poll(() => tableTiles(page).count()).toBeGreaterThan(0)
    const currentTiles = await tableTiles(page).count()
    await expect(page.locator('[data-map-route]')).toHaveCount(0)

    await open(page, /Preview historical map: Laid track/)
    await expect(viewer(page)).toBeVisible()
    await expect(viewer(page).locator('header')).toContainText('Historical track lay')
    const pastTiles = await viewer(page).locator('[data-map-location][data-placed="true"]').count()
    expect(pastTiles).toBeGreaterThan(0)
    expect(pastTiles).toBeLessThanOrEqual(currentTiles)
    await expect(viewer(page).locator('[data-map-location][tabindex="0"]')).toHaveCount(0)
    await expect(viewer(page).locator('[data-map-layer="unavailable"]')).toHaveCount(0)
    await expect(viewer(page).locator('[data-map-route]')).toHaveCount(0)
    await expect(tableTiles(page)).toHaveCount(currentTiles)
    await expect(header).toHaveText(currentHeader, { useInnerText: true })
    await viewer(page).getByRole('button', { name: 'Close', exact: true }).click()
    await expect(viewer(page)).toHaveCount(0)
    await expect(tableTiles(page)).toHaveCount(currentTiles)

    await open(page, /Preview historical map: Ran/)
    await expect(viewer(page)).toBeVisible()
    await expect(viewer(page).locator('header')).toContainText(/Historical run · .+ · OR .+\$\d+/)
    expect(await viewer(page).locator('[data-map-route]').count()).toBeGreaterThan(0)
    await expect(page.locator('[data-map-route]:not([aria-label="Historical map"] *)')).toHaveCount(
        0
    )
    await expect(header).toHaveText(currentHeader, { useInnerText: true })
    await expect
        .poll(async () =>
            viewer(page).evaluate((dialog) => {
                const viewport = dialog.querySelector('.map')!.getBoundingClientRect()
                return [...dialog.querySelectorAll('[data-map-route]')].every((route) => {
                    const bounds = route.getBoundingClientRect()
                    return (
                        bounds.top >= viewport.top &&
                        bounds.bottom <= viewport.bottom &&
                        bounds.left >= viewport.left &&
                        bounds.right <= viewport.right
                    )
                })
            })
        )
        .toBe(true)
    await page.keyboard.press('f')
    await expect(viewer(page)).toHaveCount(0)

    await open(page, /Preview historical map: Ran/)
    await expect(viewer(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(viewer(page)).toHaveCount(0)
    await expect(tableTiles(page)).toHaveCount(currentTiles)
    await expect(header).toHaveText(currentHeader, { useInnerText: true })
    expect(errors).toEqual([])
})

for (const title of ['TOP', '1889'] as const) {
    test(`${title} closes the map viewer when the live state changes beneath it`, async ({
        page
    }) => {
        await page.goto('/table')
        await page.getByRole('tab', { name: 'Map', exact: true }).waitFor()
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('routes')
        const run = page.getByRole('button', { name: 'Run trains', exact: true })
        await expect(run).toBeEnabled()
        await run.click()
        await page.getByRole('tab', { name: 'History', exact: true }).click()
        await open(page, /Preview historical map: Ran/)
        await expect(viewer(page)).toBeVisible()
        await page
            .getByRole('button', { name: 'Undo', exact: true })
            .first()
            .evaluate((element: HTMLButtonElement) => element.click())
        await expect(viewer(page)).toHaveCount(0)
        await page.getByRole('tab', { name: 'Map', exact: true }).click()
        await expect(run).toBeEnabled()
    })
}
