import { expect, test, type Page } from '@playwright/test'
import type { PromontoryPointGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        promontoryPointBoardSession: PromontoryPointGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function createGame(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.promontoryPointBoardSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Board')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(page.locator('svg.board')).toBeVisible()
    await expect.poll(() => page.evaluate(() => !!window.promontoryPointBoardSession)).toBe(true)
}

async function pickFirstPiece(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const session = window.promontoryPointBoardSession
        session.pressPiece(session.pickablePieces[0])
        return session.boardOffer.lit
    })
}

const board = (page: Page) => page.locator('svg.board')

test('contract, "Render ownership": the board draws its layers back to front', async ({ page }) => {
    await createGame(page)
    const layers = await board(page)
        .locator(':scope > g[data-layer]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-layer')))
    expect(layers).toEqual([
        'map',
        'town-tiles',
        'track-pieces',
        'this-turn',
        'price-markers',
        'money-markers',
        'sea',
        'pick-chrome',
        'hit-targets',
        'chips'
    ])
    await expect(board(page).locator('[data-layer="town-tiles"] [data-town-tile]')).toHaveCount(48)
    await expect(board(page).locator('[data-layer="hit-targets"] [data-space-id]')).toHaveCount(123)
    await expect(board(page).locator('[data-layer="chips"] > g')).toHaveCSS(
        'pointer-events',
        'none'
    )
})

test('R-3.3: a picked piece veils the board with one path holed at each lit hex and rings them', async ({
    page
}) => {
    await createGame(page)
    await expect(board(page).locator('[data-veil]')).toHaveCount(0)
    const lit = await pickFirstPiece(page)
    expect(lit.length).toBeGreaterThan(0)
    const veil = board(page).locator('[data-veil]')
    await expect(veil).toHaveCount(1)
    const subpaths = (await veil.getAttribute('d'))?.match(/M/g)?.length
    expect(subpaths).toBe(1 + lit.length)
    const rings = await board(page)
        .locator('[data-lit]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-lit')))
    expect(rings.sort()).toEqual([...lit].sort())
})

test('R-3.3: a press on a lit hex places the piece with its order badge', async ({ page }) => {
    await createGame(page)
    const [target] = await pickFirstPiece(page)
    await board(page).locator(`[data-layer="hit-targets"] [data-space-id="${target}"]`).click()
    await expect(board(page).locator(`[data-track-piece][data-space-id="${target}"]`)).toHaveCount(
        1
    )
    await expect(board(page).locator('[data-placement-order="1"]')).toHaveCount(1)
    await expect(board(page).locator('[data-veil]')).toHaveCount(0)
})

test('contract, "The principle": a press on an unlit town places nothing and enlarges its tile', async ({
    page
}) => {
    await createGame(page)
    const lit = await pickFirstPiece(page)
    const town = await page.evaluate(
        (litIds) =>
            Object.keys(window.promontoryPointBoardSession.gameState.towns).find(
                (spaceId) => !litIds.includes(spaceId)
            ),
        lit
    )
    expect(town).toBeDefined()
    const placedBefore = await page.evaluate(
        () => Object.keys(window.promontoryPointBoardSession.gameState.track).length
    )
    await board(page).locator(`[data-layer="hit-targets"] [data-space-id="${town}"]`).click()
    const enlarged = page.locator('[data-enlarged-view]')
    await expect(enlarged).toBeVisible()
    await expect(enlarged.getByRole('img')).toHaveAttribute('alt', / town tile$/)
    expect(
        await page.evaluate(
            () => Object.keys(window.promontoryPointBoardSession.gameState.track).length
        )
    ).toBe(placedBefore)
    await page.keyboard.press('Escape')
    await expect(enlarged).toHaveCount(0)
})

test('R-1.2, R-1.3-H1, R-6.1: markers and the sea read the displayed state', async ({ page }) => {
    await createGame(page)
    const state = await page.evaluate(() => {
        const s = window.promontoryPointBoardSession.gameState
        return {
            priceIndex: s.priceIndex,
            seats: s.players.length,
            bag: s.bag.remaining,
            redTowns: Object.values(s.towns).filter((kind) => kind.startsWith('tile.red')).length
        }
    })
    for (const [railroadId, priceIndex] of Object.entries(state.priceIndex)) {
        await expect(board(page).locator(`[data-price-marker="${railroadId}"]`)).toHaveAttribute(
            'data-price-index',
            String(priceIndex)
        )
    }
    await expect(board(page).locator('[data-money-marker]')).toHaveCount(state.seats)
    await expect(board(page).locator('[data-bag]')).toHaveAttribute('data-bag', String(state.bag))
    const tracker = board(page).locator('[data-end-tracker]')
    await expect(tracker).toHaveAttribute('data-red-tiles-uncovered', String(state.redTowns))
    await expect(tracker).toHaveAttribute('data-promontory-taken', 'false')
})

// Plays the seeded game's turns, placing on the last lit hex, until a picked piece lights a
// Dividend or Repairs town.
async function playUntilChip(page: Page): Promise<void> {
    const found = await page.evaluate(async () => {
        const session = window.promontoryPointBoardSession
        const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
        const chipShown = () => [...session.boardOffer.hexes.values()].some((hex) => hex.chip)
        for (let step = 0; step < 40; step++) {
            if (session.pickablePieces.length === 0) {
                await session.endTurn()
                await settle(300)
                continue
            }
            for (const railroadId of session.pickablePieces) {
                session.pressPiece(railroadId)
                await settle(20)
                if (chipShown()) return true
                if (session.hasManualSelection) session.pressPiece(railroadId)
            }
            session.pressPiece(session.pickablePieces[0])
            await settle(20)
            if (session.pickedPieceHasNoRoom) await session.scrapTrack()
            else await session.placeTrack(session.boardOffer.lit[session.boardOffer.lit.length - 1])
            await settle(200)
        }
        return false
    })
    expect(found).toBe(true)
}

test('O-3: a lit Dividend or Repairs town carries its chip, which never takes a press', async ({
    page
}) => {
    await createGame(page)
    await playUntilChip(page)
    const chip = board(page).locator('[data-chip]').first()
    await expect(chip).toHaveText(/^you (\+|pay )\$\d+$/)
    const spaceId = await chip.getAttribute('data-chip')
    await expect(board(page).locator(`[data-lit="${spaceId}"]`)).toHaveCount(1)
    const box = await chip.boundingBox()
    expect(box).not.toBeNull()
    const pressed = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-space-id') ?? null,
        { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 }
    )
    expect(pressed).not.toBeNull()
})

test('full screen opens the wrapper’s dialog with the action panel in its toolbar', async ({
    page
}) => {
    await createGame(page)
    await page.getByRole('button', { name: 'Enter full screen' }).click()
    const dialog = page.locator('dialog[aria-label="Full screen view"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('[data-fullscreen-panel]').getByRole('heading')).toHaveText(
        'Your turn'
    )
    await page.getByRole('button', { name: 'Exit full screen' }).click()
    await expect(page.locator('[data-fullscreen-panel]')).toHaveCount(0)
})
