import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import jsonpatch from 'fast-json-patch'
import {
    ActionSource,
    GameEngine,
    GameStatus,
    PlayerStatus,
    calculateActionChecksum,
    type Game,
    type GameAction,
    type GameDefinition,
    type GameState
} from '@tabletop/common'

export type ComparisonPhase = 'final' | 'resume' | 'variant'

export interface RehearsalFixture {
    name: string
    packageId: string
    state: string
    actions: string
    game?: Partial<Game>
    config?: Game['config']
    variants?: Record<
        string,
        (initial: GameState, engine: GameEngine, game: Game) => { state: GameState; game: Game }
    >
    comparisonNotes?: string[]
    assertProtectedView?: (state: GameState, playerId: string, canonical: GameState) => void
    normalizeState?: (state: GameState, phase: ComparisonPhase) => GameState
}

export interface Rehearsal {
    fixture: RehearsalFixture
    definition: GameDefinition
    game: Game
    finalState: GameState
    actions: GameAction[]
}

export interface ReplayStep {
    input: GameAction
    state: GameState
    actions: GameAction[]
}

export interface RehearsalFailure {
    stage: string
    index?: number
    type?: string
    message: string
}

export function jsonCopy<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
}

export function unprocessedAction(action: GameAction): GameAction {
    const input = structuredClone(action)
    for (const key of ['undoPatch', 'forwardPatch', 'metadata', 'index']) {
        Reflect.deleteProperty(input, key)
    }
    return input
}

export function compareStates(
    rehearsal: Rehearsal,
    expected: GameState,
    actual: GameState,
    phase: ComparisonPhase
) {
    const normalize = (state: GameState) => {
        const value = jsonCopy(state)
        return rehearsal.fixture.normalizeState
            ? jsonCopy(rehearsal.fixture.normalizeState(value, phase))
            : value
    }
    const expectedValue = normalize(expected)
    const actualValue = normalize(actual)
    return {
        matches: isDeepStrictEqual(expectedValue, actualValue),
        differences: jsonpatch.compare(expectedValue, actualValue).slice(0, 30),
        rawDifferencePaths: jsonpatch
            .compare(jsonCopy(expected), jsonCopy(actual))
            .map((operation) => operation.path)
    }
}

