import type { GameDefinition } from '@tabletop/common'
import type { MarracashGameState, HydratedMarracashGameState } from '../model/gameState.js'
import { MarracashInfo } from './info.js'
import { MarracashRuntime } from './runtime.js'

export const Definition = {
    info: MarracashInfo,
    runtime: MarracashRuntime
} satisfies GameDefinition<MarracashGameState, HydratedMarracashGameState>
