import { type TSchema } from '@sinclair/typebox'
import { type GameHydrator } from './gameHydrator.js'
import { type GameMetadata } from './gameMetadata.js'
import { GameInitializer } from './gameInitializer.js'
import { MachineStateHandler } from '../engine/machineStateHandler.js'
import { HydratedAction } from '../engine/gameAction.js'
import { GameStateLogger } from './gameStateLogger.js'
import { GameConfigOptions } from './gameConfig.js'
import { PlayerColor } from '../model/playerColors.js'

export interface GameDefinition {
    id: string
    metadata: GameMetadata
    initializer: GameInitializer
    stateHandlers: Record<string, MachineStateHandler<HydratedAction>>
    hydrator: GameHydrator
    apiActions: Record<string, TSchema>
    playerColors: PlayerColor[]
    configOptions: GameConfigOptions
    stateLogger?: GameStateLogger
}
