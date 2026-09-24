import { expect, test } from '@playwright/test'

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
