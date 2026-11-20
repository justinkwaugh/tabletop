import type { HydratedAction } from '@tabletop/common'
import {
    isPlaceVessel,
    placeVesselOffers,
    type HydratedPlaceVessel
} from '../actions/placeVessel.js'
import {
    isPlayMandate,
    playMandateOffers,
    type HydratedPlayMandate
} from '../actions/playMandate.js'
import {
    isReclaimImmunitySeal,
    reclaimImmunitySealOffers,
    type HydratedReclaimImmunitySeal
} from '../actions/reclaimImmunitySeal.js'
import {
    isSpendRegionTile,
    spendRegionTileOffers,
    type HydratedSpendRegionTile
} from '../actions/spendRegionTile.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-4.4-H1, R-3.14-H2, R-4.4-H5 */
export type AtWillAction =
    | HydratedPlayMandate
    | HydratedSpendRegionTile
    | HydratedPlaceVessel
    | HydratedReclaimImmunitySeal

/** R-4.4-H1 A new at-will action adds its row here and to `atWillOffers`. */
export function isAtWillAction(action: HydratedAction): action is AtWillAction {
    return (
        isPlayMandate(action) ||
        isSpendRegionTile(action) ||
        isPlaceVessel(action) ||
        isReclaimImmunitySeal(action)
    )
}

/** R-4.4-H1, R-4.2.2 Reads writs only through offers that take a projected state. */
export function atWillOffers(state: HydratedFeudumGameState, playerId: string): ActionType[] {
    const open = (offered: boolean, type: ActionType) => (offered ? [type] : [])
    return [
        ...open(
            playMandateOffers(state, playerId).some((offer) => !offer.refused),
            ActionType.PlayMandate
        ),
        ...open(spendRegionTileOffers(state, playerId).length > 0, ActionType.SpendRegionTile),
        ...open(placeVesselOffers(state, playerId).length > 0, ActionType.PlaceVessel),
        ...open(
            reclaimImmunitySealOffers(state, playerId).length > 0,
            ActionType.ReclaimImmunitySeal
        )
    ]
}
