import type { GameDefinition } from '@tabletop/common'
import type { OathProjectedState, HydratedOathGameState } from '../model/gameState.js'
import { OathInfo } from './info.js'
import { OathRuntime } from './runtime.js'

export const Definition: GameDefinition<OathProjectedState, HydratedOathGameState> = {
    info: OathInfo,
    runtime: OathRuntime
}
