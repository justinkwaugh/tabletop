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

type Square = { board: number; row: number; col: number }
const squareKey = (square: Square) => `${square.board}:${square.row}:${square.col}`
const neighbours = (square: Square): Square[] =>
    [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ].map(([row, col]) => ({ board: square.board, row: square.row + row, col: square.col + col }))

const targetSquare = (label: string): Square | undefined => {
    const match = label.match(/board (\d), row (\d+), column (\d+)/)
    return match ? { board: +match[1], row: +match[2] - 1, col: +match[3] - 1 } : undefined
}

// Where each colour's polyps lie, read from the reef boards' polyp images: a face's file names
// its colour, and its position (before the board is turned) its square.
async function squaresOfColor(page: Page, color: string): Promise<Set<string>> {
    const squares = await page.locator('svg[aria-label^="Reef board"]').evaluateAll(
        (boards, wanted) =>
            boards.flatMap((svg) => {
                const board = Number(svg.getAttribute('aria-label')?.split(' ')[2])
                return [...svg.querySelectorAll('image')].flatMap((image) => {
                    const href = image.getAttribute('href') ?? ''
                    if (!new RegExp(`polyps/${wanted}-\\d+`).test(href)) return []
                    const col = Math.round((Number(image.getAttribute('x')) - 138.9) / 144)
                    const row = Math.round((Number(image.getAttribute('y')) - 159.1) / 143.4)
                    return [`${board}:${row}:${col}`]
                })
            }),
        color
    )
    return new Set(squares)
}

async function labelsOf(locator: Locator): Promise<string[]> {
    return locator.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('aria-label') ?? '')
    )
}

// Plays turns that grow one coral of the colour the acting player holds most, guarded by their
// shrimp, until eating is offered at the start of a turn.
export async function playUntilCoralIsEdible(page: Page, maxTurns = 8) {
    const actions = actionPanel(page)
    for (let turn = 0; turn < maxTurns; turn++) {
        await expect(actions).toContainText('Grow your reefs')
        if ((await actions.getByRole('button', { name: 'Eat a coral' }).count()) > 0) {
            return
        }
        const cubes = actions.getByRole('button', { name: /^Play a \w+ larva cube$/ })
        const counts = await cubes.evaluateAll((elements) =>
            elements.map((element) => Number(element.textContent?.trim()) || 0)
        )
        if (counts.length > 0) {
            const best = counts.indexOf(Math.max(...counts))
            const color = (await labelsOf(cubes))[best].split(' ')[2]
            await cubes.nth(best).click()
            const places = page.getByRole('button', { name: /^(Place|Attack with) a / })
            for (let placed = 0; placed < 8 && (await places.count()) > 0; placed++) {
                const coral = await squaresOfColor(page, color)
                const index = (await labelsOf(places)).findIndex((label) => {
                    const square = targetSquare(label)
                    return (
                        square !== undefined &&
                        neighbours(square).some((next) => coral.has(squareKey(next)))
                    )
                })
                await places.nth(Math.max(index, 0)).click()
            }
            const introduce = actions.getByRole('button', { name: 'Introduce a shrimp' })
            const hasShrimpOut =
                (await page.getByRole('button', { name: /^Pick up your shrimp/ }).count()) > 0
            if ((await introduce.count()) > 0 && !hasShrimpOut) {
                const coral = await squaresOfColor(page, color)
                await introduce.click()
                const spots = page.getByRole('button', { name: /^Put your shrimp on / })
                const index = (await labelsOf(spots)).findIndex((label) => {
                    const square = targetSquare(label)
                    return square !== undefined && coral.has(squareKey(square))
                })
                await spots.nth(Math.max(index, 0)).click()
            }
        }
        await page
            .getByRole('button', { name: /^Take the \w+ larva cube/ })
            .first()
            .click()
    }
    throw new Error('No coral became edible within the turns played')
}
