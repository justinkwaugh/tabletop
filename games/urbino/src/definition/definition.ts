import type { GameDefinition } from '@tabletop/common'
import type { UrbinoGameState, HydratedUrbinoGameState } from '../model/gameState.js'
import { UrbinoInfo } from './info.js'
import { UrbinoRuntime } from './runtime.js'

export const Definition = <GameDefinition<UrbinoGameState, HydratedUrbinoGameState>>{
    info: UrbinoInfo,
    runtime: UrbinoRuntime,
}
