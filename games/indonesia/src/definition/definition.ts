import type { GameDefinition } from '@tabletop/common'
import type { IndonesiaGameState, HydratedIndonesiaGameState } from '../model/gameState.js'
import { IndonesiaInfo } from './info.js'
import { IndonesiaRuntime } from './runtime.js'

export const Definition = <GameDefinition<IndonesiaGameState, HydratedIndonesiaGameState>>{
    info: IndonesiaInfo,
    runtime: IndonesiaRuntime
}
