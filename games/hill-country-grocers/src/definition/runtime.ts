import { DefaultStateLogger, type GameRuntime } from '@tabletop/common'
import {
    HcgGameStateValidator,
    type HcgGameState,
    type HydratedHcgGameState
} from '../model/gameState.js'
import { HcgApiActions } from './apiActions.js'
import { HcgColors } from './colors.js'
import { HcgHydrator } from './hydrator.js'
import { HcgGameInitializer } from './initializer.js'
import { HcgScoring } from './scoring.js'
import { HcgStateHandlers } from './stateHandlers.js'

export const HcgRuntime = {
    randomnessVersion: 1,
    initializer: new HcgGameInitializer(),
    canonicalStateValidator: HcgGameStateValidator,
    hydrator: new HcgHydrator(),
    stateHandlers: HcgStateHandlers,
    apiActions: HcgApiActions,
    playerColors: HcgColors,
    scoring: new HcgScoring(),
    stateLogger: new DefaultStateLogger()
} satisfies GameRuntime<HcgGameState, HydratedHcgGameState>
