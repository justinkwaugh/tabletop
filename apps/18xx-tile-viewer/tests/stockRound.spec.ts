import { expect, test } from '@playwright/test'

test(`completes both stock rounds, restores them, and undoes the last pass at desktop`, async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/economy')
    for (const title of ['The Old Prince', 'Shikoku 1889']) {
        if (title === 'Shikoku 1889')
            await page.getByRole('button', { name: title, exact: true }).click()
        const trading = page.getByRole('region', { name: 'Stock trading', exact: true })
        const status = page.getByRole('region', { name: 'Round status', exact: true })
        for (const player of ['Alex', 'Blair', 'Casey']) {
            await expect(status).toContainText(`${player}’s stock turn`)
            await trading.getByRole('button', { name: 'Pass', exact: true }).click()
        }
        await expect(
            trading.getByRole('heading', { name: 'Operating set 1', exact: true })
        ).toBeVisible()
        await expect(status).toContainText('Round 1 of 1')
        await expect(status).toContainText('Next stock round: Alex → Blair → Casey')
        const order = status.getByRole('list', { name: 'Operating order' })
        await expect(order.getByRole('listitem')).toHaveCount(title === 'The Old Prince' ? 3 : 2)
        await expect(order).toContainText(
            title === 'The Old Prince' ? 'Prince Edward Island Railway' : 'Iyo Railway'
        )
        await expect(trading.getByRole('button', { name: 'Pass', exact: true })).toHaveCount(0)
        await expect(page.getByRole('list', { name: 'Stock history' })).toContainText(
            'Stock round complete.'
        )
        await page.reload()
        if (title === 'Shikoku 1889')
            await page.getByRole('button', { name: title, exact: true }).click()
        await expect(
            trading.getByRole('heading', { name: 'Operating set 1', exact: true })
        ).toBeVisible()
        await trading.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(status).toContainText('Casey’s stock turn')
        await expect(page.getByRole('list', { name: 'Stock history' })).not.toContainText(
            'Stock round complete.'
        )
        await trading.getByRole('button', { name: 'Pass', exact: true }).click()
        await expect(
            trading.getByRole('heading', { name: 'Operating set 1', exact: true })
        ).toBeVisible()
        await expect(
            page
                .getByRole('list', { name: 'Stock history' })
                .getByText('Stock round complete.', { exact: true })
        ).toHaveCount(1)
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            .toBe(true)
    }
    expect(errors).toEqual([])
})
test(`resumes TOP trading after a pass and restores pass cards with Undo at desktop`, async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/economy')
    const trading = page.getByRole('region', { name: 'Stock trading', exact: true })
    const status = page.getByRole('region', { name: 'Round status', exact: true })
    await trading.getByRole('button', { name: 'Pass', exact: true }).click()
    await expect(status).toContainText('Pass order: Alex')
    await page.locator('[data-purchase-certificate="So:share:5"][data-buyer="player"]').click()
    await expect(trading.getByRole('button', { name: 'Pass', exact: true })).toBeDisabled()
    await trading.getByRole('button', { name: 'Confirm purchase', exact: true }).click()
    await trading.getByRole('button', { name: 'End turn', exact: true }).click()
    await trading.getByRole('button', { name: 'Pass', exact: true }).click()
    await expect(status).toContainText('Alex’s stock turn')
    await expect(status).toContainText('Pass order: Alex → Casey')
    await page.locator('[data-purchase-certificate="ML:share:5"][data-buyer="player"]').click()
    await trading.getByRole('button', { name: 'Confirm purchase', exact: true }).click()
    await expect(status).toContainText('Pass order: Casey')
    await trading.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(status).toContainText('Pass order: Alex → Casey')
    await expect(trading.getByRole('button', { name: 'Pass', exact: true })).toBeEnabled()
    expect(errors).toEqual([])
})
