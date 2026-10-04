import { defineGame } from '@tabletop/common'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '../model/gameState.js'
import { StellarHorizonsInfo } from './info.js'
import { StellarHorizonsRuntime } from './runtime.js'

export const Definition = defineGame<
    StellarHorizonsProjectedState,
    HydratedStellarHorizonsGameState
>({
    info: StellarHorizonsInfo,
    runtime: StellarHorizonsRuntime
})
