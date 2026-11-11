import { expect, test, type Page } from '@playwright/test'

// Plays the opening of a hand in the dev harness, where one person takes every seat in turn.

async function createGame(page: Page) {
    await page.goto('/')
    await page.locator('button', { hasText: '+' }).first().click()
    await page.getByPlaceholder('choose a name for your game').fill('Smoke')
    const names = page.getByPlaceholder('player name')
    for (const [index, name] of ['Anna', 'Bert', 'Cora'].entries()) {
        await names.nth(index + 1).fill(name)
    }
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    await page.locator('button', { hasText: 'Create Game' }).click()
    await expect(page.locator('.action-area')).toContainText('Bid for the contract')
}

test('deals a hand with the talon in two piles of three', async ({ page }) => {
    await createGame(page)
    await expect(page.locator('.hand .slot')).toHaveCount(12)
    await expect(page.locator('.talon.middle .stack > .back')).toHaveCount(6)
})

test('lists the bids in a table, Besserrufer once with its birds', async ({ page }) => {
    await createGame(page)
    await page.locator('.action-area button', { hasText: 'Bid' }).click()
    const menu = page.locator('.menu:popover-open')
    await expect(menu).toContainText('Choose your bid')
    const besserrufer = menu.locator('.row', { hasText: 'Besserrufer' })
    await expect(besserrufer).toHaveCount(1)
    await expect(besserrufer).toContainText('3–9')
    await besserrufer.locator('button').click()
    for (const bird of ['Pagat', 'Uhu', 'Kakadu', 'Quapil']) {
        await expect(menu.locator('aside button', { hasText: bird })).toBeEnabled()
    }
    await menu.locator('aside button', { hasText: 'Uhu' }).click()
    await expect(page.locator('.action-area')).toContainText('Highest bid:')
    await expect(page.locator('.action-area')).toContainText('Besserrufer Uhu (5)')
})

test('names a Rufer after Mein Spiel and shows the called King', async ({ page }) => {
    await createGame(page)
    const area = page.locator('.action-area')
    await area.locator('button', { hasText: 'Mein Spiel' }).click()
    for (let pass = 0; pass < 3; pass++) {
        await area.locator('button', { hasText: /^Pass$/ }).click()
    }
    const menu = page.locator('.menu:popover-open')
    await expect(menu).toContainText('Name your contract')
    await menu
        .locator('.row', { hasText: /^\s*1\s*Rufer/ })
        .locator('button')
        .click()
    await area.locator('button.choice', { hasText: /^K/ }).first().click()
    await expect(page.locator('.header .called')).toContainText('called K')
})
