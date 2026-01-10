import { type TSchema } from 'typebox'
import { type GameHydrator } from './gameHydrator.js'
import { type GameMetadata } from './gameMetadata.js'
import { type GameInitializer } from './gameInitializer.js'
import { type MachineStateHandler } from '../engine/machineStateHandler.js'
import { type HydratedAction } from '../engine/gameAction.js'
import { type GameStateLogger } from './gameStateLogger.js'
import { type GameConfigurator } from './gameConfigurator.js'
import { Color } from '../model/colors.js'
import { GameState, type HydratedGameState } from '../model/gameState.js'

export interface GameDefinition<
    T extends GameState = GameState,
    U extends HydratedGameState = HydratedGameState
> {
    id: string
    metadata: GameMetadata

    initializer: GameInitializer<T, U>
    configurator?: GameConfigurator
    hydrator: GameHydrator<T, U>

    stateHandlers: Record<string, MachineStateHandler<HydratedAction>>

    apiActions: Record<string, TSchema>
    playerColors: Color[]

    stateLogger?: GameStateLogger
}
