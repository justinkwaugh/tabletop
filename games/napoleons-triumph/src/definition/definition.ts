import { defineGame } from '@tabletop/common'
import type {
    HydratedNapoleonsTriumphGameState,
    NapoleonsTriumphProjectedState
} from '../model/gameState.js'
import { NapoleonsTriumphInfo } from './info.js'
import { NapoleonsTriumphRuntime } from './runtime.js'

export const Definition = defineGame<
    NapoleonsTriumphProjectedState,
    HydratedNapoleonsTriumphGameState
>({
    info: NapoleonsTriumphInfo,
    runtime: NapoleonsTriumphRuntime
})
