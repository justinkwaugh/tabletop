import { DefaultStateLogger, Visibility, type GameRuntime } from '@tabletop/common'
import {
    PromontoryPointGameState,
    PromontoryPointGameStateValidator,
    type HydratedPromontoryPointGameState,
    type PromontoryPointProjectedState
} from '../model/gameState.js'
import { PromontoryPointApiActions } from './apiActions.js'
import { PromontoryPointColors } from './colors.js'
import { PromontoryPointHydrator } from './hydrator.js'
import { PromontoryPointGameInitializer } from './initializer.js'
import { PromontoryPointProgression } from './progression.js'
import { PromontoryPointScoring } from './scoring.js'
import { PromontoryPointStateHandlers } from './stateHandlers.js'

export const PromontoryPointRuntime = {
    randomnessVersion: 1,
    initializer: new PromontoryPointGameInitializer(),
    canonicalStateValidator: PromontoryPointGameStateValidator,
    hydrator: new PromontoryPointHydrator(),
    stateHandlers: PromontoryPointStateHandlers,
    apiActions: PromontoryPointApiActions,
    playerColors: PromontoryPointColors,
    scoring: new PromontoryPointScoring(),
    progression: new PromontoryPointProgression(),
    stateLogger: new DefaultStateLogger(),
    // R-5: the bag and the concealed hands stay off every client that may not see them.
    visibility: {
        state: Visibility.createProjector(PromontoryPointGameState),
        actions: Visibility.createActionProjector(PromontoryPointApiActions)
    }
} satisfies GameRuntime<PromontoryPointProjectedState, HydratedPromontoryPointGameState>
