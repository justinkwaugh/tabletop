import type { HydratedAction } from '@tabletop/common'
import { HydratedDevelopTech, isDevelopTech } from '../actions/developTech.js'
import { ActionType } from '../definition/actions.js'
import { canDevelopAnyTech } from '../model/development.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { PlayStateHandler } from './playing.js'

export class DevelopingStateHandler extends PlayStateHandler<HydratedDevelopTech> {
    protected readonly phase = TurnPhase.Development

    protected isPhaseAction(action: HydratedAction): action is HydratedDevelopTech {
        return isDevelopTech(action)
    }

    protected phaseActions(playerId: string, state: HydratedStellarHorizonsGameState) {
        return canDevelopAnyTech(state, playerId) ? [ActionType.DevelopTech] : []
    }
}
