import type { GameDefinition } from '@tabletop/common'
import type { SantiagoGameState, HydratedSantiagoGameState } from '../model/gameState.js'
import { SantiagoInfo } from './info.js'
import { SantiagoRuntime } from './runtime.js'

export const Definition = <GameDefinition<SantiagoGameState, HydratedSantiagoGameState>>{
    info: SantiagoInfo,
    runtime: SantiagoRuntime
}
