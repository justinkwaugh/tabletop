import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { afterSale } from './flow.js'

type BiddingAction = HydratedPlaceBid | HydratedPassBid

export class BiddingStateHandler implements MachineStateHandler<
    BiddingAction,
    HydratedHcgGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHcgGameState>
    ): action is BiddingAction {
        return isPlaceBid(action) || isPassBid(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedHcgGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.PlaceBid, HydratedPlaceBid.canBid(state, playerId)],
            [ActionType.PassBid, HydratedPassBid.canPass(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedHcgGameState>) {
        const bidderId = context.gameState.bidding().currentBidderId
        context.gameState.activePlayerIds = bidderId === undefined ? [] : [bidderId]
    }

    onAction(action: BiddingAction, context: MachineContext<HydratedHcgGameState>): MachineState {
        const sale = action.metadata?.sale
        return sale ? afterSale(context.gameState, sale) : MachineState.Bidding
    }
}
