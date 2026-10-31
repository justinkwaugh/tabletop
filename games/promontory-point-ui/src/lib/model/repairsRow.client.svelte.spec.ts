import { afterEach, describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    MachineState,
    type PromontoryPointGameState,
    type RailroadId,
    type SpaceId
} from '@tabletop/promontory-point'
import {
    dealtTable,
    disposeSessions,
    editedTable,
    openSessionOn,
    settled,
    type Table
} from '$lib/testing/sessionHarness.js'
import {
    canonical,
    seatOf,
    withHoldings,
    withTownsOpenTo,
    withTurnPieces,
    type Holding
} from '@tabletop/promontory-point/testing'
import { descriptionText, type DescriptionPart } from '$lib/utils/actionDescription.js'
import { repairsPanel } from './repairsPanel.js'
import { RepairsSeatState, repairsRow, type RepairsRowView } from './repairsRow.js'
import type { PromontoryPointGameSession } from './session.svelte.js'
import { waitingView } from './waitingView.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'
const SP: RailroadId = 'railroad.sp'

afterEach(() => {
    disposeSessions()
})

type RepairsTable = { table: Table; town: SpaceId }

// Four seats; the turn player holds SP, UP, KP with a Repairs town open to SP. SP stands at $6.
function repairsTable(holdings: Holding[]): RepairsTable {
    const dealt = dealtTable({ playerCount: 4 })
    const { state, spaceIds } = withTownsOpenTo(withTurnPieces(dealt.state, [SP, UP, KP]), SP, [
        'tile.red.hammer'
    ])
    const priced: PromontoryPointGameState = structuredClone(withHoldings(state, holdings))
    priced.priceIndex[SP] = 10
    return { table: editedTable(dealt, () => canonical(priced)), town: spaceIds[0] }
}

// The placer holds no SP; seat 2 owes $10 with $7; seat 3 pays $2 at once; seat 4 owes $4 with $1.
function twoShortSeats(): RepairsTable {
    return repairsTable([
        { money: 20, shares: { [CP]: 1 } },
        { money: 7, shares: { [SP]: 5, [CP]: 2 } },
        { money: 20, shares: { [SP]: 1 } },
        { money: 1, shares: { [SP]: 2 } }
    ])
}

async function placedOnRepairs({ table, town }: RepairsTable) {
    const session = await openSessionOn(table)
    session.pressPiece(SP)
    await session.placeTrack(town)
    await settled(session)
    expect(session.gameState.machineState).toBe(MachineState.PayingRepairs)
    return session
}

function rowOf(session: PromontoryPointGameSession): RepairsRowView {
    const row = repairsRow(session.gameState, session.actions)
    assertExists(row, 'A Repairs is being paid')
    return row
}

function said(session: PromontoryPointGameSession, parts: readonly DescriptionPart[]): string {
    return descriptionText(parts, (playerId) => session.getPlayerName(playerId))
}

function seats(table: Table) {
    return [0, 1, 2, 3].map((position) => seatOf(table.state, position))
}

