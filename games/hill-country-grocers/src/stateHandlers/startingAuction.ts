import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedOpenAuction, isOpenAuction } from '../actions/openAuction.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { afterSale } from './flow.js'

export class StartingAuctionStateHandler implements MachineStateHandler<
    HydratedOpenAuction,
    HydratedHcgGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHcgGameState>
    ): action is HydratedOpenAuction {
        return isOpenAuction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedHcgGameState>
    ): ActionType[] {
        return context.gameState.turnPlayerId() === playerId ? [ActionType.OpenAuction] : []
    }

    enter(context: MachineContext<HydratedHcgGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    onAction(
        action: HydratedOpenAuction,
        context: MachineContext<HydratedHcgGameState>
    ): MachineState {
        const sale = action.metadata?.sale
        return sale ? afterSale(context.gameState, sale) : MachineState.Bidding
    }
}
