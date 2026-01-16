import type * as Type from 'typebox'
import type { GameHydrator } from './gameHydrator.js'
import type { GameMetadata } from './gameMetadata.js'
import type { GameInitializer } from './gameInitializer.js'
import type { MachineStateHandler } from '../engine/machineStateHandler.js'
import type { HydratedAction } from '../engine/gameAction.js'
import type { GameStateLogger } from './gameStateLogger.js'
import type { GameConfigurator } from './gameConfigurator.js'
import type { Color } from '../model/colors.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'

export interface GameInfo {
    id: string
    metadata: GameMetadata
    configurator?: GameConfigurator
}

export interface GameRuntime<
    T extends GameState = GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
> {
    initializer: GameInitializer<T, U>
    hydrator: GameHydrator<T, U>
    playerColors: Color[]
    apiActions: Record<string, Type.TSchema>
    stateHandlers: Record<string, MachineStateHandler<HydratedAction, U>>
    stateLogger?: GameStateLogger
}

export interface GameDefinition<
    T extends GameState = GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
> {
    info: GameInfo
    runtime: GameRuntime<T, U>
}
