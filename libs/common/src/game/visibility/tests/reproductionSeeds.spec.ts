import { describe, expect, it } from 'vitest'
import { GameEngine } from '../../engine/gameEngine.js'
import { deriveGameSeeds } from '../../../util/gameSeeds.js'
import {
    requireCanonical,
    createPrivateHandGame,
    runtime,
    projector,
    spectator,
    p1
} from './privateHandGame.js'
import { createSecretRandomnessScenario } from './hiddenCardScenarios.js'
import { projectActionHistory } from '../gameVisibility.js'

const masterSeed = '0123456789abcdef0123456789abcdef'

describe('versioned reproduction seeds', () => {
    it('initializes both cursors from a single private seed and publishes only the numeric seed', () => {
        const { game } = createPrivateHandGame()
        delete game.startedAt
        const engine = new GameEngine({ ...runtime, randomnessVersion: 1 })
        const { initialState, startedGame } = engine.startGame(game, masterSeed)
        requireCanonical(initialState)
        const expected = deriveGameSeeds(masterSeed)
        expect(initialState.masterSeed).toBe(masterSeed)
        expect(initialState.prng.seed).toBe(expected.publicSeed)
        expect(startedGame.seed).toBe(expected.publicSeed)
        expect(initialState.protectedPrng).toMatchObject({
            algorithm: 'chacha20-v1',
            seed: expected.protectedSeed
        })
        for (const perspective of [spectator, p1]) {
            const view = projector.project(initialState, perspective)
            expect(view).not.toHaveProperty('masterSeed')
            expect(view.protectedPrng).toEqual({ seed: 0, invocations: 0 })
        }
        expect(startedGame).not.toHaveProperty('masterSeed')
    })

    it('keeps older runtime initialization numeric and refuses unsupported reproduction requests', () => {
        const { game, engine } = createPrivateHandGame()
        const state = engine.generateUninitializedState(game)
        expect(state.prng.seed).toBe(game.seed)
        expect(state).not.toHaveProperty('masterSeed')
        expect(typeof state.protectedPrng?.seed).toBe('number')
        expect(() => engine.generateUninitializedState(game, masterSeed)).toThrow(
            'does not support'
        )
    })

    it('replays, undoes and projects a ChaCha20 cascade without leaking its seed', () => {
        const scenario = createSecretRandomnessScenario()
        const seeds = deriveGameSeeds(masterSeed)
        scenario.before.masterSeed = masterSeed
        scenario.before.protectedPrng = {
            algorithm: 'chacha20-v1',
            seed: seeds.protectedSeed,
            invocations: 399
        }
        const engine = new GameEngine(scenario.runtime)
        const result = engine.executeCanonicalAction({
            action: scenario.prepareDeck,
            state: scenario.before,
            game: scenario.game
        })
        let replay = scenario.before
        for (const action of result.processedActions) {
            replay = engine.executeSingleAction({
                action,
                state: replay,
                game: scenario.game
            }).updatedState
        }
        expect(replay).toEqual(result.updatedState)
        for (const action of result.processedActions.toReversed()) {
            replay = engine.undoProcessedAction({ action, state: replay })
        }
        expect(replay).toEqual(scenario.before)
        const history = projectActionHistory({
            currentState: result.updatedState,
            actions: result.processedActions,
            visibility: scenario.runtime.visibility,
            perspective: spectator,
            replay: { runtime: scenario.runtime, game: scenario.game }
        })
        expect(JSON.stringify(history)).not.toContain(masterSeed)
        expect(JSON.stringify(history)).not.toContain(seeds.protectedSeed)
    })
})
