import { describe, expect, it, vi } from 'vitest'
import { GameEngine } from '../../engine/gameEngine.js'
import { Prng } from '../../components/prng.js'
import { createPrivateDealScenario, createSecretRandomnessScenario } from './hiddenCardScenarios.js'

describe('randomness and Action identity reconstruction', () => {
    it.each([1, 2, 3])(
        'executes, replays and undoes version %i with an older hydrated-state interface',
        (version) => {
            const scenario = createPrivateDealScenario()
            delete scenario.game.protectedInformation
            scenario.before.systemVersion = version
            if (version < 3) delete scenario.before.protectedPrng
            const runtime = {
                ...scenario.runtime,
                visibility: undefined,
                hydrator: {
                    ...scenario.runtime.hydrator,
                    hydrateState(state: typeof scenario.before) {
                        const hydrated = scenario.runtime.hydrator.hydrateState(state)
                        Object.defineProperties(hydrated, {
                            getPublicPrng: { value: undefined },
                            getProtectedPrng: { value: undefined },
                            getPrng: { value: () => new Prng(hydrated.prng) }
                        })
                        return hydrated
                    }
                }
            }
            const legacyState = runtime.hydrator.hydrateState(scenario.before)
            expect(legacyState.getPublicPrng).toBeUndefined()
            expect(legacyState.getProtectedPrng).toBeUndefined()
            expect(Reflect.get(legacyState, 'getPrng')).toBeTypeOf('function')
            const engine = new GameEngine(runtime)
            const full = engine.executeCanonicalAction({
                action: scenario.startRound,
                state: scenario.before,
                game: scenario.game
            })
            expect(full.processedActions).toHaveLength(2)
            const expectedId =
                version === 1
                    ? `${scenario.startRound.id}-1`
                    : new Prng({ ...scenario.before.prng }).randId()
            expect(full.processedActions[1].id).toBe(expectedId)
            let replay = scenario.before
            for (const action of full.processedActions) {
                replay = engine.executeSingleAction({
                    action,
                    state: replay,
                    game: scenario.game
                }).updatedState
            }
            expect(replay).toEqual(full.updatedState)
            for (const action of full.processedActions.toReversed()) {
                replay = engine.undoProcessedAction({ action, state: replay })
            }
            expect(replay).toEqual(scenario.before)
            const redone = engine.executeCanonicalAction({
                action: scenario.startRound,
                state: replay,
                game: scenario.game
            })
            expect(redone.updatedState).toEqual(full.updatedState)
        }
    )

    it.each([
        [2, 0],
        [2, 2],
        [3, 0],
        [3, 2]
    ])(
        'preserves version %i generated identities during flattened replay with %i siblings',
        (version, siblings) => {
            const scenario = createSecretRandomnessScenario()
            scenario.before.systemVersion = version
            scenario.before.generatedActionIds = []
            scenario.before.siblingCount = siblings
            const engine = new GameEngine(scenario.runtime)
            const full = engine.executeAction({
                action: scenario.prepareDeck,
                state: scenario.before,
                game: scenario.game
            })
            let state = scenario.before
            for (const action of full.processedActions) {
                state = engine.executeSingleAction({
                    action,
                    state,
                    game: scenario.game
                }).updatedState
            }
            expect(state).toEqual(full.updatedState)
            expect(state.generatedActionIds).toEqual(
                full.processedActions.slice(1).map(({ id }) => id)
            )
        }
    )

    it('retains version 1 causal identities without consuming randomness for identity', () => {
        const scenario = createSecretRandomnessScenario()
        scenario.before.systemVersion = 1
        delete scenario.before.protectedPrng
        const result = new GameEngine(scenario.runtime).executeAction({
            action: scenario.prepareDeck,
            state: scenario.before,
            game: scenario.game
        })
        expect(result.processedActions.map(({ id }) => id)).toEqual([
            'prepare-secret-deck',
            'prepare-secret-deck-1',
            'prepare-secret-deck-2'
        ])
        expect(result.updatedState.prng.invocations).toBe(4)
    })

    it('reapplies a retained simultaneous submission after undo removes its predecessor', () => {
        const scenario = createSecretRandomnessScenario()
        const engine = new GameEngine(scenario.runtime)
        const first = { ...scenario.prepareDeck, id: 'first', simultaneousGroupId: 'round' }
        const retained = { ...first, id: 'retained' }
        const acceptedFirst = engine.executeAction({
            action: first,
            state: scenario.before,
            game: scenario.game
        })
        const acceptedRetained = engine.executeAction({
            action: retained,
            state: acceptedFirst.updatedState,
            game: scenario.game
        })
        let state = acceptedRetained.updatedState
        for (const action of [
            ...acceptedFirst.processedActions,
            ...acceptedRetained.processedActions
        ].toReversed()) {
            state = engine.undoProcessedAction({ action, state })
        }
        const redone = engine.executeAction({ action: retained, state, game: scenario.game })
        const expected = engine.executeAction({
            action: retained,
            state: scenario.before,
            game: scenario.game
        })
        expect(redone.updatedState).toEqual(expected.updatedState)
        expect(redone.processedActions.map(({ id }) => id)).toEqual(
            expected.processedActions.map(({ id }) => id)
        )
        expect(redone.processedActions[1]?.id).not.toBe(acceptedRetained.processedActions[1]?.id)
    })

    it('restores random cursors and generated identities through undo and redo', () => {
        const scenario = createSecretRandomnessScenario()
        const engine = new GameEngine(scenario.runtime)
        const full = engine.executeAction({
            action: scenario.prepareDeck,
            state: scenario.before,
            game: scenario.game
        })
        let state = full.updatedState
        for (const action of full.processedActions.toReversed()) {
            state = engine.undoProcessedAction({ action, state })
        }
        expect(state).toEqual(scenario.before)
        const redo = engine.executeAction({
            action: scenario.prepareDeck,
            state,
            game: scenario.game
        })
        expect(redo.updatedState).toEqual(full.updatedState)
        expect(redo.processedActions.map(({ id }) => id)).toEqual(
            full.processedActions.map(({ id }) => id)
        )
    })

    it('converges after simultaneous acceptance reverses the local order', () => {
        const scenario = createSecretRandomnessScenario()
        const engine = new GameEngine(scenario.runtime)
        const first = {
            ...scenario.prepareDeck,
            id: 'first',
            index: 1,
            simultaneousGroupId: 'round'
        }
        const second = { ...first, id: 'second' }
        const local = engine.executeAction({
            action: first,
            state: scenario.before,
            game: scenario.game
        })
        const acceptedSecond = engine.executeAction({
            action: second,
            state: scenario.before,
            game: scenario.game
        })
        const acceptedFirst = engine.executeAction({
            action: first,
            state: acceptedSecond.updatedState,
            game: scenario.game
        })
        expect(acceptedFirst.indexOffset).not.toBe(0)
        let state = local.updatedState
        for (const action of local.processedActions.toReversed()) {
            state = engine.undoProcessedAction({ action, state })
        }
        for (const action of [
            ...acceptedSecond.processedActions,
            ...acceptedFirst.processedActions
        ]) {
            state = engine.applyProcessedAction({ action, state, game: scenario.game })
        }
        expect(state).toEqual(acceptedFirst.updatedState)
    })

    it('preserves random outcomes and generated references when fork records receive new identities', () => {
        const scenario = createSecretRandomnessScenario()
        scenario.before.generatedActionIds = []
        const engine = new GameEngine(scenario.runtime)
        const full = engine.executeAction({
            action: scenario.prepareDeck,
            state: scenario.before,
            game: scenario.game
        })
        let state = scenario.before
        for (const [index, action] of full.processedActions.entries()) {
            state = engine.executeSingleAction({
                action: { ...action, id: `fork-${index}` },
                state,
                game: scenario.game
            }).updatedState
        }
        expect(state.deck).toEqual(full.updatedState.deck)
        expect(state.prng).toEqual(full.updatedState.prng)
        expect(state.generatedActionIds).toEqual(full.updatedState.generatedActionIds)
        expect(state.actionChecksum).not.toBe(full.updatedState.actionChecksum)
    })

    it('initializes independent protected entropy without requiring visibility registration', () => {
        const scenario = createSecretRandomnessScenario()
        const entropy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.25).mockReturnValueOnce(0.75)
        try {
            const engine = new GameEngine(scenario.runtime)
            const first = engine.generateUninitializedState(scenario.game)
            const second = engine.generateUninitializedState(scenario.game)
            expect(first.prng).toEqual(second.prng)
            expect(first).toHaveProperty('protectedPrng', { seed: 1073741824, invocations: 0 })
            expect(second).toHaveProperty('protectedPrng', { seed: 3221225472, invocations: 0 })
            const withoutVisibility = new GameEngine({
                ...scenario.runtime,
                visibility: undefined
            }).generateUninitializedState(scenario.game)
            expect(withoutVisibility.systemVersion).toBe(3)
            expect(withoutVisibility.protectedPrng).toBeDefined()
        } finally {
            entropy.mockRestore()
        }
    })
})
