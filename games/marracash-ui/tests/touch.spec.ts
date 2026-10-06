import { devices, expect, test, type Locator, type Page } from '@playwright/test'
import { actionPanel, auctionableShops, createGame } from './helpers'

test.use({ ...devices['iPhone 13'], browserName: 'chromium' })

// The board opens zoomed in, so only targets in the middle of the screen are tappable without panning
async function inView(page: Page, targets: Locator): Promise<Locator> {
    const viewport = page.viewportSize() ?? { width: 0, height: 0 }
    const sidePanelEdge = viewport.width * 0.27
    // Choices are withheld while the session is busy, so wait for them to be offered
    await targets.first().waitFor({ state: 'attached', timeout: 20_000 })
    for (let index = 0; index < (await targets.count()); index++) {
        const box = await targets.nth(index).boundingBox()
        if (!box) continue
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        if (x > sidePanelEdge && x < viewport.width - 8 && y > 0 && y < viewport.height - 8) {
            return targets.nth(index)
        }
    }
    throw new Error('No target is in view')
}

test('a touch screen moves with one tap and toggles highlights by tapping', async ({ page }) => {
    test.setTimeout(120_000)
    await createGame(page)

    // Round one is all auctions: each seat auctions a shop and everyone bids the minimum
    for (let seat = 0; seat < 4; seat++) {
        await (await inView(page, auctionableShops(page))).tap()
        for (let bid = 0; bid < 4; bid++) {
            const before = await actionPanel(page).innerText()
            await page.getByRole('button', { name: /Place bid|Pass/ }).tap()
            await expect.poll(() => actionPanel(page).innerText()).not.toEqual(before)
        }
    }

    const fountains = page.locator('g[role=button][aria-label^="Fountain"]')
    await (await inView(page, fountains)).tap()
    const destinations = page.locator('g[aria-label^="Move visitors to fountain"]')
    await (await inView(page, destinations)).tap()
    await expect(actionPanel(page)).not.toContainText('Choose the destination', {
        timeout: 10_000
    })
    await expect(page.getByRole('button', { name: 'Move here' })).toHaveCount(0)

    const counter = page.locator('[role=button][aria-label$=" customers"]').first()
    await counter.tap()
    await expect(counter).toHaveAttribute('aria-pressed', 'true')
    await counter.tap()
    await expect(counter).toHaveAttribute('aria-pressed', 'false')

    await page.getByRole('tab', { name: /History/ }).tap()
    const entry = page.locator('.history [role=button]').filter({ hasText: 'moved' }).first()
    const arrows = page.locator('marker[id^="marracash-history-arrow"]')
    await entry.tap()
    await expect(arrows.first()).toBeAttached()
    await entry.tap()
    await expect(arrows).toHaveCount(0)
})
