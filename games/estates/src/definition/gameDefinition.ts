import type { GameDefinition } from '@tabletop/common'
import type { EstatesProjectedState, HydratedEstatesGameState } from '../model/gameState.js'
import { EstatesInfo } from './info.js'
import { EstatesRuntime } from './runtime.js'

export const Definition = {
    info: EstatesInfo,
    runtime: EstatesRuntime
} satisfies GameDefinition<EstatesProjectedState, HydratedEstatesGameState>
