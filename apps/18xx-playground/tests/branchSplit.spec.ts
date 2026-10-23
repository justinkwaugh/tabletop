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

test('TOP split stations move between parent and branch from the map', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('TOP')
    await page.getByLabel('Position', { exact: true }).selectOption('split')
    await page
        .getByRole('navigation', { name: 'Stock actions' })
        .getByRole('button', { name: 'Split', exact: true })
        .click()
    const preview = page.getByRole('region', { name: 'Branch split preview' })
    await preview.locator('[data-split-parent]').first().click()
    await preview.locator('[data-split-branch]').first().click()
    await preview.locator('[data-split-price]').first().click()
    const branch = page.getByRole('region', { name: 'Branch assets' })
    const branchToken = await branch.locator('header image').getAttribute('href')
    const mapTokens = page.locator('[data-map-token] image')
    const branchTokensOnMap = async () =>
        (
            await mapTokens.evaluateAll((images) =>
                images.map((image) => image.getAttribute('href'))
            )
        ).filter((href) => href === branchToken).length
    const belfast = page.locator('[data-map-location="N20"]').first()
    await expect(page.getByText('Click a station on the map to move it')).toBeVisible()
    await expect.poll(branchTokensOnMap).toBe(0)

    await belfast.click({ force: true })
    await expect(branch.getByText('Belfast')).toBeVisible()
    await expect.poll(branchTokensOnMap).toBe(1)

    await belfast.click({ force: true })
    await expect(branch.getByText('Belfast')).toHaveCount(0)
    await expect.poll(branchTokensOnMap).toBe(0)
})
