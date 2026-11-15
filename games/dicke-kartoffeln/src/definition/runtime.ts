import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import {
    DickeKartoffelnGameState,
    DickeKartoffelnGameStateValidator,
    type DickeKartoffelnProjectedState,
    type HydratedDickeKartoffelnGameState
} from '../model/gameState.js'
import { DickeKartoffelnActionSchemas } from './actionSchemas.js'
import { DickeKartoffelnApiActions } from './apiActions.js'
import { DickeKartoffelnColors } from './colors.js'
import { DickeKartoffelnGameExploration } from './exploration.js'
import { DickeKartoffelnHydrator } from './hydrator.js'
import { DickeKartoffelnGameInitializer } from './initializer.js'
import { DickeKartoffelnScoring } from './scoring.js'
import { DickeKartoffelnStateHandlers } from './stateHandlers.js'

export const DickeKartoffelnRuntime = {
    randomnessVersion: 1,
    exploration: new DickeKartoffelnGameExploration(),
    initializer: new DickeKartoffelnGameInitializer(),
    canonicalStateValidator: DickeKartoffelnGameStateValidator,
    hydrator: new DickeKartoffelnHydrator(),
    stateHandlers: DickeKartoffelnStateHandlers,
    apiActions: DickeKartoffelnApiActions,
    playerColors: DickeKartoffelnColors,
    scoring: new DickeKartoffelnScoring(),
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(DickeKartoffelnGameState),
        actions: Visibility.createActionProjector(DickeKartoffelnActionSchemas)
    }
} satisfies GameRuntime<DickeKartoffelnProjectedState, HydratedDickeKartoffelnGameState>
