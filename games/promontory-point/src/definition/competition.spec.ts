import {
    GameResult,
    assert,
    assertExists,
    validateGameResult,
    type Game,
    type GameConfig
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { EndTurn } from '../actions/endTurn.js'
import { BOARD_GRID, PROMONTORY, type SpaceId } from '../components/board.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { isRedTile } from '../components/townTiles.js'
import {
    PromontoryPointGameStateValidator,
    type PromontoryPointGameState
} from '../model/gameState.js'
import { finalTotals } from '../rules/finalTotals.js'
import { GameEndReason, gameEndReason } from '../rules/gameEnd.js'
import { withEmptyBag, withHoldings, withTrack } from '../testing/fixtures.js'
import { offered, placeOnOpenCountry, play } from '../testing/play.js'
import { SeededPlayer } from '../testing/seededPlayer.js'
import {
    TEST_MASTER_SEED,
    VARIANT_OFF_AND_ON,
    canonical,
    createGame,
    engine,
    startGame
} from '../testing/startGame.js'
import { withPlacingEnded } from '../testing/turnPieces.js'
import { playerOf, turnPlayer } from '../testing/turns.js'
import { Definition } from './definition.js'
import { PromontoryPointRuntime } from './runtime.js'
import { MachineState } from './states.js'

const PLAYER_COUNTS = [2, 3, 4]

// Far more than any game takes: the bag of 96 runs out within a few dozen turns.
const ACTION_LIMIT = 2000

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function variantName(config: GameConfig): string {
    return config.fourPieceVariant === true ? 'variant on' : 'variant off'
}

// R-2.2: three placements on open country, then the end of the turn (the leftover kept in the
// variant).
function plainTurn(game: Game, state: PromontoryPointGameState): PromontoryPointGameState {
    const placed = (state.turn?.pieces ?? [])
        .slice(0, 3)
        .reduce((current, railroadId) => placeOnOpenCountry(game, current, railroadId).state, state)
    const leftover = (placed.turn?.pieces.length ?? 0) > 0
    return play(game, placed, EndTurn, {
        playerId: turnPlayer(placed),
        returnKeptPiece: leftover ? false : undefined
    }).state
}

// R-2.1, R-2.2: the seat's turn is open, and only that seat is offered anything.
function expectTurnOf(game: Game, state: PromontoryPointGameState, playerId: string) {
    expect(state.machineState).toBe(MachineState.TradingBeforePlacing)
    expect(state.activePlayerIds).toEqual([playerId])
    expect(state.turnManager.series.at(-1)?.playerId).toBe(playerId)
    for (const [seatId, types] of Object.entries(offered(game, state))) {
        expect(types.length > 0).toBe(seatId === playerId)
    }
}

// The final state's result, checked against the final totals (R-6.2, R-6.2-H1).
function expectRecordedResult(state: PromontoryPointGameState) {
    expect(state.machineState).toBe(MachineState.EndOfGame)
    expect(state.activePlayerIds).toEqual([])
    expect(() => validateGameResult(state)).not.toThrow()
    const finalScores = PromontoryPointRuntime.scoring.finalScores(state)
    expect(finalScores).toEqual(
        Object.fromEntries(finalTotals(state).map(({ playerId, total }) => [playerId, total]))
    )
    const best = Math.max(...Object.values(finalScores))
    const leaders = state.turnManager.turnOrder.filter((playerId) => finalScores[playerId] === best)
    expect(state.winningPlayerIds).toEqual(leaders)
    expect(state.result).toBe(leaders.length > 1 ? GameResult.Draw : GameResult.Win)
}

describe.each(PLAYER_COUNTS)('Promontory Point tournaments with %i players', (playerCount) => {
    describe.each(VARIANT_OFF_AND_ON.map((config) => ({ config, name: variantName(config) })))(
        '$name',
        ({ config }) => {
            const game = createGame(playerCount, config)
            const ids = game.players.map((player) => player.id)

            it('R-2.1, R-2.1-H1: every seat rotation gives position zero the first turn, then play follows the assigned order', () => {
                for (const order of rotations(ids)) {
                    const { startedGame, initialState } = engine.startGame(game, {
                        masterSeed: TEST_MASTER_SEED,
                        startingPositions: { playerIds: order }
                    })
                    let state = canonical(initialState)
                    expect(state.turnManager.turnOrder).toEqual(order)
                    expect(state.players.map((player) => player.playerId)).toEqual(order)
                    for (const playerId of order) {
                        expectTurnOf(startedGame, state, playerId)
                        state = plainTurn(startedGame, state)
                    }
                    expectTurnOf(startedGame, state, order[0])
                }
            })

            it('R-1.3, R-2.1-H1: an assignment changes only the turn order; the table, the bag and each position are as seeded', () => {
                const raw = engine.generateUninitializedState(game, TEST_MASTER_SEED)
                const initialize = (playerIds?: string[]) =>
                    canonical(
                        Definition.runtime.initializer
                            .initializeGameState(
                                game,
                                structuredClone(raw),
                                playerIds ? { playerIds } : undefined
                            )
                            .dehydrate()
                    )
                const normal = initialize()
                expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)

                for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
                    const assigned = initialize(order)
                    expect(initialize(order)).toEqual(assigned)
                    assert(PromontoryPointGameStateValidator.Check(assigned), 'Canonical setup')
                    expect(assigned.turnManager.turnOrder).toEqual(order)
                    expect(assigned.activePlayerIds).toEqual([order[0]])
                    expect(assigned.turnManager.series.at(-1)?.playerId).toBe(order[0])

                    // Each player keeps their colour; each position keeps its money, shares and
                    // hand, so position zero opens with the pieces the first seat would have had.
                    for (const [position, player] of assigned.players.entries()) {
                        const seeded = normal.players[position]
                        const own = normal.players.find(
                            (candidate) => candidate.playerId === player.playerId
                        )
                        assertExists(own, `No player ${player.playerId}`)
                        expect(player.color).toBe(own.color)
                        expect({ ...player, playerId: '', color: '' }).toEqual({
                            ...seeded,
                            playerId: '',
                            color: ''
                        })
                    }
                    expect({
                        ...assigned,
                        players: normal.players,
                        turnManager: normal.turnManager,
                        activePlayerIds: normal.activePlayerIds
                    }).toEqual(normal)
                }
            })

            it('R-6.1, R-6.2, R-6.2-H1: a seeded game in an assigned order ends with a recorded result', () => {
                const order = [...ids].reverse()
                const { startedGame, initialState } = engine.startGame(game, {
                    masterSeed: TEST_MASTER_SEED,
                    startingPositions: { playerIds: order }
                })
                const player = new SeededPlayer(
                    playerCount * 10 + (config.fourPieceVariant ? 1 : 0)
                )
                let state = canonical(initialState)
                for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
                    assert(step < ACTION_LIMIT, 'A seeded game ends')
                    state = canonical(
                        engine.executeCanonicalAction({
                            game: startedGame,
                            state,
                            action: player.nextAction(startedGame, state)
                        }).updatedState
                    )
                }
                expect(state.turnManager.turnOrder).toEqual(order)
                expect(gameEndReason(state)).toBeDefined()
                expectRecordedResult(state)
            })

            it('R-2.1: refuses an assignment that does not name every seat exactly once', () => {
                const refused = [
                    [ids[0], ...ids.slice(0, -1)],
                    ids.slice(1),
                    [...ids.slice(0, -1), 'unknown']
                ]
                for (const playerIds of refused) {
                    expect(() =>
                        engine.startGame(game, {
                            masterSeed: TEST_MASTER_SEED,
                            startingPositions: { playerIds }
                        })
                    ).toThrow()
                }
            })
        }
    )
})

