import { defineGame } from '@tabletop/common'
import type { HydratedOstbahnGameState, OstbahnGameState } from '../model/gameState.js'
import { OstbahnInfo } from './info.js'
import { OstbahnRuntime } from './runtime.js'

export const Definition = defineGame<OstbahnGameState, HydratedOstbahnGameState>({
    info: OstbahnInfo,
    runtime: OstbahnRuntime
})
