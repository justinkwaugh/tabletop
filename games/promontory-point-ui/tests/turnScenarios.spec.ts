import { expect, test, type Locator, type Page } from '@playwright/test'
import {
    WIDTHS,
    board,
    facts,
    failOnPageErrors,
    header,
    hexTarget,
    history,
    lit,
    openTable,
    placeOnOpenCountry,
    press,
    settled,
    shareEntry,
    sharesHeading,
    trackPiece,
    turnPiece,
    undoButton
} from './support/table.js'

// docs/ui-interaction-visual-contract.md, "Verification scenarios", The turn (1–15).
test.describe.configure({ mode: 'parallel' })
failOnPageErrors()

const CP = 'railroad.cp'
const UP = 'railroad.up'
const KP = 'railroad.kp'
const SP = 'railroad.sp'
const MARA = 'p1'
const ROYCE = 'p3'
const LOCKED_NOTE = 'Buying and selling open again after your third piece'

const buy = (page: Page, name: string) =>
    shareEntry(page, name).getByRole('button', { name: /^Buy/ })
const sell = (page: Page, name: string) =>
    shareEntry(page, name).getByRole('button', { name: /^Sell/ })
const tradeButtons = (page: Page) => page.locator('.entry .trade button')
const seatHand = (page: Page, name: string) =>
    page.locator(`[aria-label="${name}'s seat"] [data-hand-piece]`)
const handFaces = (page: Page, name: string) =>
    seatHand(page, name).evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-hand-piece'))
    )
const pressedPieces = (page: Page) =>
    page.locator('[aria-label="Turn pieces"] [data-turn-piece][aria-pressed="true"]')
const panelPieces = (page: Page) => page.locator('[aria-label="Turn pieces"] [data-turn-piece]')
// Mara's turn in the log: one entry headed by her name, growing line by line.
const maraTurn = (log: Locator) => log.locator('.turn').filter({ hasText: /Mara\s*Turn 1/ })
const playerOf = async (page: Page, playerId: string) => {
    const player = (await facts(page)).players.find((seat) => seat.playerId === playerId)
    if (!player) throw Error(`No player ${playerId}`)
    return player
}

// The town under each lit hex of the given kind, from the displayed state.
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

