import type { HydratedAction } from '@tabletop/common'
import {
    discardWritOffers,
    isDiscardWrit,
    type HydratedDiscardWrit
} from '../actions/discardWrit.js'
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
    isSealCharter,
    sealCharterOffers,
    type HydratedSealCharter
} from '../actions/sealCharter.js'
import {
    isSpendRegionTile,
    spendRegionTileOffers,
    type HydratedSpendRegionTile
} from '../actions/spendRegionTile.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-4.4-H1, R-4.4-H5, R-3.14-H2 What a seat may send in any at-will window. */
export type AtWillAction =
    | HydratedPlayMandate
    | HydratedSealCharter
    | HydratedSpendRegionTile
    | HydratedPlaceVessel
    | HydratedDiscardWrit
    | HydratedReclaimImmunitySeal

/** R-4.4-H1 A new at-will action adds its row here and to `atWillOffers`. */
export function isAtWillAction(action: HydratedAction): action is AtWillAction {
    return (
        isPlayMandate(action) ||
        isSealCharter(action) ||
        isSpendRegionTile(action) ||
        isPlaceVessel(action) ||
        isDiscardWrit(action) ||
        isReclaimImmunitySeal(action)
    )
}

/**
 * R-4.4-H1, R-4.4-H5, R-4.2.2 What this seat is offered at will now: nothing outside a window, and
 * each action its own offers decide. Reads the seat's writs only through offers that take a
 * projected state, so a viewer who isn't that seat is offered what the public counts show.
 */
export function atWillOffers(state: HydratedFeudumGameState, playerId: string): ActionType[] {
    const open = (offered: boolean, type: ActionType) => (offered ? [type] : [])
    return [
        ...open(
            playMandateOffers(state, playerId).some((offer) => !offer.refused),
            ActionType.PlayMandate
        ),
        ...open(
            sealCharterOffers(state, playerId).some((offer) => !offer.refused),
            ActionType.SealCharter
        ),
        ...open(spendRegionTileOffers(state, playerId).length > 0, ActionType.SpendRegionTile),
        ...open(placeVesselOffers(state, playerId).length > 0, ActionType.PlaceVessel),
        ...open(discardWritOffers(state, playerId).length > 0, ActionType.DiscardWrit),
        ...open(
            reclaimImmunitySealOffers(state, playerId).length > 0,
            ActionType.ReclaimImmunitySeal
        )
    ]
}
