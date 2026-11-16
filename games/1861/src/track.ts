import {
    automaticBorrowing,
    companyStationCenters,
    laidTileFace,
    RailwayMapState,
    type ConstructionState,
    type TrackRules
} from '@tabletop/18xx'
import { LoanRules1861 } from './loans.js'
import { Map1861, PrivateBlockedLocationIds, PrivateHexesOpenPhaseId } from './map.js'
import { TileColorOrder1861, TileSet1861, preservesStops1861 } from './tiles.js'
import { Phases1861 } from './trains.js'

/** The second tile operation of a turn costs R20 (§10.4). */
const SecondLayCost = 20

const isUpgrade = (color: string) => color !== 'yellow'

/** The company's home hexes still without track, where it must build before anywhere else (§10.4). */
function untrackedHomes(state: ConstructionState, companyId: string): string[] {
    const mapState = new RailwayMapState(Map1861, TileSet1861, state.tileInventory)
    return companyStationCenters(state, companyId)
        .map((center) => center.locationId)
        .filter((locationId) => !mapState.tile(locationId).face.paths.length)
}

export const TrackRules1861: TrackRules = {
    map: Map1861,
    tileSet: TileSet1861,
    colorOrder: TileColorOrder1861,
    // Track costs are paid with loans where the treasury falls short (§10.2).
    borrowing: automaticBorrowing(LoanRules1861),
    availableColors: (state) => Phases1861.phase(state.phaseId).tileColors,
    // Two tile operations a turn, in different hexes, at most one of them an upgrade; the second
    // costs R20 (§10.4).
    allowance(state, color) {
        const lays = state.trackStep?.lays ?? []
        if (!lays.length) return { cost: 0 }
        if (lays.length > 1)
            return { reason: 'A company makes at most two tile operations a turn.' }
        if (isUpgrade(laidTileFace(state, TrackRules1861, lays[0]).color) && isUpgrade(color))
            return { reason: 'Only one of a turn’s two tile operations may be an upgrade.' }
        return { cost: SecondLayCost }
    },
    preservesStops: preservesStops1861,
    // A large city brown tile has six exits where it can (§10.4).
    mostExits: (before) => before.nodes.some((node) => node.kind === 'city'),
    useful: ({ home, newTrack, increasedCityRevenue, connectedCity, connectedTown }) =>
        home || newTrack || increasedCityRevenue || connectedCity || connectedTown,
    homeLocations: () => [],
    restriction(state, request) {
        if (
            PrivateBlockedLocationIds.includes(request.locationId) &&
            !Phases1861.isAtLeast(state.phaseId, PrivateHexesOpenPhaseId)
        )
            return 'Private company hexes are closed to track until phase 3.'
        if (state.trackStep?.lays.some((lay) => lay.locationId === request.locationId))
            return 'The second tile operation must be in a different hex.'
        const homes = untrackedHomes(state, request.companyId)
        if (homes.length && !homes.includes(request.locationId))
            return 'A company builds in its home hex before anywhere else.'
        return undefined
    }
}
