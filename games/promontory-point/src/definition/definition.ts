import { defineGame } from '@tabletop/common'
import type {
    PromontoryPointGameState,
    HydratedPromontoryPointGameState
} from '../model/gameState.js'
import { PromontoryPointInfo } from './info.js'
import { PromontoryPointRuntime } from './runtime.js'

export const Definition = defineGame<PromontoryPointGameState, HydratedPromontoryPointGameState>({
    info: PromontoryPointInfo,
    runtime: PromontoryPointRuntime
})
