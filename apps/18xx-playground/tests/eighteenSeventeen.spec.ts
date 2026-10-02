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

test('1817 presidents in a cash crisis can go bankrupt after confirming', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1817')
    await page.getByLabel('Position', { exact: true }).selectOption('bankruptcy')
    const trains = page.getByRole('region', { name: 'Train purchases' })
    await trains.getByRole('button', { name: 'finish', exact: true }).click()

    const crisis = page.getByRole('region', { name: 'Cash crisis' })
    await expect(crisis).toContainText('owes the bank $25')
    await crisis.getByRole('button', { name: 'Go bankrupt' }).click()
    await expect(crisis.getByRole('button', { name: 'Confirm bankruptcy' })).toBeVisible()
    await crisis.getByRole('button', { name: 'Back' }).click()
    await expect(crisis.getByRole('button', { name: 'Go bankrupt' })).toBeVisible()
    await crisis.getByRole('button', { name: 'Go bankrupt' }).click()
    await crisis.getByRole('button', { name: 'Confirm bankruptcy' }).click()
    await expect(page.getByRole('region', { name: 'Cash crisis' })).toHaveCount(0)

    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const history = page.getByRole('list', { name: 'Action history' })
    await expect(history).toContainText('could not pay interest and was liquidated')
    await expect(history).toContainText('Went bankrupt')
    await page.getByRole('tab', { name: 'Players', exact: true }).click()
    await expect(page.getByText('Bankrupt', { exact: true })).toBeVisible()
})

test('1817 presidents act for a company in place of their stock turn', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1817')
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    await page.getByRole('button', { name: 'Pass', exact: true }).first().click()
    const corporate = page.getByRole('region', { name: 'Corporate actions' })
    await expect(corporate).toContainText('Boston and Albany Railroad')
    await corporate.getByRole('button', { name: 'Take a loan' }).click()
    await expect(corporate).toContainText('Acting for')
    await expect(corporate).toContainText('Loans 1/5')
    await corporate.getByRole('button', { name: 'Buy back a share ($110)' }).click()
    await expect(page.getByRole('region', { name: 'Corporate actions' })).toHaveCount(0)
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Action history' })).toContainText(
        'bought back 1 Boston and Albany Railroad share'
    )
})

test('1817 players short a company in their stock turn', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1817')
    await page.getByLabel('Position', { exact: true }).selectOption('trading')
    for (let pass = 0; pass < 2; pass++)
        await page.getByRole('button', { name: 'Pass', exact: true }).first().click()
    const shorting = page.getByRole('region', { name: 'Short selling' })
    await shorting.getByRole('button', { name: 'Short Boston and Albany Railroad ($120)' }).click()
    await expect(page.getByRole('region', { name: 'Short selling' })).toHaveCount(0)
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Action history' })).toContainText(
        'shorted Boston and Albany Railroad'
    )
})

test('1817 companies convert in the merger round after an operating round', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1817')
    await page.getByLabel('Position', { exact: true }).selectOption('construction')
    const merger = page.getByRole('region', { name: 'Merger round' })
    for (let turn = 0; turn < 2; turn++) {
        await page
            .getByRole('navigation', { name: 'Operating steps' })
            .getByRole('button', { name: 'Station' })
            .click()
        await page
            .getByRole('region', { name: 'Train purchases' })
            .getByRole('button', { name: 'finish', exact: true })
            .click()
        await page
            .getByRole('region', { name: 'Loans' })
            .getByRole('button', { name: 'Finish turn' })
            .click()
    }
    await expect(page.getByLabel('Game phase')).toContainText(/Merger round.* 1\.1/)
    await expect(merger).toContainText('Boston and Albany Railroad')
    await merger.getByRole('button', { name: 'Pass', exact: true }).click()
    await merger.getByRole('button', { name: 'Convert to 5 shares' }).click()
    await expect(merger).toContainText('3 treasury shares at $60')
    await merger.getByRole('button', { name: 'Buy a share ($60)' }).click()
    await merger.getByRole('button', { name: 'Buy a share ($60)' }).click()
    await merger.getByRole('button', { name: 'Pass', exact: true }).click()
    await merger.getByRole('button', { name: 'Take a loan' }).click()
    await merger.getByRole('button', { name: 'Buy 1 station' }).click()
    await expect(page.getByRole('region', { name: 'Merger round' })).toHaveCount(0)

    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const history = page.getByRole('list', { name: 'Action history' })
    await expect(history.getByRole('listitem', { name: 'MR 1.1' })).toContainText('to 5 shares')
    await expect(history).toContainText('bought 1 station')
})

test('1817 companies are sold in the acquisition round after the merger round', async ({
    page
}) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1817')
    await page.getByLabel('Position', { exact: true }).selectOption('construction')
    for (let turn = 0; turn < 2; turn++) {
        await page
            .getByRole('navigation', { name: 'Operating steps' })
            .getByRole('button', { name: 'Station' })
            .click()
        await page
            .getByRole('region', { name: 'Train purchases' })
            .getByRole('button', { name: 'finish', exact: true })
            .click()
        await page
            .getByRole('region', { name: 'Loans' })
            .getByRole('button', { name: 'Finish turn' })
            .click()
    }
    const merger = page.getByRole('region', { name: 'Merger round' })
    for (let turn = 0; turn < 2; turn++)
        await merger.getByRole('button', { name: 'Pass', exact: true }).click()

    const sale = page.getByRole('region', { name: 'Acquisition round' })
    await expect(page.getByLabel('Game phase')).toContainText(/Acquisition round.* 1\.1/)
    await expect(sale).toContainText('Pittsburgh and Lake Erie Railroad')
    await sale.getByRole('button', { name: 'Offer for sale' }).click()
    await expect(sale).toContainText('No bids yet')
    await sale.getByRole('button', { name: 'Bid $120' }).click()
    await sale.getByRole('button', { name: 'Finish' }).click()
    await expect(page.getByRole('region', { name: 'Acquisition round' })).toHaveCount(0)

    await page.getByRole('tab', { name: 'History', exact: true }).click()
    const history = page.getByRole('list', { name: 'Action history' })
    await expect(history.getByRole('listitem', { name: 'AR 1.1' })).toContainText(
        'acquired Pittsburgh and Lake Erie Railroad'
    )
    await expect(history).toContainText('holders received $60 a share')
})

test('1817 companies use their private powers in their operating turn', async ({ page }) => {
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1817')
    await page.getByLabel('Position', { exact: true }).selectOption('company-powers')
    await page.getByRole('button', { name: 'Use privates' }).click()
    const markers = page.getByLabel('Private markers')
    await markers.getByRole('button', { name: /Place bridge on Cincinnati/ }).click()
    await expect(page.locator('[data-map-location="G6"] [data-map-markers]').first()).toContainText(
        'Bridge'
    )
    await page.getByRole('tab', { name: 'History', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Action history' })).toContainText(
        'marked G6 with Union Bridge'
    )
})
