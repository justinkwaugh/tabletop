import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import type { OffsetCoordinates, Point } from '@tabletop/common'
import type { Fly, Hurl, HydratedSolGameState } from '@tabletop/sol'
import {
    dimensionsForSpace,
    getCirclePoint,
    getGatePosition,
    getSpaceCentroid,
    toRadians
} from './boardGeometry.js'

export function getFlightPath({
    action,
    gameSession,
    playerId,
    pathCoords,
    toState,
    fromState
}: {
    action: Fly | Hurl
    gameSession: SolGameSession
    playerId: string
    pathCoords: OffsetCoordinates[]
    toState: HydratedSolGameState
    fromState: HydratedSolGameState
}): Point[] {
    const flightPath: Point[] = []

    let hadGate = false
    for (let i = 0; i < pathCoords.length; i++) {
        const coords = pathCoords[i]

        let hasGate = false
        let location: Point | undefined
        if (i === 0) {
            const cell = fromState.board.cellAt(coords)
            if (action.stationId) {
                console.log('using station location')
                location = gameSession.locationForStationInCell(cell)
            } else {
                location = gameSession.locationForDiverInCell(playerId, cell)
            }
            if (location) {
                flightPath.push(location)
            }
        } else if (i === pathCoords.length - 1) {
            const cell = toState.board.cellAt(coords)
            if (action.stationId) {
                console.log('using station location')
                location = gameSession.locationForStationInCell(cell)
            } else {
                location = gameSession.locationForDiverInCell(playerId, cell)
            }
            if (location) {
                flightPath.push(location)
            }
        }

        if (i < pathCoords.length - 1) {
            const nextCoords = pathCoords[i + 1]
            if (fromState.board.hasGateBetween(coords, nextCoords)) {
                hasGate = true
                const gatePosition = getGatePosition(gameSession.numPlayers, coords, nextCoords)

                const firstDimensions = dimensionsForSpace(gameSession.numPlayers, coords)
                const firstOffset = (firstDimensions.outerRadius - firstDimensions.innerRadius) / 4

                const secondDimensions = dimensionsForSpace(gameSession.numPlayers, nextCoords)
                const secondOffset =
                    (secondDimensions.outerRadius - secondDimensions.innerRadius) / 4

                if (coords.row > nextCoords.row) {
                    // Moving inward
                    flightPath.push(
                        getCirclePoint(
                            gatePosition.radius + firstOffset,
                            toRadians(gatePosition.angle)
                        )
                    )
                    flightPath.push(
                        getCirclePoint(
                            gatePosition.radius - secondOffset,
                            toRadians(gatePosition.angle)
                        )
                    )
                } else {
                    // Moving outward
                    flightPath.push(
                        getCirclePoint(
                            gatePosition.radius - firstOffset,
                            toRadians(gatePosition.angle)
                        )
                    )
                    flightPath.push(
                        getCirclePoint(
                            gatePosition.radius + secondOffset,
                            toRadians(gatePosition.angle)
                        )
                    )
                }
            } else if (!location && !hadGate && !hasGate) {
                location = getSpaceCentroid(gameSession.numPlayers, coords)
                flightPath.push(location)
            }
            hadGate = hasGate
        }
    }

    return flightPath
}

export function getFlightDuration(action: Fly | Hurl, pathLength: number): number {
    if (action.teleport) {
        return 1.5
    }
    const duration = Math.min(2, Math.max(1, pathLength * 0.3))

    if (action.stationId) {
        return duration * 3
    } else {
        return duration
    }
}
