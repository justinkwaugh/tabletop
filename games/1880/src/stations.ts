import {
    StationPlacement,
    charterStationCost,
    getCompany,
    homeStationId,
    type HomeStation,
    type HomeStationChoice,
    type OperatingStationState,
    type StationPosition,
    type StationRules
} from '@tabletop/18xx'
import { Majors1880, StationCosts1880 } from './companies.js'
import { Map1880 } from './map.js'
import { MajorIds1880, isInvestor } from './stock.js'
import { TileSet1880 } from './tiles.js'
import { Phases1880 } from './trains.js'

const charterCost = charterStationCost(
    Object.fromEntries(Majors1880.map((company) => [company.id, StationCosts1880]))
)

/** Station markers cost twice as much from phase D (§X Placing station markers). */
const doubled = (state: { phaseId: string }) => Phases1880.isAtLeast(state.phaseId, 'D1')

/**
 * The floated majors whose home stations still wait: a company's home goes down as the share
 * round that floats it ends (§XII Inauguration of a Major Company).
 */
function companiesPlacingHomes(state: OperatingStationState): string[] {
    return MajorIds1880.filter((companyId) => {
        const company = getCompany(state, companyId)
        const home = state.stations.find((station) => station.id === homeStationId(companyId))
        return company.floated && !company.closed && home?.status === 'available'
    })
}

/** The reserved cities still open to the company's home. */
function openHomeCities(state: OperatingStationState, companyId: string): StationPosition[] {
    const placement = new StationPlacement(state, StationRules1880)
    return state.stationReservations
        .filter((reservation) => reservation.companyId === companyId)
        .flatMap(({ locationId, nodeId }) => {
            const [slot] = placement.openSlots(companyId, locationId, nodeId)
            return slot === undefined ? [] : [{ locationId, nodeId, slot }]
        })
}

function pendingHomes1880(state: OperatingStationState): HomeStation[] {
    return companiesPlacingHomes(state).flatMap((companyId) => {
        const open = openHomeCities(state, companyId)
        return open.length === 1
            ? [
                  {
                      stationId: homeStationId(companyId),
                      locationId: open[0].locationId,
                      nodeId: open[0].nodeId
                  }
              ]
            : []
    })
}

/**
 * The QSR and SCR start in a hex of two cities, either of which they may take while both are
 * open (§X Placing station markers).
 */
function homeChoice1880(state: OperatingStationState): HomeStationChoice | undefined {
    for (const companyId of companiesPlacingHomes(state)) {
        const positions = openHomeCities(state, companyId)
        if (positions.length > 1)
            return {
                companyId,
                stationId: homeStationId(companyId),
                positions: positions.map(({ locationId, nodeId }) => ({ locationId, nodeId }))
            }
    }
    return undefined
}

export const StationRules1880: StationRules = {
    map: Map1880,
    tileSet: TileSet1880,
    // The home station is free, the next ¥40 and the last ¥100, doubled in phase D (§X).
    placementCost: (state, stationId, context) =>
        charterCost(state, stationId, context) * (doubled(state) ? 2 : 1),
    // One station a turn; a foreign investor has only its home (§VII, §X).
    placementLimit: (_state, companyId) => (isInvestor(companyId) ? 0 : 1),
    pendingHomes: pendingHomes1880,
    homeChoice: homeChoice1880
}
