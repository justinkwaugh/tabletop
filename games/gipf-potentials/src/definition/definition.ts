import { defineGame } from '@tabletop/common'
import type {
    HydratedGipfPotentialsGameState,
    GipfPotentialsGameState
} from '../model/gameState.js'
import { GipfPotentialsInfo } from './info.js'
import { GipfPotentialsRuntime } from './runtime.js'

export const Definition = defineGame<GipfPotentialsGameState, HydratedGipfPotentialsGameState>({
    info: GipfPotentialsInfo,
    runtime: GipfPotentialsRuntime
})
