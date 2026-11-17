import { assert } from '@tabletop/common'
import type { BoardMap } from '../data/boardMap.js'
import { boardMap, isCityHex } from '../data/boardMaps.js'
import type { HexId } from '../data/hexes.js'
import { LOCOMOTIVES_PER_RAILROAD, type RailroadId } from '../data/railroads.js'
import type { Track } from '../model/gameState.js'

// The hexes of a shortest way from one hex to another, both included. It follows adjacency, so
// it crosses no impassable side.
export function shortestPath(map: BoardMap, from: HexId, to: HexId): HexId[] {
    const previous = new Map<HexId, HexId | null>([[from, null]])
    const frontier: HexId[] = [from]
    for (let hexId = frontier.shift(); hexId !== undefined; hexId = frontier.shift()) {
        for (const next of map.adjacentHexIds(hexId)) {
            if (!previous.has(next)) {
                previous.set(next, hexId)
                frontier.push(next)
            }
        }
    }
    const hexIds: HexId[] = []
    for (let hexId: HexId | null | undefined = to; hexId; hexId = previous.get(hexId)) {
        hexIds.unshift(hexId)
    }
    assert(hexIds[0] === from, `No way from ${from} to ${to}`)
    return hexIds
}

export const SAULT_STE_MARIE: HexId = 'hex.ca.0-2'
export const WINDSOR: HexId = 'hex.ca.1-29'
export const QUEBEC_CITY: HexId = 'hex.ca.30-4'

export type OneShort = {
    track: Track
    // The placement that joins the three cities.
    railroadId: RailroadId
    hexId: HexId
}

export function addTrack(track: Track, railroadId: RailroadId, hexIds: readonly HexId[]) {
    assert(hexIds.length <= LOCOMOTIVES_PER_RAILROAD, `${railroadId} has too few locomotives`)
    for (const hexId of hexIds) {
        track[hexId] = [...(track[hexId] ?? []), railroadId]
    }
}

// R-8.3: Canada's track one placement short of the Intercolonial. Red runs from Sault Ste. Marie
// to Windsor. Toward Québec City, Blue runs from Sault Ste. Marie to the last city on the way and
// Orange from there, as one railroad's locomotives are too few for the whole way; the network
// changes railroad in that city. Orange's locomotive in Québec City joins the three.
export function intercolonialOneShort(): OneShort {
    const map = boardMap('map.ca')
    const toWindsor = shortestPath(map, SAULT_STE_MARIE, WINDSOR)
    const toQuebecCity = shortestPath(map, SAULT_STE_MARIE, QUEBEC_CITY)
    const change = toQuebecCity.findLastIndex(
        (hexId, index) => index > 0 && index < toQuebecCity.length - 1 && isCityHex(hexId)
    )
    assert(change > 0, 'A city lies on the way to Québec City')
    assert(!toWindsor.includes(toQuebecCity[change]), 'The railroads change off the way to Windsor')
    const track: Track = {}
    addTrack(track, 'railroad.red', toWindsor)
    addTrack(track, 'railroad.blue', toQuebecCity.slice(0, change + 1))
    addTrack(track, 'railroad.orange', toQuebecCity.slice(change, -1))
    return { track, railroadId: 'railroad.orange', hexId: QUEBEC_CITY }
}
