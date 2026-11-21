import { assertExists } from '@tabletop/common'
import type { MapStateData } from '@tabletop/18xx'
import type { EighteenUSAState } from './state.js'
import { MetropolisCandidates, type MetropolisCity } from './metropolis.js'
import { EighteenUSATileSet } from './tiles.js'
import { NewYorkId } from './mapFeatures.js'

export function metropolisCandidate(locationId: string): MetropolisCity | undefined {
    return MetropolisCandidates.find((candidate) => candidate.locationId === locationId)
}

/** New York and the cities made metropolises at setup or by P10 Carnegie Steel (Definitions). */
export function isMetropolis(
    state: Pick<EighteenUSAState, 'metropolisIds'>,
    locationId: string
): boolean {
    return locationId === NewYorkId || state.metropolisIds.includes(locationId)
}

/** Lays a candidate's yellow metropolis tile, north up, on its still empty hex (§2.4). */
export function layMetropolisTile(
    state: Pick<MapStateData, 'tileInventory'> & Pick<EighteenUSAState, 'metropolisIds'>,
    locationId: string
): void {
    const candidate = metropolisCandidate(locationId)
    assertExists(candidate, 'Only a metropolis candidate takes a metropolis tile')
    const piece = EighteenUSATileSet.availablePieces(state.tileInventory, candidate.yellowTileId)[0]
    assertExists(piece, 'Each metropolis tile is in the supply')
    state.tileInventory = EighteenUSATileSet.replace(state.tileInventory, {
        locationId,
        placement: {
            pieceId: piece.id,
            definitionId: candidate.yellowTileId,
            rotation: candidate.rotation
        },
        returnPrevious: true
    })
    state.metropolisIds = [...state.metropolisIds, locationId]
}
