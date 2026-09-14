import { expect, test } from '@playwright/test'

for (const title of ['TOP', '1889']) {
    test(`${title} forced purchase stages share sales and waits for the train click`, async ({
        page
    }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/economy')
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('funding')
        const funding = page.getByRole('region', { name: 'Compulsory train funding', exact: true })
        await expect(funding).toContainText('must buy a')
        await expect(funding).not.toContainText('Choose a train to buy')
        await expect(funding.getByRole('button', { name: /^Fund / })).toHaveCount(0)
        let sales = 0
        for (let i = 0; i < 10; i++) {
            await expect
                .poll(
                    async () =>
                        (await funding.locator('[data-depot-train]:enabled').count()) > 0 ||
                        (await funding
                            .getByRole('button', { name: /^Sell / })
                            .and(page.locator(':enabled'))
                            .count()) > 0
                )
                .toBe(true)
            if (await funding.locator('[data-depot-train]:enabled').count()) break
            await funding
                .getByRole('button', { name: /^Sell / })
                .last()
                .click()
            sales++
            await expect(
                funding.getByRole('table', { name: 'Shares sold for train' })
            ).toBeVisible()
        }
        expect(sales).toBeGreaterThan(0)
        const purchase = funding.locator('[data-depot-train]:enabled')
        await expect(purchase).toHaveCount(1)
        await expect(funding.getByRole('table', { name: 'Shares sold for train' })).toBeVisible()
        await purchase.click()
        await expect(funding).toHaveCount(0)
        expect(errors).toEqual([])
    })
}

test('Union Bank funding scenario passes the shortfall to Alex after exhausting the bank', async ({
    page
}) => {
    await page.goto('/table')
    await page.getByLabel('Position', { exact: true }).selectOption('funding-chain')
    const panel = page.getByRole('region', { name: 'Compulsory train funding', exact: true })
    await expect(panel).toContainText('Charlottetown must buy a')
    await expect(panel).toContainText('Union Bank must raise')
    await panel.getByRole('button', { name: /^Sell / }).click()
    await expect(panel).toContainText('Alex must raise')
    await expect(panel).toContainText('Union Bank contributed $126.')
    const ledger = panel.getByRole('table', { name: 'Shares sold for train' })
    await expect(ledger).toContainText('Union Bank')
    await panel
        .getByRole('button', { name: /^Sell / })
        .first()
        .click()
    await expect(panel.locator('[data-depot-train]:enabled')).toHaveCount(1)
    await expect(ledger).toContainText('Alex')
    await panel.locator('[data-depot-train]').click()
    await expect(panel).toHaveCount(0)
})