describe('Repairs row (R-4.3, R-4.3-H1, R-4.3-H4)', () => {
    it('R-4.3-H4: one entry per seat from the placing seat, with each bill and its state', async () => {
        const repairs = twoShortSeats()
        const [placer, firstDebtor, payer, secondDebtor] = seats(repairs.table)
        const session = await placedOnRepairs(repairs)
        const row = rowOf(session)
        expect(row.railroadId).toBe(SP)
        expect(row.placingPlayerId).toBe(placer)
        expect(
            row.entries.map(({ playerId, bill, state, short, text }) => ({
                playerId,
                bill,
                state,
                short,
                text
            }))
        ).toEqual([
            {
                playerId: placer,
                bill: 0,
                state: RepairsSeatState.NoShares,
                short: undefined,
                text: 'no shares'
            },
            {
                playerId: firstDebtor,
                bill: 10,
                state: RepairsSeatState.Choosing,
                short: 3,
                text: 'choosing shares to sell'
            },
            {
                playerId: payer,
                bill: 2,
                state: RepairsSeatState.Paid,
                short: undefined,
                text: 'paid $2'
            },
            {
                playerId: secondDebtor,
                bill: 4,
                state: RepairsSeatState.Waiting,
                short: undefined,
                text: 'waiting'
            }
        ])
    })

    it('R-4.3: staged sales do not reach the row; a sent payment does, and the next seat decides', async () => {
        const repairs = twoShortSeats()
        const [, firstDebtor, , secondDebtor] = seats(repairs.table)
        const session = await placedOnRepairs(repairs)
        const before = rowOf(session)
        session.stageRepairsSale(SP)
        expect(rowOf(session)).toEqual(before)

        await session.sendRepairs()
        await settled(session)
        const row = rowOf(session)
        const entry = (playerId: string) => row.entries.find((seat) => seat.playerId === playerId)
        expect(entry(firstDebtor)).toMatchObject({
            state: RepairsSeatState.Paid,
            text: 'paid $10'
        })
        expect(entry(secondDebtor)).toMatchObject({
            state: RepairsSeatState.Choosing,
            short: 3,
            text: 'choosing shares to sell'
        })
    })

    it('R-4.3-H4: the last payment ends the step and the row; Undo brings both back', async () => {
        const repairs = twoShortSeats()
        const [, firstDebtor, , secondDebtor] = seats(repairs.table)
        const session = await placedOnRepairs(repairs)
        session.stageRepairsSale(SP)
        await session.sendRepairs()
        await settled(session)
        expect(session.decidingPlayerId).toBe(secondDebtor)
        session.stageRepairsSale(SP)
        await session.sendRepairs()
        await settled(session)

        // The last payment ends the step, so the row is gone with it.
        expect(repairsRow(session.gameState, session.actions)).toBeUndefined()
        await session.undo()
        await settled(session)
        expect(rowOf(session).entries.find((seat) => seat.playerId === firstDebtor)?.text).toBe(
            'paid $10'
        )
    })

    it('R-4.3: the row is read from the displayed state, so History View keeps it', async () => {
        const session = await placedOnRepairs(twoShortSeats())
        const live = rowOf(session)
        session.stageRepairsSale(SP)
        await session.sendRepairs()
        await settled(session)
        const placementIndex = session.actions.at(0)?.index
        assertExists(placementIndex, 'The placement is recorded')
        await session.history.goToActionIndex(placementIndex, { exact: true })
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(rowOf(session)).toEqual(live)
    })

    it('no row while no Repairs is being paid', async () => {
        const session = await openSessionOn(twoShortSeats().table)
        expect(repairsRow(session.gameState, session.actions)).toBeUndefined()
    })
})

describe('Repairs panel (R-4.3, R-4.3-H1 to H3)', () => {
    it('R-4.3, R-4.3-H1: names the bill, its cause and the money, and lists each railroad at half price', async () => {
        const session = await placedOnRepairs(twoShortSeats())
        const draft = session.repairsDraft
        const viewerId = session.decidingPlayerId
        assertExists(draft, 'The debtor decides')
        assertExists(viewerId, 'The debtor decides')
        const panel = repairsPanel(draft, rowOf(session).placingPlayerId, viewerId)
        expect(panel.prompt.lead).toBe('Repairs on Southern Pacific.')
        expect(said(session, panel.prompt.parts)).toBe(
            `${session.getPlayerName(rowOf(session).placingPlayerId)} placed SP on a Repairs town. You owe $10 (5 SP shares × $2) and have $7.`
        )
        expect(panel.prompt.note).toBe(
            'Sell shares at half price, rounded down, one at a time, until you can pay.'
        )
        expect(
            panel.entries.map((entry) => [
                entry.name,
                entry.holding,
                `price ${entry.priceLine.price} → ${entry.priceLine.proceeds} each`,
                `Sell one ${entry.sellLabel}`,
                entry.locked
            ])
        ).toEqual([
            ['Central Pacific', 'you hold 2', 'price $5 → $2 each', 'Sell one +$2', false],
            ['Southern Pacific', 'you hold 5', 'price $6 → $3 each', 'Sell one +$3', false]
        ])
        expect(panel.entries.map((entry) => entry.short)).toEqual(['CP ×2', 'SP ×5'])
        expect(panel.billNote).toContain('Selling SP does not lower the bill')
        expect(panel.runningLine).toBe('Have $7 of $10 · short $3')
        expect(panel.send).toEqual({ label: 'Pay $10', ready: false })
    })

    it('R-4.3-H2: one SP covers the bill, so every row locks and the button sends', async () => {
        const session = await placedOnRepairs(twoShortSeats())
        session.stageRepairsSale(SP)
        const draft = session.repairsDraft
        const viewerId = session.decidingPlayerId
        assertExists(draft, 'The debtor decides')
        assertExists(viewerId, 'The debtor decides')
        const panel = repairsPanel(draft, rowOf(session).placingPlayerId, viewerId)
        expect(panel.entries.map((entry) => [entry.locked, entry.stagedNote])).toEqual([
            [true, undefined],
            [true, '1 picked']
        ])
        expect(panel.runningLine).toBe('Have $7 + sale $3 = $10 of $10 · enough')
        expect(panel.send).toEqual({ label: 'Sell 1 SP share · pay $10', ready: true })
    })

    it('R-4.3-H1: the note stands only while the seat holds the railroad that caused the bill', () => {
        const draft = {
            railroadId: SP,
            owed: 4,
            money: 1,
            holdsBilledRailroad: false,
            shortAfterEverySale: true,
            entries: [],
            runningLine: 'Have $1 of $4 · $3 forgiven',
            send: { sales: [], paid: 1, forgiven: 3, ready: true, label: 'Pay $1 · $3 forgiven' }
        }
        const panel = repairsPanel(draft, 'p1', 'p2')
        expect(panel.billNote).toBeUndefined()
        expect(panel.everySaleNote).toBeUndefined()
        expect(panel.send).toEqual({ label: 'Pay $1 · $3 forgiven', ready: true })
    })
})

