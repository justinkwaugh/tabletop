import {
    ActionSource,
    GameResult,
    assert,
    assertExists,
    createAction,
    validateGameResult,
    type GameAction
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { EndGame, HydratedEndGame } from '../actions/endGame.js'
import { cityById } from '../data/boardMaps.js'
import { MAP_IDS, type MapId } from '../data/maps.js'
import {
    CURRENT_RIDE_THE_RAILS_REVISION,
    RideTheRailsGameStateValidator,
    type RideTheRailsGameState
} from '../model/gameState.js'
import { legalPlacements } from '../rules/placement.js'
import { firstLinkFrom } from '../rules/routeSearch.js'
import { shareableRailroads } from '../rules/shares.js'
import {
    buildState,
    createGame,
    engine,
    fixturePlayerIds,
    hydrated,
    masterSeed
} from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { PhaseName } from './phases.js'
import { RideTheRailsRuntime } from './runtime.js'
import { MachineState } from './states.js'

// A whole game takes about two seconds alone; the margin covers a loaded machine.
const WHOLE_GAME_TIMEOUT_MS = 30_000

type UserInput = Omit<GameAction, 'id' | 'gameId' | 'source'> & Record<string, unknown>

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function byPlayer(state: RideTheRailsGameState) {
    return state.players.toSorted((a, b) => a.playerId.localeCompare(b.playerId))
}

// A plain player: a share of a railroad it may take, every legal locomotive until the building
// turn closes by itself, and the first one-link journey from a passenger, else a pass.
function nextInput(state: RideTheRailsGameState, step: number): UserInput {
    const gameState = hydrated(state)
    const [playerId] = state.activePlayerIds
    assertExists(playerId, `No active player in ${state.machineState}`)
    switch (state.machineState) {
        case MachineState.TakingShares: {
            const railroadIds = shareableRailroads(gameState)
            assert(railroadIds.length > 0, 'An active share taker has a share to take')
            return {
                type: ActionType.TakeShare,
                playerId,
                railroadId: railroadIds[step % railroadIds.length]
            }
        }
        case MachineState.Building: {
            const placements = legalPlacements(gameState, playerId)
            if (placements.length === 0) {
                return { type: ActionType.EndBuilding, playerId }
            }
            const { railroadId, hexId } = placements[step % placements.length]
            return { type: ActionType.PlaceLocomotive, playerId, railroadId, hexId }
        }
        case MachineState.Riding: {
            for (const cityId of state.passengers) {
                const { hexId } = cityById(cityId)
                const link = firstLinkFrom(state, hexId, [hexId])
                if (link) {
                    return { type: ActionType.RideJourney, playerId, links: [link] }
                }
            }
            return { type: ActionType.PassJourney, playerId }
        }
        default:
            throw new Error(`No player acts in ${state.machineState}`)
    }
}

class Table {
    readonly game
    readonly processed: GameAction[] = []
    state: RideTheRailsGameState
    private step = 0

    constructor(playerIds: readonly string[], mapId: MapId) {
        this.game = createGame(playerIds.length, 11, mapId)
        this.state = engine.startGame(this.game, {
            masterSeed,
            startingPositions: { playerIds: [...playerIds] }
        }).initialState
    }

    playOne() {
        const action = {
            id: `a${this.state.actionCount}`,
            gameId: this.state.gameId,
            source: ActionSource.User,
            ...nextInput(this.state, this.step++)
        }
        const result = engine.executeCanonicalAction({
            game: this.game,
            state: this.state,
            action
        })
        this.processed.push(...result.processedActions)
        this.state = result.updatedState
    }

    playUntil(done: (state: RideTheRailsGameState) => boolean) {
        for (let guard = 0; !done(this.state); guard++) {
            assert(guard < 4000, `The game did not reach its goal from ${this.state.machineState}`)
            this.playOne()
        }
    }
}

const roundNumber = (state: RideTheRailsGameState) =>
    hydrated(state).roundManager.currentRound?.number

// The player of each turn of round 1's phases, in the order the turns came.
function roundOneTurns(state: RideTheRailsGameState): Record<string, string[]> {
    return Object.fromEntries(
        state.phaseManager.series.slice(0, 3).map((phase) => {
            const end = phase.end ?? state.actionCount
            const turns = state.turnManager.series.filter(
                (turn) => turn.start >= phase.start && turn.start < end
            )
            return [phase.name, turns.map((turn) => turn.playerId)]
        })
    )
}

// R-8: the map is the creation option that changes setup, so every map is played at every count.
const TOURNAMENTS = MAP_IDS.flatMap((mapId) => [3, 4, 5].map((count) => ({ mapId, count })))

describe.each(TOURNAMENTS)(
    'Ride the Rails tournaments on $mapId with $count players (R-1.2, R-8)',
    ({ mapId, count }) => {
        const playerIds = fixturePlayerIds(count)

        // R-2.2: position zero is first in turn order. Take a Share runs in reverse, so its first
        // turn is the last position's; Build and Ride open with position zero.
        it('puts position zero first in turn order and later positions after it, in every rotation (R-2.2, R-2.3)', () => {
            for (const order of rotations(playerIds)) {
                const table = new Table(order, mapId)
                expect(table.state.turnManager.turnOrder).toEqual(order)
                expect(table.state.players.map((player) => player.playerId)).toEqual(order)
                expect(table.state.activePlayerIds).toEqual([order.at(-1)])

                table.playUntil((state) => roundNumber(state) === 2)
                expect(roundOneTurns(table.state)).toEqual({
                    [PhaseName.TakeShare]: order.toReversed(),
                    [PhaseName.Build]: order,
                    [PhaseName.Ride]: order
                })
            }
        })

        it('leaves setup otherwise unchanged for the same master seed (R-1.3, R-X.3)', () => {
            const game = createGame(count, 11, mapId)
            const uninitialized = engine.generateUninitializedState(game, masterSeed)
            const initialize = (assigned?: string[]) =>
                RideTheRailsRuntime.initializer
                    .initializeGameState(
                        game,
                        structuredClone(uninitialized),
                        assigned ? { playerIds: assigned } : undefined
                    )
                    .dehydrate()
            const normal = initialize()
            expect(normal.mapId).toBe(mapId)
            expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
            for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
                const assigned = initialize(order)
                expect(initialize(order)).toEqual(assigned)
                expect(assigned.turnManager.turnOrder).toEqual(order)
                expect(assigned.rideTheRailsRevision).toBe(CURRENT_RIDE_THE_RAILS_REVISION)
                // Seat colours, money and shares belong to the player, not the position.
                expect(byPlayer(assigned)).toEqual(byPlayer(normal))
                expect(assigned.turnManager.series).toEqual(
                    normal.turnManager.series.map((turn) => ({ ...turn, playerId: order.at(-1) }))
                )
                expect({
                    ...assigned,
                    players: byPlayer(assigned),
                    turnManager: normal.turnManager,
                    activePlayerIds: normal.activePlayerIds
                }).toEqual({ ...normal, players: byPlayer(normal) })
                assert(RideTheRailsGameStateValidator.Check(assigned), 'Setup must be canonical')
            }
        })

        it(
            'finishes an assigned game with a result validateGameResult accepts (R-6.1, R-6.2)',
            () => {
                const order = playerIds.toReversed()
                const table = new Table(order, mapId)
                table.playUntil((state) => state.result !== undefined)
                const finished = table.state

                expect(finished.machineState).toBe(MachineState.Ended)
                assert(RideTheRailsGameStateValidator.Check(finished), 'The end must be canonical')
                expect(() => validateGameResult(finished)).not.toThrow()

                const finalScores = RideTheRailsRuntime.scoring.finalScores(finished)
                expect(finalScores).toEqual(
                    Object.fromEntries(
                        finished.players.map((player) => [player.playerId, player.money])
                    )
                )
                expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
                const best = Math.max(...Object.values(finalScores))
                expect(finished.winningPlayerIds).toEqual(
                    finished.players
                        .filter((player) => player.money === best)
                        .map((player) => player.playerId)
                )
                expect(finished.result).toBe(
                    finished.winningPlayerIds.length === 1 ? GameResult.Win : GameResult.Draw
                )

                // Every processed action, user and system, is one the hydrator rebuilds.
                for (const action of table.processed) {
                    expect(RideTheRailsRuntime.hydrator.hydrateAction(action).dehydrate()).toEqual(
                        action
                    )
                }
                const types = new Set(table.processed.map((action) => action.type))
                for (const type of [
                    ActionType.TakeShare,
                    ActionType.PlaceLocomotive,
                    ActionType.RideJourney,
                    ActionType.EndRound,
                    ActionType.EndGame
                ]) {
                    expect(types).toContain(type)
                }
            },
            WHOLE_GAME_TIMEOUT_MS
        )
    }
)

