import { expect, test } from '@playwright/test'

test('search preserves variants, rotation and style are local, and paths can be inspected', async ({
    page
}) => {
    await page.goto('/')
    const viewer = page.getByRole('region', { name: 'Tile library', exact: true })
    await viewer.getByLabel('Find a tile').fill('611')
    await expect(viewer.getByRole('button', { name: /^Inspect 611/ })).toHaveCount(2)
    await viewer.getByRole('button', { name: 'Inspect 611, 1832', exact: true }).click()
    const detail = viewer.getByRole('complementary', { name: 'Tile inspection' })
    await expect(detail.locator('[data-tile-label]')).toHaveText('Y')
    const basePath = await detail.locator('[data-path-id] path').first().getAttribute('d')
    await viewer.getByRole('button', { name: 'Rotate clockwise', exact: true }).click()
    await expect(viewer.getByLabel('Rotation', { exact: true })).toHaveText('60°')
    await expect(detail.locator('[data-path-id] path').first()).not.toHaveAttribute('d', basePath!)
    const rotatedPath = await detail.locator('[data-path-id] path').first().getAttribute('d')
    await viewer.getByLabel('Tile style').selectOption({ label: 'Muted' })
    await expect(detail.locator('[data-path-id] path').first()).toHaveAttribute('d', rotatedPath!)
    await viewer.getByRole('button', { name: /^1: edge/ }).click()
    await expect(detail.locator('[data-highlight-path]')).toHaveCount(1)
    await viewer.getByRole('button', { name: 'Reset', exact: true }).click()
    await expect(detail.locator('[data-highlight-path]')).toHaveCount(0)
    await expect(viewer.getByLabel('Rotation', { exact: true })).toHaveText('0°')
    await viewer.getByLabel('Find a tile').fill('no such tile')
    await expect(detail).toContainText('No matching tiles')
    await viewer.getByRole('button', { name: 'Clear filters' }).click()
    await expect(viewer.getByRole('button', { name: /^Inspect / })).toHaveCount(84)
})

test('title collections show independent full inventories and beginner extras', async ({
    page
}) => {
    await page.goto('/')
    const viewer = page.getByRole('region', { name: 'Tile library', exact: true })
    await page.getByLabel('Browse a collection').selectOption('The Old Prince 1871')
    await expect(viewer.getByRole('button', { name: /^Inspect / })).toHaveCount(58)
    await viewer.getByRole('button', { name: 'Inspect 8, Shared 18xx', exact: true }).click()
    await expect(viewer.getByRole('complementary').locator('[data-tile-inventory]')).toHaveText(
        '25 of 25 available'
    )
    await page.getByLabel('Browse a collection').selectOption('Shikoku 1889')
    await expect(viewer.getByRole('button', { name: /^Inspect / })).toHaveCount(40)
    await viewer.getByRole('button', { name: 'Inspect 8, Shared 18xx', exact: true }).click()
    await expect(viewer.getByRole('complementary').locator('[data-tile-inventory]')).toHaveText(
        '5 of 5 available'
    )
    await page.getByLabel('Browse a collection').selectOption('Shikoku 1889 beginner')
    await viewer.getByRole('button', { name: 'Inspect 57, Shared 18xx', exact: true }).click()
    await expect(viewer.getByRole('complementary').locator('[data-tile-inventory]')).toHaveText(
        '3 of 3 available'
    )
    await viewer.getByRole('button', { name: 'Inspect 437, Shared 18xx', exact: true }).click()
    await expect(
        viewer.getByRole('complementary').locator('[data-tile-symbol="port"]')
    ).toHaveCount(1)
})

