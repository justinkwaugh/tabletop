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

// Plays setup, each player taking two larva cubes of a colour they hold behind their screen,
// so their first turn has polyps to place.
export async function playSetup(page: Page, playerCount: number) {
    const actions = actionPanel(page)
    const held: string[] = []
    for (let seat = 0; seat < playerCount; seat++) {
        await expect(actions).toContainText('Feed one of your polyps')
        const feeds = actions.getByRole('button', { name: /^Feed a / })
        const label = await feeds.first().getAttribute('aria-label')
        held.push(label?.split(' ')[2] ?? '')
        await feeds.last().click()
    }
    for (let seat = 0; seat < playerCount; seat++) {
        await expect(actions).toContainText('Take two larva cubes')
        const cube = actions.getByRole('button', { name: `Take a ${held[seat]} larva cube` })
        await cube.click()
        await cube.click()
    }
    await expect(actions).toContainText('Grow your reefs')
}
