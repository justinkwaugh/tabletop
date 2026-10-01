import { expect, test } from '@playwright/test'

// R-1.23 — the Chancellor keeps a card and orders the other two, and the next seat is asked for a site.
test('a hotseat game opens on the Chancellor setup and hands the turn on', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Setup smoke')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()

    await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()
    const cards = page.locator('.panel').getByRole('button').filter({ hasNotText: 'Back' })
    await cards.first().click()
    await expect(page.getByText('Tap the card that is discarded first', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: /Undo/ }).click()
    await expect(page.getByText('Tap the card to keep', { exact: false })).toBeVisible()

    await cards.first().click()
    await cards.first().click()
    await expect(page.getByText('Tap the site where your pawn starts', { exact: false })).toBeVisible()
    expect(errors).toEqual([])
})
