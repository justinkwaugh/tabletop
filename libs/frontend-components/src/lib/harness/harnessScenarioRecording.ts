import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameConfig,
    assertExists,
    type Game,
    type GameAction,
    type GameState
} from '@tabletop/common'
import type {
    HarnessScenario,
    HarnessScenarioMove,
    HarnessScenarioSeed
} from './harnessScenarios.js'

// Built on first use, so a published UI Artifact that bundles this library never compiles it.
function recordingSchema() {
    return Type.Object({
        format: Type.Literal(1),
        id: Type.String({ pattern: '^[a-z0-9][a-z0-9-]*$' }),
        label: Type.String({ minLength: 1 }),
        description: Type.String(),
        recordedWith: Type.String(),
        seed: Type.Union([
            Type.Object({ masterSeed: Type.String() }),
            Type.Object({ seed: Type.Number() })
        ]),
        config: GameConfig,
        seats: Type.Array(Type.Object({ id: Type.String(), name: Type.String() }), { minItems: 1 }),
        moves: Type.Array(
            Type.Intersect([
                Type.Object({ type: Type.String(), playerId: Type.Optional(Type.String()) }),
                Type.Record(Type.String(), Type.Unknown())
            ])
        )
    })
}
export type HarnessScenarioRecording = Type.Static<ReturnType<typeof recordingSchema>>
let recordingValidator: ReturnType<typeof compileRecordingValidator> | undefined
function compileRecordingValidator() {
    return Compile(recordingSchema())
}

// What the engine adds to a player's move when it processes it; a recording keeps only the input.
const ProcessedKeys = [
    'gameId',
    'source',
    'index',
    'metadata',
    'undoPatch',
    'forwardPatch',
    'createdAt',
    'updatedAt'
] as const

export function recordedScenario(recording: HarnessScenarioRecording): HarnessScenario {
    const { id, label, description, config, seed, seats, moves } = recording
    return {
        id,
        label,
        description,
        playerCount: seats.length,
        config,
        seed,
        seats,
        isComplete: (_state, { movesPlayed }) => movesPlayed === moves.length,
        nextMove: (_state, { movesPlayed }) => moves[movesPlayed]
    }
}

// Validates the recordings a title's dev page loads; one that does not match the format is
// reported and left out of the menu rather than stopping the harness.
export function recordedScenarios(files: Record<string, unknown>): HarnessScenario[] {
    return Object.entries(files).flatMap(([path, recording]) => {
        recordingValidator ??= compileRecordingValidator()
        if (recordingValidator.Check(recording)) return [recordedScenario(recording)]
        console.error(`Scenario recording ${path} is not in the recording format`, [
            ...recordingValidator.Errors(recording)
        ])
        return []
    })
}

export function recordGame({
    id,
    label,
    description,
    recordedWith,
    game,
    state,
    actions
}: {
    id: string
    label: string
    description: string
    recordedWith: string
    game: Game
    state: GameState
    actions: GameAction[]
}): HarnessScenarioRecording {
    return {
        format: 1,
        id,
        label,
        description,
        recordedWith,
        seed: recordedSeed(game, state),
        config: game.config,
        seats: game.players.map((player) => ({ id: player.id, name: player.name })),
        moves: actions
            .filter((action) => action.source === ActionSource.User)
            .toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
            .map(recordedMove)
    }
}

function recordedSeed(game: Game, state: GameState): HarnessScenarioSeed {
    if (state.masterSeed) return { masterSeed: state.masterSeed }
    assertExists(game.seed, 'This game has no seed to record')
    return { seed: game.seed }
}

function recordedMove(action: GameAction): HarnessScenarioMove {
    const move: Record<string, unknown> = { ...action }
    for (const key of ProcessedKeys) delete move[key]
    return { ...move, type: action.type, playerId: action.playerId }
}
