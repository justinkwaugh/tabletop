import { type TSchema } from 'typebox'
import { type GameHydrator } from './gameHydrator.js'
import { type GameMetadata } from './gameMetadata.js'
import { type GameInitializer } from './gameInitializer.js'
import { type MachineStateHandler } from '../engine/machineStateHandler.js'
import { type HydratedAction } from '../engine/gameAction.js'
import { type GameStateLogger } from './gameStateLogger.js'
import { type GameConfigurator } from './gameConfigurator.js'
import { Color } from '../model/colors.js'

export interface GameDefinition {
    id: string
    metadata: GameMetadata

    initializer: GameInitializer
    configurator?: GameConfigurator
    hydrator: GameHydrator

    stateHandlers: Record<string, MachineStateHandler<HydratedAction>>

    apiActions: Record<string, TSchema>
    playerColors: Color[]

    stateLogger?: GameStateLogger
}
