import { assert, GameAction, GameEngine, GameResult, validateGameResult } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { describe, expect, it } from 'vitest'
import { isFinishBuilding } from '../actions/finishBuilding.js'
import { MAP_IDS, type MapId } from '../data/maps.js'
import { RAILROAD_IDS } from '../data/railroads.js'
import { RideTheRailsGameStateValidator, type RideTheRailsGameState } from '../model/gameState.js'
import { ROUND_COUNT } from '../rules/endOfRound.js'
import { legalPlacements } from '../rules/placement.js'
import { supplyOf } from '../rules/supply.js'
import {
    playCompleteGame,
    submitAction,
    type CompleteGame,
    type RailroadPreference
} from '../testing/completeGame.js'
import { engine, hydrated } from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { RideTheRailsRuntime } from './runtime.js'
import { MachineState } from './states.js'

// A scripted game takes about a second alone; other suites on the machine slow it.
const COMPLETE_GAME_TIMEOUT = 30_000
// The tally across games plays every game it has not yet played.
const ALL_GAMES_TIMEOUT = 60_000

const PLAYER_COUNTS = [3, 4, 5]
// Seeds that spread shares and track over every railroad: three on the USA, one on each
// expansion map, so the whole run stays within the suite's time.
function seedsOn(mapId: MapId): number[] {
    return mapId === 'map.usa' ? [1, 2, 3] : [1]
}

type Script = { mapId: MapId; playerCount: number; seed: number; railroads: RailroadPreference }

// On every map (R-8) and at every player count, the seeds above, and one game that empties the
// scarcest supply first.
const SCRIPTS: Script[] = MAP_IDS.flatMap((mapId) =>
    PLAYER_COUNTS.flatMap((playerCount) => [
        ...seedsOn(mapId).map((seed): Script => ({
            mapId,
            playerCount,
            seed,
            railroads: 'least-taken'
        })),
        { mapId, playerCount, seed: 1, railroads: 'scarcest' }
    ])
)

const USA_SCRIPTS = SCRIPTS.filter((script) => script.mapId === 'map.usa')

const games = new Map<string, CompleteGame>()

function played({ mapId, playerCount, seed, railroads }: Script): CompleteGame {
    const key = `${mapId}:${playerCount}:${seed}:${railroads}`
    const game = games.get(key) ?? playCompleteGame(playerCount, seed, { railroads, mapId })
    games.set(key, game)
    return game
}

const GameActionValidator = Compile(GameAction)

// What a server keeps: the setup state and the user actions as submitted, through JSON.
function persisted(game: CompleteGame): { initial: RideTheRailsGameState; actions: GameAction[] } {
    const record: unknown = JSON.parse(
        JSON.stringify({ initial: game.initial, actions: game.steps.map((step) => step.submitted) })
    )
    assert(typeof record === 'object' && record !== null, 'The record reads back')
    const initial = 'initial' in record ? record.initial : undefined
    const actions = 'actions' in record ? record.actions : undefined
    assert(RideTheRailsGameStateValidator.Check(initial), 'The setup state reads back')
    assert(Array.isArray(actions), 'The user actions read back')
    const userActions = actions.filter((action) => GameActionValidator.Check(action))
    expect(userActions).toHaveLength(actions.length)
    return { initial, actions: userActions }
}

// A cascade as the rules see it. The wall-clock stamp and the undo bookkeeping are the engine's.
function cascadeOf(processed: GameAction[]) {
    return processed.map(({ type, playerId, index }) => ({ type, playerId, index }))
}

// R-8: what only an expansion map's rules write; a USA game never holds them (R-X.3).
const EXPANSION_STATE_FIELDS = ['connectionClaim', 'usedLongDistance']
const EXPANSION_METADATA_KEYS = ['passengerPlacedIn']
const EXPANSION_FINISH_REASONS = ['long-distance']

function keysIn(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.flatMap(keysIn)
    }
    if (typeof value === 'object' && value !== null) {
        return Object.entries(value).flatMap(([key, inner]) => [key, ...keysIn(inner)])
    }
    return []
}

// Each state the engine writes gets a new id; no rule reads it.
function withoutId({ id: _id, ...state }: RideTheRailsGameState) {
    return state
}

