import type { GameRuntime } from '@tabletop/common'
import { DefaultStateLogger } from '@tabletop/common'
import type { HydratedSolGameState, SolGameState } from '../model/gameState.js'
import { SolHydrator } from './hydrator.js'
import { SolGameInitializer } from './gameInitializer.js'
import { SolApiActions } from './apiActions.js'
import { SolStateHandlers } from './stateHandlers.js'
import { SolColors } from './colors.js'

export const SolRuntime: GameRuntime<SolGameState, HydratedSolGameState> = {
    initializer: new SolGameInitializer(),
    hydrator: new SolHydrator(),
    stateHandlers: SolStateHandlers,
    apiActions: SolApiActions,
    playerColors: SolColors,
    stateLogger: new DefaultStateLogger()
}
