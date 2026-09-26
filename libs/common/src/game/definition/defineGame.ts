import type { GameConfigNormalizer } from './gameConfigurator.js'
import type { GameRuntime, GameInfo, GameDefinition } from './gameDefinition.js'
import type { GameExploration } from './gameExploration.js'
import type { GameVisibility } from '../visibility/gameVisibility.js'
import type { ProjectionContext } from '../visibility/valueProjector.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'
import { normalizeGame, normalizeGameConfig } from '../model/gameConfig.js'

const configured = Symbol('configuredGameRuntime')

export interface RuntimeConfiguration extends GameConfigNormalizer {
    readonly [configured]: true
}

export function defineGame<T extends GameState, U extends HydratedGameState<T>>({
    info,
    runtime
}: {
    info: GameInfo
    runtime: Omit<GameRuntime<T, U>, 'configuration'>
}): GameDefinition<T, U> {
    const configurator = info.configurator
    if (configurator?.normalizeConfig === undefined) return { info, runtime }
    const normalize = configurator.normalizeConfig
    const configuration: RuntimeConfiguration = {
        [configured]: true,
        normalizeConfig: (config) => normalize.call(configurator, config)
    }
    return { info, runtime: configureRuntime(runtime, configuration) }
}

function configureRuntime<T extends GameState, U extends HydratedGameState<T>>(
    runtime: GameRuntime<T, U>,
    configuration: RuntimeConfiguration
): GameRuntime<T, U> {
    const initializer = runtime.initializer
    return {
        ...runtime,
        configuration,
        initializer: {
            supportsStartingPositions: initializer.supportsStartingPositions,
            initializeGame: (game, definition) =>
                initializer.initializeGame(normalizeGame(game, configuration), definition),
            initializeGameState: (game, state, assignment) =>
                initializer.initializeGameState(
                    normalizeGame(game, configuration),
                    state,
                    assignment
                )
        },
        exploration: configureExploration(runtime.exploration, configuration),
        visibility: configureVisibility(runtime.visibility, configuration)
    }
}

function configureExploration<T extends GameState>(
    exploration: GameExploration<T> | undefined,
    configurator: GameConfigNormalizer
): GameExploration<T> | undefined {
    if (exploration === undefined) return undefined
    const populate = exploration.createFromProjectedState
    return {
        createFromCanonicalState: (state) => exploration.createFromCanonicalState(state),
        createFromProjectedState:
            populate === undefined
                ? undefined
                : (input) =>
                      populate.call(exploration, {
                          ...input,
                          game: normalizeGame(input.game, configurator)
                      })
    }
}

function configureVisibility<T extends GameState>(
    visibility: GameVisibility<T, T> | undefined,
    configurator: GameConfigNormalizer
): GameVisibility<T, T> | undefined {
    if (visibility === undefined) return undefined
    return {
        state: {
            schema: visibility.state.schema,
            project: (state, perspective, context) =>
                visibility.state.project(
                    state,
                    perspective,
                    normalizeContext(context, configurator)
                ),
            guardForExecution: (state, perspective, context) =>
                visibility.state.guardForExecution(
                    state,
                    perspective,
                    normalizeContext(context, configurator)
                )
        },
        actions: {
            project: (action, perspective, context) =>
                visibility.actions.project(
                    action,
                    perspective,
                    normalizeContext(context, configurator)
                )
        }
    }
}

function normalizeContext(
    context: ProjectionContext | undefined,
    configurator: GameConfigNormalizer
): ProjectionContext | undefined {
    return context === undefined
        ? undefined
        : { ...context, config: normalizeGameConfig(context.config, configurator) }
}
