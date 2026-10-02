import { expect, test, type Page } from '@playwright/test'
import { actionPanel, auctionFirstShop, createGame } from './helpers'

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
    await expect(page.getByText('1200 Dirham')).toHaveCount(1)
    await expect(page.getByText('Cash hidden')).toHaveCount(3)

    await viewAs(page, 'Spectator')
    await expect(page.getByText('1200 Dirham')).toHaveCount(0)
    await expect(page.getByText('Cash hidden')).toHaveCount(4)

    await viewAs(page, 'Host View')
    await expect(page.getByText('Cash hidden').first()).toBeVisible()
    expect(errors).toEqual([])
})

test('protected views keep a sealed bid secret from everyone but its bidder', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await createGame(page)
    await auctionFirstShop(page)
    await page.getByRole('button', { name: 'Place bid' }).click()
    await expect(actionPanel(page).getByText(/^Sealed bid for/)).toBeVisible()
    await enterProtectedMode(page)

    await viewHistoryAs(page, 'Spectator')
    await expect(page.getByText('placed a sealed bid')).toHaveCount(1)
    await expect(page.getByText(/bid \d+ Dirham/)).toHaveCount(0)

    const viewer = page.getByLabel('Protected view', { exact: true })
    const players = (await viewer.locator('option').allTextContents()).filter(
        (label) => label !== 'Spectator' && label !== 'Host View'
    )
    let viewersWhoSeeTheAmount = 0
    for (const player of players) {
        await viewHistoryAs(page, player)
        await expect(page.getByText(/placed a sealed bid|bid \d+ Dirham/)).toHaveCount(1)
        viewersWhoSeeTheAmount += await page.getByText(/bid \d+ Dirham/).count()
    }
    expect(viewersWhoSeeTheAmount).toBe(1)

    await viewHistoryAs(page, 'Host View')
    await expect(page.getByText('placed a sealed bid')).toHaveCount(1)
    expect(errors).toEqual([])
})
