import { defineGame } from '@tabletop/common'
import type {
    HydratedMagnaGreciaGameState,
    MagnaGreciaProjectedState
} from '../model/gameState.js'
import { MagnaGreciaInfo } from './info.js'
import { MagnaGreciaRuntime } from './runtime.js'

export const Definition = defineGame<MagnaGreciaProjectedState, HydratedMagnaGreciaGameState>({
    info: MagnaGreciaInfo,
    runtime: MagnaGreciaRuntime
})
