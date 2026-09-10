import { expect, test } from '@playwright/test'
for (const title of ['The Old Prince 1871', 'Shikoku 1889']) {
    test(`${title} finishes, shows valuation, reloads, and undoes its final turn`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/economy')
        await page.getByRole('button', { name: title, exact: true }).click()
        await page.getByLabel('Example position').selectOption('ending')
        const ending = page.getByRole('region', { name: 'Game ending', exact: true })
        await expect(ending).toContainText('Ends after operating set')
        await page.getByRole('button', { name: 'Finish operating turn', exact: true }).click()
        await expect(ending.getByRole('table', { name: 'Final wealth' })).toBeVisible()
        await expect(ending).toContainText('Game over')
        await ending.getByText('Show valuation', { exact: true }).first().click()
        await expect(ending).toContainText('Cash:')
        await ending.screenshot({
            path: `/tmp/s19-${title === 'Shikoku 1889' ? '1889' : 'top'}-results.png`
        })
        await page.reload()
        await page.getByRole('button', { name: title, exact: true }).click()
        await page.getByLabel('Example position').selectOption('ending')
        await expect(ending.getByRole('table', { name: 'Final wealth' })).toBeVisible()
        await ending.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(ending.getByRole('table')).toHaveCount(0)
        await expect(
            page.getByRole('button', { name: 'Finish operating turn', exact: true })
        ).toBeEnabled()
        expect(errors).toEqual([])
    })
}
