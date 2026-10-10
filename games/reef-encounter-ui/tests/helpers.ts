import { expect, type Locator, type Page } from '@playwright/test'

export async function createGame(page: Page, playerCount = 3) {
    await page.goto('/')
    // The dev server hydrates slowly, so a click before hydration is ignored
    const gameName = page.getByPlaceholder('choose a name for your game')
    await expect(async () => {
        await page.getByRole('button', { name: 'New game', exact: true }).click()
        await expect(gameName).toBeVisible({ timeout: 2_000 })
    }).toPass()
    await gameName.fill('Reef check')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    await page.getByText(String(playerCount), { exact: true }).first().click()
    const names = page.locator('input[placeholder="player name"]:not([disabled])')
    for (const [index, name] of ['Amira', 'Bashir', 'Chadia'].slice(0, playerCount - 1).entries()) {
        await names.nth(index).fill(name)
    }
    await page.getByRole('button', { name: 'Create Game' }).click()
    // The new-game dialog stays modal while it closes, leaving the table inert and unfocusable
    await page.waitForFunction(() => document.querySelector('dialog:modal') === null)
}

export function actionPanel(page: Page): Locator {
    return page.getByRole('region', { name: 'Actions' })
}
