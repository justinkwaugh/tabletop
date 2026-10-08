import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedPassBid, PassBid, isPassBid } from '../actions/passBid.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

type BiddingAction = HydratedPlaceBid | HydratedPassBid

export class BiddingStateHandler implements MachineStateHandler<
    BiddingAction,
    HydratedKoggeGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedKoggeGameState>
    ): action is BiddingAction {
        return (
            (isPlaceBid(action) || isPassBid(action)) &&
            action.playerId === context.gameState.nextBidderId()
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoggeGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.PlaceBid, HydratedPlaceBid.canPlaceBid(state, playerId)],
            [ActionType.PassBid, HydratedPassBid.canPassBid(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedKoggeGameState>) {
        const state = context.gameState
        const bidderId = state.nextBidderId()
        assertExists(bidderId, 'Every player has already bid')
        state.activePlayerIds = [bidderId]
        if (state.getPlayerState(bidderId).markerCount === 0) {
            context.addSystemAction(PassBid, { playerId: bidderId })
        }
    }

    onAction(
        _action: BiddingAction,
        context: MachineContext<HydratedKoggeGameState>
    ): MachineState {
        const state = context.gameState
        return state.nextBidderId() === undefined
            ? MachineState.ResolvingAuction
            : MachineState.Bidding
    }
}
