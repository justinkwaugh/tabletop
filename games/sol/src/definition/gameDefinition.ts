import type { GameDefinition } from '@tabletop/common'
import type { HydratedSolGameState, SolGameState } from '../model/gameState.js'
import { SolInfo } from './info.js'
import { SolRuntime } from './runtime.js'

export const Definition = <GameDefinition<SolGameState, HydratedSolGameState>>{
    info: SolInfo,
    runtime: SolRuntime
}
