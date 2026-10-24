import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { HydratedPlaceRewardGoods, isPlaceRewardGoods } from '../actions/placeRewardGoods.js'
import { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { DemandResume } from '../model/pieces.js'
import { stateAfterDemandDraws } from './transitions.js'

export class PlacingRewardGoodsStateHandler implements MachineStateHandler<
    HydratedPlaceRewardGoods,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedPlaceRewardGoods {
        return isPlaceRewardGoods(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.PlaceRewardGoods] : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const reward = context.gameState.goodsRewards.at(0)
        assertExists(reward, 'Placing reward goods requires a reward')
        context.gameState.activePlayerIds = [reward.playerId]
    }

    onAction(
        _action: HydratedPlaceRewardGoods,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterDemandDraws(context.gameState, DemandResume.Anomaly)
    }
}
