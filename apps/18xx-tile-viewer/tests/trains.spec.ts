import { expect, test } from '@playwright/test'
for (const title of ['TOP', '1889']) {
    test(`${title} buys depot trains with Back, Undo, history and reload`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/economy')
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('trains')
        const panel = page.getByRole('region', { name: 'Train purchases', exact: true })
        const map = page.getByRole('region', { name: 'Game map', exact: true })
        const rank = title === 'TOP' ? '2H' : '2'
        const company = title === 'TOP' ? 'ML' : 'IR'
        const card = panel.locator(`[data-depot-train="${rank}"]`)
        const treasury = title === 'TOP' ? 920 : 600
        const remaining = title === 'TOP' ? 3 : 5
        const owned = panel.locator(`[data-train-roster="${company}"] [data-owned-train]`)
        await expect(owned).toHaveCount(1)
        await card.getByRole('button', { name: `Select ${rank}`, exact: true }).click()
        await expect(panel.getByLabel('Train purchase preview')).toContainText('$80')
        await expect(owned).toHaveCount(1)
        await expect(card).toContainText(`${remaining} remaining`)
        await panel.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(panel.getByLabel('Train purchase preview')).toHaveCount(0)
        await card.getByRole('button', { name: `Select ${rank}`, exact: true }).click()
        await panel.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(panel.getByLabel('Train purchase preview')).toHaveCount(0)
        await expect(map.getByRole('status')).toHaveText('Live · 0 actions')
        await card.getByRole('button', { name: `Select ${rank}`, exact: true }).click()
        await panel.getByRole('button', { name: 'Confirm train purchase', exact: true }).click()
        await expect(owned).toHaveCount(2)
        await expect(card).toContainText(`${remaining - 1} remaining`)
        await expect(panel).toContainText(`Treasury: $${treasury - 80}`)
        await expect(panel.getByLabel('Train purchase history')).toContainText(
            `${company}: ${rank}, $80`
        )
        await card.getByRole('button', { name: `Select ${rank}`, exact: true }).click()
        await map.getByRole('button', { name: 'Beginning', exact: true }).click()
        await expect(panel.getByLabel('Train purchase preview')).toHaveCount(0)
        await expect(owned).toHaveCount(1)
        await expect(
            card.getByRole('button', { name: `Select ${rank}`, exact: true })
        ).toBeDisabled()
        await map.getByRole('button', { name: 'Live', exact: true }).click()
        await expect(owned).toHaveCount(2)
        await expect(panel.getByLabel('Train purchase preview')).toHaveCount(0)
        await page.reload()
        if (title === '1889')
            await page.getByRole('button', { name: 'Shikoku 1889', exact: true }).click()
        await page.getByLabel('Example position').selectOption('trains')
        await expect(owned).toHaveCount(2)
        await panel.getByRole('button', { name: 'Undo', exact: true }).click()
        await expect(owned).toHaveCount(1)
        await expect(card).toContainText(`${remaining} remaining`)
        await expect(panel).toContainText(`Treasury: $${treasury}`)
        expect(errors).toEqual([])
    })
}
