import {
    ClockwisePointyHexDirections,
    sameCoordinates,
    type AxialCoordinates
} from '@tabletop/common'
import { BOARD_GRID, neighborCoords, spaceKey } from '../components/boardGrid.js'
import type { HydratedBoard } from './board.js'
import type { TurnProgress } from './turn.js'

export enum CityPlacementKind {
    Found = 'Found',
    Expand = 'Expand',
    CompleteClaim = 'CompleteClaim'
}

export type CityPlacementPlan =
    | { kind: CityPlacementKind.Found; claimVillage?: AxialCoordinates; awaitsVillage?: boolean }
    | { kind: CityPlacementKind.Expand; cityIds: string[]; claimVillage?: AxialCoordinates }
    | { kind: CityPlacementKind.CompleteClaim; cityId: string; founding: boolean }

export type CityPlacementInput = {
    board: HydratedBoard
    playerId: string
    coords: AxialCoordinates
    turn: TurnProgress
    tilesAvailable: number
}

export function planCityPlacement(input: CityPlacementInput): CityPlacementPlan | undefined {
    const { board, playerId, coords, turn, tilesAvailable } = input
    if (tilesAvailable < 1 || isForbiddenCitySpace(board, playerId, coords)) {
        return undefined
    }

    if (turn.pendingClaim) {
        const { village, cityId, founding } = turn.pendingClaim
        return sameCoordinates(village, coords)
            ? { kind: CityPlacementKind.CompleteClaim, cityId, founding }
            : undefined
    }

    if (turn.pendingFounding) {
        return planFoundingStep(input, turn.pendingFounding)
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

    const claimVillage = adjacentVillages[0]
    if (claimVillage && !canClaimVillage(board, playerId, claimVillage, tilesAvailable)) {
        return undefined
    }

    const ownCityIds = board
        .adjacentCities(coords)
        .filter((city) => city.playerId === playerId)
        .map((city) => city.id)
    if (ownCityIds.length > 0) {
        return { kind: CityPlacementKind.Expand, cityIds: ownCityIds, claimVillage }
    }

    if (turn.foundedCity) {
        return undefined
    }
    if (claimVillage) {
        return isFoundingVillage(board, playerId, claimVillage)
            ? { kind: CityPlacementKind.Found, claimVillage }
            : undefined
    }
    return tilesToFoundingVillage(board, playerId, coords) <= tilesAvailable
        ? { kind: CityPlacementKind.Found, awaitsVillage: true }
        : undefined
}

function planFoundingStep(
    { board, playerId, coords, tilesAvailable }: CityPlacementInput,
    cityId: string
): CityPlacementPlan | undefined {
    const adjacentCityIds = board.adjacentCities(coords).map((city) => city.id)
    if (
        board.isOpenVillage(coords) ||
        !adjacentCityIds.includes(cityId) ||
        adjacentCityIds.some((adjacentId) => adjacentId !== cityId)
    ) {
        return undefined
    }

    const adjacentVillages = board.adjacentOpenVillages(coords)
    if (adjacentVillages.length > 1) {
        return undefined
    }
    const claimVillage = adjacentVillages[0]
    if (claimVillage) {
        return isFoundingVillage(board, playerId, claimVillage) &&
            canClaimVillage(board, playerId, claimVillage, tilesAvailable)
            ? { kind: CityPlacementKind.Expand, cityIds: [cityId], claimVillage }
            : undefined
    }
    return tilesToFoundingVillage(board, playerId, coords, cityId) <= tilesAvailable
        ? { kind: CityPlacementKind.Expand, cityIds: [cityId] }
        : undefined
}

function canClaimVillage(
    board: HydratedBoard,
    playerId: string,
    village: AxialCoordinates,
    tilesAvailable: number
): boolean {
    return tilesAvailable >= 2 && !isForbiddenCitySpace(board, playerId, village)
}

function tilesToFoundingVillage(
    board: HydratedBoard,
    playerId: string,
    start: AxialCoordinates,
    foundingCityId?: string
): number {
    const tilesTo = new Map<number, number>([[spaceKey(start), 1]])
    const queue: AxialCoordinates[] = [start]
    for (let next = queue.shift(); next; next = queue.shift()) {
        const tiles = tilesTo.get(spaceKey(next)) ?? 0
        const [claimVillage] = board.adjacentOpenVillages(next)
        if (claimVillage) {
            return tiles + 1
        }
        for (const neighbor of neighborsOf(next)) {
            if (
                !tilesTo.has(spaceKey(neighbor)) &&
                isFoundingPathSpace(board, playerId, neighbor, foundingCityId)
            ) {
                tilesTo.set(spaceKey(neighbor), tiles + 1)
                queue.push(neighbor)
            }
        }
    }
    return Number.POSITIVE_INFINITY
}

function isFoundingPathSpace(
    board: HydratedBoard,
    playerId: string,
    coords: AxialCoordinates,
    foundingCityId?: string
): boolean {
    if (
        board.isOpenVillage(coords) ||
        isForbiddenCitySpace(board, playerId, coords) ||
        board.adjacentCities(coords).some((city) => city.id !== foundingCityId)
    ) {
        return false
    }
    const villages = board.adjacentOpenVillages(coords)
    return (
        villages.length === 0 ||
        (villages.length === 1 &&
            isFoundingVillage(board, playerId, villages[0]) &&
            !isForbiddenCitySpace(board, playerId, villages[0]))
    )
}

function neighborsOf(coords: AxialCoordinates): AxialCoordinates[] {
    return ClockwisePointyHexDirections.map((direction) => neighborCoords(coords, direction))
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
