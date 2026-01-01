import {
    Activate,
    ActivateBonus,
    ActivateEffect,
    DrawCards,
    Fly,
    HydratedSolGameState,
    isSolarFlare,
    isActivate,
    isActivateBonus,
    isActivateEffect,
    isDrawCards,
    isFly,
    isHurl,
    StationType,
    SolarFlare,
    Hurl,
    CENTER_COORDS,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import { Point, range, type GameAction } from '@tabletop/common'
import { move, scale } from '$lib/utils/animations.js'
import { nanoid } from 'nanoid'
import {
    getCirclePoint,
    getGatePosition,
    getMothershipSpotPoint,
    getSpaceCentroid,
    offsetFromCenter,
    toRadians
} from '$lib/utils/boardGeometry.js'
import type { AnimationContext } from '@tabletop/frontend-components'
import { getFlightDuration, getFlightPaths, getFlightPathsWithGateCrossings } from '$lib/utils/flight.js'

export class MomentumAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private pentagons: Map<string, HTMLElement | SVGElement> = new Map()

    addPentagon(id: string, element: HTMLElement | SVGElement): void {
        this.pentagons.set(id, element)
    }

    removePentagon(id: string): void {
        this.pentagons.delete(id)
    }

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action: GameAction
        animationContext: AnimationContext
    }) {
        if (isActivate(action) || isActivateBonus(action)) {
            await this.animateActivate(action, animationContext.actionTimeline, from)
        } else if (isActivateEffect(action)) {
            await this.animateActivateEffect(action, animationContext.actionTimeline, from)
        } else if (isDrawCards(action)) {
            await this.animateDrawCards(action, animationContext.actionTimeline, from)
        } else if (isFly(action) || isHurl(action)) {
            await this.animateFlyOrHurl(action, animationContext.actionTimeline, to, from)
        } else if (isSolarFlare(action)) {
            await this.animateSolarFlare(action, animationContext.actionTimeline, from)
        }
    }

    async animateActivate(
        action: Activate | ActivateBonus,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const numMomentum = action.metadata?.momentumAdded ?? 0
        if (numMomentum <= 0) {
            return
        }

        const stationId = isActivate(action) ? action.stationId : action.metadata?.stationId
        if (!stationId) {
            return
        }

        const station = fromState.board.findStation(stationId)
        if (!station || station.type !== StationType.TransmitTower || !station.coords) {
            return
        }

        const stationCell = fromState.board.cellAt(station.coords)
        const stationLocation = this.gameSession.locationForStationInCell(stationCell)
        if (!stationLocation) {
            return
        }

        await this.animateMomentumFromLocation(
            action.playerId,
            numMomentum,
            stationLocation,
            timeline,
            fromState
        )
    }

    async animateActivateEffect(
        action: ActivateEffect,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.metadata?.coords) {
            return
        }

        const numMomentum = action.metadata.momentumAdded ?? 0
        if (numMomentum <= 0) {
            return
        }

        const stationCell = fromState.board.cellAt(action.metadata.coords)
        const station = stationCell.station
        if (!station || station.type !== StationType.TransmitTower) {
            return
        }

        const stationLocation = this.gameSession.locationForStationInCell(stationCell)
        if (!stationLocation) {
            return
        }

        await this.animateMomentumFromLocation(
            action.playerId,
            numMomentum,
            stationLocation,
            timeline,
            fromState
        )
    }

    async animateDrawCards(
        action: DrawCards,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.metadata?.coords) {
            return
        }

        const numMomentum = action.metadata.momentumAdded ?? 0
        if (numMomentum <= 0) {
            return
        }

        const stationCell = fromState.board.cellAt(action.metadata.coords)
        const station = stationCell.station
        if (!station || station.type !== StationType.TransmitTower) {
            return
        }

        const stationLocation = this.gameSession.locationForStationInCell(stationCell)
        if (!stationLocation) {
            return
        }

        await this.animateMomentumFromLocation(
            action.playerId,
            numMomentum,
            stationLocation,
            timeline,
            fromState
        )
    }

    async animateSolarFlare(
        action: SolarFlare,
        timeline: gsap.core.Timeline,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const hurlBonusPlayerId = action.metadata?.hurlBonus
        if (!hurlBonusPlayerId) {
            return
        }

        const startLocation = getSpaceCentroid(this.gameSession.numPlayers, CENTER_COORDS)
        await this.animateMomentumFromLocation(
            hurlBonusPlayerId,
            1,
            startLocation,
            timeline,
            fromState
        )
    }

    async animateFlyOrHurl(
        action: Fly | Hurl,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const totalMomentum = action.metadata?.momentumGained ?? 0
        const passageCount = action.metadata?.passage
            ? Math.min(action.gates.length, totalMomentum)
            : 0
        const remainingMomentum = Math.max(0, totalMomentum - passageCount)

        if (passageCount === 0 && remainingMomentum === 0) {
            return
        }

        type MomentumMove = { from: Point; startTime: number }
        const momentumMoves: MomentumMove[] = []

        if (passageCount > 0) {
            const gateLocations = new Map<number, Point>()
            for (const gate of action.gates) {
                if (!gate.innerCoords || !gate.outerCoords) {
                    continue
                }
                const gateKey = fromState.board.gateKey(gate.innerCoords, gate.outerCoords)
                if (!gateLocations.has(gateKey)) {
                    const gatePosition = getGatePosition(
                        this.gameSession.numPlayers,
                        gate.innerCoords,
                        gate.outerCoords
                    )
                    gateLocations.set(
                        gateKey,
                        getCirclePoint(gatePosition.radius, toRadians(gatePosition.angle))
                    )
                }
            }

            const gateCrossingTimes = this.getGateCrossingTimes(
                action,
                toState,
                fromState,
                gateLocations
            )

            let remainingPassage = passageCount
            for (const gate of action.gates) {
                if (remainingPassage <= 0) {
                    break
                }
                if (!gate.innerCoords || !gate.outerCoords) {
                    continue
                }
                const gateKey = fromState.board.gateKey(gate.innerCoords, gate.outerCoords)
                const gateLocation = gateLocations.get(gateKey)
                if (!gateLocation) {
                    continue
                }
                const startTime = gateCrossingTimes.get(gateKey) ?? 0
                momentumMoves.push({ from: gateLocation, startTime })
                remainingPassage -= 1
            }
        }

        if (remainingMomentum > 0) {
            const startLocation = this.getFlyOrHurlEndLocation(action, toState)
            const startTime = this.getFlyOrHurlArrivalTime(action, toState, fromState)
            const delayBetween = 0.2
            for (let i = 0; i < remainingMomentum; i++) {
                momentumMoves.push({
                    from: startLocation,
                    startTime: startTime + delayBetween * i
                })
            }
        }

        if (momentumMoves.length === 0) {
            return
        }

        this.gameSession.movingMomentumIds = range(0, momentumMoves.length).map(() => nanoid())
        await tick()

        const moveDuration = 1
        const scaleDuration = 0.1
        const moveOffset = scaleDuration / 2

        const pentagonElements = Array.from(this.pentagons.values())
        for (const pentagon of pentagonElements) {
            gsap.set(pentagon, {
                opacity: 0,
                scale: 0,
                transformOrigin: '50% 50%'
            })
        }

        const mothershipLocation = this.getMothershipLocationForPlayer(fromState, action.playerId)
        let maxEndTime = 0
        for (let i = 0; i < momentumMoves.length; i++) {
            const pentagon = pentagonElements[i]
            if (!pentagon) {
                continue
            }
            const moveTarget = momentumMoves[i]
            const position = moveTarget.startTime

            timeline.set(
                pentagon,
                {
                    opacity: 1,
                    x: offsetFromCenter(moveTarget.from).x,
                    y: offsetFromCenter(moveTarget.from).y
                },
                position
            )

            scale({
                object: pentagon,
                to: 1,
                duration: scaleDuration,
                ease: 'power2.in',
                timeline,
                position
            })

            move({
                object: pentagon,
                location: offsetFromCenter(mothershipLocation),
                timeline,
                duration: moveDuration,
                position: position + moveOffset
            })

            const endTime = position + moveOffset + moveDuration
            if (endTime > maxEndTime) {
                maxEndTime = endTime
            }
        }

        timeline.call(
            () => {
                this.gameSession.movingMomentumIds = []
            },
            [],
            maxEndTime
        )
    }

    private async animateMomentumFromLocation(
        playerId: string,
        numMomentum: number,
        startLocation: Point,
        timeline: gsap.core.Timeline,
        fromState: HydratedSolGameState
    ) {
        this.gameSession.movingMomentumIds = range(0, numMomentum).map(() => nanoid())
        await tick()

        const delayBetween = 0.2
        const moveDuration = 1
        const scaleDuration = 0.1
        const moveOffset = scaleDuration / 2
        const startTime = 0

        const pentagonElements = Array.from(this.pentagons.values())
        for (const pentagon of pentagonElements) {
            gsap.set(pentagon, {
                opacity: 0,
                scale: 0,
                transformOrigin: '50% 50%'
            })
        }

        const mothershipLocation = this.getMothershipLocationForPlayer(fromState, playerId)
        let i = 0
        for (const pentagon of pentagonElements) {
            const position = startTime + delayBetween * i
            timeline.set(
                pentagon,
                {
                    opacity: 1,
                    x: offsetFromCenter(startLocation).x,
                    y: offsetFromCenter(startLocation).y
                },
                position
            )

            scale({
                object: pentagon,
                to: 1,
                duration: scaleDuration,
                ease: 'power2.in',
                timeline,
                position
            })

            move({
                object: pentagon,
                location: offsetFromCenter(mothershipLocation),
                timeline,
                duration: moveDuration,
                position: position + moveOffset
            })
            i++
        }

        const lastStart = startTime + delayBetween * (numMomentum - 1) + moveOffset
        timeline.call(
            () => {
                this.gameSession.movingMomentumIds = []
            },
            [],
            lastStart + moveDuration
        )
    }

    getMothershipLocationForPlayer(gameState: HydratedSolGameState, playerId: string): Point {
        const mothershipIndex = gameState.board.motherships[playerId]
        const spotPoint = getMothershipSpotPoint(gameState.players.length, mothershipIndex)

        return {
            x: spotPoint.x,
            y: spotPoint.y
        }
    }

    private getFlyOrHurlArrivalTime(
        action: Fly | Hurl,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState
    ): number {
        const flightPathCoords = action.metadata?.flightPath
        if (!flightPathCoords || flightPathCoords.length < 2) {
            return 0
        }

        const flightPaths = getFlightPaths({
            action,
            gameSession: this.gameSession,
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

    private getFlyOrHurlEndLocation(action: Fly | Hurl, toState: HydratedSolGameState): Point {
        const destinationCell = toState.board.cellAt(action.destination)
        const location = action.stationId
            ? this.gameSession.locationForStationInCell(destinationCell)
            : this.gameSession.locationForDiverInCell(action.playerId, destinationCell)

        return location ?? getSpaceCentroid(this.gameSession.numPlayers, action.destination)
    }

    private getGateCrossingTimes(
        action: Fly | Hurl,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState,
        gateLocations: Map<number, Point>
    ): Map<number, number> {
        const flightPathCoords = action.metadata?.flightPath
        if (!flightPathCoords || flightPathCoords.length < 2) {
            return new Map()
        }

        const flightPaths = getFlightPathsWithGateCrossings({
            action,
            gameSession: this.gameSession,
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
                const length = this.getDistance(points[i], points[i + 1])
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
                              Math.max(0, this.getDistance(startPoint, gateLocation))
                          )
                        : 0
                const distanceAlongPath = cumulativeLengths[index] + distanceToGate
                const progress = distanceAlongPath / totalLength
                const timeFraction = this.invertEase(ease, progress)
                gateTimes.set(gateKey, legStart + legDuration * timeFraction)
            }

            legStart += legDuration
        }

        return gateTimes
    }

    private invertEase(ease: (t: number) => number, progress: number): number {
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

    private getDistance(a: Point, b: Point): number {
        const dx = a.x - b.x
        const dy = a.y - b.y
        return Math.sqrt(dx * dx + dy * dy)
    }
}

export function animateMomentum(
    node: HTMLElement | SVGElement,
    params: { animator: MomentumAnimator; momentumId: string }
): { destroy: () => void } {
    params.animator.addPentagon(params.momentumId, node)
    return {
        destroy() {
            params.animator.removePentagon(params.momentumId)
        }
    }
}
