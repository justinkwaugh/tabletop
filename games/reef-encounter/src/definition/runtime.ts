import { DefaultStateLogger, type GameRuntime, Visibility } from '@tabletop/common'
import {
    ReefEncounterGameState,
    ReefEncounterGameStateValidator,
    type HydratedReefEncounterGameState,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import { ReefEncounterHydrator } from './hydrator.js'
import { ReefEncounterGameInitializer } from './initializer.js'
import { ReefEncounterApiActions } from './apiActions.js'
import { ReefEncounterActionSchemas } from './actionSchemas.js'
import { ReefEncounterStateHandlers } from './stateHandlers.js'
import { ReefEncounterColors } from './colors.js'
import { ReefEncounterScoring } from './scoring.js'
import { ReefEncounterGameExploration } from './gameExploration.js'

export const ReefEncounterRuntime = {
    randomnessVersion: 1,
    initializer: new ReefEncounterGameInitializer(),
    exploration: new ReefEncounterGameExploration(),
    canonicalStateValidator: ReefEncounterGameStateValidator,
    hydrator: new ReefEncounterHydrator(),
    stateHandlers: ReefEncounterStateHandlers,
    apiActions: ReefEncounterApiActions,
    playerColors: ReefEncounterColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new ReefEncounterScoring(),
    visibility: {
        state: Visibility.createProjector(ReefEncounterGameState),
        actions: Visibility.createActionProjector(ReefEncounterActionSchemas)
    }
} satisfies GameRuntime<ReefEncounterProjectedState, HydratedReefEncounterGameState>
