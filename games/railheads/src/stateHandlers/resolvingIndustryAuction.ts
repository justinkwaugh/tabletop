import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import {
    HydratedResolveIndustryAuction,
    isResolveIndustryAuction
} from '../actions/resolveIndustryAuction.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { finishTurn } from './flow.js'

export class ResolvingIndustryAuctionStateHandler implements MachineStateHandler<
    HydratedResolveIndustryAuction,
    HydratedRailheadsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedRailheadsGameState>
    ): action is HydratedResolveIndustryAuction {
        return isResolveIndustryAuction(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedRailheadsGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedRailheadsGameState>) {
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedResolveIndustryAuction,
        context: MachineContext<HydratedRailheadsGameState>
    ): MachineState {
        return finishTurn(context.gameState)
    }
}
