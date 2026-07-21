import {
    GameAction,
    type GameHydrator,
    type HydratedAction
} from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { HydratedPlaceCastle, isPlaceCastle } from '../actions/placeCastle.js'
import { HydratedDrawActionCard, isDrawActionCard } from '../actions/drawActionCard.js'
import { HydratedChooseAction, isChooseAction } from '../actions/chooseAction.js'
import { HydratedAdvanceResolution, isAdvanceResolution } from '../actions/advanceResolution.js'
import { HydratedNegotiationMove, isNegotiationMove } from '../actions/negotiationMove.js'
import { HydratedSubmitDuelBid, isSubmitDuelBid } from '../actions/submitDuelBid.js'
import { HydratedPlaceWall, isPlaceWall } from '../actions/placeWall.js'
import { HydratedPlaceKnight, isPlaceKnight } from '../actions/placeKnight.js'
import { HydratedExpandRegion, isExpandRegion } from '../actions/expandRegion.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedTakePoliticsCard, isTakePoliticsCard } from '../actions/takePoliticsCard.js'
import { HydratedPlayRenegadeCard, isPlayRenegadeCard } from '../actions/playRenegadeCard.js'
import { HydratedPlayAllianceCard, isPlayAllianceCard } from '../actions/playAllianceCard.js'
import { HydratedCancelAlliance, isCancelAlliance } from '../actions/cancelAlliance.js'

// This is essentially a factory that knows how to take raw action and state data
// and return the correct hydrated class instances for the Löwenherz game.  Used by the game engine
export class LowenherzHydrator
    implements GameHydrator<LowenherzGameState, HydratedLowenherzGameState>
{
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceCastle(data): {
                return new HydratedPlaceCastle(data)
            }
            case isDrawActionCard(data): {
                return new HydratedDrawActionCard(data)
            }
            case isChooseAction(data): {
                return new HydratedChooseAction(data)
            }
            case isAdvanceResolution(data): {
                return new HydratedAdvanceResolution(data)
            }
            case isNegotiationMove(data): {
                return new HydratedNegotiationMove(data)
            }
            case isSubmitDuelBid(data): {
                return new HydratedSubmitDuelBid(data)
            }
            case isPlaceWall(data): {
                return new HydratedPlaceWall(data)
            }
            case isPlaceKnight(data): {
                return new HydratedPlaceKnight(data)
            }
            case isExpandRegion(data): {
                return new HydratedExpandRegion(data)
            }
            case isPass(data): {
                return new HydratedPass(data)
            }
            case isTakePoliticsCard(data): {
                return new HydratedTakePoliticsCard(data)
            }
            case isPlayRenegadeCard(data): {
                return new HydratedPlayRenegadeCard(data)
            }
            case isPlayAllianceCard(data): {
                return new HydratedPlayAllianceCard(data)
            }
            case isCancelAlliance(data): {
                return new HydratedCancelAlliance(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: LowenherzGameState): HydratedLowenherzGameState {
        return new HydratedLowenherzGameState(state)
    }
}
