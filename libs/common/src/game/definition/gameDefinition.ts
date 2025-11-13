import { type TSchema } from '@sinclair/typebox'
import { type GameHydrator } from './gameHydrator.js'
import { type GameMetadata } from './gameMetadata.js'
import { type GameInitializer } from './gameInitializer.js'
import { type MachineStateHandler } from '../engine/machineStateHandler.js'
import { type HydratedAction } from '../engine/gameAction.js'
import { type GameStateLogger } from './gameStateLogger.js'
import { type ConfigHandler, GameConfigOptions } from './gameConfig.js'
import { Color } from '../model/colors.js'

export interface GameDefinition {
    id: string
    metadata: GameMetadata
    initializer: GameInitializer
    stateHandlers: Record<string, MachineStateHandler<HydratedAction>>
    hydrator: GameHydrator
    apiActions: Record<string, TSchema>
    playerColors: Color[]
    configOptions: GameConfigOptions
    configHandler?: ConfigHandler
    stateLogger?: GameStateLogger
}
