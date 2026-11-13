import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedDeclineOffer, isDeclineOffer } from '../actions/declineOffer.js'
import { HydratedOfferShare, isOfferShare } from '../actions/offerShare.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { afterSale, finishTurnAction } from './flow.js'

type OfferingAction = HydratedOfferShare | HydratedDeclineOffer

export class OfferingStockStateHandler implements MachineStateHandler<
    OfferingAction,
    HydratedSarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): action is OfferingAction {
        return isOfferShare(action) || isDeclineOffer(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSarGameState>
    ): ActionType[] {
        const state = context.gameState
        if (state.turnPlayerId() !== playerId) {
            return []
        }
        const available: [ActionType, boolean][] = [
            [ActionType.OfferShare, HydratedOfferShare.canOffer(state, playerId)],
            [ActionType.DeclineOffer, HydratedDeclineOffer.canDecline(state)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedSarGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    onAction(action: OfferingAction, context: MachineContext<HydratedSarGameState>): MachineState {
        const state = context.gameState
        if (isDeclineOffer(action)) {
            return finishTurnAction(state)
        }
        const sale = action.metadata?.sale
        return sale ? afterSale(state, sale) : MachineState.Bidding
    }
}
