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
        'strip',
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

test('contract, "Hover preview": a mouse hover or keyboard focus on a hand piece previews its hexes', async ({
    page
}) => {
    await createGame(page)
    const piece = page.locator('[data-turn-piece]').first()
    const previewed = board(page).locator('[data-previewed]')
    await piece.hover()
    await expect(previewed.first()).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(previewed).toHaveCount(0)

    // A key press first, so the focus that follows counts as keyboard focus (:focus-visible).
    await page.keyboard.press('Tab')
    await piece.focus()
    await expect(piece).toBeFocused()
    await expect(previewed.first()).toBeVisible()
    await piece.blur()
    await expect(previewed).toHaveCount(0)
})

test('contract, "Hover preview": a click moving focus to another piece keeps the hover the pointer set there', async ({
    page
}) => {
    await createGame(page)
    const railroads = await page
        .locator('[data-turn-piece]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-turn-piece')))
    const second = railroads.find((railroadId) => railroadId !== railroads[0])
    expect(second).toBeDefined()
    const hovered = () => page.evaluate(() => window.promontoryPointBoardSession.hoveredPiece)
    await page.locator(`[data-turn-piece="${railroads[0]}"]`).first().click()
    await page.locator(`[data-turn-piece="${second}"]`).first().click()
    expect(await hovered()).toBe(second)
    await page.mouse.move(0, 0)
    expect(await hovered()).toBeUndefined()
})

test('contract, "Hover preview": leaving a keyboard-focused piece returns the preview to the piece under the pointer', async ({
    page
}) => {
    await createGame(page)
    const railroads = await page
        .locator('[data-turn-piece]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-turn-piece')))
    const second = railroads.find((railroadId) => railroadId !== railroads[0])
    expect(second).toBeDefined()
    const hovered = () => page.evaluate(() => window.promontoryPointBoardSession.hoveredPiece)
    await page.locator(`[data-turn-piece="${second}"]`).first().hover()
    expect(await hovered()).toBe(second)

    // A key press first, so the focus that follows counts as keyboard focus (:focus-visible).
    const focused = page.locator(`[data-turn-piece="${railroads[0]}"]`).first()
    await page.keyboard.press('Tab')
    await focused.focus()
    expect(await hovered()).toBe(railroads[0])
    await focused.blur()
    expect(await hovered()).toBe(second)
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

test('R-1.2, R-1.3-H1, R-6.1: markers and the strip read the displayed state', async ({ page }) => {
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

test('O-8: the strip left of the map shows the bag, each deck with its price and count, and both end conditions', async ({
    page
}) => {
    await createGame(page)
    const state = await page.evaluate(() => {
        const s = window.promontoryPointBoardSession.gameState
        return {
            bag: s.bag.remaining,
            // R-1.2: the price is the track index less the four extra 0 spaces, never below 0.
            decks: (Object.keys(s.priceIndex) as (keyof typeof s.priceIndex)[]).map(
                (railroadId) => ({
                    railroadId,
                    count: s.shareDeckCount(railroadId),
                    price: Math.max(0, s.priceIndex[railroadId] - 4)
                })
            ),
            redTowns: Object.values(s.towns).filter((kind) => kind.startsWith('tile.red')).length
        }
    })
    // The strip sits beside the map, inside the board's one surface.
    const map = await board(page).locator('[data-layer="map"] image').boundingBox()
    const strip = board(page).locator('[data-layer="strip"]')
    const stripBox = await strip.boundingBox()
    expect(map).not.toBeNull()
    expect(stripBox).not.toBeNull()
    if (map && stripBox) {
        expect(stripBox.x + stripBox.width).toBeLessThan(map.x)
        expect(stripBox.y).toBeGreaterThanOrEqual(map.y - 1)
        expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(map.y + map.height)
    }

    const bag = strip.locator('[data-bag]')
    await expect(bag).toHaveAttribute('data-bag', String(state.bag))
    await expect(bag).toContainText('THE BAG')
    await expect(bag).toContainText(new RegExp(`${state.bag}\\s*pieces left`))

    await expect(strip.locator('[data-strip-shares]')).toContainText('SHARES FOR SALE')
    for (const { railroadId, count, price } of state.decks) {
        const deck = strip.locator(`[data-share-deck="${railroadId}"]`)
        await expect(deck).toHaveAttribute('data-price', String(price))
        await expect(deck.locator('[data-deck-price]')).toHaveText(`$${price}`)
        await expect(deck).toHaveAttribute('data-count', String(count))
        await expect(deck.locator('[data-deck-count]')).toHaveText(String(count))
    }

    const tracker = strip.locator('[data-end-tracker]')
    await expect(tracker).toContainText('GAME ENDS WHEN BOTH')
    await expect(tracker.locator('[data-end-line="red"]')).toHaveText(
        `${state.redTowns} red towns open`
    )
    await expect(tracker).toContainText('at most 1')
    await expect(tracker.locator('[data-end-line="promontory"]')).toHaveText('Promontory')
    await expect(tracker).toContainText(/Promontory\s*open/)
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
                await session.waitForVisibleTransitionSettled()
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
            await session.waitForVisibleTransitionSettled()
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
