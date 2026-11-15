import {
    laidTileFace,
    sameStopCounts,
    type ConstructionState,
    type TileFace,
    type TrackRequest,
    type TrackRules
} from '@tabletop/18xx'
import { ChicagoLocationId, Map1850, WestChicagoNodeId } from './map.js'
import { MesabiAccess } from './mesabiAccess.js'
import { BridgeLocationId, PrivateCatalog1850 } from './privates.js'
import { requireState1850 } from './state.js'
import { ChicagoYellowTileId, TileSet1850 } from './tiles.js'
import { Phases1850 } from './trains.js'

const operatedBefore = (state: ConstructionState, companyId: string | undefined) =>
    !!state.companies.find((company) => company.id === companyId)?.operated

/** This turn's ordinary lays, each as whether it was an upgrade; a Mesabi token is a yellow (§6.5.1). */
function laysThisTurn(state: ConstructionState): boolean[] {
    return [
        ...(state.trackStep?.lays ?? []).map(
            (lay) => laidTileFace(state, TrackRules1850, lay).color !== 'yellow'
        ),
        ...(requireState1850(state).mesabiBought ? [false] : [])
    ]
}

// Laid on its only legs that upgrades can keep, the tile's second city is the western (§6.1.3).
const ForbiddenChicagoRotation = 2

function chicagoRestriction(request: TrackRequest): string | undefined {
    if (request.locationId !== ChicagoLocationId || request.definitionId !== ChicagoYellowTileId)
        return undefined
    if (request.rotation === ForbiddenChicagoRotation)
        return 'Chicago’s yellow tile may not have legs to the northwest and due east'
    return request.nodeMapping[WestChicagoNodeId] === WestChicagoNodeId
        ? undefined
        : 'The Chicago, Burlington & Quincy starts in west Chicago'
}

// Chicago's green cities join into one city in brown (§6.1.3).
function chicagoJoinsCities(before: TileFace, after: TileFace): boolean {
    return before.labels.includes('C') && after.labels.includes('C') && after.color === 'brown'
}

export const TrackRules1850: TrackRules = {
    map: Map1850,
    tileSet: TileSet1850,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => Phases1850.phase(state.phaseId).tileColors,
    // A company lays one yellow tile or upgrades one tile; the first time it operates it may lay
    // two yellow tiles instead (§6, §6.1.1).
    allowance(state, color, upgrade) {
        const lays = [...laysThisTurn(state), color !== 'yellow' || !!upgrade]
        const upgrades = lays.filter((lay) => lay).length
        const yellows = lays.length - upgrades
        if (lays.length === 1) return { cost: 0 }
        return !operatedBefore(state, state.trackStep?.companyId) && !upgrades && yellows <= 2
            ? { cost: 0 }
            : { reason: 'A company lays one yellow tile or upgrades one tile.' }
    },
    stopAllowed: MesabiAccess.open,
    preservesStops: (before, after) =>
        sameStopCounts(before, after) || chicagoJoinsCities(before, after),
    // New track must be reachable, or the new tile a stop the company can run to (§6.1, §6.2).
    useful: ({ home, newTrack, connectedCity, connectedTown }) =>
        home || newTrack || connectedCity || connectedTown,
    homeLocations: (companyId) => Map1850.reservedLocationIds(companyId),
    restriction(state, request) {
        if (state.trackStep?.lays.some((lay) => lay.locationId === request.locationId))
            return 'A tile laid this turn cannot be replaced'
        if (requireState1850(state).bridgeLaid && request.locationId === BridgeLocationId)
            return 'A tile laid with the Bridge Company cannot be upgraded this operating round'
        const blocker = PrivateCatalog1850.blockedBy(state, request.locationId)
        if (blocker) return `No track here while a player owns the ${blocker.name}`
        return chicagoRestriction(request)
    }
}
