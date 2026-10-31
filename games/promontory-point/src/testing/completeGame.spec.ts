import {
    ActionSource,
    GameAction,
    GameEngine,
    Visibility,
    assert,
    assertExists,
    type Game
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { isEndTurn } from '../actions/endTurn.js'
import { isPayRepairs } from '../actions/payRepairs.js'
import { isScrapTrack } from '../actions/scrapTrack.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { PromontoryPointRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import {
    CURRENT_PROMONTORY_POINT_REVISION,
    PromontoryPointGameStateValidator,
    type PromontoryPointGameState,
    type PromontoryPointProjectedState
} from '../model/gameState.js'
import { invariantsHold, piecesConserved } from '../model/invariants.js'
import { GameEndReason, gameEndReason } from '../rules/gameEnd.js'
import { PlayStyle, playCompleteGame, type CompleteGameSetting } from './completeGame.js'
import { finalState, history, type Step, type Walk } from './seededWalk.js'
import { VARIANT_OFF_AND_ON, canonical, engine } from './startGame.js'

const PLAYER_COUNTS = [2, 3, 4]

// Three seeds for every player count and option, each seat leaning its own way.
const SEEDED_STYLES = [
    { seed: 1, style: PlayStyle.TownSeeker },
    { seed: 2, style: PlayStyle.Blocker },
    { seed: 3, style: PlayStyle.Spender }
]

const spectator = { kind: 'spectator' } as const

type Run = CompleteGameSetting & { name: string; walked: Walk }

const RUNS: Run[] = PLAYER_COUNTS.flatMap((playerCount) =>
    VARIANT_OFF_AND_ON.flatMap((config) =>
        SEEDED_STYLES.map(({ seed, style }) => {
            const variant = config.fourPieceVariant === true ? 'variant on' : 'variant off'
            const setting = { playerCount, config, seed, style }
            return {
                ...setting,
                name: `${playerCount} players, ${variant}, seed ${seed} (${style})`,
                walked: playCompleteGame(setting)
            }
        })
    )
)

function perspectivesOf(walked: Walk): Visibility.Perspective[] {
    return [
        ...walked.initial.turnManager.turnOrder.map(
            (playerId) => ({ kind: 'player', playerId }) as const
        ),
        spectator
    ]
}

function project(
    state: PromontoryPointGameState,
    game: Game,
    perspective: Visibility.Perspective
): PromontoryPointProjectedState {
    return PromontoryPointRuntime.visibility.state.project(state, perspective, {
        config: game.config
    })
}

// What every seat and a spectator may all see: the projection without the owner's own hand.
function publicPart(view: PromontoryPointProjectedState): PromontoryPointProjectedState {
    const shared = structuredClone(view)
    for (const player of shared.players) {
        delete player.hand
    }
    return shared
}

// R-5, R-X.2, R-6.3: an action that draws from the bag reads what no seat may see; a kept piece
// returned to an empty bag is drawn back through it.
function drawsFromTheBag(step: Step): boolean {
    const [submitted] = step.processedActions
    return (
        (isEndTurn(submitted) &&
            (step.before.bag.remaining > 0 || submitted.returnKeptPiece === true)) ||
        (isScrapTrack(submitted) && submitted.metadata?.bagEmpty === false)
    )
}

function persisted(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value))
}