describe('terminal results (R-6.2)', () => {
    function endGame(playerCount: number, money: Record<string, number>) {
        const state = buildState({ playerCount, round: 6, phase: PhaseName.Ride, money })
        new HydratedEndGame(
            createAction(EndGame, {
                id: 'end-game',
                gameId: state.gameId,
                source: ActionSource.System
            })
        ).apply(state)
        return state.dehydrate()
    }

    const cases: { playerCount: number; money: Record<string, number>; winners: string[] }[] = [
        { playerCount: 3, money: { p1: 40, p2: 52, p3: 25 }, winners: ['p2'] },
        { playerCount: 3, money: { p1: 52, p2: 30, p3: 52 }, winners: ['p1', 'p3'] },
        { playerCount: 4, money: { p1: 61, p2: 61, p3: 20, p4: 61 }, winners: ['p1', 'p2', 'p4'] },
        { playerCount: 5, money: {}, winners: ['p1', 'p2', 'p3', 'p4', 'p5'] }
    ]

    it.each(cases)(
        'records winners $winners for money $money',
        ({ playerCount, money, winners }) => {
            const state = endGame(playerCount, money)
            expect(state.winningPlayerIds).toEqual(winners)
            expect(state.result).toBe(winners.length === 1 ? GameResult.Win : GameResult.Draw)
            expect(() => validateGameResult(state)).not.toThrow()
            expect(RideTheRailsRuntime.scoring.finalScores(state)).toEqual(
                Object.fromEntries(
                    fixturePlayerIds(playerCount).map((playerId) => [
                        playerId,
                        money[playerId] ?? 0
                    ])
                )
            )
        }
    )
})
