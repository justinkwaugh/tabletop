import { defineGame } from '@tabletop/common'
import type {
    HydratedReefEncounterGameState,
    ReefEncounterProjectedState
} from '../model/gameState.js'
import { ReefEncounterInfo } from './info.js'
import { ReefEncounterRuntime } from './runtime.js'

export const Definition = defineGame<ReefEncounterProjectedState, HydratedReefEncounterGameState>({
    info: ReefEncounterInfo,
    runtime: ReefEncounterRuntime
})
