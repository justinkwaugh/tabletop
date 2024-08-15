import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { HydratedPlaceMarket } from '../actions/placeMarket.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'

// Transition from MarketTileDrawn(PlaceMarket) -> StartOfTurn (for next player)
// Transition from MarketTileDrawn(PlaceMarket) -> TileBagEmptied (if bag empty)
export class MarketTileDrawnStateHandler implements MachineStateHandler<HydratedPlaceMarket> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is HydratedPlaceMarket {
        return action.type === ActionType.PlaceMarket
    }

    validActionsForPlayer(_playerId: string, _context: MachineContext): ActionType[] {
        return [ActionType.PlaceMarket]
    }

    enter(_context: MachineContext) {}

    onAction(action: HydratedPlaceMarket, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedFreshFishGameState
        gameState.turnManager.endTurn(gameState.actionCount + 1)
        if (gameState.tileBag.isEmpty()) {
            return MachineState.TileBagEmptied
        } else {
            return MachineState.StartOfTurn
        }
    }
}
