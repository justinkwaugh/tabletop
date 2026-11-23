import { describe, expect, it } from 'vitest'
import {
    ExplorationHistory,
    GameEngine,
    assert,
    assertExists,
    type GameAction,
    type GameConfig,
    type Visibility
} from '@tabletop/common'
import { isAdjustMarket } from '../actions/adjustMarket.js'
import { isDevelop } from '../actions/develop.js'
import { LwGameStateValidator, type LwGameState } from '../model/gameState.js'
import { botAction, createGame } from '../testing/bot.js'
import { LwRuntime } from './runtime.js'

const engine = new GameEngine(LwRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'
const spectator = { kind: 'spectator' } as const

function perspectives(state: LwGameState): Visibility.Perspective[] {
    return [
        spectator,
        ...state.turnManager.turnOrder.map((playerId) => ({ kind: 'player', playerId }) as const)
    ]
}

function metadataOf(action: GameAction): unknown {
    return 'metadata' in action ? action.metadata : undefined
}

// Plays the bot until the first Market Demands, keeping every processed Action.
function playToMarket(config: GameConfig = {}) {
    const game = createGame(3, config)
    let state = engine.startGame(game, { masterSeed }).initialState
    const actions: GameAction[] = []
    for (let step = 0; !actions.some(isAdjustMarket); step++) {
        assert(step < 200, 'No Market Demands within 200 steps')
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action = botAction(LwRuntime.hydrator.hydrateState(state), playerId, step)
        const result = engine.executeCanonicalAction({ game, state, action })
        actions.push(...result.processedActions)
        state = result.updatedState
    }
    return { game, state, actions }
}

describe('visibility', () => {
    it('withholds the master seed and the protected dice stream from every Perspective', () => {
        const { game, state } = playToMarket()
        assert(LwGameStateValidator.Check(state), 'Projection starts from canonical state')
        expect(state.masterSeed).toBe(masterSeed)
        for (const perspective of perspectives(state)) {
            const view = LwRuntime.visibility.state.project(state, perspective, {
                config: game.config
            })
            expect(view).not.toHaveProperty('masterSeed')
            expect(view.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            const { masterSeed: _seed, protectedPrng: _stream, ...open } = state
            expect({ ...view, protectedPrng: undefined }).toEqual({
                ...open,
                protectedPrng: undefined
            })
            expect(() => LwRuntime.hydrator.hydrateState(view)).not.toThrow()
        }
    })

    it('rolls Market Demands and new Initial Orders from the protected stream, as reveals', () => {
        const { state, actions } = playToMarket()
        const market = actions.find(isAdjustMarket)
        assertExists(market?.metadata, 'Market Demands ran')
        expect(market.metadata.steps.some((step) => step.rolls.length > 0)).toBe(true)
        expect(market.revealsInfo).toBe(true)
        expect(state.protectedPrng?.invocations).toBeGreaterThan(0)
        for (const develop of actions.filter(isDevelop)) {
            expect(develop.revealsInfo ?? false).toBe(develop.metadata?.nextRoll !== undefined)
        }
    })

    it('explores from a player’s view, rolling dice from a fresh stream of its own', () => {
        const { game, state } = playToMarket()
        const [playerId] = state.turnManager.turnOrder
        const view = LwRuntime.visibility.state.project(
            state,
            { kind: 'player', playerId },
            { config: game.config }
        )
        const populate = LwRuntime.exploration.createFromProjectedState
        const hypothetical = new ExplorationHistory(engine).prepareState(
            populate({
                game,
                state: view,
                actions: [],
                perspective: spectator,
                random: Math.random
            })
        )
        expect(hypothetical.protectedPrng).not.toEqual(state.protectedPrng)
        let explored = hypothetical
        const processed: GameAction[] = []
        for (let step = 0; !processed.some(isAdjustMarket); step++) {
            assert(step < 200, 'No Market Demands within 200 steps')
            const [acting] = explored.activePlayerIds
            assertExists(acting, `No active player in ${explored.machineState}`)
            const action = botAction(LwRuntime.hydrator.hydrateState(explored), acting, step)
            const result = engine.executeCanonicalAction({ game, state: explored, action })
            processed.push(...result.processedActions)
            explored = result.updatedState
        }
        expect(explored.protectedPrng?.invocations).toBeGreaterThan(0)
    })

    it('shows every Perspective the public Actions whole', () => {
        const { game, state, actions } = playToMarket()
        for (const perspective of perspectives(state)) {
            for (const action of actions) {
                const view = LwRuntime.visibility.actions.project(action, perspective, {
                    config: game.config
                })
                expect(view.type).toBe(action.type)
                expect(metadataOf(view)).toEqual(metadataOf(action))
            }
        }
    })
})
