import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedPlaceStall } from '../actions/placeStall.js'
import { MachineState } from '../definition/states.js'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

// Transition from AuctionEnded(PlaceStall) -> StartOfTurn (if more tiles in bag, could be same or new player)
//                 AuctionEnded(PlaceStall) -> TileBagEmptied (if bag empty)
export class AuctionEndedStateHandler implements MachineStateHandler<HydratedPlaceStall, HydratedFreshFishGameState> {
    isValidAction(action: HydratedAction, _context: MachineContext<HydratedFreshFishGameState>): action is HydratedPlaceStall {
        return action.type === ActionType.PlaceStall
    }

    validActionsForPlayer(_playerId: string, _context: MachineContext<HydratedFreshFishGameState>): string[] {
        return [ActionType.PlaceStall]
    }

    enter(_context: MachineContext<HydratedFreshFishGameState>) {}

    onAction(action: HydratedPlaceStall, context: MachineContext<HydratedFreshFishGameState>): MachineState {
        const gameState = context.gameState
        const currentAuction = gameState.currentAuction
        if (!currentAuction || !currentAuction.auctioneerId) {
            throw Error(`No auction found but auction was ended`)
        }

        gameState.currentAuction = undefined

        if (gameState.tileBag.isEmpty()) {
            gameState.turnManager.endTurn(gameState.actionCount)
            return MachineState.TileBagEmptied
        } else {
            // If the auctioneer (i.e the player who drew the tile) did not win the auction, they get to go again
            if (currentAuction.winnerId === currentAuction.auctioneerId) {
                gameState.turnManager.endTurn(gameState.actionCount)
            } else {
                gameState.activePlayerIds = [currentAuction.auctioneerId]
            }
            return MachineState.StartOfTurn
        }
    }
}
