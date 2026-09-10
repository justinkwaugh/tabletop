import { expect, test } from '@playwright/test'
for (const title of ['TOP', '1889']) {
    test(`${title} drafts a route set, rejects overlap, and restores results through history, reload and Undo`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/economy')
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('routes')
        const panel = page.getByRole('region', { name: 'Train routes', exact: true })
        const map = page.getByRole('region', { name: 'Game map', exact: true })
        const home = title === 'TOP' ? 'L16' : 'E2'
        const first =
            title === 'TOP'
                ? [
                      ['L16', 'edge-1'],
                      ['K17', 'path-0'],
                      ['K19', 'edge-2']
                  ]
                : [
                      ['E2', 'edge-1'],
                      ['F3', 'edge-0']
                  ]
        const second =
            title === 'TOP'
                ? [
                      ['L16', 'edge-5'],
                      ['M17', 'town-edge-2']
                  ]
                : [
                      ['E2', 'edge-0'],
                      ['F1', 'edge-1']
                  ]
        const trainButtons = panel.getByRole('button', { name: /^Run / })
        async function draft(index: number, paths: string[][]) {
            await trainButtons.nth(index).click()
            if (index === 1)
                await map
                    .getByRole('button', { name: `${home} city slot 1`, exact: true })
                    .press('Enter')
            else
                await panel
                    .getByLabel('Starting revenue center')
                    .selectOption(JSON.stringify({ locationId: home, nodeId: 'city' }))
            for (const [pathIndex, [location, path]] of paths.entries()) {
                if (index === 1 && pathIndex === 0) {
                    const hit = map.getByRole('button', {
                        name: `${location} path ${path}`,
                        exact: true
                    })
                    await hit.scrollIntoViewIfNeeded()
                    const point = await hit.evaluate((element) => {
                        if (!(element instanceof SVGPathElement))
                            throw new Error('Expected track path')
                        const matrix = element.getScreenCTM()
                        if (!matrix) throw new Error('Expected visible track')
                        const point = element
                            .getPointAtLength(element.getTotalLength() / 2)
                            .matrixTransform(matrix)
                        return { x: point.x, y: point.y }
                    })
                    await page.mouse.click(point.x, point.y)
                } else
                    await panel
                        .getByRole('button', { name: `Add ${location} ${path}`, exact: true })
                        .click()
            }
        }
        await draft(0, first)
        await expect(panel.getByLabel('Route draft')).toContainText('Revenue: $40')
        await expect(
            map.getByRole('status', { name: '' }).filter({ hasText: 'Live ·' })
        ).toHaveText('Live · 0 actions')
        await expect(map.locator('[data-map-route="route-draft"]')).toHaveCount(first.length)
        await panel.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(panel.getByRole('button', { name: 'Save route', exact: true })).toBeDisabled()
        await panel.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(panel.getByLabel('Route draft')).toHaveCount(0)
        await draft(0, first)
        await panel.getByRole('button', { name: 'Save route', exact: true }).click()
        await draft(1, first)
        await expect(panel.getByRole('alert')).toContainText('share track')
        await panel.getByRole('button', { name: 'Save route', exact: true }).click()
        await expect(
            panel.getByRole('button', { name: 'Confirm routes', exact: true })
        ).toBeDisabled()
        await panel.getByRole('button', { name: 'Remove route', exact: true }).last().click()
        await draft(1, second)
        await panel.getByRole('button', { name: 'Save route', exact: true }).click()
        const total = title === 'TOP' ? 70 : 90
        await expect(panel).toContainText(`Revenue: $${total}`)
        await panel.getByRole('button', { name: 'Confirm routes', exact: true }).click()
        await expect(
            panel.getByRole('button', { name: 'Confirm routes', exact: true })
        ).toHaveCount(0)
        await expect(panel.locator('[data-route-train]')).toHaveCount(2)
        await expect(panel).toContainText(`Revenue: $${total}`)
        await map.getByRole('button', { name: 'Beginning', exact: true }).click()
        await expect(panel.locator('[data-route-train]')).toHaveCount(0)
        await expect(
            panel.getByRole('button', { name: 'Confirm routes', exact: true })
        ).toBeDisabled()
        await map.getByRole('button', { name: 'Live', exact: true }).click()
        await expect(panel.locator('[data-route-train]')).toHaveCount(2)
        await page.reload()
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('routes')
        await expect(panel).toContainText(`Revenue: $${total}`)
        await panel.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(panel.locator('[data-route-train]')).toHaveCount(0)
        await expect(
            panel.getByRole('button', { name: 'Confirm routes', exact: true })
        ).toBeEnabled()
        expect(errors).toEqual([])
    })
}
