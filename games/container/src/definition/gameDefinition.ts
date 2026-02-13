import type { GameDefinition } from '@tabletop/common'
import type { ContainerGameState, HydratedContainerGameState } from '../model/gameState.js'
import { ContainerInfo } from './info.js'
import { ContainerRuntime } from './runtime.js'

export const Definition = <GameDefinition<ContainerGameState, HydratedContainerGameState>>{
    info: ContainerInfo,
    runtime: ContainerRuntime
}
