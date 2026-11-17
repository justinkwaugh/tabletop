import {
    RailwayMapState,
    automaticBorrowing,
    companyStationCenters,
    laidTileFace,
    rotateTileFace,
    tileExits,
    type ConstructionState,
    type TrackRequest,
    type TrackRules
} from '@tabletop/18xx'
import { LoanRules1867 } from './loans.js'
import {
    LockedHexesOpenPhaseId,
    LockedLocationIds1867,
    Map1867,
    YellowTileStubs1867
} from './map.js'
import { TileColorOrder1867, TileSet1867, preservesStops1867 } from './tiles.js'
import { Phases1867 } from './trains.js'

/** The second track action of a turn costs $20 (GTG §8.6). */
const SecondLayCost = 20

const isUpgrade = (color: string) => color !== 'yellow'

/**
 * The company's home hexes still without track, where it must lay its tile before anywhere else
 * (AAG §10.4, which the designer rules definitive where the Grand Trunk rulebook is silent).
 */
function untrackedHomes(state: ConstructionState, companyId: string): string[] {
    const mapState = new RailwayMapState(Map1867, TileSet1867, state.tileInventory)
    return companyStationCenters(state, companyId)
        .map((center) => center.locationId)
        .filter((locationId) => !mapState.tile(locationId).face.paths.length)
}

/** A yellow tile laid where the map prints a yellow triangle must connect to it (GTG §8.6.2). */
function missesStub(request: TrackRequest): boolean {
    const { locationId, definitionId, rotation } = request
    const stub = YellowTileStubs1867[locationId]
    if (stub === undefined) return false
    const definition = TileSet1867.definitions.find((entry) => entry.id === definitionId)
    if (!definition || definition.face.color !== 'yellow') return false
    return !tileExits(rotateTileFace(definition.face, rotation)).has(stub)
}

export const TrackRules1867: TrackRules = {
    map: Map1867,
    tileSet: TileSet1867,
    colorOrder: TileColorOrder1867,
    // Track costs are paid with loans where the treasury falls short (GTG §8.2).
    borrowing: automaticBorrowing(LoanRules1867),
    availableColors: (state) => Phases1867.phase(state.phaseId).tileColors,
    // A free track action, and a second one for $20 that lays a yellow tile in another hex; at
    // most one of the two is an upgrade (GTG §8.6).
    allowance(state, color) {
        const lays = state.trackStep?.lays ?? []
        if (!lays.length) return { cost: 0 }
        if (lays.length > 1) return { reason: 'A company takes at most two track actions a turn.' }
        if (isUpgrade(laidTileFace(state, TrackRules1867, lays[0]).color) && isUpgrade(color))
            return { reason: 'Only one of a turn’s two track actions may be an upgrade.' }
        return { cost: SecondLayCost }
    },
    preservesStops: preservesStops1867,
    // A green city upgraded to brown uses as many track segments as it can (GTG §8.6).
    mostExits: (before) => before.nodes.some((node) => node.kind === 'city'),
    useful: ({ home, newTrack, increasedCityRevenue, connectedCity, connectedTown }) =>
        home || newTrack || increasedCityRevenue || connectedCity || connectedTown,
    homeLocations: () => [],
    restriction(state, request) {
        if (
            LockedLocationIds1867.includes(request.locationId) &&
            !Phases1867.isAtLeast(state.phaseId, LockedHexesOpenPhaseId)
        )
            return 'This hex is locked until phase 3.'
        if (state.trackStep?.lays.some((lay) => lay.locationId === request.locationId))
            return 'The second track action must be in a different hex.'
        const homes = untrackedHomes(state, request.companyId)
        if (homes.length && !homes.includes(request.locationId))
            return 'A company lays its first tile in its home hex.'
        if (missesStub(request)) return 'A yellow tile here must connect to the yellow triangle.'
        return undefined
    }
}
