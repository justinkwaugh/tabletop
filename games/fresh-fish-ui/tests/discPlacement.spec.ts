import { expect, test } from '@playwright/test'

test('a placed disc takes over from its preview without vanishing or growing in', async ({
    page
}) => {
    await page.goto('/')
    await page.evaluate(async () => {
        const fixture = await import(
            new URL('/src/lib/stores/tests/exploration.fixture.ts', location.href).href
        )
        return fixture.saveProtectedHarnessGame()
    })
    await page.reload()
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByText('Protected Fresh Fish', { exact: true }).click()
    await expect(page.getByText('Please place a disc', { exact: true })).toBeVisible()

    const cell = page.locator('.land .cell.cursor-pointer').first()
    await cell.hover()
    const preview = cell.locator('svg')
    await expect(preview).toHaveCount(1)

    // Watch every frame from the click on: the cell must always show a full-size disc.
    await cell.evaluate((element) => {
        const frames: number[] = []
        ;(window as unknown as { discFrames: number[] }).discFrames = frames
        const sample = () => {
            const widths = [...element.querySelectorAll('svg')].map(
                (svg) => svg.getBoundingClientRect().width
            )
            frames.push(widths.length ? Math.max(...widths) : 0)
            if (frames.length < 30) requestAnimationFrame(sample)
        }
        element.addEventListener('click', () => requestAnimationFrame(sample), { once: true })
    })
    await cell.click()
    await expect
        .poll(() =>
            page.evaluate(() => (window as unknown as { discFrames: number[] }).discFrames.length)
        )
        .toBe(30)
    const frames = await page.evaluate(
        () => (window as unknown as { discFrames: number[] }).discFrames
    )
    const placedWidth = frames.at(-1)!
    for (const width of frames)
        expect(width, JSON.stringify(frames)).toBeGreaterThan(placedWidth * 0.95)
    await expect(page.getByText('placed a disc')).toBeVisible()
})
