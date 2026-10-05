import { expect, type Locator, type Page } from '@playwright/test'

export async function createGame(page: Page, { concealedCash = false } = {}) {
    await page.goto('/')
    // The dev server hydrates slowly, so a click before hydration is ignored
    const gameName = page.getByPlaceholder('choose a name for your game')
    await expect(async () => {
        await page.getByRole('button', { name: 'New game', exact: true }).click()
        await expect(gameName).toBeVisible({ timeout: 2_000 })
    }).toPass()
    await gameName.fill('Market check')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    if (concealedCash) {
        await page.locator('dialog label:has(input[type=checkbox])').first().click()
    }
    const names = page.locator('input[placeholder="player name"]:not([disabled])')
    for (const [index, name] of ['Amira', 'Bashir', 'Chadia'].entries()) {
        await names.nth(index).fill(name)
    }
    await page.getByRole('button', { name: 'Create Game' }).click()
    await expect(board(page)).toBeVisible()
}

export function board(page: Page): Locator {
    return page.getByRole('img', { name: 'MarraCash market' })
}

export function actionPanel(page: Page): Locator {
    return page.getByRole('region', { name: 'Actions' })
}

export function auctionableShops(page: Page): Locator {
    return page.locator('g[aria-label^="Auction shop"]')
}

export function destinationFountains(page: Page): Locator {
    return page.locator('g[aria-label^="Move visitors"]')
}

export async function finishBidding(page: Page) {
    while (await actionPanel(page).getByText('Sealed bid').count()) {
        const place = page.getByRole('button', { name: 'Place bid' })
        const before = await actionPanel(page).innerText()
        if (await place.count()) await place.click()
        else await page.getByRole('button', { name: 'Pass' }).click()
        await expect(actionPanel(page)).not.toHaveText(before)
    }
}

export async function auctionFirstShop(page: Page) {
    await auctionableShops(page).first().click()
}

export async function playOpeningRound(page: Page, players = 4) {
    for (let seat = 0; seat < players; seat++) {
        await auctionFirstShop(page)
        await finishBidding(page)
    }
    await expect(actionPanel(page)).toContainText(/move a fountain's visitors/i)
}

export function incomingVisitors(page: Page): Locator {
    return page.locator('g[aria-label="Visitor queue"] path[filter*="candidate-halo"]')
}
