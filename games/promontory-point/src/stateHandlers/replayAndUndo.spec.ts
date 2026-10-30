import {
    ActionSource,
    assert,
    assertExists,
    latestPlayerUndoTarget,
    playerUndoReach,
    type GameAction,
    type GameConfig
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isScrapTrack } from '../actions/scrapTrack.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { perRailroad } from '../components/railroads.js'
import { withHoldings } from '../testing/fixtures.js'
import { SeededPlayer } from '../testing/seededPlayer.js'
import { canonical, engine, startGame } from '../testing/startGame.js'
import { withNoRoomFor } from '../testing/turnPieces.js'

// Far more than any game takes: the bag of 96 runs out within a few dozen turns.
const ACTION_LIMIT = 2000

type Step = {
    submitted: GameAction
    processedActions: GameAction[]
    states: PromontoryPointGameState[]
}

type Walk = { initial: PromontoryPointGameState; steps: Step[] }

const WALKS: { name: string; playerCount: number; config: GameConfig; seed: number }[] = [
    { name: '2 players', playerCount: 2, config: {}, seed: 11 },
    { name: '3 players', playerCount: 3, config: {}, seed: 24 },
    {
        name: '4 players, four-piece variant',
        playerCount: 4,
        config: { fourPieceVariant: true },
        seed: 37
    }
]

// R-3.3, R-4.3: the Kansas Pacific boxed in from the start and every seat nearly out of money, so
// a seeded game scraps, draws replacements and queues debtors as well as trading and placing.
function fixture(state: PromontoryPointGameState): PromontoryPointGameState {
    const boxedIn = withNoRoomFor(state, 'railroad.kp', 'railroad.up')
    return withHoldings(
        boxedIn,
        boxedIn.turnManager.turnOrder.map(() => ({
            money: 1,
            shares: perRailroad(() => 1)
        }))
    )
}

function walk(playerCount: number, config: GameConfig, seed: number) {
    const started = startGame({ playerCount, config })
    const game = started.game
    const initial = fixture(started.state)
    const player = new SeededPlayer(seed)
    const steps: Step[] = []
    let state = initial
    while (state.machineState !== MachineState.EndOfGame) {
        assert(steps.length < ACTION_LIMIT, 'A seeded game ends')
        const submitted = player.nextAction(game, state)
        const { processedActions, actionCascade } = engine.executeCanonicalAction({
            action: submitted,
            state,
            game
        })
        const states = actionCascade.transitions.map(({ after }) => canonical(after))
        steps.push({ submitted, processedActions, states })
        state = states[states.length - 1]
    }
    return { game, walked: { initial, steps } }
}

function history(walked: Walk): GameAction[] {
    return walked.steps.flatMap(({ processedActions }) => processedActions)
}

function finalState(walked: Walk): PromontoryPointGameState {
    return walked.steps.at(-1)?.states.at(-1) ?? walked.initial
}

// R-X.2: the barriers a reveal or a draw from the bag sets.
function isBarrier(action: GameAction): boolean {
    return (
        action.type === ActionType.RevealHand ||
        action.type === ActionType.EndTurn ||
        (isScrapTrack(action) && action.metadata?.bagEmpty === false)
    )
}

describe('Promontory Point seeded replay and Undo', () => {
    describe.each(WALKS)('$name', ({ playerCount, config, seed }) => {
        const { game, walked } = walk(playerCount, config, seed)
        const actions = history(walked)
        const states = walked.steps.flatMap((step) => step.states)

        it('R-6.1, R-6.1-H2: a seeded game visits every machine state and every action and is played to its end', () => {
            expect(finalState(walked).machineState).toBe(MachineState.EndOfGame)
            expect(new Set(states.map(({ machineState }) => machineState))).toEqual(
                new Set(Object.values(MachineState))
            )
            expect(new Set(actions.map(({ type }) => type))).toEqual(
                new Set(Object.values(ActionType))
            )
        })

        it("R-X.1: the only System Action is the reveal; every other step is a seat's own input", () => {
            for (const action of actions) {
                expect(action.source === ActionSource.System).toBe(
                    action.type === ActionType.RevealHand
                )
            }
            for (const { processedActions } of walked.steps) {
                expect(processedActions[0]?.source).toBe(ActionSource.User)
            }
        })

        it('replaying the submitted actions gives the same cascades and the same final state', () => {
            let state = walked.initial
            for (const step of walked.steps) {
                const replayed = engine.executeCanonicalAction({
                    action: step.submitted,
                    state,
                    game
                })
                expect(replayed.processedActions.map(({ type, id }) => [type, id])).toEqual(
                    step.processedActions.map(({ type, id }) => [type, id])
                )
                state = canonical(replayed.updatedState)
            }
            expect(state).toEqual(finalState(walked))
        })

        it('applying the processed actions gives the same final state', () => {
            const replayed = actions.reduce(
                (state, action) => canonical(engine.applyProcessedAction({ action, state, game })),
                walked.initial
            )
            expect(replayed).toEqual(finalState(walked))
        })

        it('R-X.2: undo returns, action by action, to every earlier state', () => {
            let state = finalState(walked)
            for (let index = actions.length - 1; index >= 0; index -= 1) {
                state = canonical(engine.undoProcessedAction({ action: actions[index], state }))
                expect(state).toEqual(index === 0 ? walked.initial : states[index - 1])
            }
        })

        it('R-X.2: exactly the reveals, the end-of-turn draws and the drawing scraps are barriers', () => {
            for (const action of actions) {
                expect(action.revealsInfo === true).toBe(isBarrier(action))
            }
        })

        it('R-X.2: within a turn each seat may undo its own latest action; Undo stops at every barrier', () => {
            const playerIds = walked.initial.turnManager.turnOrder
            let done: GameAction[] = []
            for (const step of walked.steps) {
                done = [...done, ...step.processedActions]
                const lastBarrier = done.findLastIndex(isBarrier)
                if (step.processedActions.some(isBarrier)) {
                    for (const playerId of playerIds) {
                        expect(playerUndoReach(done, playerId)).toBeUndefined()
                    }
                    continue
                }
                const [submitted] = step.processedActions
                assertExists(submitted.playerId, 'A seat submits each user action')
                expect(latestPlayerUndoTarget(done, submitted.playerId)).toBe(submitted)
                for (const playerId of playerIds) {
                    const reach = playerUndoReach(done, playerId)
                    if (reach !== undefined) {
                        expect(reach).toBeGreaterThan(done[lastBarrier]?.index ?? -1)
                    }
                }
            }
        })
    })
})
