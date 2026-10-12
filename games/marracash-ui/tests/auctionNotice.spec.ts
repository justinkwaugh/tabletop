import { expect, test, type Page } from '@playwright/test'
import { auctionFirstShop, auctionableShops, board, createGame, finishBidding } from './helpers'

function notice(page: Page) {
    return page.getByRole('status').filter({ hasText: 'is auctioning a' })
}

function stallPlacard(page: Page) {
    return board(page).locator('g.placard')
}

function historyButton(page: Page, name: string) {
    return page.locator(`button[aria-label="${name}"]:visible`).first()
}

test('starting your own auction puts the placard on the stall without announcing it', async ({
    page
}) => {
    await createGame(page)
    await auctionFirstShop(page)
    await expect(stallPlacard(page)).toBeVisible()
    await expect(notice(page)).toHaveCount(0)
})

test("another player's auction is announced, then its placard settles on the stall", async ({
    page
}) => {
    await createGame(page)
    await auctionFirstShop(page)
    await finishBidding(page)
    // The next player starts an auction while the board is watched from another seat.
    await auctionableShops(page).first().click()
    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByText('Protected mode', { exact: true }).click()
    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByLabel('Protected view', { exact: true }).selectOption({ label: 'Amira' })
    await expect(board(page)).toBeVisible()

    // A state-only step back and forward never announces it.
    await historyButton(page, 'step backwards').click()
    await historyButton(page, 'step forwards').click()
    await expect(stallPlacard(page)).toBeVisible()
    await expect(notice(page)).toHaveCount(0)

    // Replaying the action in full announces it as it was announced live.
    await historyButton(page, 'step backwards').click()
    await page.keyboard.down('Shift')
    await historyButton(page, 'step forwards').click()
    await page.keyboard.up('Shift')
    await expect(notice(page)).toContainText(
        /\w+ is auctioning a\s+(red|blue|green|yellow|purple) shop/
    )
    await expect(stallPlacard(page)).toBeHidden()
    await expect(notice(page)).toHaveCount(0, { timeout: 8_000 })
    await expect(stallPlacard(page)).toBeVisible()
})
