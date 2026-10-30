import { expect, test, type Locator, type Page } from '@playwright/test'
import type { PromontoryPointGameSession } from '../../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        promontoryPointTableSession: PromontoryPointGameSession
    }
}

// The named tables the dev harness lists under Scenarios (src/scenarios/*.json).
export type TableName =
    | 'Opening turn'
    | 'Buy refused'
    | 'Sell at zero'
    | 'Towns in reach'
    | 'Price limits'
    | 'No room'
    | 'Pieces placed'
    | 'Variant opening turn'
    | 'Variant nothing left'
    | 'Repairs all pay'
    | 'Repairs one short'
    | 'Repairs two short'
    | 'Repairs short after everything'

// The invented seats every table deals, in turn order.
export type SeatName = 'Mara' | 'Royce' | 'Ines' | 'Tobias'

// Contract, "Verification scenarios": desktop width, and a 390 × 844 phone by touch.
export const WIDTHS = [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    {
        name: 'phone',
        use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
    }
] as const

// Every spec fails on an uncaught page error.
export function failOnPageErrors(): void {
    const pageErrors = new WeakMap<Page, string[]>()
    test.beforeEach(({ page }) => {
        const errors: string[] = []
        pageErrors.set(page, errors)
        page.on('pageerror', (error) => errors.push(error.message))
    })
    test.afterEach(({ page }) => {
        expect(pageErrors.get(page)).toEqual([])
    })
}

// Opens the named table from the harness's Scenarios menu, with the session in reach of specs.
export async function openTable(page: Page, name: TableName): Promise<void> {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.promontoryPointTableSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Scenarios', exact: true }).click()
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.locator('svg.board')).toBeVisible()
    await expect.poll(() => page.evaluate(() => !!window.promontoryPointTableSession)).toBe(true)
    await settled(page)
}

// The seat's player id, read from the open game.
export function playerIdOf(page: Page, seat: SeatName): Promise<string> {
    return page.evaluate((seat) => {
        const player = window.promontoryPointTableSession.primaryGame.players.find(
            (candidate) => candidate.name === seat
        )
        if (player === undefined) throw Error(`No seat named ${seat}`)
        return player.id
    }, seat)
}

// Reloads the open game in the harness's protected mode as the seat, so the page is that seat's
// own client: it holds only that seat's projection and decides only for that seat.
export async function viewAs(page: Page, seat: SeatName): Promise<void> {
    const playerId = await playerIdOf(page, seat)
    await reloaded(page, async () => {
        const view = page.getByLabel('Protected view')
        if ((await view.count()) === 0) {
            await page.locator('#harness-options').click()
            await page.getByText('Protected mode', { exact: true }).click()
            await page.locator('#harness-options').click()
        }
        await expect(view).toBeEnabled()
        await view.selectOption({ label: seat })
    })
    await expect
        .poll(() => page.evaluate(() => window.promontoryPointTableSession.myPlayer?.id))
        .toBe(playerId)
}

// One seat's client hands the game as it now stands to another seat's client, as the host
// would after an action: saved with Save as scenario, opened in the other page from the file.
// What one client holds only for itself (a pick, a staged sale) never travels.
export async function handOver(from: Page, to: Page): Promise<void> {
    await from.getByRole('button', { name: 'Scenarios', exact: true }).click()
    const download = from.waitForEvent('download')
    await from.getByText('Save as scenario', { exact: true }).click()
    const file = await (await download).path()
    await reloaded(to, () => to.locator('input[aria-label="Scenario file"]').setInputFiles(file))
    expect(await actionCount(to)).toBe(await actionCount(from))
}

const actionCount = (page: Page) =>
    page.evaluate(() => window.promontoryPointTableSession.actions.length)

// Runs the step and waits for the harness to open a fresh session for the game.
async function reloaded(page: Page, step: () => Promise<void>): Promise<void> {
    await page.evaluate(() => {
        Object.assign(window, { promontoryPointEarlierSession: window.promontoryPointTableSession })
    })
    await step()
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.promontoryPointTableSession !==
                    Reflect.get(window, 'promontoryPointEarlierSession')
            )
        )
        .toBe(true)
    await expect(page.locator('svg.board')).toBeVisible()
    await settled(page)
}