describe.each(SCRIPTS)(
    'a scripted complete game: $mapId, $playerCount players, seed $seed, $railroads railroads (R-2, R-6)',
    (script) => {
        it('plays the map it was created on (R-8)', () => {
            const { initial, final } = played(script)
            expect([initial.mapId, final.mapId]).toEqual([script.mapId, script.mapId])
        })

        it(
            'plays six rounds to the end, and the scoring gives every seat its money (R-2.1, R-6.1, R-6.2)',
            () => {
                const { final, history } = played(script)
                expect(final.machineState).toBe(MachineState.Ended)
                expect([GameResult.Win, GameResult.Draw]).toContain(final.result)
                expect(() => validateGameResult(final)).not.toThrow()
                expect(final.roundManager.series).toHaveLength(ROUND_COUNT)
                expect(history.at(-1)?.type).toBe(ActionType.EndGame)

                const scores = RideTheRailsRuntime.scoring.finalScores(final)
                expect(Object.keys(scores).toSorted()).toEqual(
                    final.players.map((player) => player.playerId).toSorted()
                )
                for (const player of final.players) {
                    expect(scores[player.playerId]).toBe(player.money)
                }
            },
            COMPLETE_GAME_TIMEOUT
        )

        it(
            'replays the persisted setup and user actions through a fresh engine to the same cascades and final state',
            () => {
                const game = played(script)
                const { initial, actions } = persisted(game)
                const freshEngine = new GameEngine(RideTheRailsRuntime)
                let state = initial
                for (const [index, action] of actions.entries()) {
                    const { updatedState, processedActions } = submitAction(
                        game.game,
                        state,
                        action,
                        freshEngine
                    )
                    const original = game.steps[index].processed
                    expect(processedActions).toHaveLength(original.length)
                    expect(cascadeOf(processedActions)).toEqual(cascadeOf(original))
                    state = updatedState
                }
                expect(withoutId(state)).toEqual(withoutId(game.final))
            },
            COMPLETE_GAME_TIMEOUT
        )

        it(
            'undoes every action in reverse back to setup, matching the state before each user action (R-5)',
            () => {
                const { initial, steps, final } = played(script)
                let state = final
                for (const step of steps.toReversed()) {
                    state = step.processed
                        .toReversed()
                        .reduce(
                            (undone, action) =>
                                engine.undoProcessedAction({ state: undone, action }),
                            state
                        )
                    expect(state).toEqual(step.before)
                }
                expect(state).toEqual(initial)
            },
            COMPLETE_GAME_TIMEOUT
        )
    }
)

describe.each(USA_SCRIPTS)(
    'a scripted USA game: $playerCount players, seed $seed, $railroads railroads (R-8.1)',
    (script) => {
        it(
            'never writes a state field or metadata key that only an expansion map uses (R-8, R-X.3)',
            () => {
                const { initial, steps, history } = played(script)
                const states = [initial, ...steps.map((step) => step.after)]
                const stateKeys = new Set(states.flatMap(keysIn))
                expect(EXPANSION_STATE_FIELDS.filter((field) => stateKeys.has(field))).toEqual([])
                const actionKeys = new Set(history.flatMap(keysIn))
                expect(EXPANSION_METADATA_KEYS.filter((key) => actionKeys.has(key))).toEqual([])
                const reasons: string[] = history.flatMap((action) =>
                    isFinishBuilding(action) && action.metadata ? [action.metadata.reason] : []
                )
                expect(
                    reasons.filter((reason) => EXPANSION_FINISH_REASONS.includes(reason))
                ).toEqual([])
            },
            COMPLETE_GAME_TIMEOUT
        )
    }
)

describe('across the scripted complete games', () => {
    it(
        'every user and system action occurs; SkipShare needs every available supply empty, which ordinary play does not reach (R-3.1)',
        () => {
            const seen = new Set(
                SCRIPTS.flatMap((script) => played(script).history.map((action) => action.type))
            )
            const missing = Object.values(ActionType).filter((type) => !seen.has(type))
            expect(missing.filter((type) => type !== ActionType.SkipShare)).toEqual([])
        },
        ALL_GAMES_TIMEOUT
    )

    it.each(PLAYER_COUNTS)(
        'with %i players, a building turn opens with nothing legal once the seat’s railroads have empty supplies, and finishes by itself (R-1.1, R-3.2.4)',
        (playerCount) => {
            const { game, steps } = played({
                mapId: 'map.usa',
                playerCount,
                seed: 1,
                railroads: 'scarcest'
            })
            const opensEmpty = (action: GameAction) =>
                isFinishBuilding(action) && action.metadata?.placed === 0
            const step = steps.find((candidate) => candidate.processed.some(opensEmpty))
            assert(step !== undefined, 'A building turn opens with nothing legal')

            // Follow the cascade up to the FinishBuilding, to see the turn as it opened.
            const index = step.processed.findIndex(opensEmpty)
            const finish = step.processed[index]
            assert(isFinishBuilding(finish), 'The cascade holds the FinishBuilding')
            const opened = hydrated(
                step.processed
                    .slice(0, index)
                    .reduce(
                        (state, action) => engine.applyProcessedAction({ game, state, action }),
                        step.before
                    )
            )
            const playerId = finish.playerId
            expect(finish.metadata?.reason).toBe('nothing-legal')
            expect(step.submitted.playerId).not.toBe(playerId)
            expect(opened.machineState).toBe(MachineState.Building)
            expect(opened.turnManager.currentTurn()?.playerId).toBe(playerId)
            expect(opened.building).toEqual({ placed: 0, usedMountain: false })
            expect(legalPlacements(opened, playerId)).toEqual([])

            const held = RAILROAD_IDS.filter(
                (railroadId) => opened.getPlayerState(playerId).sharesOf(railroadId) > 0
            )
            expect(held.length).toBeGreaterThan(0)
            expect(held.map((railroadId) => supplyOf(opened, railroadId))).toEqual(
                held.map(() => 0)
            )

            const after = hydrated(step.after)
            expect(after.turnManager.currentTurn()?.playerId).not.toBe(playerId)
        },
        COMPLETE_GAME_TIMEOUT
    )
})
