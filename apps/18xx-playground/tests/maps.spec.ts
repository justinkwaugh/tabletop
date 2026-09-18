import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
    test(`map selection and overlays survive fit, zoom, and pan at ${width}px`, async ({
        page
    }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/maps')
        await expect(page.locator('[data-map-location]')).toHaveCount(110)
        const viewport = page.getByRole('region', { name: 'Map viewport' })
        const scene = page.locator('.map-scene')
        await expect
            .poll(async () => {
                const outer = await viewport.boundingBox(),
                    inner = await scene.boundingBox()
                return (
                    !!outer &&
                    !!inner &&
                    inner.width <= outer.width + 1 &&
                    inner.height <= outer.height + 1
                )
            })
            .toBe(true)
        await page.getByRole('combobox').first().selectOption('1889')
        await expect(page.locator('[data-map-location]')).toHaveCount(52)
        await page.getByLabel('Show sample tile, token & route').check()
        await expect(page.locator('[data-map-token]')).toHaveCount(1)
        await expect(page.locator('[data-map-route]')).toHaveCount(1)
        const slot = page.getByRole('button', { name: 'I2 city slot 1', exact: true })
        await slot.focus()
        await slot.press('Enter')
        const inspector = page.getByRole('complementary', { name: 'Map inspection' })
        await expect(inspector).toContainText('Marugame')
        await expect(inspector).toContainText('Station space 1')
        await page.getByRole('combobox').nth(1).selectOption({ label: 'Muted' })
        await expect(inspector).toContainText('Station space 1')
        await page.getByRole('button', { name: 'Focus selection' }).click()
        await slot.click()
        const transform = () =>
            scene.evaluate((element) => element.parentElement?.parentElement?.style.transform)
        const before = await transform()
        await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
        await expect.poll(transform).not.toBe(before)
        const rect = await viewport.boundingBox()
        if (!rect) throw new Error('Missing viewport')
        await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
        const zoomed = await transform()
        await page.mouse.wheel(80, 80)
        await expect.poll(transform).not.toBe(zoomed)
        await expect(inspector).toContainText('Marugame')
        await page.getByRole('button', { name: 'Focus selection' }).click()
        await slot.click()
        await expect(inspector).toContainText('Station space 1')
        await page.getByRole('button', { name: 'Fit map' }).click()
        await expect(page.locator('[data-map-token]')).toHaveCount(1)
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            .toBe(true)
        await page.getByLabel('Show sample tile, token & route').uncheck()
        await expect(inspector).toContainText('Select a hex')
        await expect(page.locator('[data-map-token]')).toHaveCount(0)
    })
}

test('map inspection exposes terrain, future labels, and edge stations', async ({ page }) => {
    await page.goto('/maps')
    const inspector = page.getByRole('complementary', { name: 'Map inspection' })
    const shipyard = page.locator('[data-map-location="G11"]')
    await shipyard.focus()
    await shipyard.press('Enter')
    await expect(inspector).toContainText('station tokens cannot be placed')
    await expect(shipyard.locator('[data-map-slot]')).toHaveCount(0)
    const charlottetown = page.locator('[data-map-location="L16"]')
    await charlottetown.focus()
    await charlottetown.press('Enter')
    await expect(inspector).toContainText('CX from gray')
    await page.getByRole('combobox').first().selectOption('1889')
    const terrain = page.locator('[data-map-location="H5"]')
    await terrain.focus()
    await terrain.press('Enter')
    await expect(inspector).toContainText('water + mountain · 80')
    const path = page.getByRole('button', { name: 'C4 path edge-2', exact: true })
    await path.focus()
    await path.press('Enter')
    await expect(inspector).toContainText('Path: edge-2')
    await expect(page.locator('[data-map-location="C4"] path[stroke="#d52f83"]')).toHaveCount(1)
    const edgeSlot = page.getByRole('button', { name: 'B7 city slot 2', exact: true })
    await edgeSlot.focus()
    await edgeSlot.press('Enter')
    await page.getByRole('button', { name: 'Focus selection' }).click()
    await edgeSlot.click()
    await expect(inspector).toContainText('Uwajima')
    await expect(inspector).toContainText('Station space 2')
})
