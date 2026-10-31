import {
    ActionSource,
    assertExists,
    latestPlayerUndoTarget,
    playerUndoReach,
    type GameAction
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { WALKS, finalState, history, isUndoBarrier, walk } from '../testing/seededWalk.js'
import { canonical, engine } from '../testing/startGame.js'

describe('Promontory Point seeded replay and Undo', () => {
    describe.each(WALKS)('$name', (setting) => {
        const walked = walk(setting)
        const { game } = walked
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
                expect(action.revealsInfo === true).toBe(isUndoBarrier(action))
            }
        })

        it('R-X.2: within a turn each seat may undo its own latest action; Undo stops at every barrier', () => {
            const playerIds = walked.initial.turnManager.turnOrder
            let done: GameAction[] = []
            for (const step of walked.steps) {
                done = [...done, ...step.processedActions]
                const lastBarrier = done.findLastIndex(isUndoBarrier)
                if (step.processedActions.some(isUndoBarrier)) {
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
