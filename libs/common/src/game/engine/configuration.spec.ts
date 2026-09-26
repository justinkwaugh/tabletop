import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    assert,
    assertExists,
    BaseConfigurator,
    defineGame,
    ExplorationHistory,
    GameAction,
    GameEngine,
    HydratableAction,
    normalizeGame,
    type Game,
    type GameConfig,
    type GameConfigOptions,
    type GameConfigurator,
    type GameRuntime,
    type MachineContext
} from '../../index.js'
import {
    createNoteGame,
    noteGameInfo,
    noteGameRuntime,
    type HydratedNoteGameState,
    type NoteGameState
} from './tests/noteGame.js'

class Configurator extends BaseConfigurator {
    schema = Type.Object({ enabled: Type.Boolean() }, { additionalProperties: false })
    options: GameConfigOptions = []
    normalizeConfig(config: GameConfig): GameConfig {
        const { legacyEnabled, ...current } = config
        return { ...current, enabled: legacyEnabled ?? current.enabled ?? false }
    }
}

const ConfigAction = Type.Object({
    ...GameAction.properties,
    type: Type.Union([Type.Literal('advance'), Type.Literal('automatic')])
})
const actionValidator = Compile(ConfigAction)
class ConfiguredAction extends HydratableAction<typeof ConfigAction> {
    constructor(data: GameAction) {
        assert(actionValidator.Check(data), 'Invalid configuration test action')
        super(data, actionValidator)
    }
    apply(state: HydratedNoteGameState, context?: MachineContext): void {
        assertExists(context)
        expect(context.gameConfig).toEqual({ enabled: true })
        state.steps.push(`${this.type}:${context.gameConfig.enabled}`)
    }
}

function scenario(config: GameConfig = { legacyEnabled: true }) {
    const observations: string[] = []
    const observe = (point: string, config: GameConfig) => {
        expect(config).toEqual({ enabled: true })
        observations.push(point)
    }
    const initializer = noteGameRuntime.initializer
    const playing = noteGameRuntime.stateHandlers.playing
    const runtime: GameRuntime<NoteGameState, HydratedNoteGameState> = {
        ...noteGameRuntime,
        initializer: {
            initializeGame(game, definition) {
                observe('create', game.config ?? {})
                return initializer.initializeGame(game, definition)
            },
            initializeGameState(game, state) {
                observe('initialize', game.config)
                return initializer.initializeGameState(game, state)
            }
        },
        hydrator: {
            ...noteGameRuntime.hydrator,
            hydrateAction: (action) => new ConfiguredAction(action)
        },
        apiActions: { advance: ConfigAction, automatic: ConfigAction },
        stateHandlers: {
            playing: {
                enter(context) {
                    observe('enter', context.gameConfig)
                    playing.enter(context)
                    if (context.gameState.steps.at(-1) === 'advance:true')
                        context.addSystemAction(ConfigAction, { type: 'automatic' })
                },
                validActionsForPlayer(_playerId, context) {
                    observe('available', context.gameConfig)
                    return context.gameConfig.enabled === true ? ['advance'] : []
                },
                isValidAction(_action, context) {
                    observe('validate', context.gameConfig)
                    return context.gameConfig.enabled === true
                },
                onAction(_action, context) {
                    observe('transition', context.gameConfig)
                    return 'playing'
                }
            }
        },
        exploration: {
            createFromCanonicalState: (state) => state,
            createFromProjectedState(input) {
                observe('exploration', input.game.config)
                return input.state
            }
        },
        visibility: {
            state: {
                schema: Type.Unknown(),
                project(state, _perspective, context) {
                    assertExists(context, 'Game configuration is required')
                    observe('project', context.config)
                    return structuredClone(state)
                },
                guardForExecution(state, _perspective, context) {
                    assertExists(context, 'Game configuration is required')
                    observe('guard', context.config)
                    return state
                }
            },
            actions: {
                project(action, _perspective, context) {
                    assertExists(context, 'Game configuration is required')
                    observe('projectAction', context.config)
                    return action
                }
            }
        }
    }
    const configurator = new Configurator()
    const definition = defineGame({ info: { ...noteGameInfo, configurator }, runtime })
    const configured = definition.runtime
    const engine = new GameEngine(configured)
    const { game: original } = createNoteGame()
    const game: Game = { ...original, config, startedAt: undefined, protectedInformation: true }
    const action: GameAction = {
        id: 'advance-1',
        gameId: game.id,
        type: 'advance',
        source: ActionSource.User,
        playerId: 'p1'
    }
    return { runtime: configured, engine, game, action, configurator, definition, observations }
}

