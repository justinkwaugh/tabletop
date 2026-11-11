import { expect, test, type Locator } from '@playwright/test'
import { firstLegalCell, openProtectedGame } from './protectedGame.js'

const SAMPLED_FRAMES = 30

async function discWidthsAfter(cell: Locator, act: () => Promise<void>): Promise<number[]> {
    const frames = cell.evaluate(
        (element, count) =>
            new Promise<number[]>((resolve) => {
                const widths: number[] = []
                const sample = () => {
                    const discs = [...element.querySelectorAll('svg')]
                    widths.push(
                        Math.max(0, ...discs.map((svg) => svg.getBoundingClientRect().width))
                    )
                    if (widths.length < count) requestAnimationFrame(sample)
                    else resolve(widths)
                }
                element.ownerDocument.addEventListener(
                    'click',
                    () => requestAnimationFrame(sample),
                    {
                        once: true,
                        capture: true
                    }
                )
            }),
        SAMPLED_FRAMES
    )
    await act()
    return frames
}

test('a placed disc takes over from its preview without vanishing or growing in', async ({
    page
}) => {
    await openProtectedGame(page)
    const cell = await firstLegalCell(page)
    await cell.hover()
    await expect(cell.locator('svg')).toHaveCount(1)

    const frames = await discWidthsAfter(cell, () => cell.click())

    const placedWidth = frames.at(-1) ?? 0
    for (const width of frames)
        expect(width, JSON.stringify(frames)).toBeGreaterThan(placedWidth * 0.95)
    await expect(page.getByText('placed a disc')).toBeVisible()
})

test('a disc shown by stepping through History still grows in', async ({ page }) => {
    await openProtectedGame(page)
    const cell = await firstLegalCell(page)
    await cell.click()
    await expect(page.getByText('placed a disc')).toBeVisible()
    await page.mouse.move(0, 0)
    await page.getByRole('button', { name: 'step backwards' }).click()
    await expect(cell.locator('svg')).toHaveCount(0)

    const frames = await discWidthsAfter(cell, () =>
        page.getByRole('button', { name: 'step forwards' }).click()
    )

    const placedWidth = Math.max(...frames)
    const firstShown = frames.find((width) => width > 0)
    expect(firstShown, JSON.stringify(frames)).toBeLessThan(placedWidth * 0.5)
})

test('stepping back through History marks the square of the piece just placed', async ({
    page
}) => {
    await openProtectedGame(page)
    const first = await firstLegalCell(page)
    await first.click()
    await expect(page.getByText('placed a disc')).toBeVisible()
    const second = await firstLegalCell(page)
    await second.click()
    await page.mouse.move(0, 0)
    const marked = page.locator('.land .cell:has(.target.hover)')
    await expect(marked).toHaveCount(0)

    // One step back shows the board as the first disc left it, with that disc marked.
    await page.getByRole('button', { name: 'step backwards' }).click()
    await expect(second.locator('svg')).toHaveCount(0)
    await expect(first.locator('.target.hover')).toHaveCount(1)
    await expect(marked).toHaveCount(1)

    await page.getByRole('button', { name: 'step forwards' }).click()
    await expect(second.locator('.target.hover')).toHaveCount(1)
    await expect(marked).toHaveCount(1)
})
