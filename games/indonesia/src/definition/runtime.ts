import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    IndonesiaGameStateValidator,
    type HydratedIndonesiaGameState,
    type IndonesiaGameState
} from '../model/gameState.js'
import { IndonesiaHydrator } from './hydrator.js'
import { IndonesiaGameInitializer } from './initializer.js'
import { IndonesiaApiActions } from './apiActions.js'
import { IndonesiaStateHandlers } from './stateHandlers.js'
import { IndonesiaColors } from './colors.js'

export const IndonesiaRuntime: GameRuntime<IndonesiaGameState, HydratedIndonesiaGameState> = {
    initializer: new IndonesiaGameInitializer(),
    canonicalStateValidator: IndonesiaGameStateValidator,
    hydrator: new IndonesiaHydrator(),
    stateHandlers: IndonesiaStateHandlers,
    apiActions: IndonesiaApiActions,
    playerColors: IndonesiaColors,
    stateLogger: new DefaultStateLogger() // This never really got used, but it could do some custom logging if desired
}
