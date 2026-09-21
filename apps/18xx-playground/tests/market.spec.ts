import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} market animates sales, stack order, history and Undo`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.setViewportSize({ width: 1400, height: 1100 })
        await page.goto('/table')
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('trading')
        await page.getByRole('tab', { name: 'Market', exact: true }).click()
        const companyId = title === 'TOP' ? 'ML' : 'IR'
        const residentId = title === 'TOP' ? 'So' : 'AR'
        const initialSpace = title === 'TOP' ? '1:1' : '0:3'
        const destination = title === 'TOP' ? '2:1' : '1:3'
        const token = page.locator(`[data-market-company="${companyId}"]`)
        const resident = page.locator(`[data-market-company="${residentId}"]`)
        const undo = page.getByRole('button', { name: 'Undo', exact: true })
        await expect(token).toHaveAttribute('data-market-token-space', initialSpace)
        await page.getByRole('navigation', { name: 'Stock actions' }).getByRole('button', { name: 'Sell', exact: true }).click()
        await page.locator(`[data-sale-company="${companyId}"]`).first().click()
        await page.getByRole('tab', { name: 'Market', exact: true }).click()
        await token.evaluate((element) => {
            const values = new Set<string>()
            const until = performance.now() + 1200
            function sample() {
                values.add(element.querySelector('.token-motion')?.getAttribute('style') ?? '')
                element.setAttribute('data-animation-samples', String(values.size))
                if (performance.now() < until) requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
        })
        await page.locator('[data-sale-shares="1"]').first().click()
        await expect(undo).toBeEnabled()
        await expect(token).toHaveAttribute('data-market-token-space', destination)
        expect(Number(await token.getAttribute('data-animation-samples'))).toBeGreaterThan(3)
        expect(await resident.evaluate((element) => Number(getComputedStyle(element).zIndex))).toBeGreaterThan(await token.evaluate((element) => Number(getComputedStyle(element).zIndex)))
        const sameColumn = await Promise.all([token, resident].map((item) => item.evaluate((element) => element.getBoundingClientRect().x)))
        expect(sameColumn[0]).toBeCloseTo(sameColumn[1])
        await page.getByRole('button', { name: 'step backwards', exact: true }).click()
        await expect(token).toHaveAttribute('data-market-token-space', initialSpace)
        await expect(page.getByRole('region', { name: 'Stock market board' })).toHaveAttribute('aria-busy', 'false')
        await page.getByRole('button', { name: 'step forwards', exact: true }).click({ modifiers: ['Shift'] })
        await expect(token).toHaveAttribute('data-market-token-space', destination)
        await expect(page.getByRole('region', { name: 'Stock market board' })).toHaveAttribute('aria-busy', 'false')
        await page.getByRole('button', { name: 'go to current', exact: true }).click()
        await expect(undo).toBeEnabled()
        await undo.click()
        await expect(token).toHaveAttribute('data-market-token-space', initialSpace)
        await expect(page.getByRole('region', { name: 'Stock market board' })).toHaveAttribute('aria-busy', 'false')
        await page.reload()
        await page.getByLabel('Game', { exact: true }).selectOption(title)
        await page.getByLabel('Position', { exact: true }).selectOption('trading')
        await page.getByRole('tab', { name: 'Market', exact: true }).click()
        await expect(token).toHaveAttribute('data-market-token-space', initialSpace)
        expect(errors).toEqual([])
    })
}
