import type { HydratedAction } from '@tabletop/common'
import { HydratedMoveShip, isMoveShip } from '../actions/moveShip.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { canMoveAnyShip } from '../model/movement.js'
import { TurnPhase } from '../model/turn.js'
import { PlayStateHandler } from './playing.js'

export class MovingStateHandler extends PlayStateHandler<HydratedMoveShip> {
    protected readonly phase = TurnPhase.Movement

    protected isPhaseAction(action: HydratedAction): action is HydratedMoveShip {
        return isMoveShip(action)
    }

    protected phaseActions(playerId: string, state: HydratedStellarHorizonsGameState) {
        return canMoveAnyShip(state, playerId) ? [ActionType.MoveShip] : []
    }
}
