import {
    SizedCompanyStations,
    addCompanyStations,
    closePrivate,
    locationMarkers,
    removeLocationMarkers,
    type LocationMarkerState,
    type StationLimitMarkers,
    type StationState,
    type StockState
} from '@tabletop/18xx'
import { EighteenUSACompanyMarket } from './marketZones.js'
import { BaileyYardId, ExpressFreightId, companyHolding } from './privateHolders.js'
import { ExpressFreightMarker } from './resourceMarkers.js'

export const StationsBySize: Readonly<Record<number, number>> = { 2: 1, 5: 2, 10: 4 }
export const StationPrice = 50
export const StationLimit = 8

/**
 * P8's marker in a red area counts toward its company's eight stations; given up over the limit
 * after a merger or acquisition, it leaves the map and P8 is discarded (P8).
 */
const ExpressFreightStation: StationLimitMarkers = {
    held: (state, companyId) =>
        companyHolding(state, ExpressFreightId) === companyId
            ? locationMarkers(state, { kind: ExpressFreightMarker })
            : [],
    giveUp(state) {
        removeLocationMarkers(state, { kind: ExpressFreightMarker })
        closePrivate(state, ExpressFreightId)
    }
}

/** A company needs 1, 2 or 4 stations for its size, at $50 beyond its home, and holds 8 at most. */
export const EighteenUSAStations = new SizedCompanyStations(EighteenUSACompanyMarket, {
    bySize: StationsBySize,
    price: StationPrice,
    limit: StationLimit,
    afterStationsBought: grantBaileyYard,
    limitMarkers: ExpressFreightStation
})

// Bailey Yard's bonus station comes from the supply once the company's own are bought (P23).
function grantBaileyYard(
    state: StockState & StationState & LocationMarkerState,
    companyId: string
): void {
    if (
        companyHolding(state, BaileyYardId) !== companyId ||
        EighteenUSAStations.stationsOwed(state, companyId) ||
        EighteenUSAStations.limitedStations(state, companyId) >= StationLimit
    )
        return
    addCompanyStations(state, companyId, 1)
    closePrivate(state, BaileyYardId)
}
