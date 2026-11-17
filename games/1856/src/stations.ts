import { assert } from '@tabletop/common'
import {
    RailwayMapState,
    StationPlacement,
    charterStationCost,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    privateOwner,
    privatePowerUsed,
    type HomeStation,
    type HomeStationChoice,
    type OperatingStationState,
    type StationRules
} from '@tabletop/18xx'
import { CgrId, CgrStationCost, CgrStationCount, Majors1856, WaterlooId } from './companies.js'
import { Map1856 } from './map.js'
import { requireState1856 } from './state.js'
import { TileSet1856 } from './tiles.js'

/** Each charter's station costs, home free; the CGR's further stations $100 (Token Exchange). */
export const StationCosts1856: Readonly<Record<string, readonly number[]>> = {
    ...Object.fromEntries(Majors1856.map((company) => [company.id, company.stationCosts])),
    [CgrId]: Array.from({ length: CgrStationCount }, () => CgrStationCost)
}

/**
 * The Waterloo & Saugeen's station takes the place of its owner's station for the turn: its power
 * is spent only by that station, and the private closes as the round ends.
 */
function waterlooStationThisTurn(state: OperatingStationState, companyId: string): boolean {
    const owner = privateOwner(state, WaterlooId)
    return (
        !getCompany(state, WaterlooId).closed &&
        privatePowerUsed(requireState1856(state), WaterlooId) &&
        owner?.kind === 'company' &&
        owner.companyId === companyId
    )
}

/** The floated company about to operate first, while its home station waits. */
function companyPlacingHome(state: OperatingStationState): string | undefined {
    const companyId = nextOperatingCompany(state)
    if (!companyId || companyId === CgrId) return undefined
    const company = getCompany(state, companyId)
    const home = state.stations.find((station) => station.id === homeStationId(companyId))
    return company.floated && !company.closed && home?.status === 'available'
        ? companyId
        : undefined
}

/**
 * The open cities of the hexes a company's home is claimed in, Hamilton's for the THB. In a hex
 * with no track yet the station takes the first, the company laying the first tile there choosing
 * the city it ends in, as for the Waterloo & Saugeen's station in a bare Kitchener (designer).
 */
function openHomeCities(
    state: OperatingStationState,
    companyId: string
): HomeStationChoice['positions'] {
    const placement = new StationPlacement(state, StationRules1856)
    return (state.hexReservations ?? [])
        .filter((reservation) => reservation.companyId === companyId)
        .flatMap(({ locationId }) => {
            const { face } = placement.mapState.tile(locationId)
            const open = face.nodes.flatMap((node) =>
                node.kind === 'city' && placement.openSlots(companyId, locationId, node.id).length
                    ? [{ locationId, nodeId: node.id }]
                    : []
            )
            return face.paths.length ? open : open.slice(0, 1)
        })
}

/** A company places its home station as it first operates (Place station markers). */
function pendingHomes1856(state: OperatingStationState): HomeStation[] {
    const companyId = companyPlacingHome(state)
    if (!companyId) return []
    const stationId = homeStationId(companyId)
    const reserved = state.stationReservations.find(
        (reservation) => reservation.companyId === companyId
    )
    if (reserved) {
        const face = new RailwayMapState(Map1856, TileSet1856, state.tileInventory).tile(
            reserved.locationId
        ).face
        assert(
            face.nodes.some((node) => node.id === reserved.nodeId),
            'A home reservation names a city of its tile'
        )
        return [{ stationId, locationId: reserved.locationId, nodeId: reserved.nodeId }]
    }
    const open = openHomeCities(state, companyId)
    return open.length === 1 ? [{ stationId, ...open[0] }] : []
}

/** The THB chooses between Hamilton's cities while both are open on a tile with track. */
function homeChoice1856(state: OperatingStationState): HomeStationChoice | undefined {
    const companyId = companyPlacingHome(state)
    if (!companyId) return undefined
    const positions = openHomeCities(state, companyId)
    return positions.length > 1
        ? { companyId, stationId: homeStationId(companyId), positions }
        : undefined
}

export const StationRules1856: StationRules = {
    map: Map1856,
    tileSet: TileSet1856,
    placementCost: charterStationCost(StationCosts1856),
    placementLimit: (state, companyId) => (waterlooStationThisTurn(state, companyId) ? 0 : 1),
    pendingHomes: pendingHomes1856,
    homeChoice: homeChoice1856
}
