import { expect, test } from '@playwright/test'

test('track construction projects the run on the previewed tile', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/table')
    await page.getByRole('tab', { name: 'Board', exact: true }).waitFor()
    await page.getByLabel('Position', { exact: true }).selectOption('construction')
    const total = page
        .getByRole('table', { name: 'Projected train income' })
        .getByRole('row', { name: /Total/ })
        .getByRole('cell')
    await expect(total).toHaveText('$30')
    await expect(page.locator('[data-map-route]')).not.toHaveCount(0)

    // Upgrading Charlottetown raises the city the 2H runs to.
    await page.locator('[data-map-location="L16"]').click({ force: true })
    await page.locator('[data-map-tile-choice]').first().click()
    await expect(total).toHaveText('$40')
    await expect(page.getByRole('region', { name: 'Projected run' })).toHaveAttribute(
        'aria-busy',
        'false'
    )

    await page.getByRole('button', { name: 'Accept track lay', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Run trains', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Projected run' })).toHaveCount(0)
    expect(errors).toEqual([])
})
