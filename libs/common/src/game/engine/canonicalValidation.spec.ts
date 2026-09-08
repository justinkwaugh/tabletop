import { describe, expect, it, vi } from 'vitest'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameEngine } from './gameEngine.js'
import { createGameFork, GameForkError } from './gameFork.js'
import { GameState } from '../model/gameState.js'
import { createPrivateDealScenario } from '../visibility/tests/hiddenCardScenarios.js'

function fixture() {
    const scenario = createPrivateDealScenario()
    const canonicalStateValidator = Compile(
        Type.Intersect([
            GameState,
            Type.Object({ teamSecret: Type.Object({ value: Type.String() }) })
        ])
    )
    const state = {
        ...scenario.before,
        teamSecret: {
            ownerPlayerId: 'player-1',
            teamPlayerIds: [],
            revealLevel: 'owner' as const,
            value: 'ace'
        }
    }
    const runtime = { ...scenario.runtime, canonicalStateValidator }
    const engine = new GameEngine(runtime)
    return { ...scenario, runtime, engine, state }
}

describe('canonical state validation', () => {
    it('rejects incomplete input before executing rules, even when hydration accepts it', () => {
        const { engine, before, startRound, game, runtime } = fixture()
        expect(() => runtime.hydrator.hydrateState(before)).not.toThrow()
        const hydrateAction = vi.spyOn(runtime.hydrator, 'hydrateAction')
        expect(() =>
            engine.executeCanonicalAction({ state: before, action: startRound, game })
        ).toThrow('Complete canonical state is required')
        expect(hydrateAction).not.toHaveBeenCalled()
        hydrateAction.mockRestore()
    })

    it('checks every completed transition, including generated actions', () => {
        const { runtime, state, game, startRound } = fixture()
        const check = vi.spyOn(runtime.canonicalStateValidator, 'Check')
        const result = new GameEngine(runtime).executeCanonicalAction({
            state,
            game,
            action: startRound
        })
        expect(result.processedActions.length).toBeGreaterThan(1)
        expect(check.mock.calls.map(([value]) => value)).toEqual([
            state,
            ...result.actionCascade.transitions.map(({ after }) => after)
        ])
    })

    it('rejects a broken generated transition before another action can repair it', () => {
        const { runtime, state, game, startRound } = fixture()
        const handlers = runtime.stateHandlers
        const handler = handlers[state.machineState]
        let entered = 0
        const engine = new GameEngine({
            ...runtime,
            stateHandlers: {
                [state.machineState]: {
                    ...handler,
                    enter(context) {
                        entered += 1
                        if (entered === 2) Reflect.deleteProperty(context.gameState, 'teamSecret')
                    }
                }
            }
        })
        expect(() => engine.executeCanonicalAction({ state, game, action: startRound })).toThrow(
            'Complete canonical state is required'
        )
        expect(entered).toBe(2)
        expect(state.teamSecret.value).toBe('ace')
    })

    it('validates initialization after the first state handler has entered', () => {
        const { runtime, state, game } = fixture()
        const engine = new GameEngine({
            ...runtime,
            initializer: {
                ...runtime.initializer,
                initializeGameState: () => runtime.hydrator.hydrateState(state)
            },
            stateHandlers: {
                [state.machineState]: {
                    ...runtime.stateHandlers[state.machineState],
                    enter(context) {
                        Reflect.deleteProperty(context.gameState, 'teamSecret')
                    }
                }
            }
        })
        const unstartedGame = { ...game }
        delete unstartedGame.startedAt
        expect(() => engine.startGame(unstartedGame)).toThrow(
            'Complete canonical state is required'
        )
    })

    it('does not impose canonical validation on projected execution or processed replay', () => {
        const { engine, before, game, startRound } = fixture()
        const result = engine.executeAction({ state: before, game, action: startRound })
        let replayed = before
        for (const action of result.processedActions) {
            replayed = engine.applyProcessedAction({ state: replayed, game, action })
        }
        expect(replayed).toEqual(result.updatedState)
        for (const action of result.processedActions.toReversed()) {
            replayed = engine.undoProcessedAction({ state: replayed, action })
        }
        expect(replayed).toEqual(before)
    })

    it('rejects incomplete Fork sources and incompatible reconstructed positions', () => {
        const { runtime, engine, before, state, game, startRound } = fixture()
        expect(() =>
            createGameFork({ runtime, state: before, game, actions: [], actionIndex: -1 })
        ).toThrow(GameForkError)
        const result = engine.executeCanonicalAction({ state, game, action: startRound })
        const actions = structuredClone(result.processedActions)
        actions[0].undoPatch?.push({ op: 'remove', path: '/teamSecret' })
        expect(() =>
            createGameFork({ runtime, state: result.updatedState, game, actions, actionIndex: -1 })
        ).toThrow(GameForkError)
        expect(() =>
            createGameFork({
                runtime,
                state: result.updatedState,
                game,
                actions,
                actionIndex: actions.length - 1
            })
        ).not.toThrow()
    })

    it('keeps older runtimes usable through their existing hydration validation', () => {
        const { runtime, before, game, startRound } = createPrivateDealScenario()
        const engine = new GameEngine(runtime)
        expect(() =>
            engine.executeCanonicalAction({ state: before, game, action: startRound })
        ).not.toThrow()
        const invalid = structuredClone(before)
        Reflect.set(invalid, 'machineState', 'invalid')
        expect(() => engine.validateCanonicalState(invalid)).toThrow()
    })
})
