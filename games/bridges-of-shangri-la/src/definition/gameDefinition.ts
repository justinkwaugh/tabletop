import type { GameDefinition } from '@tabletop/common'
import type { BridgesGameState, HydratedBridgesGameState } from '../model/gameState.js'
import { BridgesInfo } from './info.js'
import { BridgesRuntime } from './runtime.js'

export const Definition = <GameDefinition<BridgesGameState, HydratedBridgesGameState>>{
    info: BridgesInfo,
    runtime: BridgesRuntime
}
