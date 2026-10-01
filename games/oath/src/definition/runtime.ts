import { DefaultStateLogger, Visibility, defineGame, type GameRuntime } from '@tabletop/common'
import {
    OathGameState,
    OathGameStateValidator,
    type HydratedOathGameState,
    type OathProjectedState
} from '../model/gameState.js'
import { OathHydrator } from './hydrator.js'
import { OathGameInitializer } from './initializer.js'
import { OathApiActions } from './apiActions.js'
import { OathStateHandlers } from './stateHandlers.js'
import { OathColors } from './colors.js'
import { OathVisibilityPolicies } from '../model/question.js'
import { OathGameExploration } from './gameExploration.js'
import { OathScoring } from './scoring.js'
import { OathInfo } from './info.js'
// Registers every built card power wherever the runtime loads.
import '../powers/index.js'

export const OathVisibility = {
    state: Visibility.createProjector(OathGameState, { policies: OathVisibilityPolicies }),
    actions: Visibility.createActionProjector(OathApiActions, {
        policies: OathVisibilityPolicies
    })
}

const runtime = {
    randomnessVersion: 1,
    initializer: new OathGameInitializer(),
    exploration: new OathGameExploration(),
    canonicalStateValidator: OathGameStateValidator,
    hydrator: new OathHydrator(),
    stateHandlers: OathStateHandlers,
    apiActions: OathApiActions,
    playerColors: OathColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new OathScoring(),
    visibility: OathVisibility
} satisfies Omit<GameRuntime<OathProjectedState, HydratedOathGameState>, 'configuration'>

// `defineGame` installs the configurator's `normalizeConfig` where the engine and clients read it.
export const Definition = defineGame<OathProjectedState, HydratedOathGameState>({
    info: OathInfo,
    runtime
})

export const OathRuntime = Definition.runtime
