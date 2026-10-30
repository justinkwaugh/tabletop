import { assert, assertExists, type Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { BOARD_GRID, BoardNodeKind, PROMONTORY, type SpaceId } from '../components/board.js'
import { MAX_PRICE_INDEX, MIN_PRICE_INDEX } from '../components/priceTrack.js'
import { perRailroad, type RailroadId } from '../components/railroads.js'
import { TownEventKind, type TownTileKindId } from '../components/townTiles.js'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { pathFromHome, withTrack } from '../testing/fixtures.js'
import { canonical, startGame } from '../testing/startGame.js'
import { action, actionEngine, edited, revealedTurn, turnPlayer } from '../testing/turns.js'
import type { DividendPaid, RepairsBilled } from '../effects/townEffectOutcome.js'
import {
    PlaceTrack,
    PlaceTrackRefusal,
    isPlaceTrack,
    type PlaceTrackMetadata
} from './placeTrack.js'

const CP = 'railroad.cp'
const UP = 'railroad.up'
const KP = 'railroad.kp'

type Holding = { money: number; shares?: Partial<Record<RailroadId, number>> }

function seat(state: PromontoryPointGameState, index: number): string {
    const playerId = state.turnManager.turnOrder[index]
    assertExists(playerId, `No seat ${index}`)
    return playerId
}

function playerOf(state: PromontoryPointGameState, playerId: string) {
    const player = state.players.find((candidate) => candidate.playerId === playerId)
    assertExists(player, `No player ${playerId}`)
    return player
}

function moneyBySeat(state: PromontoryPointGameState): number[] {
    return state.turnManager.turnOrder.map((playerId) => playerOf(state, playerId).money)
}

// Swaps the revealed turn pieces with bag pieces, keeping piece conservation.
function withTurnPieces(
    state: PromontoryPointGameState,
    pieces: RailroadId[]
): PromontoryPointGameState {
    return edited(state, (draft) => {
        const turn = draft.turn
        assertExists(turn, 'The fixture has a turn under way')
        draft.bag.items.push(...turn.pieces)
        turn.pieces = pieces.map((railroadId) => {
            const index = draft.bag.items.indexOf(railroadId)
            assert(index >= 0, `The bag holds no ${railroadId} piece`)
            draft.bag.items.splice(index, 1)
            return railroadId
        })
    })
}

// Swaps town tiles so the space carries the kind, keeping the tile counts.
function withTownTile(
    state: PromontoryPointGameState,
    spaceId: SpaceId,
    kindId: TownTileKindId
): PromontoryPointGameState {
    return edited(state, (draft) => {
        const current = draft.towns[spaceId]
        if (current === kindId) {
            return
        }
        const other = BOARD_GRID.spaces().find(
            (space) => space.spaceId in draft.towns && draft.towns[space.spaceId] === kindId
        )
        assertExists(other, `No town holds ${kindId}`)
        draft.towns[other.spaceId] = current
        draft.towns[spaceId] = kindId
    })
}

function withHoldings(
    state: PromontoryPointGameState,
    holdings: Holding[]
): PromontoryPointGameState {
    return edited(state, (draft) => {
        for (const [index, { money, shares = {} }] of holdings.entries()) {
            const player = playerOf(draft, seat(draft, index))
            player.money = money
            player.shares = perRailroad((railroadId) => shares[railroadId] ?? 0)
        }
    })
}

// The nearest space of a kind to a railroad's home, with track placed up to it.
function reaching(
    state: PromontoryPointGameState,
    railroadId: RailroadId,
    kind: BoardNodeKind
): { state: PromontoryPointGameState; spaceId: SpaceId } {
    const paths = BOARD_GRID.spaces()
        .filter((space) => space.kind === kind)
        .map((space) => pathFromHome(railroadId, space.spaceId))
        .sort((left, right) => left.length - right.length)
    const path = paths[0]
    assertExists(path, `No ${kind} space`)
    return {
        state: withTrack(
            state,
            path.slice(0, -1).map((spaceId) => [spaceId, railroadId])
        ),
        spaceId: path[path.length - 1]
    }
}

function trackTo(
    state: PromontoryPointGameState,
    railroadId: RailroadId,
    target: SpaceId
): PromontoryPointGameState {
    return withTrack(
        state,
        pathFromHome(railroadId, target)
            .slice(0, -1)
            .map((spaceId) => [spaceId, railroadId])
    )
}

function dividendPaid(metadata?: PlaceTrackMetadata): DividendPaid {
    const outcome = metadata?.outcome
    if (outcome?.kind !== TownEventKind.Dividend) {
        throw new Error(`Expected a Dividend, got ${outcome?.kind}`)
    }
    return outcome
}

function repairsBilled(metadata?: PlaceTrackMetadata): RepairsBilled {
    const outcome = metadata?.outcome
    if (outcome?.kind !== TownEventKind.Repairs) {
        throw new Error(`Expected a Repairs, got ${outcome?.kind}`)
    }
    return outcome
}

function turnWith(pieces: RailroadId[]): { game: Game; state: PromontoryPointGameState } {
    const { game, state } = startGame()
    return { game, state: withTurnPieces(revealedTurn(game, state), pieces) }
}

function atTown(kindId: TownTileKindId, railroadId: RailroadId = CP) {
    const { game, state } = turnWith([railroadId, UP, KP])
    const reached = reaching(state, railroadId, BoardNodeKind.Town)
    return {
        game,
        spaceId: reached.spaceId,
        state: withTownTile(reached.state, reached.spaceId, kindId)
    }
}

function place(
    game: Game,
    state: PromontoryPointGameState,
    spaceId: SpaceId,
    railroadId: RailroadId = CP,
    playerId = turnPlayer(state)
) {
    const { processedActions, updatedState } = actionEngine.executeCanonicalAction({
        action: action(PlaceTrack, state, { playerId, railroadId, spaceId }),
        state,
        game
    })
    expect(processedActions).toHaveLength(1)
    const [placement] = processedActions
    assert(isPlaceTrack(placement), 'The processed action is the PlaceTrack')
    return { placement, updatedState: canonical(updatedState) }
}

function refusalOf(
    game: Game,
    state: PromontoryPointGameState,
    spaceId: SpaceId,
    railroadId: RailroadId = CP,
    playerId = turnPlayer(state)
): string {
    try {
        place(game, state, spaceId, railroadId, playerId)
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
    throw new Error('PlaceTrack was accepted')
}

describe('PlaceTrack', () => {
    describe('R-3.3: placing a turn piece', () => {
        it('R-3.3, R-2.2 step 3: moves the piece from the turn pieces onto open country, which resolves nothing', () => {
            const { game, state } = turnWith([CP, CP, UP])
            const reached = reaching(state, CP, BoardNodeKind.Empty)

            const { placement, updatedState } = place(game, reached.state, reached.spaceId)

            expect(updatedState.track[reached.spaceId]).toBe(CP)
            expect(updatedState.turn).toEqual({
                pieces: [CP, UP],
                tradesUsed: 0,
                placementsMade: 1,
                placementsLeft: 2
            })
            expect(updatedState.priceIndex).toEqual(reached.state.priceIndex)
            expect(updatedState.players).toEqual(reached.state.players)
            expect(updatedState.towns).toEqual(reached.state.towns)
            expect(updatedState.bag).toEqual(reached.state.bag)
            expect(updatedState.pendingRepairs).toBeUndefined()
            expect(placement.metadata).toEqual({ spaceKind: BoardNodeKind.Empty })
        })

        it('R-2.2, R-2.2-H1: a later placement follows in Placing', () => {
            const { game, state } = turnWith([CP, UP, KP])
            const reached = reaching(state, CP, BoardNodeKind.Empty)
            const placing = edited(reached.state, (draft) => {
                draft.machineState = MachineState.Placing
            })

            const { updatedState } = place(game, placing, reached.spaceId)

            expect(updatedState.track[reached.spaceId]).toBe(CP)
            expect(updatedState.turn?.pieces).toEqual([UP, KP])
        })

        it('R-3.3: is refused for a railroad not among the turn pieces', () => {
            const { game, state } = turnWith([UP, UP, KP])
            const reached = reaching(state, CP, BoardNodeKind.Empty)

            expect(refusalOf(game, reached.state, reached.spaceId)).toContain(
                PlaceTrackRefusal.NotInTurnPieces
            )
        })

        it('R-3.3: is refused on a space that holds a piece', () => {
            const { game, state } = turnWith([CP, UP, KP])
            const reached = reaching(state, CP, BoardNodeKind.Empty)
            const occupied = withTrack(reached.state, [[reached.spaceId, UP]])

            expect(refusalOf(game, occupied, reached.spaceId)).toContain(PlaceTrackRefusal.Occupied)
        })

        it('R-3.3: is refused on a space not next to the home hex or a piece of the railroad', () => {
            const { game, state } = turnWith([CP, UP, KP])

            expect(refusalOf(game, state, PROMONTORY.spaceId)).toContain(
                PlaceTrackRefusal.NotConnected
            )
        })

        it('R-3.3: is refused off the board', () => {
            const { game, state } = turnWith([CP, UP, KP])

            expect(refusalOf(game, state, 'space.99.99')).toContain(PlaceTrackRefusal.NotASpace)
        })

        it('R-2.2 step 3, R-3.3-H1: is refused once the placements are done', () => {
            const { game, state } = turnWith([CP, UP, KP])
            const reached = reaching(state, CP, BoardNodeKind.Empty)
            const done = edited(reached.state, (draft) => {
                draft.machineState = MachineState.Placing
                assertExists(draft.turn, 'The fixture has a turn under way')
                draft.turn.placementsMade = 3
                draft.turn.placementsLeft = 0
            })
            const afterPlacing = edited(done, (draft) => {
                draft.machineState = MachineState.TradingAfterPlacing
            })

            expect(refusalOf(game, done, reached.spaceId)).toContain(
                PlaceTrackRefusal.PlacementsDone
            )
            expect(refusalOf(game, afterPlacing, reached.spaceId)).toContain(
                PlaceTrackRefusal.PlacementsDone
            )
        })

        it('R-2.2: is refused for a seat whose turn it is not', () => {
            const { game, state } = turnWith([CP, UP, KP])
            const reached = reaching(state, CP, BoardNodeKind.Empty)
            const everyoneActive = edited(reached.state, (draft) => {
                draft.activePlayerIds = draft.turnManager.turnOrder
            })

            expect(
                refusalOf(game, everyoneActive, reached.spaceId, CP, seat(everyoneActive, 1))
            ).toContain(PlaceTrackRefusal.NotTurnPlayer)
        })

        it('R-4.3-H4: is refused while a Repairs waits on its debtors', () => {
            const { game, state } = turnWith([CP, UP, KP])
            const reached = reaching(state, CP, BoardNodeKind.Empty)
            const paying = edited(reached.state, (draft) => {
                draft.machineState = MachineState.PayingRepairs
                draft.pendingRepairs = {
                    railroadId: UP,
                    debtors: [{ playerId: seat(draft, 1), owed: 2 }]
                }
            })

            expect(refusalOf(game, paying, reached.spaceId)).toContain(
                PlaceTrackRefusal.RepairsPending
            )
        })

        it('R-2.2 step 1: is refused before the hand is revealed', () => {
            const { game, state } = turnWith([CP, UP, KP])
            const reached = reaching(state, CP, BoardNodeKind.Empty)
            const starting = edited(reached.state, (draft) => {
                draft.machineState = MachineState.StartingTurn
            })

            expect(refusalOf(game, starting, reached.spaceId)).toContain(
                PlaceTrackRefusal.PlacingClosed
            )
        })
    })

    describe('R-4.2: the town resolves at once', () => {
        it('R-4.2, R-1.2: a price town moves the railroad by its value and records the move', () => {
            const { game, state, spaceId } = atTown('tile.price.plus-2')
            const before = state.priceIndex[CP]

            const { placement, updatedState } = place(game, state, spaceId)

            expect(updatedState.priceIndex).toEqual({ ...state.priceIndex, [CP]: before + 2 })
            expect(updatedState.players).toEqual(state.players)
            expect(placement.metadata).toEqual({
                spaceKind: BoardNodeKind.Town,
                townEffectId: 'tile.price.plus-2',
                outcome: {
                    kind: TownEventKind.PriceChange,
                    railroadId: CP,
                    priceChange: 2,
                    priceIndexBefore: before,
                    priceIndexAfter: before + 2,
                    capped: false
                }
            })
        })

        it('R-1.2: a move past 25 stops there and is recorded as capped', () => {
            const placed = atTown('tile.price.plus-3')
            const state = edited(placed.state, (draft) => {
                draft.priceIndex[CP] = MAX_PRICE_INDEX - 1
            })

            const { placement, updatedState } = place(placed.game, state, placed.spaceId)

            expect(updatedState.priceIndex[CP]).toBe(MAX_PRICE_INDEX)
            expect(placement.metadata?.outcome).toMatchObject({
                priceIndexBefore: MAX_PRICE_INDEX - 1,
                priceIndexAfter: MAX_PRICE_INDEX,
                capped: true
            })
        })

        it('R-1.2: a move below the last 0 stops there and is recorded as capped', () => {
            const placed = atTown('tile.price.minus-3')
            const state = edited(placed.state, (draft) => {
                draft.priceIndex[CP] = MIN_PRICE_INDEX + 1
            })

            const { placement, updatedState } = place(placed.game, state, placed.spaceId)

            expect(updatedState.priceIndex[CP]).toBe(MIN_PRICE_INDEX)
            expect(placement.metadata?.outcome).toMatchObject({
                priceIndexBefore: MIN_PRICE_INDEX + 1,
                priceIndexAfter: MIN_PRICE_INDEX,
                capped: true
            })
        })

        it('R-4.2: Promontory adds 5 to the railroad that reaches it', () => {
            const { game, state } = turnWith([CP, UP, KP])
            const reached = trackTo(state, CP, PROMONTORY.spaceId)
            const before = reached.priceIndex[CP]

            const { placement, updatedState } = place(game, reached, PROMONTORY.spaceId)

            expect(updatedState.priceIndex[CP]).toBe(before + 5)
            expect(placement.metadata).toMatchObject({
                spaceKind: BoardNodeKind.Promontory,
                townEffectId: PROMONTORY.spaceId,
                outcome: {
                    kind: TownEventKind.PriceChange,
                    priceChange: 5,
                    priceIndexBefore: before,
                    priceIndexAfter: before + 5,
                    capped: false
                }
            })
        })

        it('R-4.2: a Dividend pays every holder $2 per share, whoever placed, and records each payment', () => {
            const placed = atTown('tile.red.dividend')
            const state = withHoldings(placed.state, [
                { money: 10 },
                { money: 5, shares: { [CP]: 2 } },
                { money: 0, shares: { [UP]: 3 } },
                { money: 1, shares: { [CP]: 1, [UP]: 1 } }
            ])

            const { placement, updatedState } = place(placed.game, state, placed.spaceId)

            expect(moneyBySeat(updatedState)).toEqual([10, 9, 0, 3])
            expect(updatedState.priceIndex).toEqual(state.priceIndex)
            const metadata = placement.metadata
            expect(metadata).toMatchObject({
                spaceKind: BoardNodeKind.Town,
                townEffectId: 'tile.red.dividend'
            })
            const paid = dividendPaid(metadata)
            expect(paid.railroadId).toBe(CP)
            expect(paid.payments).toHaveLength(2)
            expect(paid.payments).toEqual(
                expect.arrayContaining([
                    { playerId: seat(state, 1), amount: 4 },
                    { playerId: seat(state, 3), amount: 2 }
                ])
            )
        })
    })

    describe('R-4.3: a Repairs', () => {
        it('R-4.2, R-4.3-H1: every holder who can pay pays at once and nothing waits', () => {
            const placed = atTown('tile.red.hammer')
            const state = withHoldings(placed.state, [
                { money: 4, shares: { [CP]: 2 } },
                { money: 6, shares: { [CP]: 3 } },
                { money: 0, shares: { [UP]: 2 } },
                { money: 9 }
            ])

            const { placement, updatedState } = place(placed.game, state, placed.spaceId)

            expect(moneyBySeat(updatedState)).toEqual([0, 0, 0, 9])
            expect(updatedState.pendingRepairs).toBeUndefined()
            expect(updatedState.players.map((player) => player.shares)).toEqual(
                state.players.map((player) => player.shares)
            )
            const metadata = placement.metadata
            expect(metadata).toMatchObject({
                spaceKind: BoardNodeKind.Town,
                townEffectId: 'tile.red.hammer',
                outcome: { kind: TownEventKind.Repairs, railroadId: CP, debtors: [] }
            })
            const { bills } = repairsBilled(metadata)
            expect(bills).toHaveLength(2)
            expect(bills).toEqual(
                expect.arrayContaining([
                    { playerId: seat(state, 0), owed: 4, paid: 4 },
                    { playerId: seat(state, 1), owed: 6, paid: 6 }
                ])
            )
        })

        it('R-4.3, R-4.3-H1, R-4.3-H4: short holders pay nothing yet and are queued, the placing seat first', () => {
            const placed = atTown('tile.red.hammer')
            const state = withHoldings(placed.state, [
                { money: 3, shares: { [CP]: 2 } },
                { money: 8, shares: { [CP]: 3 } },
                { money: 0, shares: { [CP]: 1, [UP]: 4 } },
                { money: 2, shares: { [UP]: 1 } }
            ])

            const { placement, updatedState } = place(placed.game, state, placed.spaceId)

            expect(moneyBySeat(updatedState)).toEqual([3, 2, 0, 2])
            expect(updatedState.pendingRepairs).toEqual({
                railroadId: CP,
                debtors: [
                    { playerId: seat(state, 0), owed: 4 },
                    { playerId: seat(state, 2), owed: 2 }
                ]
            })
            const metadata = placement.metadata
            expect(metadata?.outcome).toMatchObject({
                kind: TownEventKind.Repairs,
                railroadId: CP,
                debtors: [
                    { playerId: seat(state, 0), owed: 4 },
                    { playerId: seat(state, 2), owed: 2 }
                ]
            })
            const { bills } = repairsBilled(metadata)
            expect(bills).toHaveLength(3)
            expect(bills).toEqual(
                expect.arrayContaining([
                    { playerId: seat(state, 0), owed: 4, paid: 0 },
                    { playerId: seat(state, 1), owed: 6, paid: 6 },
                    { playerId: seat(state, 2), owed: 2, paid: 0 }
                ])
            )
        })
    })

    describe('R-X.2: not a barrier', () => {
        it('R-X.2: undo removes the piece and reverses the Repairs and every payment', () => {
            const placed = atTown('tile.red.hammer')
            const state = withHoldings(placed.state, [
                { money: 3, shares: { [CP]: 2 } },
                { money: 8, shares: { [CP]: 3 } },
                { money: 5, shares: { [UP]: 1 } },
                { money: 0 }
            ])

            const { placement, updatedState } = place(placed.game, state, placed.spaceId)
            expect(updatedState.pendingRepairs).toBeDefined()
            expect(moneyBySeat(updatedState)).toEqual([3, 2, 5, 0])
            expect(placement.revealsInfo).toBeFalsy()

            expect(
                actionEngine.undoProcessedAction({ state: updatedState, action: placement })
            ).toEqual(state)
        })

        it('R-X.2: undo reverses a price move', () => {
            const { game, state, spaceId } = atTown('tile.price.minus-2')

            const { placement, updatedState } = place(game, state, spaceId)
            expect(placement.revealsInfo).toBeFalsy()

            expect(
                actionEngine.undoProcessedAction({ state: updatedState, action: placement })
            ).toEqual(state)
        })
    })
})
