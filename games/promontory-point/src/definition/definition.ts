import { defineGame } from '@tabletop/common'
import type {
    PromontoryPointProjectedState,
    HydratedPromontoryPointGameState
} from '../model/gameState.js'
import { PromontoryPointInfo } from './info.js'
import { PromontoryPointRuntime } from './runtime.js'

export const Definition = defineGame<
    PromontoryPointProjectedState,
    HydratedPromontoryPointGameState
>({
    info: PromontoryPointInfo,
    runtime: PromontoryPointRuntime
})
