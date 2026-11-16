import { defineGame } from '@tabletop/common'
import type { HydratedMatrxGameState, MatrxGameState } from '../model/gameState.js'
import { MatrxInfo } from './info.js'
import { MatrxRuntime } from './runtime.js'

export const Definition = defineGame<MatrxGameState, HydratedMatrxGameState>({
    info: MatrxInfo,
    runtime: MatrxRuntime
})