// Waits until no state transition is playing on screen.
export async function settled(page: Page): Promise<void> {
    await page.evaluate(() => window.promontoryPointTableSession.waitForVisibleTransitionSettled())
}

export const board = (page: Page) => page.locator('svg.board')
export const header = (page: Page) => page.locator('h2').first()
export const undoButton = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
export const turnPiece = (page: Page, tag: string) =>
    page.locator('[aria-label="Turn pieces"] [data-turn-piece]').filter({ hasText: tag })
export const sharesHeading = (page: Page) =>
    page.locator('.pp-block-heading').filter({ hasText: /^Shares/ })
export const litSpaces = (page: Page) => board(page).locator('[data-lit]')
export const hexTarget = (page: Page, spaceId: string) =>
    board(page).locator(`[data-layer="hit-targets"] [data-space-id="${spaceId}"]`)
export const trackPiece = (page: Page, spaceId: string) =>
    board(page).locator(`[data-track-piece][data-space-id="${spaceId}"]`)

// Opens the side column's History tab (it replaces the seat cards) and returns the log.
export async function history(page: Page): Promise<Locator> {
    const tab = page.getByRole('tab', { name: 'History' })
    if ((await tab.getAttribute('aria-selected')) !== 'true') await press(tab)
    return page.locator('.history')
}

// The share block's row for a railroad, by its full name.
export function shareEntry(page: Page, name: string): Locator {
    return page.locator('.entry').filter({ has: page.getByRole('img', { name: `${name} share` }) })
}

// A press that works at both widths: a tap on a touch screen, a click otherwise.
export async function press(locator: Locator): Promise<void> {
    const touch = await locator.page().evaluate(() => navigator.maxTouchPoints > 0)
    if (touch) await locator.tap()
    else await locator.click()
}

// The lit hexes' space ids, sorted.
export async function lit(page: Page): Promise<string[]> {
    const ids = await litSpaces(page).evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-lit') ?? '')
    )
    return ids.sort()
}

// The session's view of the table, read straight from the displayed state.
export function facts(page: Page) {
    return page.evaluate(() => {
        const session = window.promontoryPointTableSession
        const state = session.gameState
        return {
            players: state.players.map((player) => ({
                playerId: player.playerId,
                money: player.money,
                shares: { ...player.shares },
                handCount: player.handCount,
                keptPiece: player.keptPiece
            })),
            priceIndex: { ...state.priceIndex },
            track: { ...state.track },
            turnPieces: [...(state.turn?.pieces ?? [])],
            placementsMade: state.turn?.placementsMade ?? 0,
            placementsLeft: state.turn?.placementsLeft ?? 0,
            bag: state.bag.count(),
            machineState: state.machineState,
            activePlayerIds: [...state.activePlayerIds],
            turnOrder: [...state.turnManager.turnOrder],
            deck: Object.fromEntries(
                (['railroad.cp', 'railroad.up', 'railroad.kp', 'railroad.sp'] as const).map(
                    (railroadId) => [railroadId, state.shareDeckCount(railroadId)]
                )
            )
        }
    })
}

// Picks the piece in the panel and presses a lit hex that holds no town, then waits for it to land.
export async function placeOnOpenCountry(page: Page, tag: string): Promise<string> {
    const piece = turnPiece(page, tag).first()
    if ((await piece.getAttribute('aria-pressed')) !== 'true') await press(piece)
    const target = await page.evaluate(() => {
        const session = window.promontoryPointTableSession
        const state = session.gameState
        const spaceId = session.boardOffer.lit.find(
            (candidate) => !(candidate in state.towns) && candidate !== 'space.0.0'
        )
        if (spaceId === undefined) throw Error('An open hex with no town is lit')
        return spaceId
    })
    await press(hexTarget(page, target))
    await expect(trackPiece(page, target)).toHaveCount(1)
    await settled(page)
    return target
}