for (const width of WIDTHS) {
    test.describe(width.name, () => {
        test.use(width.use)

        test('scenario 1 (R-2.2 step 1, R-5): ending a turn reveals the next hand to all, with no Undo across it', async ({
            page
        }) => {
            await openTable(page, 'Pieces placed')
            expect(await handFaces(page, 'Royce')).toEqual(['hidden', 'hidden', 'hidden'])

            await press(page.getByRole('button', { name: 'End turn · draw 3', exact: true }))
            await expect(header(page)).toHaveText('Your turn')
            await settled(page)
            const table = await facts(page)
            expect(table.activePlayerIds).toEqual([ROYCE])
            await expect(panelPieces(page)).toHaveCount(3)
            const revealed = await handFaces(page, 'Royce')
            expect(revealed).toEqual(table.turnPieces)
            expect(await handFaces(page, 'Mara')).toEqual(['hidden', 'hidden', 'hidden'])
            expect(await handFaces(page, 'Ines')).toEqual(['hidden', 'hidden', 'hidden'])
            await expect(undoButton(page)).toHaveCount(0)

            // Any other seat sees the same: the header names Royce, his hand face up.
            await page.evaluate(() =>
                window.promontoryPointTableSession.setViewingAsNonActivePlayer(true)
            )
            await expect(header(page)).toHaveText("Royce's turn")
            expect(await handFaces(page, 'Royce')).toEqual(revealed)
            await expect(undoButton(page)).toHaveCount(0)
        })

        test('scenario 2 (R-3.1): Buy on a $5 railroad costs $5, adds the share, takes it from the deck; Undo restores all three', async ({
            page
        }) => {
            await openTable(page, 'Opening turn')
            const before = await playerOf(page, MARA)
            expect(before.money).toBe(20)
            const deck = (await facts(page)).deck[UP]
            await expect(sharesHeading(page)).toHaveText('Shares · 2 actions left')

            await press(buy(page, 'Union Pacific'))
            await settled(page)
            await expect(sharesHeading(page)).toHaveText('Shares · 1 action left')
            await expect(
                page.locator('[aria-label="Mara\'s seat"] [data-seat-money]')
            ).toHaveAttribute('data-seat-money', '15')
            const after = await playerOf(page, MARA)
            expect([after.money, after.shares[UP], (await facts(page)).deck[UP]]).toEqual([
                15,
                before.shares[UP] + 1,
                deck - 1
            ])

            await press(undoButton(page))
            await settled(page)
            await expect(sharesHeading(page)).toHaveText('Shares · 2 actions left')
            const undone = await playerOf(page, MARA)
            expect([undone.money, undone.shares[UP], (await facts(page)).deck[UP]]).toEqual([
                20,
                before.shares[UP],
                deck
            ])
        })

        test('scenario 3 (R-3.1): Buy is dimmed with its reason for an empty deck and a price above the money', async ({
            page
        }) => {
            await openTable(page, 'Buy refused')
            await expect(buy(page, 'Southern Pacific')).toBeDisabled()
            await expect(shareEntry(page, 'Southern Pacific')).toContainText('none left')
            await expect(buy(page, 'Central Pacific')).toBeDisabled()
            await expect(shareEntry(page, 'Central Pacific')).toContainText('you have $3')

            // A press does nothing but show the reason.
            await buy(page, 'Central Pacific').click({ force: true })
            await expect(sharesHeading(page)).toHaveText('Shares · 2 actions left')
            expect((await playerOf(page, MARA)).money).toBe(3)
            await expect(shareEntry(page, 'Central Pacific')).toContainText('you have $3')
        })

        test('scenario 4 (R-3.2-H1): selling at price 0 pays nothing, returns the share and uses an action', async ({
            page
        }) => {
            await openTable(page, 'Sell at zero')
            const before = await playerOf(page, MARA)
            const deck = (await facts(page)).deck[UP]
            await expect(sell(page, 'Union Pacific')).toContainText('$0')

            await press(sell(page, 'Union Pacific'))
            await settled(page)
            const after = await playerOf(page, MARA)
            expect([after.money, after.shares[UP], (await facts(page)).deck[UP]]).toEqual([
                before.money,
                before.shares[UP] - 1,
                deck + 1
            ])
            await expect(sharesHeading(page)).toHaveText('Shares · 1 action left')
        })

        test('scenario 5 (R-2.2, R-2.2-H1): after two share actions every Buy and Sell is dimmed, and stays so after the third placement', async ({
            page
        }) => {
            await openTable(page, 'Opening turn')
            await press(buy(page, 'Union Pacific'))
            await settled(page)
            await press(buy(page, 'Central Pacific'))
            await settled(page)
            await expect(sharesHeading(page)).toHaveText('Shares · no share actions left')
            for (const button of await tradeButtons(page).all()) await expect(button).toBeDisabled()

            await placeOnOpenCountry(page, 'CP')
            await placeOnOpenCountry(page, 'KP')
            await placeOnOpenCountry(page, 'KP')
            await expect(page.getByRole('button', { name: 'End turn · draw 3' })).toBeVisible()
            await expect(sharesHeading(page)).toHaveText('Shares · no share actions left')
            await expect(tradeButtons(page)).toHaveCount(8)
            for (const button of await tradeButtons(page).all()) await expect(button).toBeDisabled()
        })

        test('scenario 6 (O-2, O-3, R-3.3, R-4.1, R-X.2): pick lights hexes and chips, a second press unpicks; a placement resolves its town and Undo reverses it', async ({
            page
        }) => {
            await openTable(page, 'Towns in reach')
            await press(turnPiece(page, 'CP'))
            await expect(turnPiece(page, 'CP')).toHaveAttribute('aria-pressed', 'true')
            expect((await lit(page)).length).toBeGreaterThan(0)
            await expect(board(page).locator('[data-veil]')).toHaveCount(1)
            const dividend = await litTownOf(page, 'tile.red.dividend')
            const repairs = await litTownOf(page, 'tile.red.hammer')
            await expect(board(page).locator(`[data-chip="${dividend}"]`).first()).toBeAttached()
            await expect(board(page).locator(`[data-chip="${repairs}"]`).first()).toBeAttached()

            await press(turnPiece(page, 'CP'))
            await expect(pressedPieces(page)).toHaveCount(0)
            expect(await lit(page)).toEqual([])

            await press(turnPiece(page, 'CP'))
            const town = await litTownOf(page, 'tile.price.plus-2')
            await press(hexTarget(page, town))
            await expect(trackPiece(page, town)).toHaveCount(1)
            await settled(page)
            expect((await facts(page)).priceIndex[CP]).toBe(11)
            await expect(board(page).locator('[data-placement-order="1"]')).toHaveCount(1)

            await press(undoButton(page))
            await settled(page)
            await expect(trackPiece(page, town)).toHaveCount(0)
            expect((await facts(page)).priceIndex[CP]).toBe(9)
            await expect(panelPieces(page)).toHaveCount(3)
            // The pick went with the action: nothing is picked and nothing is left to undo.
            await expect(pressedPieces(page)).toHaveCount(0)
            await expect(undoButton(page)).toHaveCount(0)
            await expect(board(page).locator('[data-placement-order]')).toHaveCount(0)
        })

        test('scenario 7 (O-2, R-3.3): with a piece picked an unlit hex places nothing, and an unlit town enlarges its tile', async ({
            page
        }) => {
            await openTable(page, 'Towns in reach')
            await press(turnPiece(page, 'CP'))
            const { unlitEmpty, unlitTown } = await page.evaluate(() => {
                const session = window.promontoryPointTableSession
                const state = session.gameState
                const litSpaces = new Set<string>(session.boardOffer.lit)
                const free = [
                    ...document.querySelectorAll('[data-layer="hit-targets"] [data-space-id]')
                ]
                    .map((node) => node.getAttribute('data-space-id') ?? '')
                    .filter((spaceId) => !litSpaces.has(spaceId) && !(spaceId in state.track))
                const unlitTown = free.find((spaceId) => spaceId in state.towns)
                const unlitEmpty = free.find(
                    (spaceId) => !(spaceId in state.towns) && spaceId !== 'space.0.0'
                )
                if (!unlitTown || !unlitEmpty) throw Error('An unlit town and open country')
                return { unlitEmpty, unlitTown }
            })
            const track = (await facts(page)).track

            await hexTarget(page, unlitEmpty).dispatchEvent('click')
            await settled(page)
            expect((await facts(page)).track).toEqual(track)
            await expect(page.locator('[data-enlarged-view]')).toHaveCount(0)

            await hexTarget(page, unlitTown).dispatchEvent('click')
            await expect(page.locator('[data-enlarged-view]')).toHaveAttribute(
                'data-enlarged-view',
                'TownTile'
            )
            expect((await facts(page)).track).toEqual(track)
        })

        test('scenario 8 (O-2, R-X.2): with two KP pieces left KP is picked by itself, and Undo goes straight to the last placement', async ({
            page
        }) => {
            await openTable(page, 'Opening turn')
            await expect(pressedPieces(page)).toHaveCount(0)
            const placed = await placeOnOpenCountry(page, 'CP')
            await expect(turnPiece(page, 'KP').first()).toHaveAttribute('aria-pressed', 'true')
            expect((await lit(page)).length).toBeGreaterThan(0)

            await press(undoButton(page))
            await settled(page)
            await expect(trackPiece(page, placed)).toHaveCount(0)
            await expect(panelPieces(page)).toHaveCount(3)
            await expect(pressedPieces(page)).toHaveCount(0)
            expect((await facts(page)).placementsMade).toBe(0)
        })

        test('scenario 9 (R-2.2-H1): shares lock after the first placement, with the note, and open after the third', async ({
            page
        }) => {
            await openTable(page, 'Opening turn')
            await placeOnOpenCountry(page, 'CP')
            await expect(page.getByText(LOCKED_NOTE, { exact: true })).toBeVisible()
            for (const button of await tradeButtons(page).all()) await expect(button).toBeDisabled()

            await placeOnOpenCountry(page, 'KP')
            await placeOnOpenCountry(page, 'KP')
            await expect(page.getByText(LOCKED_NOTE, { exact: true })).toHaveCount(0)
            await expect(sharesHeading(page)).toHaveText('Shares · 2 actions left')
            await expect(buy(page, 'Union Pacific')).toBeEnabled()
        })

        test('scenario 10 (R-1.2, R-4.1): a +3 town at $24 stops at $25, a −2 town on the fourth 0 stops on the fifth, each logged as capped', async ({
            page
        }) => {
            await openTable(page, 'Price limits')
            await press(turnPiece(page, 'KP'))
            await press(hexTarget(page, await litTownOf(page, 'tile.price.plus-3')))
            await settled(page)
            expect((await facts(page)).priceIndex[KP]).toBe(29)
            await expect(board(page).locator(`[data-price-marker="${KP}"]`)).toHaveAttribute(
                'data-price-index',
                '29'
            )
            await expect(await history(page)).toContainText('$24 → $25 (capped)')

            await press(turnPiece(page, 'UP'))
            await press(hexTarget(page, await litTownOf(page, 'tile.price.minus-2')))
            await settled(page)
            expect((await facts(page)).priceIndex[UP]).toBe(0)
            await expect(board(page).locator(`[data-price-marker="${UP}"]`)).toHaveAttribute(
                'data-price-index',
                '0'
            )
            await expect(await history(page)).toContainText('stays at $0 (1 space down, capped)')
        })

        test('scenario 11 (R-4.1, R-6.1): Promontory raises the price by 5 and the end tracker reads it taken', async ({
            page
        }) => {
            await openTable(page, 'Price limits')
            const tracker = board(page).locator('[data-end-tracker]')
            await expect(tracker).toHaveAttribute('data-promontory-taken', 'false')
            await press(turnPiece(page, 'SP'))
            expect(await lit(page)).toContain('space.0.0')
            await press(hexTarget(page, 'space.0.0'))
            await expect(trackPiece(page, 'space.0.0')).toHaveCount(1)
            await settled(page)
            expect((await facts(page)).priceIndex[SP]).toBe(14)
            await expect(tracker).toHaveAttribute('data-promontory-taken', 'true')
            await expect(tracker).toContainText('Promontory taken ✓')
        })

        test('scenario 12 (R-4.2): a Dividend pays every holder $2 a share, logged by name; Undo reverses every payment', async ({
            page
        }) => {
            await openTable(page, 'Towns in reach')
            const before = (await facts(page)).players
            await press(turnPiece(page, 'CP'))
            const town = await litTownOf(page, 'tile.red.dividend')
            await press(hexTarget(page, town))
            if (width.name === 'desktop') {
                await expect(page.locator('[data-money-chip]').first()).toBeAttached()
            }
            await settled(page)
            const paid = (await facts(page)).players
            expect(
                paid.map(
                    (player) =>
                        player.money -
                        (before.find((seat) => seat.playerId === player.playerId)?.money ?? 0)
                )
            ).toEqual(paid.map((player) => 2 * player.shares[CP]))
            expect((await playerOf(page, MARA)).money).toBe(24)
            // Mara reads her own payment in the second person.
            await expect(await history(page)).toContainText(
                'Dividend pays you $4, Royce $2, Ines $2, Tobias $2'
            )

            await press(undoButton(page))
            await settled(page)
            expect((await facts(page)).players.map((player) => player.money)).toEqual(
                before.map((player) => player.money)
            )
            await expect(trackPiece(page, town)).toHaveCount(0)
        })

        test('scenario 13 (R-3.3, R-3.3-H1, R-2.2-H2, R-X.2): a piece with no room is set aside for a replacement, then with the bag empty for one placement fewer; trading stays closed', async ({
            page
        }) => {
            await openTable(page, 'No room')
            await expect(page.getByRole('button', { name: 'KP piece, no room' })).toHaveCount(2)
            await expect(turnPiece(page, 'KP').first()).toContainText('no room')

            await press(turnPiece(page, 'KP').first())
            expect(await lit(page)).toEqual([])
            const setAside = page.getByRole('button', {
                name: "Set aside · draw a replacement · can't be undone",
                exact: true
            })
            await expect(setAside).toBeVisible()
            await expect(page.getByRole('button', { name: /^End turn/ })).toHaveCount(0)
            await press(setAside)
            await settled(page)

            // The replacement joins the revealed hand for all; nothing to undo.
            let table = await facts(page)
            expect(table.turnPieces.toSorted()).toEqual([CP, CP, KP])
            expect(table.bag).toBe(0)
            expect((await handFaces(page, 'Mara')).toSorted()).toEqual([CP, CP, KP])
            await expect(undoButton(page)).toHaveCount(0)
            // R-2.2-H2: a scrap before the first placement keeps buying and selling closed.
            expect(table.machineState).toBe('Placing')
            for (const button of await tradeButtons(page).all()) await expect(button).toBeDisabled()

            await press(turnPiece(page, 'KP'))
            const bagEmpty = page.getByRole('button', {
                name: 'Set aside · bag empty',
                exact: true
            })
            await expect(bagEmpty).toBeVisible()
            await press(bagEmpty)
            await settled(page)
            table = await facts(page)
            expect(table.turnPieces).toEqual([CP, CP])
            expect([table.placementsMade, table.placementsLeft]).toEqual([0, 2])
            await expect(page.getByText('Place piece 1 of 2.')).toBeVisible()
            // R-X.2: this set-aside draws nothing, so it reveals nothing and can be undone.
            await expect(undoButton(page)).toBeVisible()
            for (const button of await tradeButtons(page).all()) await expect(button).toBeDisabled()
            await expect(await history(page)).toContainText('and drew CP')
        })

        test('scenario 14 (R-2.2 step 4, R-5): End turn · draw 3 draws three, logged as "drew 3" to others, with no Undo', async ({
            page
        }) => {
            await openTable(page, 'Pieces placed')
            await press(page.getByRole('button', { name: 'End turn · draw 3', exact: true }))
            if (width.name === 'desktop') {
                // Three pieces fly from the bag to Mara's seat card.
                await expect(page.locator('[data-flight-layer] [data-flight="Piece"]')).toHaveCount(
                    3
                )
            }
            await expect(header(page)).toHaveText('Your turn')
            await settled(page)
            expect((await playerOf(page, MARA)).handCount).toBe(3)
            expect(await handFaces(page, 'Mara')).toEqual(['hidden', 'hidden', 'hidden'])
            await expect(maraTurn(await history(page))).toContainText('ended the turn and drew 3')
            await expect(undoButton(page)).toHaveCount(0)
        })

        test('scenario 15 (R-6.3): the variant hand holds four; Keep draws 3 and the kept piece stays face up', async ({
            page
        }) => {
            await openTable(page, 'Variant opening turn')
            await expect(panelPieces(page)).toHaveCount(4)
            await placeOnOpenCountry(page, 'CP')
            await placeOnOpenCountry(page, 'UP')
            await placeOnOpenCountry(page, 'KP')
            const keep = page.getByRole('button', { name: 'Keep SP · draw 3', exact: true })
            await expect(keep).toBeVisible()
            await expect(
                page.getByRole('button', { name: 'Return it · draw 4', exact: true })
            ).toBeVisible()
            const bag = (await facts(page)).bag

            await press(keep)
            await expect(header(page)).toHaveText('Your turn')
            await settled(page)
            const mara = await playerOf(page, MARA)
            expect([mara.handCount, mara.keptPiece]).toEqual([3, SP])
            expect((await facts(page)).bag).toBe(bag - 3)
            expect((await handFaces(page, 'Mara')).toSorted()).toEqual([
                'hidden',
                'hidden',
                'hidden',
                SP
            ])
            await expect(maraTurn(await history(page))).toContainText(
                'ended the turn, kept SP and drew 3'
            )
        })

        test('scenario 15 (R-6.3): Return it puts the fourth piece back and draws 4', async ({
            page
        }) => {
            await openTable(page, 'Variant opening turn')
            await placeOnOpenCountry(page, 'CP')
            await placeOnOpenCountry(page, 'UP')
            await placeOnOpenCountry(page, 'KP')
            const bag = (await facts(page)).bag

            await press(page.getByRole('button', { name: 'Return it · draw 4', exact: true }))
            await expect(header(page)).toHaveText('Your turn')
            await settled(page)
            expect((await playerOf(page, MARA)).handCount).toBe(4)
            expect((await facts(page)).bag).toBe(bag + 1 - 4)
            expect(await handFaces(page, 'Mara')).toEqual(['hidden', 'hidden', 'hidden', 'hidden'])
            await expect(maraTurn(await history(page))).toContainText(
                'ended the turn, returned SP to the bag and drew 4'
            )
        })

        test('scenario 15 (R-6.3): with no piece left over the variant shows End turn · draw 4', async ({
            page
        }) => {
            await openTable(page, 'Variant nothing left')
            await placeOnOpenCountry(page, 'CP')
            await placeOnOpenCountry(page, 'UP')
            await placeOnOpenCountry(page, 'KP')
            await expect(page.getByRole('button', { name: /^(End turn|Keep|Return)/ })).toHaveText([
                'End turn · draw 4'
            ])
            await press(page.getByRole('button', { name: 'End turn · draw 4', exact: true }))
            await expect(header(page)).toHaveText('Your turn')
            await settled(page)
            expect((await playerOf(page, MARA)).handCount).toBe(4)
            await expect(maraTurn(await history(page))).toContainText('ended the turn and drew 4')
        })
    })
}
