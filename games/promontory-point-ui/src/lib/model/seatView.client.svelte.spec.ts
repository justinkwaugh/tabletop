import { afterEach, describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    HydratedPromontoryPointGameState,
    MachineState,
    sharePrice,
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
    variantConfig,
    withHoldings,
    withTownsOpenTo,
    withTurnPieces
} from '$lib/testing/tables.js'
import { aggregateTurns } from '$lib/utils/actionAggregator.js'
import { PreviewKind } from './cardPreview.svelte.js'
import {
    HandPerspective,
    SeatTag,
    handPerspective,
    moneyLinesOfTurn,
    seatView,
    seatViews
} from './seatView.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'

afterEach(() => {
    disposeSessions()
})

const hydrated = (state: PromontoryPointGameState) => new HydratedPromontoryPointGameState(state)

function seatAt(state: HydratedPromontoryPointGameState, position: number): string {
    const playerId = state.turnManager.turnOrder[position]
    assertExists(playerId, `No seat at position ${position}`)
    return playerId
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

// The turn player holds 2 CP and the next seat 1 CP with no money; CP reaches a Dividend town and
// a Repairs town.
function townsTable(): { table: Table; dividend: SpaceId; repairs: SpaceId } {
    const dealt = dealtTable()
    const { state, spaceIds } = withTownsOpenTo(withTurnPieces(dealt.state, [CP, UP, KP]), CP, [
        'tile.red.dividend',
        'tile.red.hammer'
    ])
    const held = withHoldings(state, [
        { money: 20, shares: { [CP]: 2 } },
        { money: 0, shares: { [CP]: 1 } },
        { money: 20 }
    ])
    return {
        table: editedTable(dealt, () => held),
        dividend: spaceIds[0],
        repairs: spaceIds[1]
    }
}

describe('seat view', () => {
    it('R-5, R-2.2 step 1: the turn player is revealed, the viewer sees its own, others are hidden', () => {
        const state = hydrated(dealtTable().state)
        const [first, second, third] = state.turnManager.turnOrder
        assertExists(first, 'seat 1')
        assertExists(second, 'seat 2')
        assertExists(third, 'seat 3')

        const revealed = seatView(state, first, second).hand
        expect(revealed.perspective).toBe(HandPerspective.Revealed)
        expect(revealed.caption).toBe('hand, revealed')
        expect(revealed.pieces).toEqual(
            (state.turn?.pieces ?? []).map((railroadId) => ({ faceShown: true, railroadId }))
        )

        const own = seatView(state, second, second).hand
        expect(own.perspective).toBe(HandPerspective.Own)
        expect(own.caption).toBe('yours, hidden')
        expect(own.pieces).toEqual(
            state
                .getPlayerState(second)
                .knownHand()
                .map((railroadId) => ({ faceShown: true, railroadId }))
        )

        const hidden = seatView(state, third, second).hand
        expect(hidden.perspective).toBe(HandPerspective.Hidden)
        expect(hidden.caption).toBe('hand: 3 hidden')
        expect(hidden.pieces).toEqual([
            { faceShown: false },
            { faceShown: false },
            { faceShown: false }
        ])
    })

    it('R-5: faceShown follows the perspective, never the hands the client holds', () => {
        // The canonical state holds every hand, as a Local game or Host View does.
        const state = hydrated(dealtTable().state)
        const second = state.turnManager.turnOrder[1]
        assertExists(second, 'seat 2')
        expect(state.getPlayerState(second).hand).toHaveLength(3)

        expect(handPerspective(state, second, undefined)).toBe(HandPerspective.Hidden)
        const spectator = seatView(state, second, undefined).hand
        expect(spectator.pieces.every((piece) => !piece.faceShown)).toBe(true)
        expect(spectator.pieces.some((piece) => 'railroadId' in piece)).toBe(false)
    })

    it('R-6.3-H2: a kept piece is shown face up to every seat', () => {
        const dealt = dealtTable({ config: variantConfig(true) })
        const state = hydrated(withKeptPiece(dealt.state, 2, KP))
        const third = state.turnManager.turnOrder[2]
        assertExists(third, 'seat 3')

        const handCount = state.getPlayerState(third).handCount
        const asOther = seatView(state, third, state.turnManager.turnOrder[1]).hand
        expect(asOther.keptPiece).toBe(KP)
        expect(asOther.pieces).toHaveLength(handCount)
        expect(asOther.caption).toBe(`hand: ${handCount} hidden · 1 kept`)
        expect(seatView(state, third, undefined).hand.keptPiece).toBe(KP)
        expect(seatView(state, third, third).hand).toMatchObject({
            keptPiece: KP,
            caption: 'yours, hidden · 1 kept'
        })
    })

    it('R-6.1-H2: a seat left with no hand when the bag ran out reads empty, never "0 hidden"', () => {
        const dealt = dealtTable()
        const next = structuredClone(dealt.state)
        const emptied = next.players.find((seat) => seat.playerId === seatOf(next, 2))
        assertExists(emptied, 'seat 3')
        next.bag.items.push(...(emptied.hand ?? []))
        next.bag.remaining += emptied.handCount
        emptied.hand = []
        emptied.handCount = 0
        const state = hydrated(canonical(next))
        const third = seatAt(state, 2)

        const asOther = seatView(state, third, seatAt(state, 1)).hand
        expect(asOther.pieces).toEqual([])
        expect(asOther.caption).toBe('hand: empty')
        expect(seatView(state, third, third).hand.caption).toBe('yours, empty')
    })

    it('R-1.3-H1, O-9: money, each stack with count and price, a faint ×0, and the worth', () => {
        const dealt = dealtTable()
        const state = hydrated(
            withHoldings(dealt.state, [{ money: 12, shares: { [CP]: 3, [KP]: 1 } }])
        )
        const first = state.turnManager.turnOrder[0]
        assertExists(first, 'seat 1')
        const view = seatView(state, first, first)
        const cp = sharePrice(state, CP)
        const kp = sharePrice(state, KP)

        expect(view.money).toBe(12)
        expect(view.shares.map((share) => share.railroadId)).toEqual([
            'railroad.cp',
            'railroad.up',
            'railroad.kp',
            'railroad.sp'
        ])
        expect(view.shares[0]).toMatchObject({
            count: 3,
            countLabel: '×3',
            priceLabel: `$${cp} ea`
        })
        expect(view.shares[1]).toMatchObject({ count: 0, countLabel: '×0' })
        expect(view.worth).toBe(3 * cp + kp)
    })

    it('R-2.1, R-X.1: seats keep seat order; the turn player is active and placing', () => {
        const state = hydrated(dealtTable({ playerCount: 4 }).state)
        const views = seatViews(state, undefined)
        expect(views.map((view) => view.playerId)).toEqual(state.turnManager.turnOrder)
        expect(views.map((view) => view.active)).toEqual([true, false, false, false])
        expect(views.map((view) => view.tag)).toEqual([
            SeatTag.Placing,
            undefined,
            undefined,
            undefined
        ])
    })

    it('R-4.3-H4: the debtor deciding carries the repairs tag and the ring; the turn waits', async () => {
        const { table, repairs } = townsTable()
        const session = await openSessionOn(table)
        session.pressPiece(CP)
        await session.placeTrack(repairs)
        await settled(session)
        expect(session.gameState.machineState).toBe(MachineState.PayingRepairs)

        const [placer, debtor] = seatViews(session.gameState, undefined)
        expect(placer).toMatchObject({ tag: SeatTag.Placing, active: false, waitingTurn: true })
        expect(debtor).toMatchObject({ tag: SeatTag.Repairs, active: true, waitingTurn: false })
    })

    it("contract, 'Open seat': this turn's money changes for the seat", async () => {
        const { table, dividend } = townsTable()
        const session = await openSessionOn(table)
        const placer = seatAt(session.gameState, 0)
        const price = sharePrice(session.gameState, UP)
        await session.buyShare(UP)
        await settled(session)
        session.pressPiece(CP)
        await session.placeTrack(dividend)
        await settled(session)

        const turn = aggregateTurns(session.actions, session.gameState, placer).at(-1)
        const lines = moneyLinesOfTurn(turn?.actions ?? [], placer)
        expect(lines.map(({ label, change }) => ({ label, change }))).toEqual([
            { label: 'Bought a UP share', change: -price },
            { label: 'Dividend on CP', change: 4 }
        ])
    })
})

describe('card preview and open seat', () => {
    it('contract, "The principle": a share or the bag opens the preview; close clears it', async () => {
        const session = await openSessionOn(dealtTable())
        session.cardPreview.show({ kind: PreviewKind.Share, railroadId: CP })
        expect(session.cardPreview.shown).toEqual({ kind: PreviewKind.Share, railroadId: CP })
        session.cardPreview.show({ kind: PreviewKind.Bag })
        expect(session.cardPreview.shown).toEqual({ kind: PreviewKind.Bag })
        session.cardPreview.close()
        expect(session.cardPreview.shown).toBeUndefined()
    })

    it('contract, "Open seat": the name opens the seat and the name again closes it', async () => {
        const session = await openSessionOn(dealtTable())
        const second = seatAt(session.gameState, 1)
        session.openSeat.toggle(second)
        expect(session.openSeat.playerId).toBe(second)
        session.openSeat.toggle(second)
        expect(session.openSeat.playerId).toBeUndefined()
    })
})
