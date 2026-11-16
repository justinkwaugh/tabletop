import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    SarGameStateValidator,
    type HydratedSarGameState,
    type SarGameState
} from '../model/gameState.js'
import { SarApiActions } from './apiActions.js'
import { SarColors } from './colors.js'
import { SarHydrator } from './hydrator.js'
import { SarGameInitializer } from './initializer.js'
import { SarScoring } from './scoring.js'
import { SarStateHandlers } from './stateHandlers.js'

export const SarRuntime = {
    randomnessVersion: 1,
    initializer: new SarGameInitializer(),
    canonicalStateValidator: SarGameStateValidator,
    hydrator: new SarHydrator(),
    stateHandlers: SarStateHandlers,
    apiActions: SarApiActions,
    playerColors: SarColors,
    scoring: new SarScoring(),
    stateLogger: new DefaultStateLogger()
} satisfies GameRuntime<SarGameState, HydratedSarGameState>
