import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import type { OffsetCoordinates, Point } from '@tabletop/common'
import {
    EffectType,
    type Fly,
    type Hurl,
    type HydratedSolGameBoard,
    type HydratedSolGameState
} from '@tabletop/sol'
import {
    dimensionsForSpace,
    getCirclePoint,
    getGatePosition,
    getMothershipSpotPoint,
    getSpaceCentroid,
    toRadians
} from '$lib/utils/boardGeometry.js'

export function getFlightPaths({
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
}): Point[][] {
    const board = fromState.board
    const transcend = fromState.activeEffect === EffectType.Transcend
    let flightLegs: OffsetCoordinates[][] = action.teleport
        ? [pathCoords]
        : getFlightLegs(pathCoords, board, transcend)

    // console.log(flightLegs)

    // First leg cannot start at a mothership
    const flightPaths: Point[][] = []
    flightLegs.forEach((leg, i) => {
        const path = getFlightPath({
            action,
            gameSession,
            playerId,
            pathCoords: leg,
            toState: i < flightLegs.length - 1 ? fromState : toState, // Only last leg is going to toState
            fromState
        })
        // console.log('path before', [...path])
        if (i < flightLegs.length - 1) {
            // Ends at mothership
            const mothership = fromState.findAdjacentMothership(leg.at(-1)!) ?? playerId
            const mothershipIndex = board.motherships[mothership]
            const mothershipLocation = getMothershipSpotPoint(
                gameSession.numPlayers,
                mothershipIndex
            )
            path.push(mothershipLocation)
        } else if (i > 0) {
            // Starts at mothership
            const mothership = toState.findAdjacentMothership(leg.at(0)!) ?? playerId
            const mothershipIndex = board.motherships[mothership]
            const mothershipLocation = getMothershipSpotPoint(
                gameSession.numPlayers,
                mothershipIndex
            )
            path.unshift(mothershipLocation)
        }
        // console.log('Path after', [...path])
        flightPaths.push(path)
        i++
    })
    // console.log('flightPaths', flightPaths)
    return flightPaths
}

function getFlightLegs(
    pathCoords: OffsetCoordinates[],
    board: HydratedSolGameBoard,
    transcend: boolean = false
): OffsetCoordinates[][] {
    let flightLegs: OffsetCoordinates[][] = []

    let currentFlightLeg: OffsetCoordinates[] = []
    for (const coord of pathCoords) {
        const lastCoord = currentFlightLeg.at(-1)
        if (!lastCoord) {
            currentFlightLeg.push(coord)
            continue
        }

        if (board.areAdjacent(lastCoord, coord, transcend)) {
            currentFlightLeg.push(coord)
            continue
        }

        flightLegs.push(currentFlightLeg)
        currentFlightLeg = [coord]
    }
    if (currentFlightLeg.length > 0) {
        flightLegs.push(currentFlightLeg)
    }

    return flightLegs
}

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

    // Special case that arises during portal second leg
    if (pathCoords.length === 1) {
        const coords = pathCoords[0]
        const cell = toState.board.cellAt(coords)
        const location = action.stationId
            ? gameSession.locationForStationInCell(cell)
            : gameSession.locationForDiverInCell(playerId, cell)
        if (location) {
            flightPath.push(location)
        } else {
            flightPath.push(getSpaceCentroid(gameSession.numPlayers, coords))
        }
        return flightPath
    }

    let hadGate = false
    for (let i = 0; i < pathCoords.length; i++) {
        const coords = pathCoords[i]

        let hasGate = false
        let location: Point | undefined
        if (i === 0) {
            const cell = fromState.board.cellAt(coords)
            // console.log('First coord', coords, cell)
            location = action.stationId
                ? gameSession.locationForStationInCell(cell)
                : gameSession.locationForDiverInCell(playerId, cell)
            // console.log('Location', location)
            if (location) {
                flightPath.push(location)
            }
        } else if (i === pathCoords.length - 1) {
            const cell = toState.board.cellAt(coords)
            location = action.stationId
                ? gameSession.locationForStationInCell(cell)
                : gameSession.locationForDiverInCell(playerId, cell)
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
