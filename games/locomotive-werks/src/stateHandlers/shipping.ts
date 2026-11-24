import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import { HydratedShip, Ship, isShip } from '../actions/ship.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { afterShipping } from './flow.js'
import { readLwSetup } from '../definition/setup.js'

export class ShippingStateHandler implements MachineStateHandler<
    HydratedShip,
    HydratedLwGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedLwGameState>
    ): action is HydratedShip {
        return isShip(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLwGameState>
    ): ActionType[] {
        return context.gameState.turnPlayerId() === playerId ? [ActionType.Ship] : []
    }

    // A player who chose to ship automatically ships everything they can without being asked.
    enter(context: MachineContext<HydratedLwGameState>) {
        const state = context.gameState
        const playerId = state.turnPlayerId()
        state.activePlayerIds = [playerId]
        if (state.getPlayerState(playerId).autoShip) {
            context.addSystemAction(Ship, {
                playerId,
                locomotiveIds: state.shipments(playerId).map((shipment) => shipment.locomotiveId)
            })
        }
    }

    onAction(action: HydratedShip, context: MachineContext<HydratedLwGameState>): MachineState {
        return afterShipping(
            context.gameState,
            action.playerId,
            readLwSetup(context.gameConfig).buyAndShip
        )
    }
}