test('mobile browsing supports keyboard selection with no horizontal overflow', async ({
    page
}) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const viewer = page.getByRole('region', { name: 'Tile library', exact: true })
    await viewer.getByLabel('Find a tile').fill('PEI')
    const card = viewer.getByRole('button', {
        name: 'Inspect PEI15, The Old Prince 1871',
        exact: true
    })
    await card.focus()
    await page.keyboard.press('Enter')
    await expect(viewer.locator('h3')).toHaveText('PEI15')
    await viewer.getByLabel('Hex orientation').selectOption({ label: 'Pointy top' })
    await expect(viewer.getByRole('complementary').locator('[data-tile-label]')).toHaveText('CX')
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
})

test('all rotation examples have finite SVG paths, correct token capacity, and independent overlays', async ({
    page
}) => {
    await page.goto('/specimens')
    for (const orientation of ['Flat top', 'Pointy top']) {
        await page.getByLabel('Hex orientation').selectOption({ label: orientation })
        for (const style of ['Classic', 'Muted']) {
            await page.getByLabel('Tile style').selectOption({ label: style })
            const geometry = await page
                .locator('[data-path-id] path')
                .evaluateAll((elements) =>
                    elements.every(
                        (element) =>
                            element instanceof SVGPathElement &&
                            element.getTotalLength() > 0 &&
                            !/NaN|undefined|Infinity/.test(element.getAttribute('d') ?? '')
                    )
                )
            expect(geometry).toBe(true)
            const overflowingText = await page.locator('.rotations svg').evaluateAll((elements) =>
                elements.flatMap((svg) => {
                    if (!(svg instanceof SVGSVGElement)) throw new Error('Expected a tile SVG')
                    const polygon = svg.querySelector('polygon')
                    const transform = svg.getCTM()
                    if (!polygon || !transform) throw new Error('Missing tile geometry')
                    const vertices = Array.from(polygon.points)
                    return Array.from(svg.querySelectorAll('text')).flatMap((text) => {
                        const textTransform = text.getCTM()
                        if (!textTransform) throw new Error('Missing annotation transform')
                        const matrix = transform.inverse().multiply(textTransform)
                        const bounds = text.getBBox()
                        const corners = [
                            [bounds.x, bounds.y],
                            [bounds.x + bounds.width, bounds.y],
                            [bounds.x + bounds.width, bounds.y + bounds.height],
                            [bounds.x, bounds.y + bounds.height]
                        ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix))
                        const outside = corners.some((point) =>
                            vertices.some((a, index) => {
                                const b = vertices[(index + 1) % vertices.length]
                                return (
                                    (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) <
                                    -1
                                )
                            })
                        )
                        return outside
                            ? [`${svg.getAttribute('aria-label')}: ${text.textContent}`]
                            : []
                    })
                })
            )
            expect(overflowingText).toEqual([])
            const obscuredLabels = await page.locator('.rotations svg').evaluateAll((elements) =>
                elements.flatMap((svg) => {
                    const label = svg.querySelector('[data-tile-label]')
                    if (!label) return []
                    const bounds = label.getBoundingClientRect()
                    const overlaps = Array.from(
                        svg.querySelectorAll('[data-station-slot], [data-revenue-for] > circle')
                    ).some((element) => {
                        const circle = element.getBoundingClientRect()
                        const x = circle.x + circle.width / 2
                        const y = circle.y + circle.height / 2
                        return (
                            Math.hypot(
                                x - Math.max(bounds.left, Math.min(x, bounds.right)),
                                y - Math.max(bounds.top, Math.min(y, bounds.bottom))
                            ) <
                            circle.width / 2
                        )
                    })
                    return overlaps ? [svg.getAttribute('aria-label')] : []
                })
            )
            expect(obscuredLabels).toEqual([])
            await expect(
                page
                    .getByRole('region', { name: 'the-old-prince:PEI15', exact: true })
                    .locator('[data-station-slot]')
            ).toHaveCount(18)
            await expect(
                page.getByRole('region', { name: '18xx:16', exact: true }).locator('[data-node-id]')
            ).toHaveCount(0)
        }
    }
    await expect(page.locator('[data-example-route]')).toHaveCount(1)
    await expect(page.locator('[data-example-token]')).toHaveCount(1)
})
