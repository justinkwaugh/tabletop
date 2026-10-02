import { expect, test } from '@playwright/test'

test('1817 opens with a selection auction and starts companies by auction', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1817')
    await page.getByLabel('Position', { exact: true }).selectOption('opening')
    const lots = page.getByRole('region', { name: 'Private auction' })
    await expect(lots.getByRole('button', { name: 'Auction Minor Coal Mine' })).toBeEnabled()
    await lots.getByRole('button', { name: 'Auction Minor Coal Mine' }).click()
    await lots.getByRole('button', { name: 'Bid', exact: true }).click()
    const bidding = page.getByRole('article', { name: 'Current auction' })
    await expect(bidding).toBeVisible()
    for (let pass = 0; pass < 2; pass++)
        await bidding.getByRole('button', { name: 'Pass', exact: true }).click()
    await expect(lots.getByRole('button', { name: 'Auction Minor Coal Mine' })).toHaveCount(0)
    for (let pass = 0; pass < 3; pass++)
        await lots.getByRole('button', { name: 'Pass', exact: true }).click()

    await page.getByRole('button', { name: 'Auction', exact: true }).click()
    await page.getByRole('button', { name: 'Auction Alton & Southern Railway' }).click()
    const city = page.locator('[data-map-location="B5"]').filter({ visible: true }).first()
    await expect(city).toBeVisible()
    await city.click()
    const opening = page.getByLabel('Auction a company')
    await expect(opening).toContainText('Home Lansing')
    await opening.getByRole('button', { name: 'Bid', exact: true }).click()
    const auction = page.getByRole('article', { name: 'Company auction' })
    await expect(auction).toBeVisible()
    for (let pass = 0; pass < 2; pass++)
        await auction.getByRole('button', { name: 'Pass', exact: true }).click()
    await expect(page.getByRole('article', { name: 'Company auction' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Auction', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Action history' })).toContainText(
        'formed Alton & Southern Railway with 2 shares'
    )
})

test('1817 companies borrow during their turn and settle interest in a Loans step', async ({
    page
}) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1817')
    await page.getByLabel('Position', { exact: true }).selectOption('construction')
    const steps = page.getByRole('navigation', { name: 'Operating steps' })
    await expect(steps.getByRole('button', { name: 'Loans' })).toBeVisible()
    const loans = steps.getByLabel('Loans', { exact: true })
    await expect(loans).toContainText('Loans 0/5 · 5%')
    await loans.getByRole('button', { name: 'Take loan ($100)' }).click()
    await expect(loans).toContainText('Loans 1/5')

    await steps.getByRole('button', { name: 'Station' }).click()
    const trains = page.getByRole('region', { name: 'Train purchases' })
    await expect(trains).toBeVisible()
    await trains.getByRole('button', { name: 'finish', exact: true }).click()

    const repayment = page.getByRole('region', { name: 'Loans' })
    await expect(repayment).toContainText('Paid $5 interest at 5%')
    await expect(repayment.getByRole('button', { name: 'Repay a loan ($100)' })).toBeEnabled()
    await repayment.getByRole('button', { name: 'Repay a loan ($100)' }).click()
    await expect(repayment).toContainText('Loans 0/5')
    await repayment.getByRole('button', { name: 'Finish turn' }).click()
    await expect(page.getByRole('region', { name: 'Loans' })).toHaveCount(0)

    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const history = page.getByRole('list', { name: 'Action history' })
    await expect(history).toContainText('Borrowed for')
    await expect(history).toContainText('Repaid a loan for')
})
