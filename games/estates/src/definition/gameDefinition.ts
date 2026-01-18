import type { GameDefinition } from '@tabletop/common'
import type { EstatesGameState, HydratedEstatesGameState } from '../model/gameState.js'
import { EstatesInfo } from './info.js'
import { EstatesRuntime } from './runtime.js'

export const Definition = <GameDefinition<EstatesGameState, HydratedEstatesGameState>>{
    info: EstatesInfo,
    runtime: EstatesRuntime
}
