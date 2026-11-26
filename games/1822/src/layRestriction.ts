import {
    privateOwner,
    type ConstructionState,
    type TrackPlacement,
    type TrackRequest,
    presidentOf
} from '@tabletop/18xx'
import {
    LondonLocationId,
    MetropolitanId,
    concessionId,
    londonHomeCompanyIds1822,
    major1822
} from './companies.js'
import { LondonNodeIds } from './faces.js'
import { LondonApproachLocationIds } from './map.js'
import { requireState1822 } from './state.js'
import { LondonTileIds1822, TileSet1822 } from './tiles.js'

const Yellow = 'yellow'

/** The side of each hex beside London that faces it, where its London station's track comes out (§1.2.3). */
const LondonSides: Readonly<Record<string, number>> = Object.fromEntries(
    LondonNodeIds.map((nodeId, side) => [LondonApproachLocationIds[nodeId], (side + 3) % 6])
)

/** The London station each hex beside London is kept for, by that hex. */
const LondonStations: Readonly<Record<string, string>> = Object.fromEntries(
    LondonNodeIds.map((nodeId) => [LondonApproachLocationIds[nodeId], nodeId])
)

function director(state: ConstructionState, companyId: string): string | undefined {
    const company = state.companies.find((entry) => entry.id === companyId)
    const president = company && !company.closed ? presidentOf(state, companyId) : undefined
    return president?.kind === 'player' ? president.playerId : undefined
}

/**
 * The players whose hex beside London this is: the director of the company whose London station
 * it adjoins, or the holder of its concession, and the director of the Metropolitan Railway where
 * its home stands beside that station (§5.10.7).
 */
export function londonTrackHolders1822(state: ConstructionState, locationId: string): string[] {
    const nodeId = LondonStations[locationId]
    if (!nodeId) return []
    const title = requireState1822(state)
    const [adjoining] = londonHomeCompanyIds1822(nodeId)
    const held =
        adjoining &&
        major1822(adjoining) &&
        title.companies.find((company) => company.id === concessionId(adjoining) && !company.closed)
    const concession = held ? privateOwner(title, held.id) : undefined
    const metropolitan = state.stations.some(
        (station) =>
            station.companyId === MetropolitanId &&
            station.status === 'placed' &&
            station.position.locationId === LondonLocationId &&
            station.position.nodeId === nodeId
    )
    return [
        ...new Set(
            [
                adjoining && director(state, adjoining),
                concession?.kind === 'player' ? concession.playerId : undefined,
                metropolitan ? director(state, MetropolitanId) : undefined
            ].filter((playerId) => playerId !== undefined)
        )
    ]
}

function laysYellow(request: TrackRequest): boolean {
    return (
        TileSet1822.definitions.find((tile) => tile.id === request.definitionId)?.face.color ===
        Yellow
    )
}

/**
 * Whose agreement a yellow tile beside London needs: none where the laying company's director is
 * one of the hex's holders, or where it has none (§5.10.7).
 */
export function londonConsentPlayerId1822(
    state: ConstructionState,
    request: TrackRequest
): string | undefined {
    if (!laysYellow(request)) return undefined
    const holders = londonTrackHolders1822(state, request.locationId)
    const layer = director(state, request.companyId)
    return layer !== undefined && holders.includes(layer) ? undefined : holders[0]
}

/** The hex's other holders, any of whom may be asked in place of the first (§5.10.7). */
export function londonOtherConsentPlayerIds1822(
    state: ConstructionState,
    request: TrackRequest
): string[] {
    return londonConsentPlayerId1822(state, request)
        ? londonTrackHolders1822(state, request.locationId).slice(1)
        : []
}

/** London's stations keep their sides (§1.2.3). */
export function londonPlacementRestriction1822(placement: TrackPlacement): string | undefined {
    return LondonTileIds1822.includes(placement.definitionId) && placement.rotation !== 0
        ? 'London is developed in place.'
        : undefined
}

/** Why a tile may not be laid as asked, whoever lays it and by what power. */
export function layRestriction1822(
    state: ConstructionState,
    request: TrackRequest
): string | undefined {
    // The Metropolitan Railway's home token is its track lay in its first turn (§5.6.7).
    const title = requireState1822(state)
    if (request.companyId === MetropolitanId && title.debutCompanyIds.includes(MetropolitanId))
        return 'Placing its home station is the Metropolitan Railway’s track lay this turn.'
    if (request.locationId === LondonLocationId) return undefined
    // A hex beside London with no holder takes a yellow tile only if it joins the London
    // station's track (§5.10.7).
    const side = LondonSides[request.locationId]
    const face = TileSet1822.definitions.find((tile) => tile.id === request.definitionId)?.face
    if (
        side !== undefined &&
        face?.color === Yellow &&
        !londonTrackHolders1822(state, request.locationId).length
    ) {
        const joined = face.paths.some((path) =>
            path.endpoints.some(
                (end) => end.kind === 'edge' && (end.edge + request.rotation) % 6 === side
            )
        )
        if (!joined)
            return 'With no director to agree, a yellow tile beside London joins its London station’s track.'
    }
    return undefined
}
