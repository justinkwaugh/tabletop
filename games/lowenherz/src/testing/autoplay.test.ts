import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus, validateGameResult, type GameAction } from '@tabletop/common'
import { Definition } from '../definition/definition.js'
import { LowenherzRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { isAdvanceResolution } from '../actions/advanceResolution.js'
import { nextAction } from './autoplay.js'

const engine = new GameEngine(LowenherzRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'
const STEP_LIMIT = 5000
const GAME_TIMEOUT_MS = 30_000

function playFullGame(playerCount: number) {
    const game = LowenherzRuntime.initializer.initializeGame(
        {
            id: 'autoplay-game',
            typeId: Definition.info.id,
            ownerId: 'p0',
            config: {},
            players: Array.from({ length: playerCount }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState } = engine.startGame(game, { masterSeed })
    let state = initialState
    const actions: GameAction[] = []
    let peakPowerPoints = 0
    for (let step = 0; step < STEP_LIMIT && state.machineState !== MachineState.EndOfGame; step++) {
        const result = engine.executeCanonicalAction({
            game: startedGame,
            state,
            action: nextAction(state, startedGame.id)
        })
        state = result.updatedState
        actions.push(...result.processedActions)
        if (state.machineState !== MachineState.EndOfGame) {
            peakPowerPoints = Math.max(
                peakPowerPoints,
                ...state.players.map((player) => player.powerPoints)
            )
        }
    }
    return { state, actions, peakPowerPoints }
}

describe.each([2, 3, 4])('autoplay with %i players', (playerCount) => {
    it(
        'plays a full game with a changing score',
        () => {
            const { state, actions, peakPowerPoints } = playFullGame(playerCount)

            expect(state.machineState).toBe(MachineState.EndOfGame)
            expect(() => validateGameResult(state)).not.toThrow()
            const roundEnds = actions.filter(
                (action) => isAdvanceResolution(action) && action.metadata?.roundAdvanced
            )
            expect(roundEnds.length).toBeGreaterThanOrEqual(2)
            expect(peakPowerPoints).toBeGreaterThan(0)
        },
        GAME_TIMEOUT_MS
    )
})
