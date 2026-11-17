import { ActionSource, assert, GameAction, PlayerStatus } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { describe, expect, it } from 'vitest'
import { RideTheRailsGameStateValidator, type RideTheRailsGameState } from '../model/gameState.js'
import { boardMap } from '../data/boardMaps.js'
import { submitAction } from '../testing/completeGame.js'
import { engine } from '../testing/fixtures.js'
import { mapFromConfig, RideTheRailsConfigurator } from './config.js'
import { Definition } from './definition.js'
import { RideTheRailsRuntime } from './runtime.js'

// The tracked recording of a complete four-player USA game, played under the rules of the first
// release, before the map option: its config is empty and its track lies only in USA hexes. A
// change that alters how the USA plays changes what this replay produces, so it fails here first
// (R-X.3).
const RECORDING = new URL('../../rehearsals/first-game/', import.meta.url)

// The recorded game's config, as a game created before the map option stores it.
const STORED_CONFIG = {}

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

function recordedGame(final: RideTheRailsGameState) {
    return RideTheRailsRuntime.initializer.initializeGame(
        {
            id: final.gameId,
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 1,
            config: STORED_CONFIG,
            players: final.players.map(({ playerId }) => ({
                id: playerId,
                name: `Player ${playerId}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

describe('the recorded USA game replays unchanged (R-X.3)', () => {
    it('starts from the recorded seed and players, and every action and the final state match the recording', async () => {
        const final = await recordedState()
        const recorded = await recordedActions()
        const game = recordedGame(final)
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

describe('a game stored before the map option loads, undoes and plays on (R-X.3)', () => {
    it('accepts the stored config, which names no map, as a USA game', () => {
        expect(() => new RideTheRailsConfigurator().validateConfig(STORED_CONFIG)).not.toThrow()
        expect(mapFromConfig(STORED_CONFIG)).toBe('map.usa')
    })

    it('loads the stored state, its track only in USA hexes, as a valid USA state', async () => {
        const final = await recordedState()
        const usa = boardMap('map.usa')
        expect(final.mapId).toBe('map.usa')
        expect(Object.keys(final.track).length).toBeGreaterThan(0)
        expect(Object.keys(final.track).filter((hexId) => !usa.hasHex(hexId))).toEqual([])
        expect('connectionClaim' in final).toBe(false)

        expect(() => engine.validateCanonicalState(final)).not.toThrow()
        const hydrated = RideTheRailsRuntime.hydrator.hydrateState(final)
        expect(hydrated.mapId).toBe('map.usa')
        expect(hydrated.track).toEqual(final.track)
    })

    it('undoes the stored actions back to the game as it started', async () => {
        const final = await recordedState()
        const recorded = await recordedActions()
        const game = recordedGame(final)
        const { initialState } = engine.startGame(game, {
            masterSeed: final.masterSeed,
            startingPositions: { playerIds: final.players.map(({ playerId }) => playerId) }
        })

        let state = final
        for (const action of recorded.toReversed()) {
            state = engine.undoProcessedAction({ action, state })
            expect(RideTheRailsGameStateValidator.Check(state)).toBe(true)
        }

        expect(withoutId(state)).toEqual(withoutId(initialState))
    })

    it('plays on from the stored game undone to mid-game, to the same end', async () => {
        const final = await recordedState()
        const recorded = await recordedActions()
        const game = recordedGame(final)
        // The second half, from its first user action: the game as a player would undo it to.
        const resumeAt = recorded.findIndex(
            ({ source }, index) => index >= recorded.length / 2 && source === ActionSource.User
        )
        expect(resumeAt).toBeGreaterThan(0)
        const later = recorded.slice(resumeAt)

        let state = final
        for (const action of later.toReversed()) {
            state = engine.undoProcessedAction({ action, state })
        }
        expect(state.actionCount).toBe(resumeAt)
        expect(state.result).toBeUndefined()

        const replayed: GameAction[] = []
        for (const action of later.filter(({ source }) => source === ActionSource.User)) {
            const { updatedState, processedActions } = submitAction(game, state, submitted(action))
            replayed.push(...processedActions)
            state = updatedState
        }

        expect(replayed.map(ruled)).toEqual(later.map(ruled))
        expect(state.actionChecksum).toBe(final.actionChecksum)
        expect(withoutId(state)).toEqual(withoutId(final))
    })
})
