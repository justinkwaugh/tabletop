import { queueForcedBids } from '../util/automaticActions.js'
import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { HydratedStartAuction } from '../actions/startAuction.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'

// Transition from StallTileDrawn(StartAuction) -> AuctioningTile
export class StallTileDrawnStateHandler implements MachineStateHandler<
    HydratedStartAuction,
    HydratedFreshFishGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFreshFishGameState>
    ): action is HydratedStartAuction {
        return action.type === ActionType.StartAuction
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedFreshFishGameState>
    ): string[] {
        return [ActionType.StartAuction]
    }

    enter(_context: MachineContext<HydratedFreshFishGameState>) {}

    onAction(
        action: HydratedStartAuction,
        context: MachineContext<HydratedFreshFishGameState>
    ): MachineState {
        const gameState = context.gameState
        if (!gameState.currentAuction) {
            throw Error('No auction found')
        }

        gameState.activePlayerIds = gameState.currentAuction?.participants.map((participant) => {
            return participant.playerId
        })

        queueForcedBids(context)
        return MachineState.AuctioningTile
    }
}
