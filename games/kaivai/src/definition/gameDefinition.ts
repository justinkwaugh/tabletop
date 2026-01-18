import type { GameDefinition } from '@tabletop/common'
import type { HydratedKaivaiGameState, KaivaiGameState } from '../model/gameState.js'
import { KaivaiInfo } from './info.js'
import { KaivaiRuntime } from './runtime.js'

export const Definition = <GameDefinition<KaivaiGameState, HydratedKaivaiGameState>>{
    info: KaivaiInfo,
    runtime: KaivaiRuntime
}
