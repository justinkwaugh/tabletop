import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    HydratedPromontoryPointGameState,
    finalTotals,
    type PromontoryPointGameState,
    type RailroadId
} from '@tabletop/promontory-point'
import {
    canonical,
    seatOf,
    startGame,
    variantConfig,
    withHoldings,
    withPriceIndex
} from '@tabletop/promontory-point/testing'
import { seatLedger } from './seatLedger.js'
import { SeatTag } from './seatView.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'
const SP: RailroadId = 'railroad.sp'

const hydrated = (state: PromontoryPointGameState) => new HydratedPromontoryPointGameState(state)

// R-1.2: a price index is the price plus the four extra 0 spaces.
const PRICE_INDEX = (price: number) => price + 4

// A mid-game table: CP $9, UP $3, KP $12, SP $6.
function midGame(config = {}): PromontoryPointGameState {
    let state = startGame({ playerCount: 4, config }).state
    state = withPriceIndex(state, CP, PRICE_INDEX(9))
    state = withPriceIndex(state, UP, PRICE_INDEX(3))
    state = withPriceIndex(state, KP, PRICE_INDEX(12))
    state = withPriceIndex(state, SP, PRICE_INDEX(6))
    return withHoldings(state, [
        { money: 14, shares: { [CP]: 2, [UP]: 3, [KP]: 1 } },
        { money: 22, shares: { [CP]: 1, [UP]: 1, [KP]: 3, [SP]: 2 } },
        { money: 8, shares: { [CP]: 3, [KP]: 1, [SP]: 4 } },
        { money: 31, shares: { [CP]: 1, [UP]: 2, [SP]: 1 } }
    ])
}

// R-6.3-H2: the seat keeps one piece from the bag face up beside its concealed hand.
function withKeptPiece(
    state: PromontoryPointGameState,
    position: number,
    railroadId: RailroadId
): PromontoryPointGameState {
    const next = structuredClone(state)
    const player = next.players.find((seat) => seat.playerId === seatOf(next, position))
    assertExists(player, 'The seat exists')
    const index = next.bag.items.lastIndexOf(railroadId)
    next.bag.items.splice(index, 1)
    next.bag.remaining -= 1
    player.keptPiece = railroadId
    return canonical(next)
}

describe('seat ledger (contract, "Seat ledger")', () => {
    it('R-1.2: a column per railroad with its tag and today’s price', () => {
        const ledger = seatLedger(hydrated(midGame()), undefined)
        expect(ledger.columns).toEqual([
            { railroadId: CP, tag: 'CP', price: 9 },
            { railroadId: UP, tag: 'UP', price: 3 },
            { railroadId: KP, tag: 'KP', price: 12 },
            { railroadId: SP, tag: 'SP', price: 6 }
        ])
    })

    it('R-2.1, R-1.3-H1: a row per seat in seat order, each share’s count and worth, and the cash', () => {
        const state = hydrated(midGame())
        const ledger = seatLedger(state, undefined)
        expect(ledger.rows.map((row) => row.playerId)).toEqual(state.turnManager.turnOrder)
        const [first] = ledger.rows
        expect(first.money).toBe(14)
        expect(first.cells).toEqual([
            { railroadId: CP, count: 2, worth: 18 },
            { railroadId: UP, count: 3, worth: 9 },
            { railroadId: KP, count: 1, worth: 12 },
            { railroadId: SP, count: 0, worth: 0 }
        ])
        expect(first.shareWorth).toBe(39)
    })

    it('R-6.2: the score is the cash plus the shares at today’s price, as the final total sums it', () => {
        const state = hydrated(midGame())
        const ledger = seatLedger(state, undefined)
        expect(ledger.rows.map((row) => row.score)).toEqual([53, 82, 71, 52])
        const totals = new Map(finalTotals(state).map((total) => [total.playerId, total.total]))
        for (const row of ledger.rows) expect(row.score).toBe(totals.get(row.playerId))
    })

    it('R-X.1, R-2.2 step 1: the turn player’s row is active and carries its revealed hand; no other row does', () => {
        const state = hydrated(midGame())
        const ledger = seatLedger(state, seatOf(state, 1))
        const [turn, ...others] = ledger.rows
        expect(turn.active).toBe(true)
        expect(turn.tag).toBe(SeatTag.Placing)
        expect(turn.revealedHand).toEqual(state.turn?.pieces)
        expect(turn.revealedHand).toHaveLength(3)
        for (const row of others) {
            expect(row.active).toBe(false)
            // R-5: a concealed hand, the viewer's own included, never shows in the ledger.
            expect(row.revealedHand).toBeUndefined()
        }
    })

    it('R-6.3-H2: the kept piece shows on its seat’s row in the variant, and no row has one otherwise', () => {
        const variant = hydrated(withKeptPiece(midGame(variantConfig(true)), 2, SP))
        expect(seatLedger(variant, undefined).rows.map((row) => row.keptPiece)).toEqual([
            undefined,
            undefined,
            SP,
            undefined
        ])
        const base = seatLedger(hydrated(midGame()), undefined)
        expect(base.rows.every((row) => row.keptPiece === undefined)).toBe(true)
    })
})
