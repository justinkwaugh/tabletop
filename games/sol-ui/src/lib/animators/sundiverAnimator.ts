import {
    Activate,
    ActivateBonus,
    ActivateEffect,
    Blight,
    CENTER_COORDS,
    Convert,
    DrawCards,
    EffectType,
    Hatch,
    Fly,
    Hurl,
    HydratedSolGameState,
    isActivate,
    isActivateBonus,
    isActivateEffect,
    isBlight,
    isConvert,
    isDrawCards,
    isHatch,
    isFly,
    isHurl,
    isLaunch,
    Launch,
    Sundiver,
    type SolGameState,
    HydratedSolPlayerState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import {
    GameAction,
    OffsetCoordinates,
    sameCoordinates,
    samePoint,
    type Point
} from '@tabletop/common'
import {
    getCirclePoint,
    getGatePosition,
    getMothershipSpotPoint,
    offsetFromCenter,
    toRadians
} from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { fadeOut, move, scale, path, fadeIn } from '$lib/utils/animations.js'
import { gsap } from 'gsap'
import type { AnimationContext } from '@tabletop/frontend-components'
import { getFlightDuration, getFlightPath, getFlightPaths } from '$lib/utils/flight.js'

type SetQuantityCallback = (quantity: number) => void

export class SundiverAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private quantityCallback?: SetQuantityCallback
    constructor(
        gameSession: SolGameSession,
        private id: string
    ) {
        super(gameSession)
    }

    setQuantityCallback(callback: SetQuantityCallback): void {
        this.quantityCallback = callback
    }

    override onAttach(): void {
        if (this.element) {
            gsap.set(this.element, { opacity: 0 })
        }
    }

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!this.element) {
            return
        }

        if (action) {
            this.animateAction(action, animationContext.actionTimeline, to, from)
            return
        }
        if (!from) {
            return
        }

        const toSundiver = Array.from(to.getAllSundivers()).find((diver) => diver.id === this.id)
        const fromSundiver = Array.from(from.getAllSundivers()).find(
            (diver) => diver.id === this.id
        )

        if (!toSundiver || !fromSundiver) {
            return
        }
        if (toSundiver.hold && fromSundiver.hold && toSundiver.hold === fromSundiver.hold) {
            return
        }
        if (toSundiver.reserve && fromSundiver.reserve) {
            return
        }

        const toLocation = this.getFallbackLocation(to, toSundiver)
        const fromLocation = this.getFallbackLocation(from, fromSundiver)

        if (!toLocation || !fromLocation || samePoint(toLocation, fromLocation)) {
            return
        }

        gsap.set(this.element, {
            opacity: 1,
            x: offsetFromCenter(fromLocation).x,
            y: offsetFromCenter(fromLocation).y
        })

        move({
            object: this.element,
            location: offsetFromCenter(toLocation),
            duration: 0.2,
            ease: 'power1.inOut',
            timeline: animationContext.actionTimeline,
            position: 0
        })

        fadeOut({
            object: this.element,
            duration: 0.1,
            timeline: animationContext.actionTimeline,
            position: '>'
        })
    }

    private getFallbackLocation(
        gameState: HydratedSolGameState,
        sundiver: Sundiver
    ): Point | undefined {
        if (sundiver.hold) {
            return this.getMothershipLocationForPlayer(gameState, sundiver.hold)
        }

        for (const cell of gameState.board) {
            const found = cell.sundivers.find((diver) => diver.id === sundiver.id)
            if (found) {
                return this.gameSession.locationForDiverInCell(found.playerId, cell)
            }
        }

        return
    }

    private scheduleHoldOffset(
        holderId: string,
        playerId: string,
        delta: number,
        fromState: HydratedSolGameState,
        timeline: gsap.core.Timeline,
        time: number
    ) {
        if (delta === 0) {
            return
        }
        const holdMap = this.buildHoldMap(fromState.getPlayerState(holderId))
        const currentCount = holdMap.get(playerId) ?? 0
        const nextCount = Math.max(0, currentCount + delta)
        if (nextCount > 0) {
            holdMap.set(playerId, nextCount)
        } else {
            holdMap.delete(playerId)
        }

        timeline.call(
            () => {
                const existing = this.gameSession.playerStateOverrides.get(holderId) ?? {}
                this.gameSession.playerStateOverrides.set(holderId, {
                    ...existing,
                    holdSundiversByPlayer: holdMap
                })
            },
            [],
            time
        )
    }

    private scheduleReserveOffset(
        playerId: string,
        delta: number,
        fromState: HydratedSolGameState,
        timeline: gsap.core.Timeline,
        time: number
    ) {
        if (delta === 0) {
            return
        }
        const reserveCount = fromState.getPlayerState(playerId).reserveSundivers.length
        const nextCount = Math.max(0, reserveCount + delta)
        timeline.call(
            () => {
                const existing = this.gameSession.playerStateOverrides.get(playerId) ?? {}
                this.gameSession.playerStateOverrides.set(playerId, {
                    ...existing,
                    reserveSundivers: nextCount
                })
            },
            [],
            time
        )
    }

    private buildHoldMap(playerState: HydratedSolPlayerState): Map<string, number> {
        const holdMap = new Map<string, number>()
        for (const [playerId, sundivers] of playerState.holdSundiversPerPlayer()) {
            if (sundivers.length > 0) {
                holdMap.set(playerId, sundivers.length)
            }
        }
        return holdMap
    }

    private getCreatedSundiverArrivalTime(count: number): number {
        if (count <= 0) {
            return 0
        }
        const moveDuration = 0.5
        const delayBetween = 0.2
        return moveDuration + delayBetween * (count - 1)
    }

    animateAction(
        action: GameAction,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (isConvert(action)) {
            this.animateConvertAction(action, timeline, toState, fromState)
        } else if (isActivate(action)) {
            this.animateActivateAction(action, timeline, toState, fromState)
        } else if (isActivateBonus(action)) {
            this.animateActivateBonusAction(action, timeline, toState, fromState)
        } else if (isLaunch(action)) {
            this.animateLaunchAction(action, timeline, toState, fromState)
        } else if (isFly(action) || isHurl(action)) {
            this.animateFlyOrHurlAction(action, timeline, toState, fromState)
        } else if (isActivateEffect(action)) {
            this.animateActivateEffectAction(action, timeline, toState, fromState)
        } else if (isDrawCards(action)) {
            this.animateDrawCardsAction(action, timeline, toState, fromState)
        } else if (isHatch(action)) {
            this.animateHatchAction(action, timeline, toState, fromState)
        } else if (isBlight(action)) {
            this.animateBlightAction(action, timeline, toState, fromState)
        }
    }

    animateLaunchAction(
        launch: Launch,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        const launchIndex = launch.metadata?.sundiverIds.indexOf(this.id)
        if (launchIndex === undefined || launchIndex < 0) {
            return
        }
        if (launchIndex === 0 && fromState) {
            this.scheduleHoldOffset(
                launch.mothership,
                launch.playerId,
                -launch.numSundivers,
                fromState,
                timeline,
                0
            )
        }
        const board = toState.board

        // Determine which mothership, because portal can make it any
        const mothership = toState.findAdjacentMothership(launch.destination) ?? launch.mothership
        const diverLocation = this.getMothershipLocationForPlayer(fromState ?? toState, mothership)

        const targetCell = board.cellAt(launch.destination)
        const targetLocation = this.gameSession.locationForDiverInCell(launch.playerId, targetCell)

        if (!diverLocation || !targetLocation) {
            return
        }

        const moveDuration = 0.5
        const delayBetween = 0.3

        // Appear... move... disappear
        gsap.set(this.element!, {
            opacity: 1,
            scale: 0,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        scale({
            object: this.element,
            to: 1,
            duration: 0.1,
            ease: 'power2.in',
            timeline,
            position: launchIndex * 0.2
        })

        move({
            object: this.element,
            location: offsetFromCenter(targetLocation),
            duration: moveDuration,
            ease: 'power2.out',
            timeline,
            position: launchIndex * delayBetween
        })
        fadeOut({
            object: this.element,
            duration: 0,
            timeline,
            position: '>'
        })
    }

    animateFlyOrHurlAction(
        fly: Fly | Hurl,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }
        const index = fly.sundiverIds.indexOf(this.id)
        if (index === -1) {
            return
        }

        const flightPathCoords = structuredClone(fly.metadata?.flightPath)
        if (!flightPathCoords || flightPathCoords.length < 2) {
            return
        }

        const flightPaths = getFlightPaths({
            action: fly,
            gameSession: this.gameSession,
            playerId: fly.playerId,
            pathCoords: flightPathCoords,
            toState,
            fromState
        })

        if (flightPaths.length === 0) {
            return
        }

        let flightLegStart = 0

        for (const flightLeg of flightPaths) {
            const flightDuration = getFlightDuration(fly, flightLeg.length)
            const [startLocation, ...pathPoints] = flightLeg
            if (!startLocation) {
                continue
            }

            const delayBetween = 0.3
            const flightStart = flightLegStart + index * delayBetween

            // Appear... move... disappear
            timeline.set(
                this.element!,
                {
                    opacity: 1,
                    x: offsetFromCenter(startLocation).x,
                    y: offsetFromCenter(startLocation).y
                },
                flightStart
            )

            if (fly.teleport) {
                fadeOut({
                    object: this.element,
                    duration: 0.3,
                    timeline,
                    position: flightStart + 0.2
                })
                fadeIn({
                    object: this.element,
                    duration: 0.3,
                    timeline,
                    position: flightStart + flightDuration - 0.5
                })
            }

            path({
                object: this.element,
                path: pathPoints.map((loc) => offsetFromCenter(loc)),
                curviness: 1,
                duration: flightDuration,
                ease: fly.teleport ? 'power2.inOut' : 'power1.inOut',
                timeline,
                position: flightStart
            })

            if (samePoint(pathPoints.at(-1), { x: 0, y: 0 })) {
                // Special case for center space - just fade out
                fadeOut({
                    object: this.element!,
                    duration: 0.3,
                    timeline,
                    position: '>'
                })
            } else {
                timeline.set(
                    this.element!,
                    {
                        opacity: 0
                    },
                    '>'
                )
            }
            flightLegStart = flightStart + flightDuration
        }
    }

    animateHatchAction(
        action: Hatch,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.metadata?.replacedSundiver) {
            return
        }

        if (action.metadata.replacedSundiver.id !== this.id) {
            return
        }

        const addedCount = action.metadata.addedSundivers.length

        this.scheduleHoldOffset(
            action.targetPlayerId,
            action.targetPlayerId,
            1,
            fromState,
            timeline,
            1
        )
        this.scheduleReserveOffset(action.playerId, -addedCount, fromState, timeline, 0)

        const startCell = fromState.board.cellAt(action.coords)
        const startLocation = startCell
            ? this.gameSession.locationForDiverInCell(action.targetPlayerId, startCell)
            : undefined
        const targetLocation = this.getMothershipLocationForPlayer(
            fromState ?? toState,
            action.targetPlayerId
        )

        if (!startLocation || !targetLocation) {
            return
        }

        const leaveStart = 0.5

        gsap.set(this.element!, {
            opacity: 1,
            x: offsetFromCenter(startLocation).x,
            y: offsetFromCenter(startLocation).y
        })

        move({
            object: this.element,
            location: offsetFromCenter(targetLocation),
            duration: 0.5,
            ease: 'power2.in',
            timeline,
            position: leaveStart
        })

        fadeOut({
            object: this.element!,
            duration: 0.1,
            timeline,
            position: '>'
        })
    }

    animateConvertAction(
        convert: Convert,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!convert.sundiverIds.includes(this.id)) {
            return
        }
        if (fromState && convert.sundiverIds[0] === this.id) {
            if (fromState.activeEffect === EffectType.Cascade) {
                const sundiverCount = convert.sundiverIds.length
                const holdTime = 1 + 0.2 * Math.max(0, sundiverCount - 1)
                this.scheduleHoldOffset(
                    convert.playerId,
                    convert.playerId,
                    sundiverCount,
                    fromState,
                    timeline,
                    holdTime
                )
            } else {
                const sundiverCount = convert.sundiverIds.length
                this.scheduleReserveOffset(
                    convert.playerId,
                    sundiverCount,
                    fromState,
                    timeline,
                    0.5
                )
            }
        }

        const toBoard = toState.board
        const fromBoard = fromState?.board

        if (!fromBoard) {
            return
        }

        const diverCoords = fromBoard.findSundiverCoords(this.id)
        const diverCell = fromBoard.cellAt(diverCoords!)
        const diverLocation = this.gameSession.locationForDiverInCell(convert.playerId, diverCell)

        let targetLocation: Point | undefined
        if (!convert.isGate) {
            const stationCell = toBoard.cellAt(convert.coords)
            targetLocation = this.gameSession.locationForStationInCell(stationCell)
        } else if (convert.innerCoords && convert.coords) {
            const gatePosition = getGatePosition(
                this.gameSession.numPlayers,
                convert.innerCoords,
                convert.coords
            )
            targetLocation = getCirclePoint(gatePosition.radius, toRadians(gatePosition.angle))
        }
        if (!diverLocation || !targetLocation) {
            return
        }

        // Appear... move... disappear
        gsap.set(this.element!, {
            opacity: 1,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        move({
            object: this.element,
            location: offsetFromCenter(targetLocation),
            duration: 0.5,
            ease: 'power2.in',
            timeline,
            position: 0
        })

        if (fromState.activeEffect === EffectType.Cascade) {
            const targetLocation = this.getMothershipLocationForPlayer(
                fromState ?? toState,
                convert.playerId
            )

            const index = convert.sundiverIds.indexOf(this.id)
            if (targetLocation) {
                move({
                    object: this.element,
                    location: offsetFromCenter(targetLocation),
                    duration: 0.5,
                    ease: 'power2.in',
                    timeline,
                    position: '>' + (index > 0 ? '+' + index * 0.2 : '')
                })
            }
        }

        fadeOut({
            object: this.element!,
            duration: 0.1,
            timeline,
            position: '>'
        })
    }

    animateActivateAction(
        activate: Activate,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !activate.metadata) {
            return
        }

        const createdIds = activate.metadata.createdSundiverIds ?? []
        const createdCount = createdIds.length
        const returnCount = activate.metadata.sundiverId ? 1 : 0
        const isActivatingSundiver = activate.metadata.sundiverId === this.id
        const isCreatedSundiver = createdIds.includes(this.id)

        if (isCreatedSundiver || isActivatingSundiver) {
            this.animateCreatedSundivers(
                createdIds,
                activate.coords,
                activate.playerId,
                timeline,
                toState,
                fromState,
                returnCount + createdCount,
                -createdCount
            )
        }

        if (!isActivatingSundiver) {
            return
        }

        const fromBoard = fromState.board
        const toBoard = toState.board

        let diverLocation: Point | undefined
        let startOffset = 0

        // Activating sundiver starts in cell
        const diverCoords = fromBoard.findSundiverCoords(this.id)
        const diverCell = fromBoard.cellAt(diverCoords!)
        diverLocation = this.gameSession.locationForDiverInCell(activate.playerId, diverCell)

        const targetLocation = this.getMothershipLocationForPlayer(fromState, activate.playerId)

        if (!diverLocation || !targetLocation) {
            return
        }

        // Appear... move... disappear
        gsap.set(this.element!, {
            opacity: 1,
            scale: isActivatingSundiver ? 1 : 0,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        move({
            object: this.element,
            location: offsetFromCenter(targetLocation),
            duration: 0.5,
            ease: 'power2.in',
            timeline,
            position: startOffset
        })

        fadeOut({
            object: this.element!,
            duration: 0.1,
            timeline,
            position: '>'
        })
    }

    animateActivateBonusAction(
        activateBonus: ActivateBonus,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!activateBonus.metadata) {
            return
        }
        const createdIds = activateBonus.metadata.createdSundiverIds ?? []
        const createdCount = createdIds.length

        if (!createdIds.includes(this.id)) {
            return
        }

        this.animateCreatedSundivers(
            createdIds,
            activateBonus.metadata.coords,
            activateBonus.playerId,
            timeline,
            toState,
            fromState,
            createdCount,
            -createdCount
        )
    }

    animateActivateEffectAction(
        action: ActivateEffect,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (action.effect !== EffectType.Squeeze && action.effect !== EffectType.Augment) {
            return
        }

        if (!fromState || !action.metadata || !action.metadata.coords) {
            return
        }

        const createdIds = action.metadata.createdSundiverIds ?? []
        const createdCount = createdIds.length

        if (!createdIds.includes(this.id)) {
            return
        }

        this.animateCreatedSundivers(
            createdIds,
            action.metadata.coords,
            action.playerId,
            timeline,
            toState,
            fromState,
            createdCount,
            -createdCount
        )
    }

    animateDrawCardsAction(
        action: DrawCards,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (fromState?.activeEffect !== EffectType.Squeeze) {
            return
        }

        if (!fromState || !action.metadata || !action.metadata.coords) {
            return
        }

        const createdIds = action.metadata.createdSundiverIds ?? []
        const createdCount = createdIds.length

        if (!createdIds.includes(this.id)) {
            return
        }

        this.animateCreatedSundivers(
            createdIds,
            action.metadata.coords,
            action.playerId,
            timeline,
            toState,
            fromState,
            createdCount,
            -createdCount
        )
    }

    animateBlightAction(
        action: Blight,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !action.metadata?.sundiverId) {
            return
        }

        const activatingId = action.metadata.sundiverId
        const reserveDivers = fromState.getPlayerState(action.playerId).reserveSundivers
        const reserveIds = reserveDivers.slice(0, 3).map((diver) => diver.id)

        const isActivating = this.id === activatingId
        const reserveIndex = reserveIds.indexOf(this.id)
        const isReserveDiver = reserveIndex >= 0

        if (!isActivating && !isReserveDiver) {
            return
        }

        const actionMothership = this.getMothershipLocationForPlayer(fromState, action.playerId)
        const targetMothership = this.getMothershipLocationForPlayer(
            fromState,
            action.targetPlayerId
        )

        if (isActivating) {
            const startCell = fromState.board.cellAt(action.coords)
            const diverLocation = this.gameSession.locationForDiverInCell(action.playerId, startCell)
            if (!diverLocation || !actionMothership) {
                return
            }

            gsap.set(this.element!, {
                opacity: 1,
                x: offsetFromCenter(diverLocation).x,
                y: offsetFromCenter(diverLocation).y
            })

            const moveDuration = 0.5
            move({
                object: this.element,
                location: offsetFromCenter(actionMothership),
                duration: moveDuration,
                ease: 'power2.in',
                timeline,
                position: 0
            })

            fadeOut({
                object: this.element!,
                duration: 0.1,
                timeline,
                position: '>'
            })

            this.scheduleHoldOffset(action.playerId, action.playerId, 1, fromState, timeline, 0.5)
        }

        if (isReserveDiver) {
            if (!targetMothership) {
                return
            }
            const radius = 100
            const count = Math.max(1, reserveIds.length)
            const angle = -90 + (360 / count) * reserveIndex
            const startLocation = {
                x: targetMothership.x + radius * Math.cos(toRadians(angle)),
                y: targetMothership.y + radius * Math.sin(toRadians(angle))
            }

            const fadeDuration = 0.1
            const popDuration = 0.2
            const spiralDelay = 0.5
            const spiralDuration = 0.5
            const startTime = 0

            gsap.set(this.element!, {
                opacity: 0,
                scale: 0,
                transformOrigin: '50% 50%',
                x: offsetFromCenter(startLocation).x,
                y: offsetFromCenter(startLocation).y
            })

            fadeIn({
                object: this.element,
                duration: fadeDuration,
                timeline,
                position: startTime
            })

            scale({
                object: this.element,
                to: 1.5,
                duration: popDuration,
                ease: 'back.out(2)',
                timeline,
                position: startTime
            })

            scale({
                object: this.element,
                to: 1,
                duration: 0.2,
                ease: 'power2.out',
                timeline,
                position: startTime + popDuration
            })

            timeline.add(
                gsap.to(this.element, {
                    xPercent: 3,
                    yPercent: 3,
                    duration: spiralDelay + spiralDuration / 2 + 0.1,
                    ease: 'wiggle({type:random, wiggles:20})'
                }),
                startTime + popDuration - 0.1
            )

            const spiralPoints: Point[] = []
            const startAngle = -90 + (360 / count) * reserveIndex
            const endAngle = startAngle + 120
            const segments = 6
            for (let step = 0; step <= segments; step++) {
                const t = step / segments
                const angle = startAngle + (endAngle - startAngle) * t
                const radiusAt = radius * (1 - t)
                spiralPoints.push({
                    x: targetMothership.x + radiusAt * Math.cos(toRadians(angle)),
                    y: targetMothership.y + radiusAt * Math.sin(toRadians(angle))
                })
            }

            path({
                object: this.element,
                path: spiralPoints.map((point) => offsetFromCenter(point)),
                curviness: 1,
                duration: spiralDuration,
                ease: 'power1.in',
                timeline,
                position: startTime + popDuration + spiralDelay
            })

            fadeOut({
                object: this.element!,
                duration: 0.1,
                timeline,
                position: '>'
            })

            if (reserveIndex === reserveIds.length - 1) {
                const arrivalTime = startTime + popDuration + spiralDelay + spiralDuration
                this.scheduleReserveOffset(
                    action.playerId,
                    -reserveIds.length,
                    fromState,
                    timeline,
                    arrivalTime
                )
                this.scheduleHoldOffset(
                    action.targetPlayerId,
                    action.playerId,
                    reserveIds.length,
                    fromState,
                    timeline,
                    arrivalTime
                )
            }
        }
    }

    animateCreatedSundivers(
        createdSundiverIds: string[],
        startCoords: OffsetCoordinates,
        playerId: string,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState,
        holdDelta: number = 0,
        reserveDelta: number = 0
    ) {
        const createdCount = createdSundiverIds.length
        const index = createdSundiverIds.indexOf(this.id)
        const returnTime = holdDelta > createdCount ? 0.5 : 0
        const scheduleTime = Math.max(this.getCreatedSundiverArrivalTime(createdCount), returnTime)
        const shouldSchedule = createdCount === 0 || index === createdCount - 1

        if (fromState && shouldSchedule) {
            this.scheduleHoldOffset(
                playerId,
                playerId,
                holdDelta,
                fromState,
                timeline,
                scheduleTime
            )
            this.scheduleReserveOffset(playerId, reserveDelta, fromState, timeline, scheduleTime)
        }

        if (index === undefined || index < 0) {
            return
        }

        const board = this.gameSession.gameState.board

        let startOffset = index * 0.2
        const stationCell = board.cellAt(startCoords)
        const diverLocation = this.gameSession.locationForStationInCell(stationCell)

        const targetLocation = this.getMothershipLocationForPlayer(fromState ?? toState, playerId)

        if (!diverLocation || !targetLocation) {
            return
        }

        // Appear... move... disappear
        gsap.set(this.element!, {
            opacity: 1,
            scale: 0,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        scale({
            object: this.element,
            to: 1,
            duration: 0.1,
            ease: 'power2.in',
            timeline,
            position: startOffset
        })

        move({
            object: this.element,
            location: offsetFromCenter(targetLocation),
            duration: 0.5,
            ease: 'power2.in',
            timeline,
            position: startOffset
        })

        fadeOut({
            object: this.element!,
            duration: 0.1,
            timeline,
            position: '>'
        })
    }

    getMothershipLocationForPlayer(gameState: HydratedSolGameState, playerId: string): Point {
        const mothershipIndex = gameState.board.motherships[playerId]
        return getMothershipSpotPoint(gameState.players.length, mothershipIndex)
    }
}
