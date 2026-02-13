import type { GameRuntime } from '@tabletop/common'
import { DefaultStateLogger } from '@tabletop/common'
import type { ContainerGameState, HydratedContainerGameState } from '../model/gameState.js'
import { ContainerHydrator } from './hydrator.js'
import { ContainerGameInitializer } from './initializer.js'
import { ContainerApiActions } from './apiActions.js'
import { ContainerStateHandlers } from './stateHandlers.js'
import { ContainerPlayerColors } from './colors.js'

export const ContainerRuntime: GameRuntime<ContainerGameState, HydratedContainerGameState> = {
    initializer: new ContainerGameInitializer(),
    hydrator: new ContainerHydrator(),
    stateHandlers: ContainerStateHandlers,
    apiActions: ContainerApiActions,
    playerColors: ContainerPlayerColors,
    stateLogger: new DefaultStateLogger()
}
