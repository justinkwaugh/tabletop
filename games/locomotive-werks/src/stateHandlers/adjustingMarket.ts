import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import { AdjustMarket, HydratedAdjustMarket, isAdjustMarket } from '../actions/adjustMarket.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { afterMarket } from './flow.js'
import { readLwSetup } from '../definition/setup.js'

export class AdjustingMarketStateHandler implements MachineStateHandler<
    HydratedAdjustMarket,
    HydratedLwGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLwGameState>
    ): action is HydratedAdjustMarket {
        return isAdjustMarket(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedLwGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedLwGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(AdjustMarket, {})
    }

    onAction(
        _action: HydratedAdjustMarket,
        context: MachineContext<HydratedLwGameState>
    ): MachineState {
        return afterMarket(context.gameState, readLwSetup(context.gameConfig).buyAndShip)
    }
}
