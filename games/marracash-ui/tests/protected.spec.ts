import { expect, test, type Page } from '@playwright/test'
import { actionPanel, auctionFirstShop, createGame, finishBidding } from './helpers'

async function enterProtectedMode(page: Page) {
    await page.getByRole('button', { name: 'Options' }).click()
    await page.getByText('Protected mode', { exact: true }).click()
    await page.getByRole('button', { name: 'Options' }).click()
    await expect(page.getByLabel('Protected view', { exact: true })).toBeVisible()
}

// Changing the view remounts the table, so tabs reset to their defaults
async function viewAs(page: Page, label: string) {
    await page.getByLabel('Protected view', { exact: true }).selectOption({ label })
}

async function viewHistoryAs(page: Page, label: string) {
    await viewAs(page, label)
    await page.getByText('History', { exact: true }).click()
}

test('protected views show only the cash each perspective may see', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await createGame(page, { concealedCash: true })
    await enterProtectedMode(page)

    await viewAs(page, 'Amira')
    await expect(page.getByText(/^1200\s*د\.م\.\s*dirham$/)).toHaveCount(1)
    await expect(page.getByText('Cash hidden')).toHaveCount(3)

    await viewAs(page, 'Spectator')
    await expect(page.getByText(/^1200\s*د\.م\.\s*dirham$/)).toHaveCount(0)
    await expect(page.getByText('Cash hidden')).toHaveCount(4)

    await viewAs(page, 'Host View')
    await expect(page.getByText('Cash hidden').first()).toBeVisible()
    expect(errors).toEqual([])
})

test('exploring is offered under Concealed Cash only in Host View', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await createGame(page, { concealedCash: true })
    await auctionFirstShop(page)
    await finishBidding(page)
    await enterProtectedMode(page)
    const explore = page.getByRole('button', { name: 'start exploring' })

    for (const view of ['Amira', 'Spectator']) {
        await viewHistoryAs(page, view)
        await expect(explore).toBeDisabled()
    }

    await viewHistoryAs(page, 'Host View')
    await expect(explore).toBeEnabled()
    await explore.click()
    await expect(explore.locator('svg').first()).toBeVisible()
    expect(errors).toEqual([])
})

test('the history in every protected view shows that a bid is in but never its amount', async ({
    page
}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await createGame(page)
    await auctionFirstShop(page)
    await page.getByRole('button', { name: 'Place bid' }).click()
    await expect(actionPanel(page).getByText(/Sealed bid for/)).toBeVisible()
    await enterProtectedMode(page)

    const viewer = page.getByLabel('Protected view', { exact: true })
    for (const view of await viewer.locator('option').allTextContents()) {
        await viewHistoryAs(page, view)
        const history = page.getByRole('tabpanel')
        await expect(history).toContainText('1 of 4 bids')
        await expect(history).not.toContainText('100')
    }
    expect(errors).toEqual([])
})

test('the waiting line agrees with "You" when the viewer is the one acting', async ({ page }) => {
    await createGame(page)
    await auctionFirstShop(page)
    await page.getByRole('button', { name: 'Place bid' }).click()
    await expect(actionPanel(page).getByText(/Sealed bid for/)).toBeVisible()
    await enterProtectedMode(page)
    await viewAs(page, 'Developer')
    await expect(actionPanel(page)).toContainText(/you are auctioning the/i)
    await viewAs(page, 'Spectator')
    await expect(actionPanel(page)).toContainText('Developer is auctioning the')
})
