import { expect, test } from '@playwright/test'
for (const title of ['TOP', '1889']) {
    test(`${title} previews and commits earnings, restores history and undoes the company boundary`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/economy')
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('routes')
        const routes = page.getByRole('region', { name: 'Train routes', exact: true })
        const earnings = page.getByRole('region', { name: 'Earnings distribution', exact: true })
        const trains = page.getByRole('region', { name: 'Train purchases', exact: true })
        const map = page.getByRole('region', { name: 'Game map', exact: true })
        await routes.getByRole('button', { name: /^Run / }).first().click()
        await routes
            .getByLabel('Starting revenue center')
            .selectOption(
                JSON.stringify({ locationId: title === 'TOP' ? 'L16' : 'E2', nodeId: 'city' })
            )
        const paths =
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
        for (const [location, path] of paths)
            await routes
                .getByRole('button', { name: `Add ${location} ${path}`, exact: true })
                .click()
        await routes.getByRole('button', { name: 'Save route', exact: true }).click()
        await routes.getByRole('button', { name: 'Confirm routes', exact: true }).click()
        await expect(earnings).toContainText('Earnings $40')
        await earnings.getByRole('button', { name: 'Pay dividends', exact: true }).click()
        await expect(earnings.getByLabel('Earnings preview')).toContainText(
            'Dividend per share: $4'
        )
        await earnings.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(earnings.getByLabel('Earnings preview')).toHaveCount(0)
        await earnings.getByRole('button', { name: 'Pay dividends', exact: true }).click()
        await earnings.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(earnings.getByLabel('Earnings preview')).toHaveCount(0)
        await expect(earnings).toContainText('Earnings $40')
        await earnings.getByRole('button', { name: 'Withhold', exact: true }).click()
        await map.getByRole('button', { name: 'Beginning', exact: true }).click()
        await map.getByRole('button', { name: 'Live', exact: true }).click()
        await expect(earnings.getByLabel('Earnings preview')).toHaveCount(0)
        await earnings.getByRole('button', { name: 'Pay dividends', exact: true }).click()
        await earnings.getByRole('button', { name: 'Confirm distribution', exact: true }).click()
        await expect(earnings).toContainText('Distributed · Pay dividends')
        await expect(
            trains.getByRole('button', { name: 'Finish operating turn', exact: true })
        ).toBeEnabled()
        await page.reload()
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('routes')
        await expect(earnings).toContainText('Distributed · Pay dividends')
        await trains.getByRole('button', { name: 'Finish operating turn', exact: true }).click()
        await expect(earnings).toHaveCount(0)
        const track = page.getByRole('region', { name: 'Track construction', exact: true })
        await expect(track).toBeVisible()
        await track.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(trains).toBeVisible()
        await expect(earnings).toContainText('Distributed · Pay dividends')
        await trains.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(earnings.getByLabel('Earnings preview')).toHaveCount(0)
        await expect(
            earnings.getByRole('button', { name: 'Pay dividends', exact: true })
        ).toBeEnabled()
        expect(errors).toEqual([])
    })
    test(`${title} completes an operating set through the controls`, async ({ page }) => {
        await page.goto('/economy')
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('operations')
        const count = title === 'TOP' ? 6 : 4
        for (let turn = 0; turn < count; turn++) {
            await page.getByRole('button', { name: 'Finish track', exact: true }).click()
            await page.getByRole('button', { name: 'Finish stations', exact: true }).click()
            await page.getByRole('button', { name: 'Confirm routes', exact: true }).click()
            await page.getByRole('button', { name: 'Withhold', exact: true }).click()
            await page.getByRole('button', { name: 'Confirm distribution', exact: true }).click()
            await page.getByRole('button', { name: 'Finish operating turn', exact: true }).click()
        }
        await expect(page.getByRole('region', { name: 'Round status', exact: true })).toContainText(
            'Alex’s stock turn'
        )
    })
}