describe('Promontory Point scripted complete games', () => {
    describe.each(RUNS)('$name', ({ walked }) => {
        const { game, initial, steps } = walked
        const actions = history(walked)
        const states = steps.flatMap((step) => step.states)
        const final = finalState(walked)

        it('R-6.1, R-6.2: the game reaches its end and `scoring.finalScores` gives every seat its final total', () => {
            expect(final.machineState).toBe(MachineState.EndOfGame)
            expect(gameEndReason(final)).toBeDefined()
            expect(final.result).toBeDefined()
            expect(final.winningPlayerIds.length).toBeGreaterThan(0)
            const totals = PromontoryPointRuntime.scoring.finalScores(final)
            expect(Object.keys(totals).sort()).toEqual([...final.turnManager.turnOrder].sort())
            for (const total of Object.values(totals)) {
                expect(Number.isInteger(total)).toBe(true)
            }
            for (const playerId of final.turnManager.turnOrder) {
                expect(engine.getValidActionTypesForPlayer(game, final, playerId)).toEqual([])
            }
        })

        it('R-X.1: every step is an ordinary user action; the only System Action is the reveal', () => {
            for (const { submitted, processedActions } of steps) {
                expect(submitted.source).toBe(ActionSource.User)
                expect(processedActions[0]?.id).toBe(submitted.id)
            }
            for (const action of actions) {
                expect(action.source === ActionSource.System).toBe(
                    action.type === ActionType.RevealHand
                )
            }
        })

        it('R-1.1: piece and share conservation hold after every action', () => {
            for (const state of [initial, ...states]) {
                expect(piecesConserved(state)).toBe(true)
                expect(invariantsHold(state)).toBe(true)
            }
        })

        it('R-X.3: the game keeps the revision it was created under', () => {
            expect(initial.promontoryPointRevision).toBe(CURRENT_PROMONTORY_POINT_REVISION)
            for (const state of states) {
                expect(state.promontoryPointRevision).toBe(initial.promontoryPointRevision)
            }
        })

        it('persisted replay of the initial state and the user actions gives the same cascades and final state', () => {
            const freshEngine = new GameEngine(Definition.runtime)
            const storedInitial = persisted(initial)
            assert(
                PromontoryPointGameStateValidator.Check(storedInitial),
                'The initial state persists whole'
            )
            let state: PromontoryPointGameState = storedInitial
            const stored = persisted(actions)
            assert(Array.isArray(stored), 'The history persists as a list')
            const records = stored.map((record) => {
                const action = Value.Convert(GameAction, record)
                assert(Value.Check(GameAction, action), 'A persisted action is an action')
                return action
            })
            const userActions = records.filter(({ source }) => source === ActionSource.User)
            expect(userActions).toHaveLength(steps.length)
            userActions.forEach((action, index) => {
                const replayed = freshEngine.executeCanonicalAction({ action, state, game })
                expect(replayed.processedActions.map(({ type, id }) => [type, id])).toEqual(
                    steps[index].processedActions.map(({ type, id }) => [type, id])
                )
                state = canonical(replayed.updatedState)
            })
            expect(state).toEqual(final)

            const applied = records.reduce(
                (current, action) =>
                    canonical(freshEngine.applyProcessedAction({ action, state: current, game })),
                storedInitial
            )
            expect(applied).toEqual(final)
        })

        it('Player Identity: with every seat in another colour, replay gives the same actions, scores and winners', () => {
            const freshEngine = new GameEngine(Definition.runtime)
            const colors = initial.players.map(({ color }) => color)
            const recolored = (state: PromontoryPointGameState): PromontoryPointGameState => ({
                ...state,
                players: state.players.map((player, index) => ({
                    ...player,
                    color: colors[(index + 1) % colors.length]
                }))
            })
            const withoutColor = (state: PromontoryPointGameState) => ({
                ...state,
                players: state.players.map((player) => ({ ...player, color: '' }))
            })
            let state = recolored(initial)
            expect(state.players.map(({ color }) => color)).not.toEqual(colors)
            const userActions = actions.filter(({ source }) => source === ActionSource.User)
            userActions.forEach((action, index) => {
                const replayed = freshEngine.executeCanonicalAction({ action, state, game })
                expect(
                    replayed.processedActions.map(({ type, id, playerId }) => ({
                        type,
                        id,
                        playerId
                    }))
                ).toEqual(
                    steps[index].processedActions.map(({ type, id, playerId }) => ({
                        type,
                        id,
                        playerId
                    }))
                )
                state = canonical(replayed.updatedState)
            })
            expect(withoutColor(state)).toEqual(withoutColor(final))
            expect(state.winningPlayerIds).toEqual(final.winningPlayerIds)
            expect(PromontoryPointRuntime.scoring.finalScores(state)).toEqual(
                PromontoryPointRuntime.scoring.finalScores(final)
            )
        })

        it('R-X.2: full reverse Undo returns, action by action, to the state before each', () => {
            let state = final
            for (let index = actions.length - 1; index >= 0; index -= 1) {
                state = canonical(engine.undoProcessedAction({ action: actions[index], state }))
                expect(state).toEqual(index === 0 ? initial : states[index - 1])
            }
        })

        it("R-5: replay from each seat's projection and a spectator's reaches the same public final state", () => {
            const publicFinal = publicPart(project(final, game, spectator))
            for (const perspective of perspectivesOf(walked)) {
                const projected = Visibility.projectActionHistory({
                    currentState: final,
                    actions,
                    visibility: PromontoryPointRuntime.visibility,
                    perspective,
                    game
                })
                expect(projected.actions.some(Visibility.isRedactedAction)).toBe(false)
                const replayed = projected.actions.reduce(
                    (view, action) => engine.applyProcessedAction({ action, state: view, game }),
                    project(initial, game, perspective)
                )
                expect(replayed).toEqual(project(final, game, perspective))
                expect(publicPart(replayed)).toEqual(publicFinal)
            }
        })

        it('R-5, R-X.2: projected execution defers each draw from the bag to the host and predicts every other action exactly', () => {
            for (const step of steps) {
                const playerId = step.submitted.playerId
                assertExists(playerId, 'A seat submits each user action')
                const perspective = { kind: 'player', playerId } as const
                const execute = () =>
                    engine.executeAction({
                        game,
                        state: project(step.before, game, perspective),
                        action: structuredClone(step.submitted),
                        perspective
                    })
                if (drawsFromTheBag(step)) {
                    expect(execute).toThrow(Visibility.UnavailableProjectedValueError)
                    continue
                }
                const predicted = execute()
                const after = step.states.at(-1)
                assertExists(after, 'An action leaves a state')
                expect(predicted.updatedState).toEqual(project(after, game, perspective))
                expect(predicted.processedActions.map(({ type, id }) => [type, id])).toEqual(
                    step.processedActions.map(({ type, id }) => [type, id])
                )
            }
        })
    })

    describe('across the runs', () => {
        const all = RUNS.flatMap(({ walked }) => history(walked))
        const variant = RUNS.filter(({ config }) => config.fourPieceVariant === true).flatMap(
            ({ walked }) => history(walked)
        )

        it('R-6.1, R-6.1-H1, R-6.1-H2: both end conditions occur', () => {
            expect(new Set(RUNS.map(({ walked }) => gameEndReason(finalState(walked))))).toEqual(
                new Set(Object.values(GameEndReason))
            )
        })

        it('R-4.3, R-4.3-H3: a Repairs finds a debtor, and a debtor forced to sell everything and still short', () => {
            const payments = all.filter(isPayRepairs)
            expect(payments.length).toBeGreaterThan(0)
            expect(payments.some(({ metadata }) => (metadata?.forgiven ?? 0) > 0)).toBe(true)
        })

        it('R-3.3-H1, R-6.1-H2: a scrap draws a replacement, and a scrap finds the bag empty', () => {
            const scraps = all.filter(isScrapTrack)
            expect(scraps.some(({ metadata }) => metadata?.bagEmpty === false)).toBe(true)
            expect(scraps.some(({ metadata }) => metadata?.bagEmpty === true)).toBe(true)
        })

        it('R-6.3: in the variant a leftover piece is both kept and returned', () => {
            const choices = new Set(
                variant.filter(isEndTurn).map(({ returnKeptPiece }) => returnKeptPiece)
            )
            expect(choices).toContain(false)
            expect(choices).toContain(true)
        })
    })
})
