import { gsap } from 'gsap'
import type { Point } from '@tabletop/common'
import type { Fly, Hurl, HydratedSolGameState } from '@tabletop/sol'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { getSpaceCentroid } from '$lib/utils/boardGeometry.js'
import {
    getFlightDuration,
    getFlightPaths,
    getFlightPathsWithGateCrossings
} from '$lib/utils/flight.js'

export function getGateCrossingTimes({
    action,
    toState,
    fromState,
    gateLocations,
    gameSession
}: {
    action: Fly | Hurl
    toState: HydratedSolGameState
    fromState: HydratedSolGameState
    gateLocations: Map<number, Point>
    gameSession: SolGameSession
}): Map<number, number> {
    const flightPathCoords = action.metadata?.flightPath
    if (!flightPathCoords || flightPathCoords.length < 2) {
        return new Map()
    }

    const flightPaths = getFlightPathsWithGateCrossings({
        action,
        gameSession,
        playerId: action.playerId,
        pathCoords: flightPathCoords,
        toState,
        fromState
    })
    if (flightPaths.length === 0) {
        return new Map()
    }

    const gateTimes = new Map<number, number>()
    let legStart = 0

    const easeName = action.teleport ? 'power2.inOut' : 'power1.inOut'
    const ease = gsap.parseEase(easeName) as (t: number) => number

    for (const { points, gateCrossings } of flightPaths) {
        const legDuration = getFlightDuration(action, points.length)
        if (points.length < 2) {
            legStart += legDuration
            continue
        }

        const segmentLengths: number[] = []
        const cumulativeLengths: number[] = [0]
        for (let i = 0; i < points.length - 1; i++) {
            const length = getDistance(points[i], points[i + 1])
            segmentLengths.push(length)
            cumulativeLengths.push(cumulativeLengths[i] + length)
        }

        const totalLength = cumulativeLengths.at(-1) ?? 0
        if (totalLength <= 0) {
            legStart += legDuration
            continue
        }

        for (const [gateKey, index] of gateCrossings) {
            if (gateTimes.has(gateKey)) {
                continue
            }
            const gateLocation = gateLocations.get(gateKey)
            if (!gateLocation) {
                continue
            }
            if (index < 0 || index >= points.length - 1) {
                continue
            }

            const startPoint = points[index]
            const segmentLength = segmentLengths[index]
            const distanceToGate =
                segmentLength > 0
                    ? Math.min(
                          segmentLength,
                          Math.max(0, getDistance(startPoint, gateLocation))
                      )
                    : 0
            const distanceAlongPath = cumulativeLengths[index] + distanceToGate
            const progress = distanceAlongPath / totalLength
            const timeFraction = invertEase(ease, progress)
            gateTimes.set(gateKey, legStart + legDuration * timeFraction)
        }

        legStart += legDuration
    }

    return gateTimes
}

export function getFlyOrHurlArrivalTime({
    action,
    toState,
    fromState,
    gameSession
}: {
    action: Fly | Hurl
    toState: HydratedSolGameState
    fromState: HydratedSolGameState
    gameSession: SolGameSession
}): number {
    const flightPathCoords = action.metadata?.flightPath
    if (!flightPathCoords || flightPathCoords.length < 2) {
        return 0
    }

    const flightPaths = getFlightPaths({
        action,
        gameSession,
        playerId: action.playerId,
        pathCoords: flightPathCoords,
        toState,
        fromState
    })
    if (flightPaths.length === 0) {
        return 0
    }

    let totalDuration = 0
    for (const flightLeg of flightPaths) {
        totalDuration += getFlightDuration(action, flightLeg.length)
    }

    const delayBetween = 0.3
    const maxIndex = Math.max(0, action.sundiverIds.length - 1)
    return totalDuration + maxIndex * delayBetween * flightPaths.length
}

export function getFlyOrHurlEndLocation({
    action,
    toState,
    gameSession
}: {
    action: Fly | Hurl
    toState: HydratedSolGameState
    gameSession: SolGameSession
}): Point {
    const destinationCell = toState.board.cellAt(action.destination)
    const location = action.stationId
        ? gameSession.locationForStationInCell(destinationCell)
        : gameSession.locationForDiverInCell(action.playerId, destinationCell)

    return location ?? getSpaceCentroid(gameSession.numPlayers, action.destination)
}

function invertEase(ease: (t: number) => number, progress: number): number {
    if (progress <= 0) {
        return 0
    }
    if (progress >= 1) {
        return 1
    }
    let low = 0
    let high = 1
    for (let i = 0; i < 20; i++) {
        const mid = (low + high) / 2
        if (ease(mid) < progress) {
            low = mid
        } else {
            high = mid
        }
    }
    return (low + high) / 2
}

function getDistance(a: Point, b: Point): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
}
