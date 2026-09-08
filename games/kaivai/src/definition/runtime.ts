import type { GameRuntime } from '@tabletop/common'
import { DefaultStateLogger, Visibility } from '@tabletop/common'
import {
    KaivaiGameStateValidator,
    type HydratedKaivaiGameState,
    KaivaiGameState,
    type KaivaiProjectedState
} from '../model/gameState.js'
import { KaivaiHydrator } from './hydrator.js'
import { KaivaiGameInitializer } from './gameInitializer.js'
import { KaivaiApiActions } from './apiActions.js'
import { KaivaiStateHandlers } from './stateHandlers.js'
import { KaivaiColors } from './colors.js'

import { KaivaiActionSchemas } from './actionSchemas.js'
import { KaivaiGameExploration } from './gameExploration.js'

export const KaivaiRuntime = {
    randomnessVersion: 1,
    exploration: new KaivaiGameExploration(),
    initializer: new KaivaiGameInitializer(),
    canonicalStateValidator: KaivaiGameStateValidator,
    hydrator: new KaivaiHydrator(),
    stateHandlers: KaivaiStateHandlers,
    apiActions: KaivaiApiActions,
    playerColors: KaivaiColors,
    stateLogger: new DefaultStateLogger(),
    visibility: {
        state: Visibility.createProjector(KaivaiGameState),
        actions: Visibility.createActionProjector(KaivaiActionSchemas)
    }
} satisfies GameRuntime<KaivaiProjectedState, HydratedKaivaiGameState>
