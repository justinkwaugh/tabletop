import {
    availableRailroads,
    hasTrack,
    startCityIds,
    cityById,
    type HexId,
    type HydratedRideTheRailsGameState,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { insetCellPoints } from './pickMarks.js'

/**
 * The railroads whose start cities the board marks once they are available, until their first
 * placement: Yellow from round 3, Purple from round 4 (R-1.4). Black is left out: it may start in
 * nearly every city, and the plain cities' Black band already says so.
 */
export const CUED_RAILROADS: readonly RailroadId[] = ['railroad.yellow', 'railroad.purple']

/** A dashed hex outline inside the city, over a white stroke, in the railroad's colour. */
export const START_CUE = {
    inset: 9.2,
    /** A second railroad cued in the same city is drawn further in. */
    nextInset: 7.2,
    groundWidth: 7.2,
    width: 4.8,
    dash: '6.8 4.4'
} as const

/** A cue's outline in each cell of its city's hex. */
export type StartCue = { railroadId: RailroadId; hexId: HexId; cells: string[] }

/**
 * R-4.2.3, R-4.2.4: where each cued railroad could start now, from the engine's own start rules,
 * for every seat and at any point of the round; the set follows the track as cubes are placed.
 */
export function startCues(state: HydratedRideTheRailsGameState): StartCue[] {
    if (!state.roundManager.currentRound) return []
    const available = availableRailroads(state)
    const cued = CUED_RAILROADS.filter(
        (railroadId) => available.includes(railroadId) && !hasTrack(state.track, railroadId)
    )
    const perHex = new Map<HexId, number>()
    return cued.flatMap((railroadId) =>
        startCityIds(state, railroadId).map((cityId) => {
            const hexId = cityById(cityId).hexId
            const before = perHex.get(hexId) ?? 0
            perHex.set(hexId, before + 1)
            const inset = START_CUE.inset + before * START_CUE.nextInset
            return { railroadId, hexId, cells: insetCellPoints(hexId, inset) }
        })
    )
}
