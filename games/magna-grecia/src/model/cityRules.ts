import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { BOARD_GRID } from '../components/boardGrid.js'
import type { HydratedBoard } from './board.js'
import type { TurnProgress } from './turn.js'

export enum CityPlacementKind {
    Found = 'Found',
    Expand = 'Expand',
    CompleteClaim = 'CompleteClaim'
}

export type CityPlacementPlan =
    | { kind: CityPlacementKind.Found; claimVillage?: AxialCoordinates }
    | { kind: CityPlacementKind.Expand; cityIds: string[]; claimVillage?: AxialCoordinates }
    | { kind: CityPlacementKind.CompleteClaim; cityId: string; founding: boolean }

export type CityPlacementInput = {
    board: HydratedBoard
    playerId: string
    coords: AxialCoordinates
    turn: TurnProgress
    tilesAvailable: number
}

export function planCityPlacement({
    board,
    playerId,
    coords,
    turn,
    tilesAvailable
}: CityPlacementInput): CityPlacementPlan | undefined {
    if (tilesAvailable < 1 || isForbiddenCitySpace(board, playerId, coords)) {
        return undefined
    }

    if (turn.pendingClaim) {
        const { village, cityId, founding } = turn.pendingClaim
        return sameCoordinates(village, coords)
            ? { kind: CityPlacementKind.CompleteClaim, cityId, founding }
            : undefined
    }

    const adjacentVillages = board.adjacentOpenVillages(coords)
    if (adjacentVillages.length > 1) {
        return undefined
    }

    if (board.isOpenVillage(coords)) {
        return !turn.foundedCity && isFoundingVillage(board, playerId, coords)
            ? { kind: CityPlacementKind.Found }
            : undefined
    }

    // A tile beside a village is only legal when the next tile immediately covers that village.
    const claimVillage = adjacentVillages[0]
    if (claimVillage && tilesAvailable < 2) {
        return undefined
    }

    const ownCityIds = board
        .adjacentCities(coords)
        .filter((city) => city.playerId === playerId)
        .map((city) => city.id)
    if (ownCityIds.length > 0) {
        return { kind: CityPlacementKind.Expand, cityIds: ownCityIds, claimVillage }
    }

    if (claimVillage && !turn.foundedCity && isFoundingVillage(board, playerId, claimVillage)) {
        return { kind: CityPlacementKind.Found, claimVillage }
    }
    return undefined
}

export function isFoundingVillage(
    board: HydratedBoard,
    playerId: string,
    coords: AxialCoordinates
): boolean {
    return !!BOARD_GRID.space(coords)?.frontier || board.playerRoadEnters(playerId, coords)
}

function isForbiddenCitySpace(
    board: HydratedBoard,
    playerId: string,
    coords: AxialCoordinates
): boolean {
    return (
        !BOARD_GRID.space(coords) ||
        !!board.cityAt(coords) ||
        !!board.roadAt(coords) ||
        !!board.oracleAt(coords) ||
        board.isAdjacentToOracle(coords) ||
        board.adjacentCities(coords).some((city) => city.playerId !== playerId)
    )
}
