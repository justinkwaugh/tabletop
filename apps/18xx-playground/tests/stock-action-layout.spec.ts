import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} stock actions center without overlapping Pass`, async ({ page }) => {
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('trading')
        const strip = page.getByRole('navigation', { name: 'Stock actions' })
        for (const width of [700, 360, 320, 240, 200, 180, 700]) {
            await strip.evaluate((element, width) => { element.style.width = `${width}px` }, width)
            await expect.poll(async () => strip.evaluate((element) => {
                const bounds = element.getBoundingClientRect()
                const pills = element.querySelector('.selections')!.getBoundingClientRect()
                const pass = element.querySelector('.commit')!.getBoundingClientRect()
                const reserved = bounds.right - pass.left + parseFloat(getComputedStyle(element.querySelector('.commit')!).marginLeft)
                const fits = pills.width + 2 * reserved <= bounds.width
                const center = bounds.left + (bounds.width - (fits ? 0 : reserved)) / 2
                return Math.abs(pills.left + pills.width / 2 - center) < 1 && pills.left >= bounds.left && pills.right <= pass.left - 7
                    && [...element.querySelectorAll('.selections button')].every((button) => button.scrollWidth <= button.clientWidth)
            })).toBe(true)
        }
    })
}
