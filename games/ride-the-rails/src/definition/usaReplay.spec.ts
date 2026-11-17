import { ActionSource, assert, GameAction, PlayerStatus } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { describe, expect, it } from 'vitest'
import { RideTheRailsGameStateValidator, type RideTheRailsGameState } from '../model/gameState.js'
import { submitAction } from '../testing/completeGame.js'
import { engine } from '../testing/fixtures.js'
import { Definition } from './definition.js'
import { RideTheRailsRuntime } from './runtime.js'

// The tracked recording of a complete four-player USA game. A change that alters how the USA plays
// changes what this replay produces, so it fails here first (R-X.3).
const RECORDING = new URL('../../rehearsals/first-game/', import.meta.url)

const GameActionValidator = Compile(GameAction)

// What the engine adds to an action as it processes it.
const PROCESSING_FIELDS = new Set(['metadata', 'index', 'undoPatch'])

// The recording, through the test runner's loader. The wall-clock stamps are written as text and
// no rule reads them, so they are left out.
async function readRecording(name: string): Promise<unknown> {
    const module: unknown = await import(/* @vite-ignore */ new URL(name, RECORDING).href)
    assert(typeof module === 'object' && module !== null && 'default' in module, `${name} loads`)
    return JSON.parse(JSON.stringify(module.default), (key, value: unknown) =>
        key === 'createdAt' ? undefined : value
    )
}

async function recordedState(): Promise<RideTheRailsGameState> {
    const state = await readRecording('state.json')
    assert(RideTheRailsGameStateValidator.Check(state), 'The recorded state reads back')
    return state
}

async function recordedActions(): Promise<GameAction[]> {
    const actions = await readRecording('actions.json')
    assert(Array.isArray(actions), 'The recorded actions read back')
    const valid = actions.filter((action) => GameActionValidator.Check(action))
    expect(valid).toHaveLength(actions.length)
    return valid
}

// What the rules decide about an action; ids, stamps and undo bookkeeping are the engine's.
function ruled(action: GameAction) {
    const { type, playerId, source, index } = action
    return { type, playerId, source, index, metadata: 'metadata' in action ? action.metadata : {} }
}

// The user action as it was submitted, before the engine processed it.
function submitted(action: GameAction): GameAction {
    const input = Object.fromEntries(
        Object.entries(action).filter(([field]) => !PROCESSING_FIELDS.has(field))
    )
    assert(GameActionValidator.Check(input), `${action.id} reads as submitted`)
    return input
}

// Each state the engine writes gets a new id; no rule reads it.
function withoutId({ id: _id, ...state }: RideTheRailsGameState) {
    return state
}

describe('the recorded USA game replays unchanged (R-X.3)', () => {
    it('starts from the recorded seed and players, and every action and the final state match the recording', async () => {
        const final = await recordedState()
        const recorded = await recordedActions()
        const game = RideTheRailsRuntime.initializer.initializeGame(
            {
                id: final.gameId,
                typeId: Definition.info.id,
                ownerId: 'owner',
                seed: 1,
                config: {},
                players: final.players.map(({ playerId }) => ({
                    id: playerId,
                    name: `Player ${playerId}`,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            Definition
        )
        const { initialState } = engine.startGame(game, {
            masterSeed: final.masterSeed,
            startingPositions: { playerIds: final.players.map(({ playerId }) => playerId) }
        })
        expect(initialState.seed).toBe(final.seed)

        let state: RideTheRailsGameState = initialState
        const replayed: GameAction[] = []
        for (const action of recorded.filter(({ source }) => source === ActionSource.User)) {
            const { updatedState, processedActions } = submitAction(game, state, submitted(action))
            replayed.push(...processedActions)
            state = updatedState
        }

        expect(replayed.map(ruled)).toEqual(recorded.map(ruled))
        expect(state.actionCount).toBe(final.actionCount)
        expect(state.actionChecksum).toBe(final.actionChecksum)
        expect(withoutId(state)).toEqual(withoutId(final))
    })
})
