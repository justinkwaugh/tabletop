import type { HexId } from '../data/hexes.js'
import type { RailroadId } from '../data/railroads.js'
import type { Track } from '../model/gameState.js'

// R-4.1.3, R-4.1.4: the railroads with a locomotive in a hex.
export function railroadsIn(track: Track, hexId: HexId): readonly RailroadId[] {
    return track[hexId] ?? []
}

// R-1.1: a railroad's locomotives on the map, one per hex at most (R-4.1.3).
export function trackCount(track: Track, railroadId: RailroadId): number {
    return Object.values(track).filter((railroadIds) => railroadIds.includes(railroadId)).length
}

// R-4.1.1, R-4.2: a railroad has started once it has any track.
export function hasTrack(track: Track, railroadId: RailroadId): boolean {
    return Object.values(track).some((railroadIds) => railroadIds.includes(railroadId))
}

// R-4.1.3
export function hasTrackIn(track: Track, hexId: HexId, railroadId: RailroadId): boolean {
    return railroadsIn(track, hexId).includes(railroadId)
}

// R-3.2, R-4.1.3: the track once a locomotive of the railroad stands in the hex.
export function trackWith(
    track: Track,
    { hexId, railroadId }: { hexId: HexId; railroadId: RailroadId }
): Track {
    return { ...track, [hexId]: [...railroadsIn(track, hexId), railroadId] }
}
