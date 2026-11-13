import {
    layAddedTrack,
    privateOwner,
    sameStopCounts,
    type ConstructionState,
    type TrackRequest,
    type TrackRules
} from '@tabletop/18xx'
import { Map1849, MessinaLocationId } from './map.js'
import { IngegneriaPrivateId, PrivateCatalog1849 } from './privates.js'
import { requireState1849 } from './state.js'
import { TileColorOrder1849, TileSet1849 } from './tiles.js'
import { Phases1849 } from './trains.js'

/**
 * What the hex's terrain costs this lay, paid again on every upgrade: a quarter when all the new
 * track is narrow gauge, half for a company owning the SIGI otherwise (§10.3.1).
 */
export function terrainCost1849(state: ConstructionState, request: TrackRequest): number {
    const cost = Map1849.location(request.locationId).terrain?.cost ?? 0
    if (!cost) return 0
    const added = layAddedTrack(state, TrackRules1849, request)
    if (added.length && added.every((path) => path.gauge === 'narrow')) return cost / 4
    const engineers = privateOwner(state, IngegneriaPrivateId)
    return engineers?.kind === 'company' && engineers.companyId === request.companyId
        ? cost / 2
        : cost
}

/** Messina cannot be upgraded until the stock round after the earthquake has ended (§12). */
export function messinaLocked(stateObject: object): boolean {
    const state = requireState1849(stateObject)
    const until = state.messinaLockedUntil
    return (
        until !== undefined &&
        (state.stockRound.number < until ||
            (state.stockRound.number === until && !state.stockRound.completed))
    )
}

export const TrackRules1849: TrackRules = {
    map: Map1849,
    tileSet: TileSet1849,
    colorOrder: TileColorOrder1849,
    availableColors: (state) => Phases1849.phase(state.phaseId).tileColors,
    // A corporation lays or upgrades one tile a turn (§10.3).
    allowance: (state) =>
        state.trackStep?.lays.length
            ? { reason: 'A corporation lays or upgrades one tile a turn.' }
            : { cost: 0 },
    preservesStops: sameStopCounts,
    // A lay extends the company's network, or is on a hex holding its station; an upgrade adds
    // track it can reach or raises a stop it can reach (§10.3).
    useful: ({ home, newTrack, increasedCityRevenue, connectedCity, connectedTown }) =>
        home || newTrack || (increasedCityRevenue && (connectedCity || connectedTown)),
    homeLocations: (companyId) => Map1849.reservedLocationIds(companyId),
    terrainCost: (state, request) => terrainCost1849(state, request),
    restriction(state, request) {
        const blocker = PrivateCatalog1849.blockedBy(state, request.locationId)
        if (blocker) return `No track here while a player owns the ${blocker.name}`
        if (request.locationId === MessinaLocationId && messinaLocked(state))
            return 'Messina cannot be upgraded until after the stock round following the earthquake'
        return undefined
    }
}
