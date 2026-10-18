import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import {
    RailheadsGameState,
    RailheadsGameStateValidator,
    type HydratedRailheadsGameState,
    type RailheadsProjectedState
} from '../model/gameState.js'
import { RailheadsActionSchemas } from './actionSchemas.js'
import { RailheadsApiActions } from './apiActions.js'
import { RailheadsColors } from './colors.js'
import { RailheadsGameExploration } from './exploration.js'
import { RailheadsHydrator } from './hydrator.js'
import { RailheadsGameInitializer } from './initializer.js'
import { RailheadsScoring } from './scoring.js'
import { RailheadsStateHandlers } from './stateHandlers.js'

export const RailheadsRuntime = {
    randomnessVersion: 1,
    exploration: new RailheadsGameExploration(),
    initializer: new RailheadsGameInitializer(),
    canonicalStateValidator: RailheadsGameStateValidator,
    hydrator: new RailheadsHydrator(),
    stateHandlers: RailheadsStateHandlers,
    apiActions: RailheadsApiActions,
    playerColors: RailheadsColors,
    scoring: new RailheadsScoring(),
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(RailheadsGameState),
        actions: Visibility.createActionProjector(RailheadsActionSchemas)
    }
} satisfies GameRuntime<RailheadsProjectedState, HydratedRailheadsGameState>
