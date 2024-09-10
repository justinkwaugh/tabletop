import {
    ActionSource,
    HydratedAction,
    MachineContext,
    type MachineStateHandler,
    remove
} from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedPlaceScoringBid, isPlaceScoringBid } from '../actions/placeScoringBid.js'
import { MachineState } from '../definition/states.js'
import { nanoid } from 'nanoid'
import { ActionType } from '../definition/actions.js'
import { ScoreIsland } from '../actions/scoreIsland.js'

// Transition from IslandBidding(PlaceBid) -> IslandBidding | FinalScoring
export class IslandBiddingStateHandler implements MachineStateHandler<HydratedPlaceScoringBid> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext
    ): action is HydratedPlaceScoringBid {
        if (!isPlaceScoringBid(action)) {
            return false
        }

        const gameState = context.gameState as HydratedKaivaiGameState

        if (!gameState.bidders.includes(action.playerId)) {
            return false
        }

        return true
    }

    validActionsForPlayer(playerId: string, context: MachineContext): string[] {
        const gameState = context.gameState as HydratedKaivaiGameState
        return gameState.bidders.includes(playerId) ? [ActionType.PlaceScoringBid] : []
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedKaivaiGameState
        if (Object.keys(gameState.bids).length === 0) {
            gameState.activePlayerIds = gameState.bidders
        }
    }

    onAction(action: HydratedPlaceScoringBid, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedKaivaiGameState

        if (!gameState.chosenIsland) {
            throw Error(`No island chosen for bidding`)
        }

        remove(gameState.activePlayerIds, action.playerId)
        remove(gameState.bidders, action.playerId)

        // Continue if still players left to bid
        if (gameState.bidders.length > 0) {
            return MachineState.IslandBidding
        }

        const scoreIslandAction: ScoreIsland = {
            type: ActionType.ScoreIsland,
            id: nanoid(),
            gameId: action.gameId,
            source: ActionSource.System,
            islandId: gameState.chosenIsland,
            revealsInfo: true
        }

        context.addPendingAction(scoreIslandAction)

        return MachineState.FinalScoring
    }
}
