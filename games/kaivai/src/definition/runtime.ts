import type { GameRuntime } from '@tabletop/common'
import { DefaultStateLogger } from '@tabletop/common'
import type { HydratedKaivaiGameState, KaivaiGameState } from '../model/gameState.js'
import { KaivaiHydrator } from './hydrator.js'
import { KaivaiGameInitializer } from './gameInitializer.js'
import { KaivaiApiActions } from './apiActions.js'
import { KaivaiStateHandlers } from './stateHandlers.js'
import { KaivaiColors } from './colors.js'

export const KaivaiRuntime: GameRuntime<KaivaiGameState, HydratedKaivaiGameState> = {
    initializer: new KaivaiGameInitializer(),
    hydrator: new KaivaiHydrator(),
    stateHandlers: KaivaiStateHandlers,
    apiActions: KaivaiApiActions,
    playerColors: KaivaiColors,
    stateLogger: new DefaultStateLogger()
}
