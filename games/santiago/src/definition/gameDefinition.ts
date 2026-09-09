import type { GameDefinition } from '@tabletop/common'
import type { SantiagoProjectedState, HydratedSantiagoGameState } from '../model/gameState.js'
import { SantiagoInfo } from './info.js'
import { SantiagoRuntime } from './runtime.js'

export const Definition = {
    info: SantiagoInfo,
    runtime: SantiagoRuntime
} satisfies GameDefinition<SantiagoProjectedState, HydratedSantiagoGameState>
