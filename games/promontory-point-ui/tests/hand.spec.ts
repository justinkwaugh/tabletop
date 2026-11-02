import { expect, test, type Page } from '@playwright/test'
import {
    board,
    facts,
    failOnPageErrors,
    hexTarget,
    lit,
    openTable,
    placeOnOpenCountry,
    press,
    settled,
    trackPiece,
    turnPiece,
    viewAs
} from './support/table.js'

// Contract, "Your hand", "The strip" and "Phone layout"; O-6, R-6.1.
failOnPageErrors()

const hand = (page: Page) => page.locator('[data-your-hand]')
const stripHand = (page: Page) => board(page).locator('[data-layer="hand"] [data-your-hand]')
const tracker = (page: Page) => board(page).locator('[data-end-tracker]')

async function box(page: Page, selector: string) {
    const found = await page.locator(selector).first().boundingBox()
    if (!found) throw Error(`${selector} has a box`)
    return found
}

// The lit town of the kind, from the displayed state.
function litTownOf(page: Page, kindId: string): Promise<string> {
    return page.evaluate((kindId) => {
        const session = window.promontoryPointTableSession
        const spaceId = session.boardOffer.lit.find(
            (candidate) => session.gameState.towns[candidate] === kindId
        )
        if (spaceId === undefined) throw Error(`No lit ${kindId} town`)
        return spaceId
    }, kindId)
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 900 } })

    test('contract, "Your hand": the hand sits at the top of the strip beside the map, over the shares for sale, and not in the action panel', async ({
        page
    }) => {
        await openTable(page, 'Opening turn')
        const table = await facts(page)
        await expect(stripHand(page)).toHaveCount(1)
        await expect(stripHand(page)).toHaveAttribute('data-dimmed', 'false')
        await expect(stripHand(page)).toContainText('YOUR PIECES · TAP ONE')
        expect(
            await stripHand(page)
                .locator('[data-turn-piece]')
                .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-turn-piece')))
        ).toEqual(table.turnPieces)

        const pieces = await box(page, 'svg.board [data-your-hand]')
        const shares = await box(page, 'svg.board [data-strip-shares]')
        const map = await box(page, 'svg.board [data-layer="map"] image')
        expect(pieces.x + pieces.width).toBeLessThan(map.x)
        expect(pieces.y + pieces.height).toBeLessThan(shares.y)
        expect(pieces.y).toBeLessThan(map.y + map.height / 4)

        // The turn menu keeps its prompt and shares; the pieces are not in it.
        await expect(page.locator('.action-area [data-turn-piece]')).toHaveCount(0)
        await expect(page.locator('.action-area')).not.toContainText('Your pieces')
        await expect(page.locator('.action-area')).toContainText('Shares · 2 actions left')
    })

    test('O-2, R-3.3: picking, unpicking, keyboard picking and placing all work from the hand beside the map', async ({
        page
    }) => {
        await openTable(page, 'Opening turn')
        const [first] = (await facts(page)).turnPieces
        const tag = first.slice(-2).toUpperCase()
        const piece = turnPiece(page, tag).first()
        await press(piece)
        await expect(piece).toHaveAttribute('aria-pressed', 'true')
        await expect(piece).toContainText('picked')
        expect((await lit(page)).length).toBeGreaterThan(0)
        await press(piece)
        await expect(piece).toHaveAttribute('aria-pressed', 'false')
        expect(await lit(page)).toEqual([])

        // Keyboard: focus and Enter pick it, as a button would.
        await piece.focus()
        await page.keyboard.press('Enter')
        await expect(piece).toHaveAttribute('aria-pressed', 'true')

        const target = await page.evaluate(() => {
            const session = window.promontoryPointTableSession
            const spaceId = session.boardOffer.lit.find(
                (candidate) => !(candidate in session.gameState.towns)
            )
            if (spaceId === undefined) throw Error('An open hex is lit')
            return spaceId
        })
        await press(hexTarget(page, target))
        await expect(trackPiece(page, target)).toHaveCount(1)
        await settled(page)
        await expect(stripHand(page).locator('[data-hand-slot="0"]')).toHaveText('placed')
        await expect(stripHand(page).locator('[data-turn-piece]')).toHaveCount(2)
    })

    test('R-5: outside the viewer’s turn its own next hand rests beside the map, dimmed, and takes no press', async ({
        page
    }) => {
        await openTable(page, 'Opening turn')
        await viewAs(page, 'Royce')
        const own = await page.evaluate(() => {
            const session = window.promontoryPointTableSession
            const playerId = session.myPlayer?.id
            if (playerId === undefined) throw Error('A seat is on screen')
            return session.gameState.getPlayerState(playerId).knownHand()
        })
        expect(own).toHaveLength(3)
        await expect(stripHand(page)).toHaveAttribute('data-dimmed', 'true')
        await expect(stripHand(page)).toContainText('YOUR NEXT PIECES')
        await expect(stripHand(page).locator('[data-turn-piece]')).toHaveCount(0)
        const resting = stripHand(page).locator('[data-own-piece]')
        expect(
            await resting.evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute('data-own-piece'))
            )
        ).toEqual(own)
        await expect(resting.first()).toHaveCSS('opacity', '0.5')
        await resting.first().click()
        expect(await lit(page)).toEqual([])
    })

    test('R-6.3, contract, "Your hand": in the variant, the piece left after three placements takes no press or key', async ({
        page
    }) => {
        await openTable(page, 'Variant opening turn')
        await placeOnOpenCountry(page, 'CP')
        await placeOnOpenCountry(page, 'UP')
        await placeOnOpenCountry(page, 'KP')
        const keep = page.getByRole('button', { name: 'Keep SP · draw 3', exact: true })
        const giveBack = page.getByRole('button', { name: 'Return it · draw 4', exact: true })
        await expect(keep).toBeVisible()
        const leftover = stripHand(page).locator('[data-turn-piece]')
        await expect(leftover).toHaveCount(1)
        await expect(leftover).toHaveAttribute('aria-disabled', 'true')

        // A forced click reaches the piece even though it is marked disabled.
        await leftover.click({ force: true })
        await leftover.focus()
        await page.keyboard.press('Enter')
        await page.keyboard.press(' ')

        await expect(leftover).toHaveAttribute('aria-pressed', 'false')
        expect(await lit(page)).toEqual([])
        await expect(keep).toBeVisible()
        await expect(giveBack).toBeVisible()
    })

    test('O-6: every town tile, the Dividend and Repairs tiles too, turns a quarter turn on the board, enlarged and in the end tracker', async ({
        page
    }) => {
        await openTable(page, 'Opening turn')
        const tiles = board(page).locator('[data-layer="town-tiles"] [data-town-tile]')
        const turns = await tiles.evaluateAll((nodes) =>
            nodes.map((node) => [
                node.getAttribute('data-town-tile'),
                node.querySelector('image')?.getAttribute('transform')
            ])
        )
        expect(new Set(turns.map(([kind]) => kind)).size).toBe(8)
        expect(turns.filter(([, transform]) => transform !== 'rotate(90)')).toEqual([])

        await expect(tracker(page).locator('[data-end-icon="red"]')).toHaveAttribute(
            'transform',
            'rotate(90)'
        )

        const redTown = await page.evaluate(() => {
            const state = window.promontoryPointTableSession.gameState
            const town = Object.entries(state.towns).find(
                ([spaceId, kindId]) => kindId === 'tile.red.hammer' && !(spaceId in state.track)
            )
            if (town === undefined) throw Error('An open Repairs town')
            return town[0]
        })
        await hexTarget(page, redTown).dispatchEvent('click')
        const enlarged = page.locator('[data-enlarged-view="TownTile"] img')
        await expect(enlarged).toHaveAttribute('alt', 'Repairs town tile')
        await expect(enlarged).toHaveAttribute('style', /transform: rotate\(90deg\)/)
    })

    const condition = (page: Page, key: string) =>
        tracker(page).locator(`[data-end-condition="${key}"]`)

    test('R-6.1, R-6.1-H2: with neither condition met, two open rings, then "or" and the bag’s count', async ({
        page
    }) => {
        await openTable(page, 'Opening turn')
        await expect(condition(page, 'red').locator('[data-end-line]')).toHaveText(
            'Red towns open: 16'
        )
        await expect(condition(page, 'red')).toHaveAttribute('data-met', 'false')
        await expect(condition(page, 'red').locator('[data-end-tick="open"]')).toHaveCount(1)
        await expect(condition(page, 'promontory').locator('[data-end-line]')).toHaveText(
            'Promontory open'
        )
        await expect(condition(page, 'promontory').locator('[data-end-tick="open"]')).toHaveCount(1)
        await expect(tracker(page).locator('[data-end-tick="met"] path')).toHaveCount(0)
        const bag = (await facts(page)).bag
        await expect(tracker(page).locator('[data-end-or]')).toHaveText('or')
        await expect(tracker(page).locator('[data-bag]')).toHaveText(
            new RegExp(`^${bag}\\s*pieces left\\s*in the bag$`)
        )
    })

    test('R-6.1, R-6.1-H1: one condition met, then both, each with a drawn tick and no count or verdict', async ({
        page
    }) => {
        // One met: Promontory is taken, two red towns are open.
        await openTable(page, 'Two red tiles left')
        await expect(condition(page, 'red').locator('[data-end-line]')).toHaveText(
            'Red towns open: 2'
        )
        await expect(condition(page, 'red')).toHaveAttribute('data-met', 'false')
        await expect(condition(page, 'promontory').locator('[data-end-line]')).toHaveText(
            'Promontory taken'
        )
        await expect(condition(page, 'promontory')).toHaveAttribute('data-met', 'true')
        // The tick is a drawn ✓, not the colour alone.
        await expect(
            condition(page, 'promontory').locator('[data-end-tick="met"] path')
        ).toHaveCount(1)

        // Both met: covering one more red town leaves one open.
        await press(turnPiece(page, 'CP'))
        const town = await litTownOf(page, 'tile.red.dividend')
        await press(hexTarget(page, town))
        await expect(trackPiece(page, town)).toHaveCount(1)
        await settled(page)
        await expect(condition(page, 'red').locator('[data-end-line]')).toHaveText(
            'Red towns open: 1'
        )
        await expect(tracker(page).locator('[data-end-tick="met"] path')).toHaveCount(2)
        await expect(tracker(page)).not.toContainText(/of 2|game ends after|at most/i)
    })
})

test.describe('phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

    test('contract, "Phone layout": the hand is a bar right under the board; neither the strip nor the action panel holds it', async ({
        page
    }) => {
        await openTable(page, 'Opening turn')
        await expect(hand(page)).toHaveCount(1)
        await expect(stripHand(page)).toHaveCount(0)
        await expect(page.locator('.action-area [data-turn-piece]')).toHaveCount(0)
        const bar = await box(page, '[data-your-hand]')
        const boardColumn = await page
            .locator('svg.board')
            .evaluate((node) => node.closest('[style*="flex:1"]')?.getBoundingClientRect().bottom)
        const seats = await box(page, '[data-seat-strip]')
        expect(Math.abs(bar.y - (boardColumn ?? 0))).toBeLessThanOrEqual(2)
        expect(bar.y + bar.height).toBeLessThanOrEqual(seats.y + 1)

        const piece = page.locator('[aria-label="Turn pieces"] button:not([disabled])').first()
        await piece.tap()
        await expect(piece).toHaveAttribute('aria-pressed', 'true')
        expect((await lit(page)).length).toBeGreaterThan(0)
    })
})
