import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import {
    PowerGridGameState,
    PowerGridGameStateValidator,
    type HydratedPowerGridGameState,
    type PowerGridProjectedState
} from '../model/gameState.js'
import { PowerGridApiActions } from './apiActions.js'
import { PowerGridColors } from './colors.js'
import { PowerGridGameExploration } from './exploration.js'
import { PowerGridHydrator } from './hydrator.js'
import { PowerGridGameInitializer } from './initializer.js'
import { PowerGridScoring } from './scoring.js'
import { PowerGridStateHandlers } from './stateHandlers.js'

export const PowerGridRuntime = {
    randomnessVersion: 1,
    initializer: new PowerGridGameInitializer(),
    exploration: new PowerGridGameExploration(),
    canonicalStateValidator: PowerGridGameStateValidator,
    hydrator: new PowerGridHydrator(),
    stateHandlers: PowerGridStateHandlers,
    apiActions: PowerGridApiActions,
    playerColors: PowerGridColors,
    scoring: new PowerGridScoring(),
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(PowerGridGameState),
        actions: Visibility.createActionProjector(PowerGridApiActions)
    }
} satisfies GameRuntime<PowerGridProjectedState, HydratedPowerGridGameState>
