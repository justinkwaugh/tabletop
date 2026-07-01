import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { SantiagoGameState, HydratedSantiagoGameState } from '../model/gameState.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedSelectTile, isSelectTile } from '../actions/selectTile.js'
import { HydratedPlaceField, isPlaceField } from '../actions/placeField.js'
import { HydratedPlaceNeutralTile, isPlaceNeutralTile } from '../actions/placeNeutralTile.js'
import { HydratedBuildCanal, isBuildCanal } from '../actions/buildCanal.js'
import { HydratedPayBribe, isPayBribe } from '../actions/payBribe.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedProposeCanal, isProposeCanal } from '../actions/proposeCanal.js'
import { HydratedOverseerDecision, isOverseerDecision } from '../actions/overseerDecision.js'
import { HydratedEndRoundEvent, isEndRoundEvent } from '../actions/endRoundEvent.js'

export class SantiagoHydrator
    implements GameHydrator<SantiagoGameState, HydratedSantiagoGameState>
{
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBid(data):
                return new HydratedPlaceBid(data)
            case isSelectTile(data):
                return new HydratedSelectTile(data)
            case isPlaceField(data):
                return new HydratedPlaceField(data)
            case isPlaceNeutralTile(data):
                return new HydratedPlaceNeutralTile(data)
            case isBuildCanal(data):
                return new HydratedBuildCanal(data)
            case isPayBribe(data):
                return new HydratedPayBribe(data)
            case isPass(data):
                return new HydratedPass(data)
            case isProposeCanal(data):
                return new HydratedProposeCanal(data)
            case isOverseerDecision(data):
                return new HydratedOverseerDecision(data)
            case isEndRoundEvent(data):
                return new HydratedEndRoundEvent(data)
            default:
                throw new Error(`Unknown action type: ${data.type}`)
        }
    }

    hydrateState(state: SantiagoGameState): HydratedSantiagoGameState {
        return new HydratedSantiagoGameState(state)
    }
}
