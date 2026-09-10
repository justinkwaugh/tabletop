import type { GameDefinition } from '@tabletop/common'
import type { HydratedKaivaiGameState, KaivaiProjectedState } from '../model/gameState.js'
import { KaivaiInfo } from './info.js'
import { KaivaiRuntime } from './runtime.js'

export const Definition: GameDefinition<KaivaiProjectedState, HydratedKaivaiGameState> = {
    info: KaivaiInfo,
    runtime: KaivaiRuntime
}