describe('normalized runtime configuration', () => {
    it.each<GameConfig>([{ legacyEnabled: true }, { enabled: true }])(
        'normalizes creation, initialization and initial entry: %j',
        (input) => {
            const { runtime, engine, game, definition, observations } = scenario(input)
            const created = runtime.initializer.initializeGame(game, definition)
            expect(created.config).toEqual({ enabled: true })
            const started = engine.startGame(game)
            expect(started.startedGame.config).toEqual({ enabled: true })
            expect(observations).toEqual(['create', 'initialize', 'enter'])
            expect(game.config).toEqual(input)
        }
    )

    it.each(['canonical', 'projected'] as const)(
        'normalizes %s actions, generated actions and every handler callback',
        (mode) => {
            const { engine, game, action, observations } = scenario()
            const { initialState: state } = engine.startGame(game)
            observations.length = 0
            expect(
                engine.getValidActionTypesForPlayer(game, state, 'p1', {
                    perspective: { kind: 'player', playerId: 'p1' }
                })
            ).toEqual(['advance'])
            const result =
                mode === 'canonical'
                    ? engine.executeCanonicalAction({ game, state, action })
                    : engine.executeAction({
                          game,
                          state,
                          action,
                          perspective: { kind: 'player', playerId: 'p1' }
                      })
            expect(result.updatedState.steps).toEqual(['advance:true', 'automatic:true'])
            expect(result.processedActions).toHaveLength(2)
            expect(observations.filter((point) => point === 'validate')).toHaveLength(2)
            expect(observations.filter((point) => point === 'transition')).toHaveLength(2)
            expect(observations.filter((point) => point === 'enter')).toHaveLength(2)
            expect(observations).toContain('available')
            if (mode === 'projected') expect(observations).toContain('projectAction')
            expect(game.config).toEqual({ legacyEnabled: true })
        }
    )

    it('normalizes unpatched replay and single-action execution without running the generated cascade', () => {
        const { engine, game, action } = scenario()
        const { initialState: state } = engine.startGame(game)
        const single = engine.executeSingleAction({ game, state, action })
        expect(single.updatedState.steps).toEqual(['advance:true'])
        const replayed = engine.applyProcessedAction({
            game,
            state,
            action: single.processedActions[0]
        })
        expect(replayed).toEqual(single.updatedState)
        const history = new ExplorationHistory(engine)
        expect(history.forward(state, single.processedActions[0], game)).toEqual(replayed)
        expect(
            engine.undoProcessedAction({ state: replayed, action: single.processedActions[0] })
        ).toEqual(state)
    })

    it('normalizes exploration population and direct visibility callbacks', () => {
        const { runtime, engine, game, action, observations } = scenario()
        const { initialState: state } = engine.startGame(game)
        const visibility = runtime.visibility
        const populate = runtime.exploration?.createFromProjectedState
        assertExists(visibility)
        assertExists(populate)
        const perspective = { kind: 'spectator' } as const
        const populated = populate({ game, state, actions: [], perspective, random: () => 0.5 })
        const context = { config: game.config }
        visibility.state.project(populated, perspective, context)
        visibility.state.guardForExecution(populated, perspective, context)
        visibility.actions.project(action, perspective, context)
        expect(observations).toEqual([
            'initialize',
            'enter',
            'exploration',
            'project',
            'guard',
            'projectAction'
        ])
        expect(
            engine.executeCanonicalAction({ game, state: populated, action }).updatedState.steps
        ).toEqual(['advance:true', 'automatic:true'])
        expect(() => visibility.state.project(state, perspective)).toThrow(
            'Game configuration is required'
        )
        expect(() => visibility.state.guardForExecution(state, perspective)).toThrow(
            'Game configuration is required'
        )
        expect(() => visibility.actions.project(action, perspective)).toThrow(
            'Game configuration is required'
        )
        expect(game.config).toEqual({ legacyEnabled: true })
    })

    it('installs configuration from info without modifying the raw runtime', () => {
        const configurator = new Configurator()
        const info = { ...noteGameInfo, configurator }
        const definition = defineGame({ info, runtime: noteGameRuntime })
        expect(definition.info).toBe(info)
        expect(definition.runtime.configuration?.normalizeConfig({ legacyEnabled: true })).toEqual({
            enabled: true
        })
        expect(noteGameRuntime.configuration).toBeUndefined()
        expect(definition.runtime.initializer).not.toBe(noteGameRuntime.initializer)
        expect(defineGame({ info: noteGameInfo, runtime: noteGameRuntime }).runtime).toBe(
            noteGameRuntime
        )
    })

    it('leaves older runtimes without a normalizer unchanged, including null values', () => {
        const { game, state } = createNoteGame()
        game.config = { retained: null }
        expect(normalizeGame(game)).toBe(game)
        const configurator: GameConfigurator = {
            schema: Type.Object({}),
            options: [],
            validateConfig() {},
            updateConfig() {}
        }
        const configured = defineGame({
            info: { ...noteGameInfo, configurator },
            runtime: noteGameRuntime
        }).runtime
        expect(configured.initializer).toBe(noteGameRuntime.initializer)
        expect(configured.hydrator).toBe(noteGameRuntime.hydrator)
        expect(normalizeGame(game, configurator)).toBe(game)

        const replay = new GameEngine(noteGameRuntime)
        expect(replay.getValidActionTypesForPlayer(game, state, 'p1')).toEqual(['step', 'note'])
        expect(game.config).toEqual({ retained: null })
    })
})
