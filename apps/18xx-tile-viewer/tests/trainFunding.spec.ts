import { expect, test, type Page } from '@playwright/test'
async function position(page: Page, title: string, value: string) {
    if (title === '1889')
        await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
    await page.getByLabel('Example position').selectOption(value)
}
for (const title of ['TOP', '1889']) {
    test(`${title} funds a train with persisted progress, manual sale Back, and Undo`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/economy')
        await position(page, title, 'funding')
        const panel = page.getByRole('region', { name: 'Compulsory train funding', exact: true })
        await panel.getByRole('button', { name: /^Fund / }).click()
        await expect(panel).toContainText('Remaining shortfall')
        await page.reload()
        await position(page, title, 'funding')
        await expect(panel).toContainText('Remaining shortfall')
        await expect(
            page.getByRole('button', { name: 'Finish operating turn', exact: true })
        ).toBeDisabled()
        let sawSale = false
        for (let step = 0; step < 15; step++) {
            const buy = panel.getByRole('button', { name: 'Buy required train', exact: true })
            if (await buy.count()) {
                await buy.click()
                break
            }
            const issue = panel.getByRole('button', { name: 'Issue treasury shares', exact: true })
            const contribute = panel.getByRole('button', { name: /^Contribute \$/ })
            if (await issue.count()) await issue.click()
            else if (await contribute.count()) await contribute.click()
            else {
                const sale = panel.getByRole('button', { name: /^Sell / }).last()
                await sale.click()
                await expect(
                    panel.getByRole('button', { name: 'Confirm share sale', exact: true })
                ).toBeVisible()
                await panel.getByRole('button', { name: 'Back', exact: true }).click()
                await expect(
                    panel.getByRole('button', { name: 'Confirm share sale', exact: true })
                ).toHaveCount(0)
                await sale.click()
                await panel.getByRole('button', { name: 'Undo', exact: true }).click()
                await expect(
                    panel.getByRole('button', { name: 'Confirm share sale', exact: true })
                ).toHaveCount(0)
                await sale.click()
                await panel.getByRole('button', { name: 'Confirm share sale', exact: true }).click()
                sawSale = true
            }
        }
        await expect(panel).toHaveCount(0)
        await expect(
            page.getByRole('button', { name: 'Finish operating turn', exact: true })
        ).toBeEnabled()
        await page
            .getByRole('region', { name: 'Train purchases', exact: true })
            .getByRole('button', { name: 'Undo', exact: true })
            .click()
        await expect(
            panel.getByRole('button', { name: 'Buy required train', exact: true })
        ).toBeVisible()
        if (title === '1889') expect(sawSale).toBe(true)
        expect(errors).toEqual([])
    })
    test(`${title} shows bankruptcy and restores the prior state with Undo`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/economy')
        await position(page, title, 'bankruptcy')
        const panel = page.getByRole('region', { name: 'Compulsory train funding', exact: true })
        await panel.getByRole('button', { name: /^Fund / }).click()
        await expect(panel).toContainText('The game has ended')
        await page.reload()
        await position(page, title, 'bankruptcy')
        await expect(panel).toContainText('The game has ended')
        await panel.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(panel.getByRole('button', { name: /^Fund / })).toBeEnabled()
        expect(errors).toEqual([])
    })
}
