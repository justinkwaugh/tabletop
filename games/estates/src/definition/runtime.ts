import type { GameRuntime } from '@tabletop/common'
import { DefaultStateLogger } from '@tabletop/common'
import type { EstatesGameState, HydratedEstatesGameState } from '../model/gameState.js'
import { EstatesHydrator } from './hydrator.js'
import { EstatesGameInitializer } from './gameInitializer.js'
import { EstatesApiActions } from './apiActions.js'
import { EstatesStateHandlers } from './stateHandlers.js'

export const EstatesRuntime: GameRuntime<EstatesGameState, HydratedEstatesGameState> = {
    initializer: new EstatesGameInitializer(),
    hydrator: new EstatesHydrator(),
    stateHandlers: EstatesStateHandlers,
    apiActions: EstatesApiActions,
    playerColors: [],
    stateLogger: new DefaultStateLogger()
}
