import { expect, test } from '@playwright/test'

test('TOP Undo unwinds the split one stage at a time before game history', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await page.getByLabel('Position', { exact: true }).selectOption('split')
    const strip = page.getByRole('navigation', { name: 'Stock actions' })
    const split = strip.getByRole('button', { name: 'Split', exact: true })
    const preview = page.getByRole('region', { name: 'Branch split preview' })
    const undo = page.getByRole('button', { name: 'Undo', exact: true }).first()

    await split.click()
    await expect(split).toHaveAttribute('aria-pressed', 'true')
    await preview.locator('[data-split-parent]').first().click()
    await expect(preview.locator('[data-split-branch]').first()).toBeVisible()

    await undo.click()
    await expect(preview.locator('[data-split-branch]')).toHaveCount(0)
    await expect(preview.locator('[data-split-parent]').first()).toBeVisible()

    await undo.click()
    await expect(preview).toHaveCount(0)
    await expect(split).toHaveAttribute('aria-pressed', 'false')
})
