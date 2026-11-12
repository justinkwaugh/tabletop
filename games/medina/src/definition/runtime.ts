import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import {
    MedinaGameState,
    MedinaGameStateValidator,
    type HydratedMedinaGameState,
    type MedinaProjectedState
} from '../model/gameState.js'
import { MedinaApiActions } from './apiActions.js'
import { MedinaColors } from './colors.js'
import { MedinaGameExploration } from './exploration.js'
import { MedinaHydrator } from './hydrator.js'
import { MedinaGameInitializer } from './initializer.js'
import { MedinaProgression } from './progression.js'
import { MedinaScoring } from './scoring.js'
import { MedinaStateHandlers } from './stateHandlers.js'

export const MedinaRuntime = {
    randomnessVersion: 1,
    initializer: new MedinaGameInitializer(),
    exploration: new MedinaGameExploration(),
    canonicalStateValidator: MedinaGameStateValidator,
    hydrator: new MedinaHydrator(),
    stateHandlers: MedinaStateHandlers,
    apiActions: MedinaApiActions,
    playerColors: MedinaColors,
    scoring: new MedinaScoring(),
    progression: new MedinaProgression(),
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(MedinaGameState),
        actions: Visibility.createActionProjector(MedinaApiActions)
    }
} satisfies GameRuntime<MedinaProjectedState, HydratedMedinaGameState>
