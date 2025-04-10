import {
    GameAction,
    GameHydrator,
    GameState,
    type HydratedAction,
    type HydratedGameState
} from '@tabletop/common'
import { EstatesGameState, HydratedEstatesGameState } from '../model/gameState.js'
import { HydratedDrawRoof, isDrawRoof } from '../actions/drawRoof.js'
import { HydratedStartAuction, isStartAuction } from '../actions/startAuction.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedEndAuction, isEndAuction } from '../actions/endAuction.js'
import { HydratedChooseRecipient, isChooseRecipient } from '../actions/chooseRecipient.js'
import { HydratedPlaceCube, isPlaceCube } from '../actions/placeCube.js'
import { HydratedPlaceMayor, isPlaceMayor } from '../actions/placeMayor.js'
import { HydratedPlaceRoof, isPlaceRoof } from '../actions/placeRoof.js'
import { HydratedPlaceBarrier, isPlaceBarrier } from '../actions/placeBarrier.js'
import { HydratedRemoveBarrier, isRemoveBarrier } from '../actions/removeBarrier.js'
import { HydratedDiscardPiece, isDiscardPiece } from '../actions/discardPiece.js'
import { HydratedEmbezzle, isEmbezzle } from '../actions/embezzle.js'

export class EstatesHydrator implements GameHydrator {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isDrawRoof(data): {
                return new HydratedDrawRoof(data)
            }
            case isStartAuction(data): {
                return new HydratedStartAuction(data)
            }
            case isPlaceBid(data): {
                return new HydratedPlaceBid(data)
            }
            case isEndAuction(data): {
                return new HydratedEndAuction(data)
            }
            case isChooseRecipient(data): {
                return new HydratedChooseRecipient(data)
            }
            case isPlaceCube(data): {
                return new HydratedPlaceCube(data)
            }
            case isPlaceMayor(data): {
                return new HydratedPlaceMayor(data)
            }
            case isPlaceRoof(data): {
                return new HydratedPlaceRoof(data)
            }
            case isPlaceBarrier(data): {
                return new HydratedPlaceBarrier(data)
            }
            case isRemoveBarrier(data): {
                return new HydratedRemoveBarrier(data)
            }
            case isDiscardPiece(data): {
                return new HydratedDiscardPiece(data)
            }
            case isEmbezzle(data): {
                return new HydratedEmbezzle(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: GameState): HydratedGameState {
        return new HydratedEstatesGameState(state as EstatesGameState)
    }
}
