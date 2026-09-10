import { expect, test } from '@playwright/test'
for (const title of ['TOP', '1889']) {
    test(`${title} private exchange supports Back, Undo, reload and closure`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/economy')
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('privates')
        const panel = page.getByRole('region', { name: 'Private companies', exact: true })
        const company = panel.getByRole('article', {
            name: title === 'TOP' ? 'Merchants and Co.' : 'Dôgo Railway',
            exact: true
        })
        const choose = company.getByRole('button', {
            name: title === 'TOP' ? 'Exchange for So:share:6' : 'Exchange for IR:share:5',
            exact: true
        })
        await choose.click()
        const preview = panel.getByLabel('Private exchange preview')
        await expect(preview).toContainText('Alex closes')
        await panel.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(preview).toHaveCount(0)
        await choose.click()
        await panel.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(preview).toHaveCount(0)
        await expect(choose).toBeEnabled()
        await choose.click()
        await panel.getByRole('button', { name: 'Confirm private exchange', exact: true }).click()
        await expect(company).toContainText('Closed')
        await expect(choose).toHaveCount(0)
        await page.reload()
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('privates')
        await expect(company).toContainText('Closed')
        await panel.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(choose).toBeEnabled()
        await expect(preview).toHaveCount(0)
        expect(errors).toEqual([])
    })
    test(`${title} shows private phase effects and restores them with Undo`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/economy')
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('private-events')
        const panel = page.getByRole('region', { name: 'Private companies', exact: true })
        const company = panel.getByRole('article', {
            name: title === 'TOP' ? 'Ice Boats' : 'Uno-Takamatsu Ferry',
            exact: true
        })
        const trains = page.getByRole('region', { name: 'Train purchases', exact: true })
        await trains
            .getByRole('button', { name: title === 'TOP' ? 'Select 4+' : 'Select 5', exact: true })
            .click()
        await trains.getByRole('button', { name: 'Confirm train purchase', exact: true }).click()
        await expect(company).toContainText(title === 'TOP' ? 'Closed' : 'Revenue 50')
        const history = page.getByLabel('Phase history')
        await expect(history).toContainText(
            title === 'TOP' ? 'Exchanged MC for So:share:6' : 'UTF revenue becomes 50'
        )
        await page.reload()
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('private-events')
        await expect(company).toContainText(title === 'TOP' ? 'Closed' : 'Revenue 50')
        await trains.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(company).toContainText(title === 'TOP' ? 'Revenue 5' : 'Revenue 30')
        await expect(history).toHaveCount(0)
        expect(errors).toEqual([])
    })
}
test('Dôgo can exchange during Iyo’s operating turn without taking an ordinary stock action', async ({
    page
}) => {
    await page.goto('/economy')
    await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
    await page.getByLabel('Example position').selectOption('private-events')
    const panel = page.getByRole('region', { name: 'Private companies', exact: true })
    const trains = page.getByRole('region', { name: 'Train purchases', exact: true })
    await expect(trains.getByRole('button', { name: 'Select 5', exact: true })).toBeEnabled()
    await panel.getByRole('button', { name: 'Exchange for IR:share:5', exact: true }).click()
    await expect(panel.getByLabel('Private exchange preview')).toContainText('Alex closes')
    await panel.getByRole('button', { name: 'Confirm private exchange', exact: true }).click()
    await expect(panel.getByRole('article', { name: 'Dôgo Railway', exact: true })).toContainText(
        'Closed'
    )
    await expect(trains.getByRole('button', { name: 'Select 5', exact: true })).toBeEnabled()
    await page.screenshot({ path: '/tmp/18xx-private-companies.png', fullPage: true })
})
