import {
    Activate,
    ActivateBonus,
    ActivateEffect,
    DrawCards,
    Fly,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
    isActivateEffect,
    isDrawCards,
    isFly,
    isHurl,
    isLaunch,
    isTribute,
    Hurl,
    Launch,
    Tribute,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import { Point, range, type GameAction } from '@tabletop/common'
import { move } from '$lib/utils/animations.js'
import { nanoid } from 'nanoid'
import {
    getCirclePoint,
    getGatePosition,
    getMothershipSpotPoint,
    offsetFromCenter,
    toRadians
} from '$lib/utils/boardGeometry.js'
import type { AnimationContext } from '@tabletop/frontend-components'
import { getFlightDuration, getFlightPathsWithGateCrossings } from '$lib/utils/flight.js'

export class EnergyCubeAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private cubes: Map<string, HTMLElement | SVGElement> = new Map()

    addCube(id: string, element: HTMLElement | SVGElement): void {
        this.cubes.set(id, element)
    }

    removeCube(id: string): void {
        this.cubes.delete(id)
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
            await this.animateActivate(action, animationContext.actionTimeline, to, from)
        } else if (isActivateEffect(action)) {
            await this.animateActivateEffect(action, animationContext.actionTimeline, to, from)
        } else if (isDrawCards(action)) {
            await this.animateDrawCards(action, animationContext.actionTimeline, to, from)
        } else if (isLaunch(action)) {
            await this.animateLaunch(action, animationContext.actionTimeline, to)
        } else if (isTribute(action)) {
            await this.animateTribute(action, animationContext.actionTimeline, to, from)
        } else if (isFly(action) || isHurl(action)) {
            await this.animateGatePayments(action, animationContext.actionTimeline, to, from)
        }
    }

    async animateActivate(
        action: Activate | ActivateBonus,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const numCubes = action.metadata?.energyAdded ?? 0
        if (numCubes <= 0) {
            return
        }

        // Set the initial location of the cubes at the energy node
        const stationId = isActivate(action) ? action.stationId : action.metadata?.stationId
        if (!stationId) {
            return
        }
        const stationCoords = fromState.board.findStation(stationId)?.coords
        if (!stationCoords) {
            return
        }
        const stationCell = fromState?.board.cellAt(stationCoords)
        const stationLocation = this.gameSession.locationForStationInCell(stationCell)

        if (!stationLocation) {
            return
        }
        await this.animateEnergyFromLocation(
            action.playerId,
            numCubes,
            stationLocation,
            timeline,
            toState,
            fromState
        )
    }

    async animateActivateEffect(
        action: ActivateEffect,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.metadata?.coords) {
            return
        }

        const numCubes = action.metadata.energyAdded ?? 0
        if (numCubes <= 0) {
            return
        }

        const stationCell = fromState.board.cellAt(action.metadata.coords)
        const stationLocation = this.gameSession.locationForStationInCell(stationCell)
        if (!stationLocation) {
            return
        }

        await this.animateEnergyFromLocation(
            action.playerId,
            numCubes,
            stationLocation,
            timeline,
            toState,
            fromState
        )
    }

    async animateDrawCards(
        action: DrawCards,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.metadata?.coords) {
            return
        }

        const numCubes = action.metadata.energyAdded ?? 0
        if (numCubes <= 0) {
            return
        }

        const stationCell = fromState.board.cellAt(action.metadata.coords)
        const stationLocation = this.gameSession.locationForStationInCell(stationCell)
        if (!stationLocation) {
            return
        }

        await this.animateEnergyFromLocation(
            action.playerId,
            numCubes,
            stationLocation,
            timeline,
            toState,
            fromState
        )
    }

    async animateLaunch(
        action: Launch,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState
    ) {
        const numCubes = action.metadata?.energyGained ?? 0
        if (numCubes <= 0) {
            return
        }
        this.scheduleEnergyOverride(action.playerId, toState, timeline, 0)
    }

    private async animateEnergyFromLocation(
        playerId: string,
        numCubes: number,
        startLocation: Point,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (numCubes <= 0) {
            return
        }

        this.gameSession.movingCubeIds = range(0, numCubes).map(() => nanoid())
        await tick()

        const delayBetween = 0.2
        const moveDuration = 1
        const startTime = 0

        const cubeElements = Array.from(this.cubes.values())

        for (const cube of cubeElements) {
            gsap.set(cube, {
                x: offsetFromCenter(startLocation).x,
                y: offsetFromCenter(startLocation).y
            })
        }

        const mothershipLocation = this.getMothershipLocationForPlayer(
            fromState ?? toState,
            playerId
        )

        let i = 0
        for (const cube of cubeElements) {
            move({
                object: cube,
                location: offsetFromCenter(mothershipLocation),
                timeline,
                duration: moveDuration,
                position: startTime + delayBetween * i
            })
            i++
        }

        const endTime = startTime + moveDuration + delayBetween * (numCubes - 1)
        this.scheduleEnergyOverride(playerId, toState, timeline, endTime)

        timeline.call(
            () => {
                this.gameSession.movingCubeIds = []
            },
            [],
            endTime
        )
    }

    async animateTribute(
        tribute: Tribute,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !tribute.metadata) {
            return
        }

        const numCubes = Object.values(tribute.metadata.payments).reduce((a, b) => a + b, 0)
        this.gameSession.movingCubeIds = range(0, numCubes).map(() => nanoid())

        await tick()

        const toLocation = this.getMothershipLocationForPlayer(fromState, tribute.playerId)

        const delayBetween = 0.2
        const moveDuration = 1

        const cubesCopy = Array.from(this.cubes.values())
        let maxDuration = 0
        for (const [fromPlayerId, count] of Object.entries(tribute.metadata.payments)) {
            const startTime = 0

            const fromLocation = this.getMothershipLocationForPlayer(fromState, fromPlayerId)
            const cubeElements = cubesCopy.splice(0, count)

            for (const cube of cubeElements) {
                gsap.set(cube, {
                    x: offsetFromCenter(fromLocation).x,
                    y: offsetFromCenter(fromLocation).y
                })
            }

            let i = 0
            for (const cube of cubeElements) {
                move({
                    object: cube,
                    location: offsetFromCenter(toLocation),
                    timeline,
                    duration: moveDuration,
                    position: startTime + delayBetween * i
                })
                i++
            }

            const duration = moveDuration + delayBetween * (count - 1)
            if (duration > maxDuration) {
                maxDuration = duration
            }
        }

        for (const payerId of Object.keys(tribute.metadata.payments)) {
            this.scheduleEnergyOverride(payerId, toState, timeline, 0)
        }
        this.scheduleEnergyOverride(tribute.playerId, toState, timeline, maxDuration)

        timeline.call(
            () => {
                this.gameSession.movingCubeIds = []
            },
            [],
            maxDuration
        )
    }

    async animateGatePayments(
        action: Fly | Hurl,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const paidPlayerIds = action.metadata?.paidPlayerIds ?? []
        if (paidPlayerIds.length === 0 || action.gates.length === 0) {
            return
        }

        const gateByPlayerId = new Map<string, (typeof action.gates)[number]>()
        const gateLocations = new Map<number, Point>()
        for (const gate of action.gates) {
            if (!gateByPlayerId.has(gate.playerId)) {
                gateByPlayerId.set(gate.playerId, gate)
            }
            if (gate.innerCoords && gate.outerCoords) {
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
        }

        const gateCrossingTimes = this.getGateCrossingTimes(
            action,
            toState,
            fromState,
            gateLocations
        )
        const cubeMoves: { from: Point; to: Point; startTime: number; playerId: string }[] = []
        for (const playerId of paidPlayerIds) {
            const gate = gateByPlayerId.get(playerId)
            if (!gate?.innerCoords || !gate?.outerCoords) {
                continue
            }

            const gateKey = fromState.board.gateKey(gate.innerCoords, gate.outerCoords)
            const gatePosition = getGatePosition(
                this.gameSession.numPlayers,
                gate.innerCoords,
                gate.outerCoords
            )
            const gateLocation = getCirclePoint(gatePosition.radius, toRadians(gatePosition.angle))
            const mothershipLocation = this.getMothershipLocationForPlayer(fromState, playerId)
            const startTime = gateCrossingTimes.get(gateKey) ?? 0

            cubeMoves.push({ from: gateLocation, to: mothershipLocation, startTime, playerId })
        }

        if (cubeMoves.length === 0) {
            return
        }

        this.gameSession.movingCubeIds = range(0, cubeMoves.length).map(() => nanoid())
        await tick()

        const moveDuration = 1

        const cubeElements = Array.from(this.cubes.values())
        let maxEndTime = 0
        for (let i = 0; i < cubeMoves.length; i++) {
            const cube = cubeElements[i]
            if (!cube) {
                continue
            }
            const moveTarget = cubeMoves[i]

            gsap.set(cube, { opacity: 0 })
            timeline.set(
                cube,
                {
                    opacity: 1,
                    x: offsetFromCenter(moveTarget.from).x,
                    y: offsetFromCenter(moveTarget.from).y
                },
                moveTarget.startTime
            )

            move({
                object: cube,
                location: offsetFromCenter(moveTarget.to),
                timeline,
                duration: moveDuration,
                position: moveTarget.startTime
            })

            const endTime = moveTarget.startTime + moveDuration
            this.scheduleEnergyOverride(moveTarget.playerId, toState, timeline, endTime)
            if (endTime > maxEndTime) {
                maxEndTime = endTime
            }
        }

        timeline.call(
            () => {
                this.gameSession.movingCubeIds = []
            },
            [],
            maxEndTime
        )
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

    getMothershipLocationForPlayer(gameState: HydratedSolGameState, playerId: string): Point {
        const mothershipIndex = gameState.board.motherships[playerId]
        const spotPoint = getMothershipSpotPoint(gameState.players.length, mothershipIndex)

        return {
            x: spotPoint.x,
            y: spotPoint.y
        }
    }

    private scheduleEnergyOverride(
        playerId: string,
        gameState: HydratedSolGameState,
        timeline: gsap.core.Timeline,
        time: number
    ) {
        timeline.call(
            () => {
                const energyCubes = gameState.getPlayerState(playerId).energyCubes
                const existing = this.gameSession.playerStateOverrides.get(playerId) ?? {}
                this.gameSession.playerStateOverrides.set(playerId, { ...existing, energyCubes })
            },
            [],
            time
        )
    }
}

export function animateCube(
    node: HTMLElement | SVGElement,
    params: { animator: EnergyCubeAnimator; cubeId: string }
): { destroy: () => void } {
    params.animator.addCube(params.cubeId, node)
    return {
        destroy() {
            params.animator.removeCube(params.cubeId)
        }
    }
}
