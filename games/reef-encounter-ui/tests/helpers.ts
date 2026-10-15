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

export async function openScenario(page: Page, name: string) {
    await page.goto('/')
    await expect(async () => {
        await page.getByRole('button', { name: 'Scenarios' }).click()
        await page.getByRole('button', { name, exact: true }).click({ timeout: 2_000 })
    }).toPass()
    await expect(actionPanel(page)).toContainText('Choose your actions')
}

export function actionPanel(page: Page): Locator {
    return page.getByRole('region', { name: 'Actions' })
}

// Plays setup, each player taking two larva cubes of a colour they hold in their supply,
// so their first turn has polyps to place.
export async function playSetup(page: Page, playerCount: number) {
    const actions = actionPanel(page)
    const held: string[] = []
    for (let seat = 0; seat < playerCount; seat++) {
        await expect(actions).toContainText('Feed one of your polyps')
        const feeds = actions.getByRole('button', { name: /^Feed an? / })
        const label = await feeds.first().getAttribute('aria-label')
        held.push(label?.split(' ')[2] ?? '')
        await feeds.last().click()
    }
    for (let seat = 0; seat < playerCount; seat++) {
        await expect(actions).toContainText('Take two larva cubes')
        const cube = actions.getByRole('button', {
            name: new RegExp(`^Take an? ${held[seat]} larva cube$`)
        })
        await cube.click()
        await cube.click()
    }
    await expect(actions).toContainText('Choose your actions')
}

// The table ignores choices while a change plays out, and its rings still show the old state, so
// anything that reads what is on offer waits for it to settle first.
export async function settled(page: Page) {
    await expect(page.locator('.reef-table[aria-busy="true"]')).toHaveCount(0)
}

export async function settledCount(page: Page, locator: Locator) {
    await settled(page)
    return locator.count()
}
