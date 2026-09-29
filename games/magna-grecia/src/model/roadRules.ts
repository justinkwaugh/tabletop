import {
    ClockwisePointyHexDirections,
    type AxialCoordinates,
    type PointyHexDirection
} from '@tabletop/common'
import { neighborCoords, oppositeDirection } from '../components/boardGrid.js'
import type { RoadEnds } from '../components/pieces.js'
import type { HydratedBoard } from './board.js'

export enum RoadShape {
    Straight = 'Straight',
    Curve = 'Curve'
}

function edgeDistance(a: PointyHexDirection, b: PointyHexDirection): number {
    const delta = Math.abs(
        ClockwisePointyHexDirections.indexOf(a) - ClockwisePointyHexDirections.indexOf(b)
    )
    return Math.min(delta, 6 - delta)
}

// Road tiles are printed straight on one side and gently curved on the other.
export function roadShape(ends: RoadEnds): RoadShape | undefined {
    switch (edgeDistance(ends[0], ends[1])) {
        case 3:
            return RoadShape.Straight
        case 2:
            return RoadShape.Curve
        default:
            return undefined
    }
}

export const ROAD_END_OPTIONS: RoadEnds[] = ClockwisePointyHexDirections.flatMap((first, index) =>
    ClockwisePointyHexDirections.slice(index + 1)
        .map((second): RoadEnds => [first, second])
        .filter((ends) => roadShape(ends) !== undefined)
)

export function canPlaceRoad(
    board: HydratedBoard,
    playerId: string,
    coords: AxialCoordinates,
    ends: RoadEnds
): boolean {
    if (!roadShape(ends) || !board.isEmptyPlain(coords)) {
        return false
    }
    let anchored = false
    for (const end of ends) {
        const neighbor = neighborCoords(coords, end)
        const road = board.roadAt(neighbor)
        if (road?.ends.includes(oppositeDirection(end))) {
            if (road.playerId !== playerId) {
                return false
            }
            anchored = true
        } else if (board.cityAt(neighbor)) {
            anchored = true
        } else if (
            (board.oracleAt(neighbor) || board.isOpenVillage(neighbor)) &&
            board.playerRoadEnters(playerId, neighbor)
        ) {
            anchored = true
        }
    }
    return anchored
}

export function legalRoadEnds(
    board: HydratedBoard,
    playerId: string,
    coords: AxialCoordinates
): RoadEnds[] {
    return ROAD_END_OPTIONS.filter((ends) => canPlaceRoad(board, playerId, coords, ends))
}
