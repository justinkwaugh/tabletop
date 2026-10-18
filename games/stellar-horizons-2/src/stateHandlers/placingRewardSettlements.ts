import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import {
    HydratedPlaceRewardSettlements,
    isPlaceRewardSettlements
} from '../actions/placeRewardSettlements.js'
import { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterAnomaly } from './transitions.js'

export class PlacingRewardSettlementsStateHandler implements MachineStateHandler<
    HydratedPlaceRewardSettlements,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedPlaceRewardSettlements {
        return isPlaceRewardSettlements(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.PlaceRewardSettlements] : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const reward = context.gameState.settlementReward
        assertExists(reward, 'Placing reward settlements requires a reward')
        context.gameState.activePlayerIds = [reward.playerId]
    }

    onAction(
        _action: HydratedPlaceRewardSettlements,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterAnomaly(context.gameState)
    }
}
