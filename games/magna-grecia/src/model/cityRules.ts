import {
    ClockwisePointyHexDirections,
    sameCoordinates,
    type AxialCoordinates
} from '@tabletop/common'
import { BOARD_GRID, neighborCoords, spaceKey } from '../components/boardGrid.js'
import type { HydratedBoard } from './board.js'
import { PendingCityKind, type TurnProgress } from './turn.js'

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

    switch (turn.pendingCity?.kind) {
        case PendingCityKind.Claim: {
            const { village, cityId, founding } = turn.pendingCity
            return sameCoordinates(village, coords)
                ? { kind: CityPlacementKind.CompleteClaim, cityId, founding }
                : undefined
        }
        case PendingCityKind.Founding:
            return planFoundingStep(input, turn.pendingCity.cityId)
    }

    const adjacentVillages = board.adjacentOpenVillages(coords)
    if (adjacentVillages.length > 1) {
        return undefined
    }

    if (board.isOpenVillage(coords)) {
        return !turn.foundedCity && isFoundingAnchor(board, playerId, coords)
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
    const anchored = isFoundingAnchor(board, playerId, coords)
    if (claimVillage) {
        return anchored || isFoundingAnchor(board, playerId, claimVillage)
            ? { kind: CityPlacementKind.Found, claimVillage }
            : undefined
    }
    return tilesToCompleteFounding(board, playerId, coords, anchored) <= tilesAvailable
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
    const anchored =
        board.city(cityId).spaces.some((space) => isFoundingAnchor(board, playerId, space)) ||
        isFoundingAnchor(board, playerId, coords)
    const claimVillage = adjacentVillages[0]
    if (claimVillage) {
        return canClaimVillage(board, playerId, claimVillage, tilesAvailable) &&
            (anchored || isFoundingAnchor(board, playerId, claimVillage))
            ? { kind: CityPlacementKind.Expand, cityIds: [cityId], claimVillage }
            : undefined
    }
    return tilesToCompleteFounding(board, playerId, coords, anchored, cityId) <= tilesAvailable
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

function tilesToCompleteFounding(
    board: HydratedBoard,
    playerId: string,
    start: AxialCoordinates,
    startAnchored: boolean,
    foundingCityId?: string
): number {
    type Step = { coords: AxialCoordinates; anchored: boolean; tiles: number }
    const stepKey = (coords: AxialCoordinates, anchored: boolean) =>
        spaceKey(coords) * 2 + (anchored ? 1 : 0)
    const seen = new Set<number>([stepKey(start, startAnchored)])
    const queue: Step[] = [{ coords: start, anchored: startAnchored, tiles: 1 }]
    for (let step = queue.shift(); step; step = queue.shift()) {
        const [claimVillage] = board.adjacentOpenVillages(step.coords)
        if (claimVillage) {
            if (step.anchored || isFoundingAnchor(board, playerId, claimVillage)) {
                return step.tiles + 1
            }
            continue
        }
        for (const neighbor of neighborsOf(step.coords)) {
            const anchored = step.anchored || isFoundingAnchor(board, playerId, neighbor)
            const key = stepKey(neighbor, anchored)
            if (!seen.has(key) && isFoundingPathSpace(board, playerId, neighbor, foundingCityId)) {
                seen.add(key)
                queue.push({ coords: neighbor, anchored, tiles: step.tiles + 1 })
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
        (villages.length === 1 && !isForbiddenCitySpace(board, playerId, villages[0]))
    )
}

function neighborsOf(coords: AxialCoordinates): AxialCoordinates[] {
    return ClockwisePointyHexDirections.map((direction) => neighborCoords(coords, direction))
}

export function isFoundingAnchor(
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
