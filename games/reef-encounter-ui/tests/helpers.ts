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

const squareIn = (label: string) => {
    const match = label.match(/board (\d), row (\d+), column (\d+)/)
    return match ? { board: +match[1], row: +match[2], col: +match[3] } : undefined
}

// Plays turns that grow one coral at a time and attack whenever they can, until the acting
// player holds a consumed polyp. The seed in createGame reaches one within a few turns.
export async function playUntilConsumedPolyp(page: Page, maxTurns = 8) {
    const actions = actionPanel(page)
    for (let turn = 0; turn < maxTurns; turn++) {
        await expect(actions).toContainText('Grow your reefs')
        if ((await actions.getByRole('button', { name: /^Pay a consumed/ }).count()) > 0) {
            return
        }
        const cubes = actions.getByRole('button', { name: /^Play a \w+ larva cube$/ })
        if ((await cubes.count()) > 0) {
            await cubes.first().click()
            let last: ReturnType<typeof squareIn>
            for (let placed = 0; placed < 6; placed++) {
                const attacks = page.getByRole('button', { name: /^Attack with/ })
                if ((await attacks.count()) > 0) {
                    await attacks.first().click()
                    continue
                }
                const places = page.getByRole('button', { name: /^Place a / })
                const labels = await places.evaluateAll((elements) =>
                    elements.map((element) => element.getAttribute('aria-label') ?? '')
                )
                if (labels.length === 0) break
                const next = labels.findIndex((label) => {
                    const square = squareIn(label)
                    return (
                        last !== undefined &&
                        square !== undefined &&
                        square.board === last.board &&
                        Math.abs(square.row - last.row) + Math.abs(square.col - last.col) === 1
                    )
                })
                const index = Math.max(next, 0)
                last = squareIn(labels[index])
                await places.nth(index).click()
            }
        }
        await page
            .getByRole('button', { name: /^Take the \w+ larva cube/ })
            .first()
            .click()
    }
    throw new Error('No consumed polyp within the turns played')
}
