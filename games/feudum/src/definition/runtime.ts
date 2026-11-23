import { DefaultStateLogger, type GameRuntime, Visibility } from '@tabletop/common'
import {
    FeudumGameState,
    FeudumGameStateValidator,
    type FeudumProjectedState,
    type HydratedFeudumGameState
} from '../model/gameState.js'
import { FeudumApiActions } from './apiActions.js'
import { FeudumColors } from './colors.js'
import { FeudumGameExploration } from './gameExploration.js'
import { FeudumHydrator } from './hydrator.js'
import { FeudumGameInitializer } from './initializer.js'
import { FeudumProgression } from './progression.js'
import { FeudumScoring } from './scoring.js'
import { FeudumStateHandlers } from './stateHandlers.js'

export const FeudumRuntime = {
    randomnessVersion: 1,
    initializer: new FeudumGameInitializer(),
    canonicalStateValidator: FeudumGameStateValidator,
    hydrator: new FeudumHydrator(),
    stateHandlers: FeudumStateHandlers,
    apiActions: FeudumApiActions,
    playerColors: FeudumColors,
    scoring: new FeudumScoring(),
    progression: new FeudumProgression(),
    stateLogger: new DefaultStateLogger(),
    exploration: new FeudumGameExploration(),
    visibility: {
        state: Visibility.createProjector(FeudumGameState),
        actions: Visibility.createActionProjector(FeudumApiActions)
    }
} satisfies GameRuntime<FeudumProjectedState, HydratedFeudumGameState>