export async function loadRehearsal(fixtureUrl: URL): Promise<Rehearsal> {
    const { default: fixture }: { default: RehearsalFixture } = await import(fixtureUrl.href)
    assert.match(fixture.packageId, /^[a-z0-9-]+$/, 'Fixture must identify a Game package')
    if (fixture.normalizeState)
        assert(
            fixture.comparisonNotes?.length,
            'State normalization requires documented comparison notes'
        )
    const { Definition: definition }: { Definition: GameDefinition } = await import(
        new URL(`../../../../games/${fixture.packageId}/esm/index.js`, import.meta.url).href
    )
    const finalState: GameState = JSON.parse(
        await readFile(new URL(fixture.state, fixtureUrl), 'utf8')
    )
    const actions: GameAction[] = JSON.parse(
        await readFile(new URL(fixture.actions, fixtureUrl), 'utf8')
    )
    for (const action of actions) {
        if (action.createdAt) action.createdAt = new Date(action.createdAt)
        if (action.updatedAt) action.updatedAt = new Date(action.updatedAt)
    }
    actions.sort((left, right) => (left.index ?? -1) - (right.index ?? -1))
    const game = definition.runtime.initializer.initializeGame(
        {
            id: finalState.gameId,
            typeId: definition.info.id,
            name: fixture.name,
            ownerId: 'rehearsal-player-0',
            isPublic: false,
            hotseat: false,
            seed: finalState.prng.seed,
            players: finalState.players.map((player, index) => ({
                id: player.playerId,
                name: `Player ${index + 1}`,
                userId: `rehearsal-player-${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            })),
            config: fixture.config,
            ...fixture.game
        },
        definition
    )
    game.status = GameStatus.Started
    return { fixture, definition, game, finalState, actions }
}

export function runReplay(rehearsal: Rehearsal, variant?: string) {
    const { definition, actions, finalState } = rehearsal
    let game = structuredClone(rehearsal.game)
    const engine = new GameEngine(definition.runtime)
    assert.equal(actions.length, finalState.actionCount, 'Export must contain the complete history')
    assert.equal(
        new Set(actions.map((action) => action.id)).size,
        actions.length,
        'Action IDs must be unique'
    )
    actions.forEach((action, index) => {
        assert.equal(action.index, index, 'Action indices must be contiguous from zero')
        assert.equal(action.gameId, game.id, 'Action belongs to a different Game')
        assert(action.undoPatch, `Action ${index} has no canonical undo patch`)
    })
    assert.equal(
        calculateActionChecksum(0, actions),
        finalState.actionChecksum,
        'Export checksum mismatch'
    )
    const recordedStates = [structuredClone(finalState)]
    engine.validateCanonicalState(finalState)
    for (const action of actions.toReversed()) {
        const before = engine.undoProcessedAction({ state: recordedStates[0], action })
        engine.validateCanonicalState(before)
        recordedStates.unshift(before)
    }
    let initialState = recordedStates[0]
    assert.equal(initialState.actionCount, 0, 'History did not reconstruct the initial position')
    assert.equal(initialState.actionChecksum, 0, 'Initial checksum must be zero')
    if (variant) {
        const prepare = rehearsal.fixture.variants?.[variant]
        assert(prepare, `Unknown rehearsal variant: ${variant}`)
        const prepared = prepare(structuredClone(initialState), engine, game)
        initialState = prepared.state
        game = prepared.game
        engine.validateCanonicalState(initialState)
    }
    const inputs = actions.filter((action) => action.source === ActionSource.User)
    const failures: RehearsalFailure[] = []
    const steps: ReplayStep[] = []
    let state = structuredClone(initialState)
    let resumeChecks = 0
    let serializationChecks = 0
    let replayFailed = false
    const recordFailure = (stage: string, action: GameAction, error: unknown) =>
        failures.push({
            stage,
            index: action.index,
            type: action.type,
            message: error instanceof Error ? error.message : String(error)
        })
    for (const [position, action] of inputs.entries()) {
        assert(action.index !== undefined)
        const actionIndex = action.index
        const expectedCount = inputs[position + 1]?.index ?? actions.length
        if (!variant)
            try {
                const resumed = engine.executeCanonicalAction({
                    state: structuredClone(recordedStates[actionIndex]),
                    game,
                    action: unprocessedAction(action)
                })
                assert.equal(
                    resumed.updatedState.actionCount,
                    expectedCount,
                    'Automatic cascade length changed'
                )
                const comparison = compareStates(
                    rehearsal,
                    recordedStates[expectedCount],
                    resumed.updatedState,
                    'resume'
                )
                assert(comparison.matches, JSON.stringify(comparison.differences))
                resumeChecks++
            } catch (error) {
                recordFailure('resume', action, error)
            }
        if (replayFailed) continue
        try {
            const result = engine.executeCanonicalAction({
                state,
                game,
                action: unprocessedAction(action)
            })
            assert.equal(
                result.updatedState.actionCount,
                expectedCount,
                'Automatic cascade length changed'
            )
            try {
                const serialized = engine.executeCanonicalAction({
                    state: jsonCopy(state),
                    game,
                    action: unprocessedAction(action)
                })
                const differences = jsonpatch.compare(
                    jsonCopy(result.updatedState),
                    jsonCopy(serialized.updatedState)
                )
                assert.equal(differences.length, 0, JSON.stringify(differences.slice(0, 30)))
                serializationChecks++
            } catch (error) {
                recordFailure('serialization', action, error)
            }
            state = result.updatedState
            steps.push({
                input: unprocessedAction(action),
                state: structuredClone(state),
                actions: result.processedActions
            })
        } catch (error) {
            recordFailure('replay', action, error)
            replayFailed = true
        }
    }
    const comparison = compareStates(rehearsal, finalState, state, variant ? 'variant' : 'final')
    if (!comparison.matches)
        failures.push({ stage: 'final-state', message: JSON.stringify(comparison.differences) })
    return {
        game,
        initialState,
        finalState: state,
        steps,
        recordedStates,
        report: {
            name: rehearsal.fixture.name,
            variant: variant ?? 'recorded',
            passed: failures.length === 0,
            inputs: steps.length,
            processedActions: steps.reduce((count, step) => count + step.actions.length, 0),
            resumeChecks,
            serializationChecks,
            canonicalSnapshots: recordedStates.length,
            checksum: state.actionChecksum,
            comparisonNotes: rehearsal.fixture.comparisonNotes ?? [],
            ...comparison,
            failures
        }
    }
}
