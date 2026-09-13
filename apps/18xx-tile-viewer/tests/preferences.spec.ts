import { expect, test } from '@playwright/test'

test('operating-order preference survives reload and follows the player between titles', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('routes')
    const tokens = page.getByRole('button', { name: 'Tokens only', exact: true })
    const details = page.getByRole('button', { name: 'Detailed chips', exact: true })
    await expect(details).toHaveAttribute('aria-pressed', 'true')
    await tokens.click()
    await expect(tokens).toHaveAttribute('aria-pressed', 'true')
    await expect
        .poll(() =>
            page.evaluate(() => {
                const key = Object.keys(localStorage).find(
                    (key) => key.includes('harness:preferences:') && key.includes('family:18xx')
                )
                return key
                    ? JSON.parse(localStorage.getItem(key)!).values.operatingOrderDisplay
                    : null
            })
        )
        .toBe('tokens')
    await page.reload()
    await expect(tokens).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await expect(tokens).toHaveAttribute('aria-pressed', 'true')
    await details.click()
    await expect(details).toHaveAttribute('aria-pressed', 'true')
    await expect
        .poll(() =>
            page.evaluate(() => {
                const key = Object.keys(localStorage).find(
                    (key) => key.includes('harness:preferences:') && key.includes('family:18xx')
                )
                return key
                    ? JSON.parse(localStorage.getItem(key)!).values.operatingOrderDisplay
                    : null
            })
        )
        .toBe('details')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await expect(details).toHaveAttribute('aria-pressed', 'true')
    expect(errors).toEqual([])
})