describe('waiting view (contract, "Watching")', () => {
    it('R-4.3-H4: other seats read who decides and what, the row, and the last action; never staged sales', async () => {
        const repairs = twoShortSeats()
        const [placer, firstDebtor] = seats(repairs.table)
        const session = await placedOnRepairs(repairs)
        session.stageRepairsSale(SP)
        session.setViewingAsNonActivePlayer(true)
        expect(session.myPlayer?.id).toBe(placer)
        expect(session.decidingPlayerId).toBeUndefined()

        const view = waitingView(session.gameState, session.actions, session.myPlayer?.id)
        assertExists(view, 'A seat decides')
        expect(view.lead).toBe('Repairs on Southern Pacific.')
        expect(said(session, view.parts)).toBe(
            `${session.getPlayerName(firstDebtor)} owes $10 and has $7, and is choosing shares to sell at half price. Your turn continues once the bills are paid.`
        )
        const spectator = waitingView(session.gameState, session.actions, undefined)
        expect(said(session, spectator?.parts ?? [])).toContain(
            `${session.getPlayerName(placer)}'s turn continues once the bills are paid.`
        )
        assertExists(view.last, 'The placement is the last action')
        expect(view.last.playerId).toBe(placer)
        expect(said(session, view.last.parts)).toMatch(/^placed SP on a Repairs town: bills /)
        expect(said(session, view.last.parts)).not.toContain('sold')
    })

    it('R-3.3: names the piece being placed and the pieces left', async () => {
        const session = await openSessionOn(
            editedTable(dealtTable(), (state) => withTurnPieces(state, [SP, UP, KP]))
        )
        const turnPlayer = session.gameState.activePlayerIds[0]
        assertExists(turnPlayer, 'A seat takes its turn')
        const opening = waitingView(session.gameState, session.actions, undefined)
        assertExists(opening, 'The turn player decides')
        expect(said(session, opening.parts)).toBe(
            `${session.getPlayerName(turnPlayer)} may buy or sell up to 2 shares, then place 3 pieces (SP, UP, KP).`
        )
        expect(opening.last).toBeUndefined()

        session.pressPiece(UP)
        const open = session.boardOffer.lit.find((spaceId) => !(spaceId in session.gameState.towns))
        assertExists(open, 'UP has open country')
        await session.placeTrack(open)
        await settled(session)
        const placing = waitingView(session.gameState, session.actions, undefined)
        assertExists(placing, 'The turn player decides')
        expect(said(session, placing.parts)).toBe(
            `${session.getPlayerName(turnPlayer)} is placing piece 2 of 3 (SP, KP left).`
        )
        expect(placing.last?.playerId).toBe(turnPlayer)
        expect(said(session, placing.last?.parts ?? [])).toBe('placed UP in open country')
        const own = waitingView(session.gameState, session.actions, turnPlayer)
        expect(said(session, own?.parts ?? [])).toBe('You are placing piece 2 of 3 (SP, KP left).')
    })

    it('R-6.3: after the placements, names a piece left over in the variant', async () => {
        const session = await openSessionOn(
            editedTable(dealtTable({ config: { fourPieceVariant: true } }), (state) =>
                withTurnPieces(state, [SP, UP, KP, CP])
            )
        )
        const turnPlayer = session.gameState.activePlayerIds[0]
        assertExists(turnPlayer, 'A seat takes its turn')
        for (const railroadId of [SP, UP, KP]) {
            session.pressPiece(railroadId)
            const open = session.boardOffer.lit.find(
                (spaceId) => !(spaceId in session.gameState.towns)
            )
            assertExists(open, `${railroadId} has open country`)
            await session.placeTrack(open)
            await settled(session)
        }
        expect(session.gameState.machineState).toBe(MachineState.TradingAfterPlacing)
        const after = waitingView(session.gameState, session.actions, undefined)
        expect(said(session, after?.parts ?? [])).toBe(
            `${session.getPlayerName(turnPlayer)} has placed 3 pieces (CP left over) and may buy or sell up to 2 shares before ending the turn.`
        )
    })
})
