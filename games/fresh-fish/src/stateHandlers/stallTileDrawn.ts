import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    ActionSource
} from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { HydratedStartAuction } from '../actions/startAuction.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { PlaceBid } from '../actions/placeBid.js'
import { nanoid } from 'nanoid'

// Transition from StallTileDrawn(StartAuction) -> AuctioningTile
export class StallTileDrawnStateHandler implements MachineStateHandler<HydratedStartAuction> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext
    ): action is HydratedStartAuction {
        return action.type === ActionType.StartAuction
    }

    validActionsForPlayer(_playerId: string, _context: MachineContext): string[] {
        return [ActionType.StartAuction]
    }

    enter(_context: MachineContext) {}

    onAction(action: HydratedStartAuction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedFreshFishGameState
        if (!gameState.currentAuction) {
            throw Error('No auction found')
        }

        gameState.activePlayerIds = gameState.currentAuction?.participants.map((participant) => {
            return participant.playerId
        })

        // Add 0 Bids for players with no money or only player in auction
        for (const participant of gameState.currentAuction.participants) {
            if (
                gameState.currentAuction.participants.length === 1 ||
                gameState.getPlayerState(participant.playerId).money === 0
            ) {
                const placeBidAction = <PlaceBid>{
                    type: ActionType.PlaceBid,
                    id: nanoid(),
                    playerId: participant.playerId,
                    gameId: action.gameId,
                    source: ActionSource.System,
                    amount: 0
                }
                context.addPendingAction(placeBidAction)
            }
        }
        return MachineState.AuctioningTile
    }
}
