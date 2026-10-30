import { BOARD_GRID, type SpaceId } from '../components/board.js'
import type { RailroadId } from '../components/railroads.js'
import type { PromontoryPointProjectedState } from '../model/gameState.js'

type Track = PromontoryPointProjectedState['track']

// R-3.3: a railroad's pieces on the board; its home hex completes the network.
export function networkSpaceIds(track: Track, railroadId: RailroadId): SpaceId[] {
    return BOARD_GRID.spaces()
        .map((space) => space.spaceId)
        .filter((spaceId) => spaceId in track && track[spaceId] === railroadId)
}

// R-3.3: empty and adjacent to the railroad's home hex or one of its pieces.
export function openSpaceIds(track: Track, railroadId: RailroadId): SpaceId[] {
    const networkCoords = [
        BOARD_GRID.homeHex(railroadId).coords,
        ...networkSpaceIds(track, railroadId).map(
            (spaceId) => BOARD_GRID.requireSpace(spaceId).coords
        )
    ]
    const adjacent = new Set(
        networkCoords.flatMap((coords) =>
            BOARD_GRID.spacesAdjacentTo(coords).map((space) => space.spaceId)
        )
    )
    return BOARD_GRID.spaces()
        .map((space) => space.spaceId)
        .filter((spaceId) => adjacent.has(spaceId) && !(spaceId in track))
}

// R-3.3
export function isOpenTo(track: Track, railroadId: RailroadId, spaceId: SpaceId): boolean {
    return openSpaceIds(track, railroadId).includes(spaceId)
}

// R-3.3, R-3.3-H1: a piece with no open space can only be scrapped.
export function hasOpenSpace(track: Track, railroadId: RailroadId): boolean {
    return openSpaceIds(track, railroadId).length > 0
}
