import { assert, assertExists, type Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { PayRepairs, isPayRepairs, type PayRepairsMetadata } from '../actions/payRepairs.js'
import { PlaceTrack, isPlaceTrack, type PlaceTrackMetadata } from '../actions/placeTrack.js'
import { BoardNodeKind, PROMONTORY, type SpaceId } from '../components/board.js'
import { MAX_PRICE_INDEX, MIN_PRICE_INDEX, START_PRICE_INDEX } from '../components/priceTrack.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { TOWN_TILE_KIND_IDS, TownEventKind } from '../components/townTiles.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import {
    pathFromHome,
    reaching,
    withHoldings,
    withTownTile,
    withTrack,
    type Holding
} from '../testing/fixtures.js'
import { offered, play, type Played } from '../testing/play.js'
import { startGame } from '../testing/startGame.js'
import { withTurnPieces } from '../testing/turnPieces.js'
import { edited, playerOf, turnPlayer } from '../testing/turns.js'
import type { DividendPayment, RepairsBillPayment } from './townEffectOutcome.js'
import { TOWN_EFFECTS, type TownEffectId } from './townEffects.js'

const EFFECT_IDS: TownEffectId[] = [...TOWN_TILE_KIND_IDS, PROMONTORY.spaceId]

type PriceEffect = { effectId: TownEffectId; priceChange: number }

const PRICE_EFFECTS: PriceEffect[] = EFFECT_IDS.flatMap((effectId) => {
    const { event } = TOWN_EFFECTS[effectId]
    return event.kind === TownEventKind.PriceChange
        ? [{ effectId, priceChange: event.priceChange }]
        : []
})

type Firing = { effectId: TownEffectId; railroadId: RailroadId }

const FIRINGS: Firing[] = EFFECT_IDS.flatMap((effectId) =>
    RAILROAD_IDS.map((railroadId) => ({ effectId, railroadId }))
)

type Placement = {
    game: Game
    state: PromontoryPointGameState
    spaceId: SpaceId
    railroadId: RailroadId
}

function seat(state: PromontoryPointGameState, index: number): string {
    const playerId = state.turnManager.turnOrder[index]
    assertExists(playerId, `No seat ${index}`)
    return playerId
}

function moneyBySeat(state: PromontoryPointGameState): number[] {
    return state.turnManager.turnOrder.map((playerId) => playerOf(state, playerId).money)
}

function sharesBySeat(state: PromontoryPointGameState) {
    return state.turnManager.turnOrder.map((playerId) => playerOf(state, playerId).shares)
}

// A railroad other than the one given, for a second holding or turn piece.
function otherThan(railroadId: RailroadId, skip = 1): RailroadId {
    const index = RAILROAD_IDS.indexOf(railroadId)
    const other = RAILROAD_IDS[(index + skip) % RAILROAD_IDS.length]
    assertExists(other, `No railroad after ${railroadId}`)
    return other
}

// R-3.3: the first seat's opening turn, the railroad among its turn pieces and its track placed
// up to the effect's space: the nearest town carrying the tile kind, or Promontory itself.
function placementOnto(effectId: TownEffectId, railroadId: RailroadId): Placement {
    const { game, state: started } = startGame()
    const turn = withTurnPieces(started, [
        railroadId,
        otherThan(railroadId),
        otherThan(railroadId, 2)
    ])
    if (effectId === PROMONTORY.spaceId) {
        const path = pathFromHome(railroadId, PROMONTORY.spaceId)
        return {
            game,
            railroadId,
            spaceId: PROMONTORY.spaceId,
            state: withTrack(
                turn,
                path.slice(0, -1).map((spaceId) => [spaceId, railroadId])
            )
        }
    }
    const reached = reaching(turn, railroadId, BoardNodeKind.Town)
    return {
        game,
        railroadId,
        spaceId: reached.spaceId,
        state: withTownTile(reached.state, reached.spaceId, effectId)
    }
}

function withSeats(placement: Placement, holdings: Holding[]): Placement {
    return { ...placement, state: withHoldings(placement.state, holdings) }
}

function withPriceIndex(placement: Placement, railroadId: RailroadId, priceIndex: number) {
    return {
        ...placement,
        state: edited(placement.state, (draft) => {
            draft.priceIndex[railroadId] = priceIndex
        })
    }
}

// The turn player places the railroad's piece through the real engine.
function fire({ game, state, spaceId, railroadId }: Placement): {
    played: Played
    metadata: PlaceTrackMetadata | undefined
} {
    const played = play(game, state, PlaceTrack, {
        playerId: turnPlayer(state),
        railroadId,
        spaceId
    })
    const [placed] = played.processedActions
    assert(isPlaceTrack(placed), 'The first processed action is the PlaceTrack')
    return { played, metadata: placed.metadata }
}

function payRepairs(
    game: Game,
    state: PromontoryPointGameState,
    playerId: string,
    sales: RailroadId[]
): { played: Played; metadata: PayRepairsMetadata | undefined } {
    const played = play(game, state, PayRepairs, { playerId, sales })
    expect(played.processedActions.map(({ type }) => type)).toEqual([ActionType.PayRepairs])
    const [paid] = played.processedActions
    assert(isPayRepairs(paid), 'The processed action is the PayRepairs')
    return { played, metadata: paid.metadata }
}

// R-2.2 step 3, R-2.2-H1: the piece left the turn pieces for the space and the turn is placing.
function expectPlaced(before: Placement, played: Played, machineState: MachineState) {
    const { state } = played
    expect(played.processedActions.map(({ type }) => type)).toEqual([ActionType.PlaceTrack])
    expect(state.track).toEqual({ ...before.state.track, [before.spaceId]: before.railroadId })
    expect(state.turn).toMatchObject({
        pieces: before.state.turn?.pieces.slice(1),
        placementsMade: 1
    })
    expect(state.machineState).toBe(machineState)
}

function byPlayer<Entry extends { playerId: string }>(entries: Entry[]): Entry[] {
    return [...entries].sort((left, right) => left.playerId.localeCompare(right.playerId))
}

function spaceKindOf(effectId: TownEffectId): BoardNodeKind {
    return effectId === PROMONTORY.spaceId ? BoardNodeKind.Promontory : BoardNodeKind.Town
}

describe('Promontory Point town effect playthrough sweep', () => {
    it('R-4.2: the sweep fires all nine registrations for all four railroads; none is skipped', () => {
        expect([...EFFECT_IDS].sort()).toEqual(Object.keys(TOWN_EFFECTS).sort())
        expect(FIRINGS).toHaveLength(EFFECT_IDS.length * RAILROAD_IDS.length)
        expect(PRICE_EFFECTS.map(({ effectId }) => effectId)).toEqual([
            'tile.price.plus-1',
            'tile.price.plus-2',
            'tile.price.plus-3',
            'tile.price.minus-1',
            'tile.price.minus-2',
            'tile.price.minus-3',
            PROMONTORY.spaceId
        ])
    })

    // Every seat holds two shares of the placed railroad and $10, as in the registry's reach sweep.
    it.each(FIRINGS)(
        'R-4.2, R-1.2, R-4.3: a PlaceTrack fires $effectId for $railroadId through the engine',
        ({ effectId, railroadId }) => {
            const before = withSeats(
                placementOnto(effectId, railroadId),
                [0, 1, 2, 3].map(() => ({ money: 10, shares: { [railroadId]: 2 } }))
            )
            const { state } = before
            const { played, metadata } = fire(before)
            const after = played.state

            expectPlaced(before, played, MachineState.Placing)
            expect(after.activePlayerIds).toEqual([turnPlayer(state)])
            expect(sharesBySeat(after)).toEqual(sharesBySeat(state))
            expect(after.pendingRepairs).toBeUndefined()
            expect(metadata).toMatchObject({
                spaceKind: spaceKindOf(effectId),
                townEffectId: effectId
            })

            const { event } = TOWN_EFFECTS[effectId]
            switch (event.kind) {
                case TownEventKind.PriceChange:
                    expect(after.priceIndex).toEqual({
                        ...state.priceIndex,
                        [railroadId]: START_PRICE_INDEX + event.priceChange
                    })
                    expect(after.players).toEqual(state.players)
                    expect(metadata?.outcome).toEqual({
                        kind: TownEventKind.PriceChange,
                        railroadId,
                        priceChange: event.priceChange,
                        priceIndexBefore: START_PRICE_INDEX,
                        priceIndexAfter: START_PRICE_INDEX + event.priceChange,
                        capped: false
                    })
                    break
                case TownEventKind.Dividend: {
                    const payments: DividendPayment[] = state.turnManager.turnOrder.map(
                        (playerId) => ({ playerId, amount: 4 })
                    )
                    expect(moneyBySeat(after)).toEqual([14, 14, 14, 14])
                    expect(after.priceIndex).toEqual(state.priceIndex)
                    expect(metadata?.outcome).toMatchObject({ kind: event.kind, railroadId })
                    expect(
                        metadata?.outcome?.kind === TownEventKind.Dividend
                            ? byPlayer(metadata.outcome.payments)
                            : undefined
                    ).toEqual(byPlayer(payments))
                    break
                }
                case TownEventKind.Repairs: {
                    const bills: RepairsBillPayment[] = state.turnManager.turnOrder.map(
                        (playerId) => ({ playerId, owed: 4, paid: 4 })
                    )
                    expect(moneyBySeat(after)).toEqual([6, 6, 6, 6])
                    expect(after.priceIndex).toEqual(state.priceIndex)
                    expect(metadata?.outcome).toMatchObject({
                        kind: event.kind,
                        railroadId,
                        debtors: []
                    })
                    expect(
                        metadata?.outcome?.kind === TownEventKind.Repairs
                            ? byPlayer(metadata.outcome.bills)
                            : undefined
                    ).toEqual(byPlayer(bills))
                    break
                }
            }
        }
    )

    describe('R-1.2: a capped move at each end of the price track', () => {
        const cases = PRICE_EFFECTS.flatMap(({ effectId, priceChange }) => {
            const edge = priceChange > 0 ? MAX_PRICE_INDEX : MIN_PRICE_INDEX
            return RAILROAD_IDS.flatMap((railroadId) =>
                [edge, edge - Math.sign(priceChange)].map((priceIndexBefore) => ({
                    effectId,
                    railroadId,
                    priceIndexBefore,
                    edge,
                    capped: Math.abs(priceChange) > Math.abs(edge - priceIndexBefore)
                }))
            )
        })

        it('R-1.2: every price effect reaches its end, capped from on it, and both ends are swept', () => {
            expect(new Set(cases.map(({ edge }) => edge))).toEqual(
                new Set([MIN_PRICE_INDEX, MAX_PRICE_INDEX])
            )
            expect(cases.filter(({ capped }) => capped)).toHaveLength(
                PRICE_EFFECTS.length * RAILROAD_IDS.length +
                    PRICE_EFFECTS.filter(({ priceChange }) => Math.abs(priceChange) > 1).length *
                        RAILROAD_IDS.length
            )
        })

        it.each(cases)(
            'R-1.2: $effectId for $railroadId from index $priceIndexBefore stops at $edge (capped $capped)',
            ({ effectId, railroadId, priceIndexBefore, edge, capped }) => {
                const before = withPriceIndex(
                    placementOnto(effectId, railroadId),
                    railroadId,
                    priceIndexBefore
                )
                const { played, metadata } = fire(before)

                expectPlaced(before, played, MachineState.Placing)
                expect(played.state.priceIndex).toEqual({
                    ...before.state.priceIndex,
                    [railroadId]: edge
                })
                expect(played.state.players).toEqual(before.state.players)
                expect(metadata?.outcome).toMatchObject({
                    kind: TownEventKind.PriceChange,
                    railroadId,
                    priceIndexBefore,
                    priceIndexAfter: edge,
                    capped
                })
            }
        )
    })

    describe.each(RAILROAD_IDS)('R-4.2, R-4.3: the red tiles for %s', (railroadId) => {
        const other = otherThan(railroadId)

        it('R-4.2: a Dividend pays the holders, not the non-holding placer, and leaves other holdings alone', () => {
            const before = withSeats(placementOnto('tile.red.dividend', railroadId), [
                { money: 3, shares: { [other]: 2 } },
                { money: 0, shares: { [railroadId]: 2 } },
                { money: 5, shares: { [other]: 3 } },
                { money: 1, shares: { [railroadId]: 1, [other]: 1 } }
            ])
            const { played, metadata } = fire(before)

            expectPlaced(before, played, MachineState.Placing)
            expect(moneyBySeat(played.state)).toEqual([3, 4, 5, 3])
            expect(sharesBySeat(played.state)).toEqual(sharesBySeat(before.state))
            expect(played.state.priceIndex).toEqual(before.state.priceIndex)
            expect(metadata).toMatchObject({
                spaceKind: BoardNodeKind.Town,
                townEffectId: 'tile.red.dividend',
                outcome: { kind: TownEventKind.Dividend, railroadId }
            })
            expect(
                metadata?.outcome?.kind === TownEventKind.Dividend
                    ? byPlayer(metadata.outcome.payments)
                    : undefined
            ).toEqual(
                byPlayer([
                    { playerId: seat(before.state, 1), amount: 4 },
                    { playerId: seat(before.state, 3), amount: 2 }
                ])
            )
        })

        // Its price at index 6 ($2) sells a share for $1; the other railroad's at the start ($5) for $2.
        it('R-4.3, R-4.3-H1 to H4: a Repairs with two debtors, resolved by PayRepairs, then placing goes on', () => {
            const before = withSeats(
                withPriceIndex(placementOnto('tile.red.hammer', railroadId), railroadId, 6),
                [
                    { money: 1, shares: { [railroadId]: 2, [other]: 1 } },
                    { money: 10, shares: { [railroadId]: 1 } },
                    { money: 4, shares: { [other]: 2 } },
                    { money: 1, shares: { [railroadId]: 2 } }
                ]
            )
            const placer = seat(before.state, 0)
            const lastDebtor = seat(before.state, 3)
            const debtors = [
                { playerId: placer, owed: 4 },
                { playerId: lastDebtor, owed: 4 }
            ]

            const billed = fire(before)
            expectPlaced(before, billed.played, MachineState.PayingRepairs)
            expect(moneyBySeat(billed.played.state)).toEqual([1, 8, 4, 1])
            expect(billed.played.state.pendingRepairs).toEqual({ railroadId, debtors })
            expect(billed.played.state.activePlayerIds).toEqual([placer])
            expect(billed.metadata).toMatchObject({
                spaceKind: BoardNodeKind.Town,
                townEffectId: 'tile.red.hammer',
                outcome: { kind: TownEventKind.Repairs, railroadId, debtors }
            })
            expect(
                billed.metadata?.outcome?.kind === TownEventKind.Repairs
                    ? byPlayer(billed.metadata.outcome.bills)
                    : undefined
            ).toEqual(
                byPlayer([
                    { playerId: placer, owed: 4, paid: 0 },
                    { playerId: seat(before.state, 1), owed: 2, paid: 2 },
                    { playerId: lastDebtor, owed: 4, paid: 0 }
                ])
            )

            // R-4.3-H2, R-4.3-H1: $1 + $2 + $1 meets the bill of $4, fixed before the sale of the billed railroad.
            const placerPaid = payRepairs(before.game, billed.played.state, placer, [
                other,
                railroadId
            ])
            expect(placerPaid.metadata).toEqual({
                sales: [
                    { railroadId: other, proceeds: 2 },
                    { railroadId, proceeds: 1 }
                ],
                paid: 4,
                forgiven: 0
            })
            expect(playerOf(placerPaid.played.state, placer)).toMatchObject({
                money: 0,
                shares: { [railroadId]: 1, [other]: 0 }
            })
            expect(placerPaid.played.state.pendingRepairs).toEqual({
                railroadId,
                debtors: [{ playerId: lastDebtor, owed: 4 }]
            })
            expect(placerPaid.played.state.machineState).toBe(MachineState.PayingRepairs)
            expect(placerPaid.played.state.activePlayerIds).toEqual([lastDebtor])

            // R-4.3-H3: every share sold leaves $3 of $4; it is paid and the $1 left is forgiven.
            const allPaid = payRepairs(before.game, placerPaid.played.state, lastDebtor, [
                railroadId,
                railroadId
            ])
            expect(allPaid.metadata).toEqual({
                sales: [
                    { railroadId, proceeds: 1 },
                    { railroadId, proceeds: 1 }
                ],
                paid: 3,
                forgiven: 1
            })
            const after = allPaid.played.state
            expect(moneyBySeat(after)).toEqual([0, 8, 4, 0])
            expect(playerOf(after, lastDebtor).shares[railroadId]).toBe(0)
            // R-3.2: distress sales move no price.
            expect(after.priceIndex).toEqual(before.state.priceIndex)
            expect(after.pendingRepairs).toBeUndefined()
            expect(after.machineState).toBe(MachineState.Placing)
            expect(after.activePlayerIds).toEqual([placer])
            expect(after.turn).toMatchObject({ placementsMade: 1, tradesUsed: 0 })
            expect(offered(before.game, after)[placer]).toEqual([ActionType.PlaceTrack])
        })
    })
})
