import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedBid, isBid } from '../actions/bid.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedSayMeinSpiel, isSayMeinSpiel } from '../actions/sayMeinSpiel.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'
import { afterContract } from './transitions.js'

type BiddingAction = HydratedSayMeinSpiel | HydratedBid | HydratedPass

export class BiddingStateHandler implements MachineStateHandler<
    BiddingAction,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is BiddingAction {
        return isSayMeinSpiel(action) || isBid(action) || isPass(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): ActionType[] {
        const state = context.gameState
        const actions: ActionType[] = []
        if (state.canSayMeinSpiel(playerId)) {
            actions.push(ActionType.SayMeinSpiel)
        }
        if (state.biddableChoices(playerId).length > 0) {
            actions.push(ActionType.Bid)
        }
        if (state.canPass(playerId)) {
            actions.push(ActionType.Pass)
        }
        return actions
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        const state = context.gameState
        state.beginTurn(state.nextBidder())
    }

    onAction(
        _action: BiddingAction,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): MachineState {
        const state = context.gameState
        state.finishTurn()
        if (!state.isAuctionOver()) {
            return MachineState.Bidding
        }
        return state.closeAuction() === undefined
            ? MachineState.ChoosingContract
            : afterContract(state)
    }
}
