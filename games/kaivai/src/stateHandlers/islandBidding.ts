import {
    ActionSource,
    type HydratedAction,
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
export class IslandBiddingStateHandler implements MachineStateHandler<HydratedPlaceScoringBid, HydratedKaivaiGameState> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedKaivaiGameState>
    ): action is HydratedPlaceScoringBid {
        if (!isPlaceScoringBid(action)) {
            return false
        }

        const gameState = context.gameState

        if (!gameState.bidders.includes(action.playerId)) {
            return false
        }

        return true
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedKaivaiGameState>): string[] {
        const gameState = context.gameState
        return gameState.bidders.includes(playerId) ? [ActionType.PlaceScoringBid] : []
    }

    enter(context: MachineContext<HydratedKaivaiGameState>) {
        const gameState = context.gameState
        if (Object.keys(gameState.bids).length === 0) {
            gameState.activePlayerIds = structuredClone(gameState.bidders)
        }
    }

    onAction(action: HydratedPlaceScoringBid, context: MachineContext<HydratedKaivaiGameState>): MachineState {
        const gameState = context.gameState

        if (!gameState.chosenIsland) {
            throw Error(`No island chosen for bidding`)
        }

        remove(gameState.activePlayerIds, action.playerId)
        remove(gameState.bidders, action.playerId)

        // Continue if still players left to bid
        if (gameState.bidders.length > 0) {
            return MachineState.IslandBidding
        }

        context.addSystemAction(ScoreIsland, {
            islandId: gameState.chosenIsland,
            revealsInfo: true
        })

        return MachineState.FinalScoring
    }
}
