import { assert, GameAction, GameEngine, GameResult, validateGameResult } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { describe, expect, it } from 'vitest'
import { isFinishBuilding } from '../actions/finishBuilding.js'
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
const SEEDS = [1, 2, 3]

type Script = { playerCount: number; seed: number; railroads: RailroadPreference }

// Three seeds that spread shares and track over every railroad, and one per player count that
// empties the scarcest supply first.
const SCRIPTS: Script[] = PLAYER_COUNTS.flatMap((playerCount) => [
    ...SEEDS.map((seed): Script => ({ playerCount, seed, railroads: 'least-taken' })),
    { playerCount, seed: 1, railroads: 'scarcest' }
])

const games = new Map<string, CompleteGame>()

function played({ playerCount, seed, railroads }: Script): CompleteGame {
    const key = `${playerCount}:${seed}:${railroads}`
    const game = games.get(key) ?? playCompleteGame(playerCount, seed, { railroads })
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

// Each state the engine writes gets a new id; no rule reads it.
function withoutId({ id: _id, ...state }: RideTheRailsGameState) {
    return state
}

describe.each(SCRIPTS)(
    'a scripted complete game: $playerCount players, seed $seed, $railroads railroads (R-2, R-6)',
    (script) => {
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
            const { game, steps } = played({ playerCount, seed: 1, railroads: 'scarcest' })
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
