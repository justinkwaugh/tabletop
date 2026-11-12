import { defineGame } from '@tabletop/common'
import type { HydratedMedinaGameState, MedinaProjectedState } from '../model/gameState.js'
import { MedinaInfo } from './info.js'
import { MedinaRuntime } from './runtime.js'

export const Definition = defineGame<MedinaProjectedState, HydratedMedinaGameState>({
    info: MedinaInfo,
    runtime: MedinaRuntime
})
