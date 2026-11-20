import type { HexId } from '../data/hexes.js'
import type { RailroadId } from '../data/railroads.js'
import { adjacentHexIds, boardMap, isCityHex } from '../data/boardMaps.js'
import type { MapId } from '../data/maps.js'
import type { Track } from '../model/gameState.js'
import { isEastCoastHex } from './placement.js'
import { isWestCoastCity } from './startRailroad.js'
import { hasTrackIn, railroadsIn } from './track.js'

// R-4.3.3: a line is priced by whether it changes railroad only in city hexes.
export type TranscontinentalLine = {
    changesRailroadOnlyInCities: boolean
    hexIds: HexId[]
}

// R-4.3.3: the railroad the line travels on, and which railroads have carried it a step.
type LineState = {
    hexId: HexId
    railroadId: RailroadId
    firstCarrier: RailroadId | undefined
    twoCarriers: boolean
    changedRailroadOutsideCity: boolean
    previous: LineState | undefined
}

// R-4.3.3: the best Transcontinental line on the track, if any. A line
// starts in a West Coast city and ends in an East Coast city; it steps along one railroad's
// track to an adjacent hex, or changes railroad in a hex holding both, and needs at least two
// railroads each carrying it at least one step. A line is a walk and may pass a hex twice.
export function transcontinentalLine(track: Track): TranscontinentalLine | undefined {
    const queue = westCoastStates(track)
    const seen = new Set(queue.map(stateKey))
    let found: LineState | undefined
    for (let index = 0; index < queue.length; index++) {
        const state = queue[index]
        if (state.twoCarriers && isEastCoastHex(state.hexId)) {
            if (!state.changedRailroadOutsideCity) {
                return { changesRailroadOnlyInCities: true, hexIds: hexIdsOf(state) }
            }
            found ??= state
        }
        for (const next of nextStates(track, state)) {
            const key = stateKey(next)
            if (!seen.has(key)) {
                seen.add(key)
                queue.push(next)
            }
        }
    }
    return found && { changesRailroadOnlyInCities: false, hexIds: hexIdsOf(found) }
}

function hexIdsOf(end: LineState): HexId[] {
    const hexIds: HexId[] = []
    for (let state: LineState | undefined = end; state; state = state.previous) {
        if (hexIds[0] !== state.hexId) {
            hexIds.unshift(state.hexId)
        }
    }
    return hexIds
}

// R-4.3.3: the Transcontinental is the USA board's bonus.
const TRANSCONTINENTAL_MAP: MapId = 'map.usa'

function westCoastStates(track: Track): LineState[] {
    return boardMap(TRANSCONTINENTAL_MAP)
        .cities.filter(isWestCoastCity)
        .flatMap((city) =>
            railroadsIn(track, city.hexId).map((railroadId) => ({
                hexId: city.hexId,
                railroadId,
                firstCarrier: undefined,
                twoCarriers: false,
                changedRailroadOutsideCity: false,
                previous: undefined
            }))
        )
}

function nextStates(track: Track, state: LineState): LineState[] {
    return [...steps(track, state), ...railroadChanges(track, state)]
}

function steps(track: Track, state: LineState): LineState[] {
    const carried = carriedBy(state, state.railroadId)
    return adjacentHexIds(state.hexId)
        .filter((hexId) => hasTrackIn(track, hexId, state.railroadId))
        .map((hexId) => ({ ...state, ...carried, hexId, previous: state }))
}

// R-4.3.3: railroads join only where both have a locomotive in the same hex.
function railroadChanges(track: Track, state: LineState): LineState[] {
    const changedRailroadOutsideCity = state.changedRailroadOutsideCity || !isCityHex(state.hexId)
    return railroadsIn(track, state.hexId)
        .filter((railroadId) => railroadId !== state.railroadId)
        .map((railroadId) => ({
            ...state,
            railroadId,
            changedRailroadOutsideCity,
            previous: state
        }))
}

function carriedBy(
    state: LineState,
    railroadId: RailroadId
): Pick<LineState, 'firstCarrier' | 'twoCarriers'> {
    if (state.twoCarriers) {
        return { firstCarrier: undefined, twoCarriers: true }
    }
    if (state.firstCarrier === undefined || state.firstCarrier === railroadId) {
        return { firstCarrier: railroadId, twoCarriers: false }
    }
    return { firstCarrier: undefined, twoCarriers: true }
}

function stateKey(state: LineState): string {
    return [
        state.hexId,
        state.railroadId,
        state.firstCarrier ?? '',
        state.twoCarriers,
        state.changedRailroadOutsideCity
    ].join('|')
}