// R-6.1: the board covered: at most one red tile uncovered and Promontory taken.
function withRedTilesCovered(state: PromontoryPointGameState): PromontoryPointGameState {
    const redTowns = BOARD_GRID.spaces()
        .map(({ spaceId }) => spaceId)
        .filter((spaceId) => spaceId in state.towns && isRedTile(state.towns[spaceId]))
    const covering: [SpaceId, RailroadId][] = [...redTowns.slice(1), PROMONTORY.spaceId].map(
        (spaceId, index) => [spaceId, RAILROAD_IDS[index % RAILROAD_IDS.length]]
    )
    return withTrack(state, covering)
}

const ENDINGS = [
    { reason: GameEndReason.RedTilesCovered, ending: withRedTilesCovered },
    { reason: GameEndReason.BagEmpty, ending: withEmptyBag }
]

describe('Promontory Point game result', () => {
    describe.each(ENDINGS)('$reason', ({ reason, ending }) => {
        // At the start price of 5, two Central Pacific shares are worth $10.
        it('R-6.2: the highest final total wins, counting shares at their final price, not money alone', () => {
            const { game, state } = startGame({ playerCount: 3 })
            const ended = withPlacingEnded(
                withHoldings(ending(state), [
                    { money: 18 },
                    { money: 10, shares: { 'railroad.cp': 2 } },
                    { money: 19, shares: {} }
                ])
            )
            const final = play(game, ended, EndTurn, { playerId: turnPlayer(ended) }).state
            expect(gameEndReason(final)).toBe(reason)
            expectRecordedResult(final)
            expect(final.winningPlayerIds).toEqual([final.turnManager.turnOrder[1]])
            expect(final.result).toBe(GameResult.Win)
            expect(PromontoryPointRuntime.scoring.finalScores(final)).toEqual(
                Object.fromEntries(
                    final.turnManager.turnOrder.map((playerId, index) => [
                        playerId,
                        [18, 20, 19][index]
                    ])
                )
            )
        })

        it('R-6.2-H1: tied leaders share the win with no tie-break, and the result is a draw', () => {
            const { game, state } = startGame({ playerCount: 4 })
            const ended = withPlacingEnded(
                withHoldings(ending(state), [
                    { money: 20 },
                    { money: 5 },
                    { money: 10, shares: { 'railroad.cp': 2 } },
                    { money: 15, shares: { 'railroad.sp': 1 } }
                ])
            )
            const final = play(game, ended, EndTurn, { playerId: turnPlayer(ended) }).state
            expect(gameEndReason(final)).toBe(reason)
            expectRecordedResult(final)
            const [first, , third, fourth] = final.turnManager.turnOrder
            expect(final.winningPlayerIds).toEqual([first, third, fourth])
            expect(final.result).toBe(GameResult.Draw)
            // R-6.2: final totals are derived; no money changes hands at the end.
            for (const player of final.players) {
                expect(player.money).toBe(playerOf(ended, player.playerId).money)
            }
        })
    })
})
