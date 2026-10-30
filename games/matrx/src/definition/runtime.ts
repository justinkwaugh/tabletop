import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    MatrxGameStateValidator,
    type HydratedMatrxGameState,
    type MatrxGameState
} from '../model/gameState.js'
import { MatrxHydrator } from './hydrator.js'
import { MatrxGameInitializer } from './initializer.js'
import { MatrxApiActions } from './apiActions.js'
import { MatrxStateHandlers } from './stateHandlers.js'
import { MatrxColors } from './colors.js'
import { MatrxScoring } from './scoring.js'

export const MatrxRuntime: GameRuntime<MatrxGameState, HydratedMatrxGameState> = {
    initializer: new MatrxGameInitializer(),
    canonicalStateValidator: MatrxGameStateValidator,
    hydrator: new MatrxHydrator(),
    stateHandlers: MatrxStateHandlers,
    apiActions: MatrxApiActions,
    playerColors: MatrxColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new MatrxScoring()
}
