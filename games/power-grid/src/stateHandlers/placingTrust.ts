import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { HydratedPlaceTrustHouse, isPlaceTrustHouse } from '../actions/placeTrustHouse.js'

type Context = MachineContext<HydratedPowerGridGameState>

export class PlacingTrustStateHandler implements MachineStateHandler<
    HydratedPlaceTrustHouse,
    HydratedPowerGridGameState
> {
    isValidAction(action: HydratedAction, _context: Context): boolean {
        return isPlaceTrustHouse(action)
    }

    validActionsForPlayer(playerId: string, context: Context): ActionType[] {
        return context.gameState.trustPlacer() === playerId ? [ActionType.PlaceTrustHouse] : []
    }

    enter(context: Context) {
        const placer = context.gameState.trustPlacer()
        context.gameState.activePlayerIds = placer ? [placer] : []
    }

    onAction(_action: HydratedPlaceTrustHouse, context: Context): MachineState {
        return context.gameState.trustPlacer()
            ? MachineState.PlacingTrust
            : MachineState.ChoosingPlant
    }
}
