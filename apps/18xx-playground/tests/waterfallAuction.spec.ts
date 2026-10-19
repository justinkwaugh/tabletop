import { expect, test, type Page } from '@playwright/test'

async function openShikokuAuction(page: Page) {
    await page.setViewportSize({ width: 1400, height: 950 })
    await page.goto('/table')
    await page.getByLabel('Game', { exact: true }).selectOption('1889')
    await page.getByLabel('Position', { exact: true }).selectOption('opening')
    const auction = page.getByRole('region', { name: 'Private auction', exact: true })
    await expect(auction).toBeVisible()
    return auction
}

test('1889 private auction stages bids, lists reservations and opens private cards', async ({
    page
}) => {
    const auction = await openShikokuAuction(page)
    const undo = page.getByRole('button', { name: 'Undo', exact: true })
    const ehime = auction.locator('tbody tr').filter({ hasText: 'Ehime Railroad' })

    await ehime.locator('.value').click()
    await expect(page.locator('.description')).toContainText('Ohzu')
    await page.locator('.description').click()
    await expect(page.locator('.description')).toHaveCount(0)

    await expect(
        auction.getByRole('button', { name: 'Bid on Takamatsu Electric Track' })
    ).toHaveCount(0)
    await auction.getByRole('button', { name: 'Bid on Ehime Railroad' }).click()
    await expect(page.locator('.description')).toHaveCount(0)
    await expect(auction.locator('output')).toHaveText('¥45')
    await expect(auction.getByRole('button', { name: 'Decrease bid' })).toBeDisabled()
    await expect(auction.getByRole('button', { name: 'Bid on Ehime Railroad' })).toHaveCount(0)
    await undo.click()
    await expect(auction.locator('output')).toHaveCount(0)
    await expect(undo).toBeDisabled()

    await auction.getByRole('button', { name: 'Bid on Ehime Railroad' }).click()
    await auction.getByRole('button', { name: 'Increase bid' }).click()
    await auction.getByRole('button', { name: 'Bid', exact: true }).click()
    await expect(auction.getByRole('list', { name: 'Bids on Ehime Railroad' })).toContainText('¥50')
    const cards = page.getByRole('region', { name: / bids$/ })
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText('Ehime Railroad')
    await expect(cards.first()).toContainText('¥50')
    const bidder = page.locator('article').filter({ has: cards.first() })
    await expect(bidder.locator('dl').filter({ hasText: 'Cash' }).locator('dd')).toHaveText('¥420')
    await expect(bidder.locator('dl').filter({ hasText: 'Liquidity' }).locator('dd')).toHaveText(
        '¥370'
    )

    await auction.getByRole('button', { name: 'Bid on Ehime Railroad' }).click()
    await expect(auction.locator('output')).toHaveText('¥55')
    await undo.click()
    await expect(auction.locator('output')).toHaveCount(0)
    await expect(auction.getByRole('list', { name: 'Bids on Ehime Railroad' })).toContainText('¥50')
    await undo.click()
    await expect(auction.getByRole('list', { name: 'Bids on Ehime Railroad' })).toHaveCount(0)
    await expect(cards).toHaveCount(0)
})

test('1889 private auction buys in one step and resolves a contested private by bidding', async ({
    page
}) => {
    const auction = await openShikokuAuction(page)
    const bid = async (name: string) => {
        await auction.getByRole('button', { name: `Bid on ${name}` }).click()
        await auction.getByRole('button', { name: 'Bid', exact: true }).click()
    }
    await bid('Ehime Railroad')
    await bid('Ehime Railroad')
    await expect(auction.getByRole('list', { name: 'Bids on Ehime Railroad' })).toHaveText(
        /¥50.*¥45/
    )
    await auction.getByRole('button', { name: 'Buy Takamatsu Electric Track' }).click()
    const row = (name: string) => auction.locator('tbody tr', { hasText: name })
    await expect(row('Takamatsu Electric Track')).toContainText('¥20')
    await expect(row('Takamatsu Electric Track').locator('.winner')).toBeVisible()
    await auction.getByRole('button', { name: 'Buy Mitsubishi Ferry' }).click()

    const contest = auction.getByRole('group', { name: 'Current auction' })
    await expect(
        row('Ehime Railroad')
            .locator('xpath=following-sibling::tr[1]')
            .getByRole('group', { name: 'Current auction' })
    ).toBeVisible()
    await expect(contest).toContainText('High bid ¥50')
    await expect(contest.locator('output')).toHaveText('¥55')
    await expect(row('Ehime Railroad')).toContainText('¥50')
    await expect(auction.getByRole('button', { name: /^(Buy|Bid on) / })).toHaveCount(0)
    await contest.getByRole('button', { name: 'Pass', exact: true }).click()
    await expect(row('Ehime Railroad')).toContainText('¥50')
    await expect(
        auction.getByRole('button', { name: 'Buy Sumitomo Besshi Mine Railroad' })
    ).toBeVisible()
    await expect(page.getByRole('region', { name: / bids$/ })).toHaveCount(0)
})
