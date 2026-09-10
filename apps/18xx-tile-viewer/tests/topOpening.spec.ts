import { expect, test, type Page } from '@playwright/test'
async function opening(page: Page, count = 3) {
    await page.goto('/economy')
    await page.getByLabel('Example position').selectOption('opening')
    await page.getByRole('combobox', { name: 'Players', exact: true }).selectOption(String(count))
    return page.getByRole('region', { name: 'Opening auction', exact: true })
}
test('offers, bids, re-enters after passing, restores drafts and resumes the auction after reload', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    let panel = await opening(page, 4)
    await expect(panel.getByRole('article', { name: /offer pile$/ })).toHaveCount(4)
    const offer = panel.getByRole('button', { name: /^Offer / }).first()
    await offer.click()
    await panel.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Confirm offer', exact: true })).toHaveCount(0)
    await offer.click()
    await panel.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Confirm offer', exact: true })).toHaveCount(0)
    await offer.click()
    await panel.getByRole('button', { name: 'Confirm offer', exact: true }).click()
    await panel.getByRole('button', { name: 'Pass auction', exact: true }).click()
    await expect(panel).toContainText('The first bidder may re-enter')
    await panel.getByRole('button', { name: 'Place bid', exact: true }).click()
    await panel.getByRole('button', { name: 'Confirm bid', exact: true }).click()
    await page.reload()
    panel = await opening(page, 4)
    await expect(panel.getByRole('article', { name: 'Current auction', exact: true })).toBeVisible()
    await panel.getByRole('button', { name: 'Place bid', exact: true }).click()
    await panel.getByRole('button', { name: 'Confirm bid', exact: true }).click()
    await panel.getByRole('button', { name: 'Pass auction', exact: true }).click()
    await expect(panel).toContainText('Awarded')
    await panel.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(panel.getByRole('article', { name: 'Current auction', exact: true })).toBeVisible()
    expect(errors).toEqual([])
})
test('completes all forced purchases, starts the first stock round, and undoes completion', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const panel = await opening(page)
    for (let index = 0; index < 15; index++) {
        await panel
            .getByRole('button', { name: /^Offer / })
            .first()
            .click()
        await panel.getByRole('button', { name: 'Confirm offer', exact: true }).click()
        await panel.getByRole('button', { name: 'Pass auction', exact: true }).click()
        await panel.getByRole('button', { name: 'Pass auction', exact: true }).click()
    }
    await expect(panel).toHaveCount(0)
    const stock = page.getByRole('region', { name: 'Stock trading', exact: true })
    await expect(stock).toBeVisible()
    await page.screenshot({ path: '/tmp/s16b-stock.png' })
    await stock.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(panel.getByRole('article', { name: 'Current auction', exact: true })).toBeVisible()
    await panel.scrollIntoViewIfNeeded()
    await page.screenshot({ path: '/tmp/s16b-auction.png' })
    expect(errors).toEqual([])
})
