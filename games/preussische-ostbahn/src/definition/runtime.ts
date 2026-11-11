import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import {
    OstbahnGameState,
    OstbahnGameStateValidator,
    type HydratedOstbahnGameState
} from '../model/gameState.js'
import { OstbahnActionSchemas } from './actionSchemas.js'
import { OstbahnApiActions } from './apiActions.js'
import { OstbahnColors } from './colors.js'
import { OstbahnGameExploration } from './exploration.js'
import { OstbahnHydrator } from './hydrator.js'
import { OstbahnGameInitializer } from './initializer.js'
import { OstbahnProgression } from './progression.js'
import { OstbahnScoring } from './scoring.js'
import { OstbahnStateHandlers } from './stateHandlers.js'

export const OstbahnRuntime = {
    randomnessVersion: 1,
    exploration: new OstbahnGameExploration(),
    initializer: new OstbahnGameInitializer(),
    canonicalStateValidator: OstbahnGameStateValidator,
    hydrator: new OstbahnHydrator(),
    stateHandlers: OstbahnStateHandlers,
    apiActions: OstbahnApiActions,
    playerColors: OstbahnColors,
    scoring: new OstbahnScoring(),
    progression: new OstbahnProgression(),
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(OstbahnGameState),
        actions: Visibility.createActionProjector(OstbahnActionSchemas)
    }
} satisfies GameRuntime<OstbahnGameState, HydratedOstbahnGameState>
