import {
    Activate,
    ActivateBonus,
    ActivateEffect,
    Blight,
    Chain,
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
    isChain,
    isConvert,
    isDrawCards,
    isHatch,
    isFly,
    isHurl,
    isInvade,
    isLaunch,
    Launch,
    Invade,
    Sundiver,
    type SolGameState,
    HydratedSolPlayerState,
    StationType
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { GameAction, OffsetCoordinates, samePoint, type Point } from '@tabletop/common'
import {
    getCirclePoint,
    dimensionsForSpace,
    getGatePosition,
    getMothershipSpotPoint,
    getSpaceCentroid,
    offsetFromCenter,
    toRadians
} from '$lib/utils/boardGeometry.js'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { fadeOut, move, scale, path, fadeIn, rotate } from '$lib/utils/animations.js'
import { gsap } from 'gsap'
import type { AnimationContext } from '@tabletop/frontend-components'
import { getFlightDuration, getFlightPaths, TELEPORT_TIMINGS } from '$lib/utils/flight.js'
import { tick } from 'svelte'
import {
    CHAIN_MOMENTUM_MOVE_DURATION,
    CHAIN_MOMENTUM_STAGGER,
    CHAIN_SUNDIVER_RETURN_DELAY
} from '$lib/utils/animationsUtils.js'

type SetQuantityCallback = (quantity: number) => void

export class SundiverAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private quantityCallback?: SetQuantityCallback
    private elements = new Map<string, HTMLElement | SVGElement>()

    constructor(gameSession: SolGameSession) {
        super(gameSession)
    }

    setQuantityCallback(callback: SetQuantityCallback): void {
        this.quantityCallback = callback
    }

    addSundiver(id: string, element: HTMLElement | SVGElement): void {
        this.elements.set(id, element)
        gsap.set(element, {
            opacity: 0,
            transformOrigin: '50% 50%',
            transformBox: 'fill-box'
        })
    }

    removeSundiver(id: string): void {
        this.elements.delete(id)
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
        if (!action && !from) {
            return
        }

        const fromMap = this.buildSundiverMap(from)
        const toMap = this.buildSundiverMap(to)

        const sundiverIds = action
            ? this.collectActionSundiverIds(action, from)
            : this.collectFallbackSundiverIds(to, from!, toMap, fromMap)
        if (sundiverIds.length === 0) {
            return
        }

        const movingSundivers = sundiverIds
            .map((id) => fromMap.get(id) ?? toMap.get(id))
            .filter((sundiver): sundiver is Sundiver => Boolean(sundiver))
        if (movingSundivers.length === 0) {
            return
        }

        this.gameSession.movingSundivers = movingSundivers
        await tick()

        for (const sundiver of movingSundivers) {
            const element = this.elements.get(sundiver.id)
            if (!element) {
                continue
            }
            if (action) {
                this.animateAction(
                    action,
                    animationContext.actionTimeline,
                    to,
                    from,
                    sundiver.id,
                    element
                )
            } else if (from) {
                const fromSundiver = fromMap.get(sundiver.id)
                const toSundiver = toMap.get(sundiver.id)
                if (!fromSundiver || !toSundiver) {
                    continue
                }
                this.animateFallbackMove(
                    to,
                    from,
                    toSundiver,
                    fromSundiver,
                    animationContext.actionTimeline,
                    element
                )
            }
        }

        animationContext.afterAnimations(() => {
            this.gameSession.movingSundivers = []
        })
    }

    private buildSundiverMap(state?: HydratedSolGameState): Map<string, Sundiver> {
        const map = new Map<string, Sundiver>()
        if (!state) {
            return map
        }
        for (const diver of state.getAllSundivers()) {
            map.set(diver.id, diver)
        }
        return map
    }

    private collectActionSundiverIds(action: GameAction, fromState?: HydratedSolGameState): string[] {
        const ids: string[] = []

        if (isLaunch(action)) {
            ids.push(...(action.metadata?.sundiverIds ?? []))
        } else if (isFly(action) || isHurl(action)) {
            ids.push(...action.sundiverIds)
        } else if (isActivate(action)) {
            if (action.metadata?.sundiverId) {
                ids.push(action.metadata.sundiverId)
            }
            ids.push(...(action.metadata?.createdSundiverIds ?? []))
        } else if (isActivateBonus(action)) {
            ids.push(...(action.metadata?.createdSundiverIds ?? []))
        } else if (isActivateEffect(action)) {
            if (
                (action.effect === EffectType.Squeeze || action.effect === EffectType.Augment) &&
                action.metadata?.coords
            ) {
                ids.push(...(action.metadata?.createdSundiverIds ?? []))
            }
        } else if (isDrawCards(action)) {
            if (fromState?.activeEffect === EffectType.Squeeze && action.metadata?.coords) {
                ids.push(...(action.metadata?.createdSundiverIds ?? []))
            }
        } else if (isHatch(action)) {
            if (action.metadata?.replacedSundiver) {
                ids.push(action.metadata.replacedSundiver.id)
            }
        } else if (isConvert(action)) {
            ids.push(...action.sundiverIds)
        } else if (isBlight(action)) {
            if (action.metadata?.sundiverId && fromState) {
                ids.push(action.metadata.sundiverId)
                const reserveIds = fromState
                    .getPlayerState(action.playerId)
                    .reserveSundivers.slice(0, 3)
                    .map((diver) => diver.id)
                ids.push(...reserveIds)
            }
        } else if (isChain(action)) {
            action.chain.forEach((entry, index) => {
                if (entry.sundiverId && index % 2 === 0) {
                    ids.push(entry.sundiverId)
                }
            })
        } else if (isInvade(action)) {
            ids.push(...(action.metadata?.removedSundiverIds ?? []))
        }

        const seen = new Set<string>()
        const unique: string[] = []
        for (const id of ids) {
            if (seen.has(id)) {
                continue
            }
            seen.add(id)
            unique.push(id)
        }
        return unique
    }

    private collectFallbackSundiverIds(
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState,
        toMap: Map<string, Sundiver>,
        fromMap: Map<string, Sundiver>
    ): string[] {
        const ids: string[] = []
        for (const [id, fromSundiver] of fromMap) {
            const toSundiver = toMap.get(id)
            if (!toSundiver) {
                continue
            }
            if (toSundiver.hold && fromSundiver.hold && toSundiver.hold === fromSundiver.hold) {
                continue
            }
            if (toSundiver.reserve && fromSundiver.reserve) {
                continue
            }
            const toLocation = this.getFallbackLocation(toState, toSundiver)
            const fromLocation = this.getFallbackLocation(fromState, fromSundiver)
            if (!toLocation || !fromLocation || samePoint(toLocation, fromLocation)) {
                continue
            }
            ids.push(id)
        }
        return ids
    }

    private animateFallbackMove(
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState,
        toSundiver: Sundiver,
        fromSundiver: Sundiver,
        timeline: gsap.core.Timeline,
        element: HTMLElement | SVGElement
    ) {
        if (toSundiver.hold && fromSundiver.hold && toSundiver.hold === fromSundiver.hold) {
            return
        }
        if (toSundiver.reserve && fromSundiver.reserve) {
            return
        }

        const toLocation = this.getFallbackLocation(toState, toSundiver)
        const fromLocation = this.getFallbackLocation(fromState, fromSundiver)

        if (!toLocation || !fromLocation || samePoint(toLocation, fromLocation)) {
            return
        }

        gsap.set(element, {
            opacity: 1,
            x: offsetFromCenter(fromLocation).x,
            y: offsetFromCenter(fromLocation).y
        })

        move({
            object: element,
            location: offsetFromCenter(toLocation),
            duration: 0.2,
            ease: 'power1.inOut',
            timeline,
            position: 0
        })

        fadeOut({
            object: element,
            duration: 0.1,
            timeline,
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

    private getCreatedSundiverArrivalTime(
        count: number,
        moveDuration: number = 0.5,
        delayBetween: number = 0.2
    ): number {
        if (count <= 0) {
            return 0
        }
        return moveDuration + delayBetween * (count - 1)
    }

    animateAction(
        action: GameAction,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (isConvert(action)) {
            this.animateConvertAction(action, timeline, toState, fromState, sundiverId, element)
        } else if (isActivate(action)) {
            this.animateActivateAction(action, timeline, toState, fromState, sundiverId, element)
        } else if (isActivateBonus(action)) {
            this.animateActivateBonusAction(
                action,
                timeline,
                toState,
                fromState,
                sundiverId,
                element
            )
        } else if (isLaunch(action)) {
            this.animateLaunchAction(action, timeline, toState, fromState, sundiverId, element)
        } else if (isFly(action) || isHurl(action)) {
            this.animateFlyOrHurlAction(action, timeline, toState, fromState, sundiverId, element)
        } else if (isActivateEffect(action)) {
            this.animateActivateEffectAction(
                action,
                timeline,
                toState,
                fromState,
                sundiverId,
                element
            )
        } else if (isDrawCards(action)) {
            this.animateDrawCardsAction(
                action,
                timeline,
                toState,
                fromState,
                sundiverId,
                element
            )
        } else if (isHatch(action)) {
            this.animateHatchAction(action, timeline, toState, fromState, sundiverId, element)
        } else if (isBlight(action)) {
            this.animateBlightAction(action, timeline, toState, fromState, sundiverId, element)
        } else if (isChain(action)) {
            this.animateChainAction(action, timeline, toState, fromState, sundiverId, element)
        } else if (isInvade(action)) {
            this.animateInvadeAction(action, timeline, toState, fromState, sundiverId, element)
        }
    }

    animateLaunchAction(
        launch: Launch,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        const launchIndex = launch.metadata?.sundiverIds.indexOf(sundiverId)
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
        gsap.set(element, {
            opacity: 1,
            scale: 0,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        scale({
            object: element,
            to: 1,
            duration: 0.1,
            ease: 'power2.in',
            timeline,
            position: launchIndex * 0.2
        })

        move({
            object: element,
            location: offsetFromCenter(targetLocation),
            duration: moveDuration,
            ease: 'power2.out',
            timeline,
            position: launchIndex * delayBetween
        })
        fadeOut({
            object: element,
            duration: 0,
            timeline,
            position: '>'
        })
    }

    animateFlyOrHurlAction(
        fly: Fly | Hurl,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (!fromState) {
            return
        }
        const index = fly.sundiverIds.indexOf(sundiverId)
        if (index === -1) {
            return
        }

        if (isFly(fly) && fly.metadata?.puncturedGate) {
            const gate = fly.metadata.puncturedGate
            const gateInner = gate.innerCoords ?? fly.start
            const gateOuter = gate.outerCoords ?? fly.destination
            if (!gateInner || !gateOuter) {
                return
            }

            const gatePosition = getGatePosition(this.gameSession.numPlayers, gateInner, gateOuter)
            const gateLocation = getCirclePoint(
                gatePosition.radius,
                toRadians(gatePosition.angle)
            )
            const movingInward = fly.start.row > fly.destination.row
            const startDimensions = dimensionsForSpace(this.gameSession.numPlayers, fly.start)
            const thickness = startDimensions.outerRadius - startDimensions.innerRadius
            const approachFactor = movingInward ? 0.9 : 0.1
            const approachRadius = startDimensions.innerRadius + thickness * approachFactor
            const approachPoint = getCirclePoint(
                approachRadius,
                toRadians(gatePosition.angle)
            )
            const finalGateLocation = gateLocation
            const startCell = fromState.board.cellAt(fly.start)
            const diverLocation =
                this.gameSession.locationForDiverInCell(fly.playerId, startCell) ??
                getSpaceCentroid(this.gameSession.numPlayers, fly.start)

            const delayBetween = 0.3
            const flightStart = index * delayBetween
            const approachDuration = getFlightDuration(fly, 2) + 0.25
            const jitterLead = 0
            const jitterDuration = 1 + jitterLead
            const jitterRampDuration = 1
            const burstDuration = 0.25
            const jitterStart = flightStart + Math.max(0, approachDuration - jitterLead)
            const burstStart = jitterStart + jitterDuration
            const jitterMaxOffset = 7
            const approachOffset = offsetFromCenter(approachPoint)
            const approachVector = {
                x: approachPoint.x - diverLocation.x,
                y: approachPoint.y - diverLocation.y
            }
            const approachAngle =
                approachVector.x === 0 && approachVector.y === 0
                    ? 0
                    : (Math.atan2(approachVector.y, approachVector.x) * 180) / Math.PI + 90
            const approachRotation = (() => {
                const normalized = ((approachAngle % 360) + 360) % 360
                return normalized > 180 ? normalized - 360 : normalized
            })()

            timeline.set(
                element,
                {
                    opacity: 1,
                    transformOrigin: '50% 50%',
                    transformBox: 'fill-box',
                    rotation: 0,
                    x: offsetFromCenter(diverLocation).x,
                    y: offsetFromCenter(diverLocation).y
                },
                flightStart
            )

            const scaleTarget =
                (element.firstElementChild as SVGElement | HTMLElement | null) ?? element
            gsap.set(scaleTarget, {
                transformOrigin: '50% 50%',
                transformBox: 'fill-box',
                rotation: 0
            })

            move({
                object: element,
                location: approachOffset,
                duration: approachDuration,
                ease: 'power1.inOut',
                timeline,
                position: flightStart
            })
            rotate({
                object: scaleTarget,
                degrees: approachRotation,
                duration: approachDuration,
                ease: 'power1.inOut',
                timeline,
                position: flightStart
            })

            const jitterElement = element
            const jitterState = { progress: 0 }
            timeline.add(
                gsap.to(jitterState, {
                    progress: 1,
                    duration: jitterDuration,
                    ease: 'power2.in',
                    onUpdate: () => {
                        const elapsed = jitterState.progress * jitterDuration
                        const rampProgress = Math.min(1, elapsed / jitterRampDuration)
                        const amp = jitterMaxOffset * (0.2 + 0.8 * rampProgress)
                        gsap.set(jitterElement, {
                            x: approachOffset.x + gsap.utils.random(-amp, amp),
                            y: approachOffset.y + gsap.utils.random(-amp, amp)
                        })
                    },
                    onComplete: () => {
                        gsap.set(jitterElement, {
                            x: approachOffset.x,
                            y: approachOffset.y
                        })
                    }
                }),
                jitterStart
            )

            move({
                object: element,
                location: offsetFromCenter(finalGateLocation),
                duration: burstDuration,
                ease: 'power2.in',
                timeline,
                position: burstStart
            })

            scale({
                object: scaleTarget,
                to: 0.25,
                duration: 0.1,
                ease: 'power2.in',
                timeline,
                position: burstStart + burstDuration - 0.1
            })

            fadeOut({
                object: element,
                duration: 0.1,
                timeline,
                position: burstStart + burstDuration
            })

            scale({
                object: scaleTarget,
                to: 1,
                duration: 0,
                timeline,
                position: burstStart + burstDuration + 0.1
            })
            rotate({
                object: scaleTarget,
                degrees: 0,
                duration: 0,
                timeline,
                position: burstStart + burstDuration + 0.1
            })
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
                element,
                {
                    opacity: 1,
                    x: offsetFromCenter(startLocation).x,
                    y: offsetFromCenter(startLocation).y
                },
                flightStart
            )

            const pathLocations = pathPoints.map((loc) => offsetFromCenter(loc))
            if (fly.teleport) {
                const scaleTarget =
                    (element.firstElementChild as SVGElement | HTMLElement | null) ?? element
                gsap.set(scaleTarget, {
                    transformOrigin: '50% 50%',
                    transformBox: 'fill-box'
                })

                const preMoveDuration = TELEPORT_TIMINGS.preMove
                const pauseDuration = TELEPORT_TIMINGS.pause
                const popOutDuration = TELEPORT_TIMINGS.popOut
                const shrinkDuration = TELEPORT_TIMINGS.shrink
                const teleportGap = TELEPORT_TIMINGS.gap
                const popInDuration = TELEPORT_TIMINGS.popIn
                const settleDuration = TELEPORT_TIMINGS.settle
                const postMoveDuration = TELEPORT_TIMINGS.postMove
                const popScale = 1.4

                const startOffset = offsetFromCenter(startLocation)
                const endOffset = pathLocations.at(-1) ?? startOffset
                const deltaX = endOffset.x - startOffset.x
                const deltaY = endOffset.y - startOffset.y
                const totalDistance = Math.hypot(deltaX, deltaY)
                const teleportDistance = Math.min(50, totalDistance / 2)
                const unitX = totalDistance === 0 ? 0 : deltaX / totalDistance
                const unitY = totalDistance === 0 ? 0 : deltaY / totalDistance
                const prePoint = {
                    x: startOffset.x + unitX * teleportDistance,
                    y: startOffset.y + unitY * teleportDistance
                }
                const reappearPoint = {
                    x: endOffset.x - unitX * teleportDistance,
                    y: endOffset.y - unitY * teleportDistance
                }

                const outStart = flightStart + preMoveDuration + pauseDuration
                const reappearStart = outStart + popOutDuration + shrinkDuration + teleportGap

                move({
                    object: element,
                    location: prePoint,
                    duration: preMoveDuration,
                    ease: 'power1.inOut',
                    timeline,
                    position: flightStart
                })

                scale({
                    object: scaleTarget,
                    to: popScale,
                    duration: popOutDuration,
                    ease: 'back.out(2)',
                    timeline,
                    position: outStart
                })
                scale({
                    object: scaleTarget,
                    to: 0,
                    duration: shrinkDuration,
                    ease: 'power2.in',
                    timeline,
                    position: outStart + popOutDuration
                })

                timeline.set(
                    element,
                    {
                        opacity: 1,
                        x: reappearPoint.x,
                        y: reappearPoint.y
                    },
                    reappearStart
                )
                timeline.set(
                    scaleTarget,
                    {
                        scale: 0
                    },
                    reappearStart
                )
                scale({
                    object: scaleTarget,
                    to: popScale,
                    duration: popInDuration,
                    ease: 'back.out(2)',
                    timeline,
                    position: reappearStart
                })
                scale({
                    object: scaleTarget,
                    to: 1,
                    duration: settleDuration,
                    ease: 'back.out(2)',
                    timeline,
                    position: reappearStart + popInDuration
                })
                move({
                    object: element,
                    location: endOffset,
                    duration: postMoveDuration,
                    ease: 'power1.inOut',
                    timeline,
                    position: reappearStart + popInDuration
                })
            } else {
                path({
                    object: element,
                    path: pathLocations,
                    curviness: 1,
                    duration: flightDuration,
                    ease: 'power1.inOut',
                    timeline,
                    position: flightStart
                })
            }

            if (samePoint(pathPoints.at(-1), { x: 0, y: 0 })) {
                // Special case for center space - just fade out
                fadeOut({
                    object: element,
                    duration: 0.3,
                    timeline,
                    position: '>'
                })
            } else {
                timeline.set(
                    element,
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
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (!fromState || !action.metadata?.replacedSundiver) {
            return
        }

        if (action.metadata.replacedSundiver.id !== sundiverId) {
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

        gsap.set(element, {
            opacity: 1,
            x: offsetFromCenter(startLocation).x,
            y: offsetFromCenter(startLocation).y
        })

        move({
            object: element,
            location: offsetFromCenter(targetLocation),
            duration: 0.5,
            ease: 'power2.in',
            timeline,
            position: leaveStart
        })

        fadeOut({
            object: element,
            duration: 0.1,
            timeline,
            position: '>'
        })
    }

    animateConvertAction(
        convert: Convert,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (!convert.sundiverIds.includes(sundiverId)) {
            return
        }
        if (fromState && convert.sundiverIds[0] === sundiverId) {
            const revealDuration = convert.isGate ? 0.5 : 1
            const revealStart = convert.isGate ? 0 : 0.5
            if (fromState.activeEffect === EffectType.Cascade) {
                const sundiverCount = convert.sundiverIds.length
                const holdTime =
                    revealStart + revealDuration + 0.5 + 0.2 * Math.max(0, sundiverCount - 1)
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
                    revealStart + revealDuration
                )
            }
        }

        const toBoard = toState.board
        const fromBoard = fromState?.board

        if (!fromBoard) {
            return
        }

        const revealStart = convert.isGate ? 0 : 0.5
        const revealDuration = convert.isGate ? 0.5 : 1
        let approachDuration = 0
        let moveDuration = revealDuration
        let initialLocation: Point | undefined
        let approachTarget: Point | undefined
        let targetLocation: Point | undefined
        if (!convert.isGate) {
            const stationCell = toBoard.cellAt(convert.coords)
            const stationLocation = this.gameSession.locationForStationInCell(stationCell)
            const stationType = convert.stationType ?? stationCell.station?.type
            if (!stationLocation || !stationType) {
                return
            }

            const diverCoords = fromBoard.findSundiverCoords(sundiverId)
            if (!diverCoords) {
                return
            }
            const diverCell = fromBoard.cellAt(diverCoords)
            const diverLocation = this.gameSession.locationForDiverInCell(
                convert.playerId,
                diverCell
            )
            if (!diverLocation) {
                return
            }

            const stationWidth = stationType === StationType.TransmitTower ? 48 : 46
            const stationHeight = stationType === StationType.TransmitTower ? 100 : 48
            const diverWidth = 30
            const diverHeight = 40
            const gap = 8
            const stationTop = stationLocation.y - stationHeight / 2
            const sidePointOffset = diverHeight / 3
            const topOffset = 10
            const sideTopY = stationTop + diverHeight / 2 - sidePointOffset
            const topCenterY = stationTop - gap - topOffset - diverHeight / 2
            const offsetX = stationWidth / 2 + diverWidth / 2 + gap

            const positions =
                convert.sundiverIds.length >= 3
                    ? [
                          { x: stationLocation.x - offsetX, y: sideTopY },
                          { x: stationLocation.x + offsetX, y: sideTopY },
                          { x: stationLocation.x, y: topCenterY }
                      ]
                    : [
                          { x: stationLocation.x - offsetX, y: sideTopY },
                          { x: stationLocation.x + offsetX, y: sideTopY }
                      ]

            const targetIndex = convert.sundiverIds.indexOf(sundiverId)
            const target = positions[targetIndex] ?? positions[0]
            initialLocation = diverLocation
            approachTarget = { x: target.x, y: target.y + stationHeight }
            targetLocation = target
            approachDuration = revealStart
            moveDuration = revealDuration
        } else if (convert.innerCoords && convert.coords) {
            const diverCoords = fromBoard.findSundiverCoords(sundiverId)
            const diverCell = fromBoard.cellAt(diverCoords!)
            const diverLocation = this.gameSession.locationForDiverInCell(
                convert.playerId,
                diverCell
            )
            if (!diverLocation) {
                return
            }

            const gatePosition = getGatePosition(
                this.gameSession.numPlayers,
                convert.innerCoords,
                convert.coords
            )
            initialLocation = diverLocation
            targetLocation = getCirclePoint(gatePosition.radius, toRadians(gatePosition.angle))
            moveDuration = revealDuration
        }
        if (!initialLocation || !targetLocation) {
            return
        }

        // Appear... move... disappear
        gsap.set(element, {
            opacity: 1,
            x: offsetFromCenter(initialLocation).x,
            y: offsetFromCenter(initialLocation).y
        })

        if (approachTarget && approachDuration > 0) {
            move({
                object: element,
                location: offsetFromCenter(approachTarget),
                duration: approachDuration,
                ease: 'none',
                timeline,
                position: 0
            })
        }

        move({
            object: element,
            location: offsetFromCenter(targetLocation),
            duration: moveDuration,
            ease: 'power2.in',
            timeline,
            position: revealStart
        })

        if (fromState.activeEffect === EffectType.Cascade) {
            const targetLocation = this.getMothershipLocationForPlayer(
                fromState ?? toState,
                convert.playerId
            )

            const index = convert.sundiverIds.indexOf(sundiverId)
            if (targetLocation) {
                move({
                    object: element,
                    location: offsetFromCenter(targetLocation),
                    duration: 0.5,
                    ease: 'power2.in',
                    timeline,
                    position: '>' + (index > 0 ? '+' + index * 0.2 : '')
                })
            }
        }

        fadeOut({
            object: element,
            duration: 0.1,
            timeline,
            position: '>'
        })
    }

    animateActivateAction(
        activate: Activate,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (!fromState || !activate.metadata) {
            return
        }

        const createdIds = activate.metadata.createdSundiverIds ?? []
        const createdCount = createdIds.length
        const returnCount = activate.metadata.sundiverId ? 1 : 0
        const isActivatingSundiver = activate.metadata.sundiverId === sundiverId
        const isCreatedSundiver = createdIds.includes(sundiverId)

        if (isCreatedSundiver || isActivatingSundiver) {
        this.animateCreatedSundivers(
            createdIds,
            activate.coords,
            activate.playerId,
            timeline,
            toState,
            fromState,
            sundiverId,
            element,
            returnCount + createdCount,
            -createdCount,
            1,
            0.2
        )
        }

        if (!isActivatingSundiver) {
            return
        }

        const fromBoard = fromState.board

        let diverLocation: Point | undefined
        let startOffset = 0

        // Activating sundiver starts in cell
        const diverCoords = fromBoard.findSundiverCoords(sundiverId)
        const diverCell = fromBoard.cellAt(diverCoords!)
        diverLocation = this.gameSession.locationForDiverInCell(activate.playerId, diverCell)

        const targetLocation = this.getMothershipLocationForPlayer(fromState, activate.playerId)

        if (!diverLocation || !targetLocation) {
            return
        }

        // Appear... move... disappear
        gsap.set(element, {
            opacity: 1,
            scale: isActivatingSundiver ? 1 : 0,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        move({
            object: element,
            location: offsetFromCenter(targetLocation),
            duration: 0.5,
            ease: 'power2.in',
            timeline,
            position: startOffset
        })

        fadeOut({
            object: element,
            duration: 0.1,
            timeline,
            position: '>'
        })
    }

    animateActivateBonusAction(
        activateBonus: ActivateBonus,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (!activateBonus.metadata) {
            return
        }
        const createdIds = activateBonus.metadata.createdSundiverIds ?? []
        const createdCount = createdIds.length

        if (!createdIds.includes(sundiverId)) {
            return
        }

        this.animateCreatedSundivers(
            createdIds,
            activateBonus.metadata.coords,
            activateBonus.playerId,
            timeline,
            toState,
            fromState,
            sundiverId,
            element,
            createdCount,
            -createdCount,
            1,
            0.2
        )
    }

    animateActivateEffectAction(
        action: ActivateEffect,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (action.effect !== EffectType.Squeeze && action.effect !== EffectType.Augment) {
            return
        }

        if (!fromState || !action.metadata || !action.metadata.coords) {
            return
        }

        const createdIds = action.metadata.createdSundiverIds ?? []
        const createdCount = createdIds.length

        if (!createdIds.includes(sundiverId)) {
            return
        }

        this.animateCreatedSundivers(
            createdIds,
            action.metadata.coords,
            action.playerId,
            timeline,
            toState,
            fromState,
            sundiverId,
            element,
            createdCount,
            -createdCount,
            1,
            0.2
        )
    }

    animateDrawCardsAction(
        action: DrawCards,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (fromState?.activeEffect !== EffectType.Squeeze) {
            return
        }

        if (!fromState || !action.metadata || !action.metadata.coords) {
            return
        }

        const createdIds = action.metadata.createdSundiverIds ?? []
        const createdCount = createdIds.length

        if (!createdIds.includes(sundiverId)) {
            return
        }

        this.animateCreatedSundivers(
            createdIds,
            action.metadata.coords,
            action.playerId,
            timeline,
            toState,
            fromState,
            sundiverId,
            element,
            createdCount,
            -createdCount
        )
    }

    animateBlightAction(
        action: Blight,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (!fromState || !action.metadata?.sundiverId) {
            return
        }

        const activatingId = action.metadata.sundiverId
        const reserveDivers = fromState.getPlayerState(action.playerId).reserveSundivers
        const reserveIds = reserveDivers.slice(0, 3).map((diver) => diver.id)

        const isActivating = sundiverId === activatingId
        const reserveIndex = reserveIds.indexOf(sundiverId)
        const isReserveDiver = reserveIndex >= 0

        if (!isActivating && !isReserveDiver) {
            return
        }

        const actionMothership = this.getMothershipLocationForPlayer(fromState, action.playerId)
        const targetMothership = this.getMothershipLocationForPlayer(
            fromState,
            action.targetPlayerId
        )
        if (!actionMothership || !targetMothership) {
            return
        }

        const reserveCount = reserveIds.length
        const radius = 100
        const count = Math.max(1, reserveCount)
        const angleStep = 360 / count
        const dropAngles = reserveIds.map((_, index) => -90 + angleStep * index)
        const dropPoints = dropAngles.map((angle) => ({
            x: targetMothership.x + radius * Math.cos(toRadians(angle)),
            y: targetMothership.y + radius * Math.sin(toRadians(angle))
        }))
        const approachDuration = 0.4
        const orbitDuration = 0.3
        const returnDuration = 0.5
        const dropTimes = dropAngles.map((_, index) => approachDuration + orbitDuration * index)
        const returnStart =
            dropPoints.length > 0 ? approachDuration + orbitDuration * (dropPoints.length - 1) : 0
        const activatingArrivalTime = returnStart + returnDuration

        if (isActivating) {
            const startCell = fromState.board.cellAt(action.coords)
            const diverLocation = this.gameSession.locationForDiverInCell(
                action.playerId,
                startCell
            )
            if (!diverLocation) {
                return
            }

            gsap.set(element, {
                opacity: 1,
                x: offsetFromCenter(diverLocation).x,
                y: offsetFromCenter(diverLocation).y
            })

            if (dropPoints.length > 0) {
                move({
                    object: element,
                    location: offsetFromCenter(dropPoints[0]),
                    duration: approachDuration,
                    ease: 'power2.inOut',
                    timeline,
                    position: 0
                })

                const arcSteps = 4
                for (let i = 1; i < dropPoints.length; i++) {
                    const startAngle = dropAngles[i - 1]
                    const endAngle = dropAngles[i]
                    const arcPoints: Point[] = []
                    for (let step = 0; step <= arcSteps; step++) {
                        const t = step / arcSteps
                        const angle = startAngle + (endAngle - startAngle) * t
                        arcPoints.push({
                            x: targetMothership.x + radius * Math.cos(toRadians(angle)),
                            y: targetMothership.y + radius * Math.sin(toRadians(angle))
                        })
                    }
                    path({
                        object: element,
                        path: arcPoints.map((point) => offsetFromCenter(point)),
                        curviness: 1,
                        duration: orbitDuration,
                        ease: 'power1.inOut',
                        timeline,
                        position: approachDuration + orbitDuration * (i - 1)
                    })
                }
            }

            move({
                object: element,
                location: offsetFromCenter(actionMothership),
                duration: returnDuration,
                ease: 'power2.in',
                timeline,
                position: returnStart
            })

            fadeOut({
                object: element,
                duration: 0.1,
                timeline,
                position: '>'
            })

            this.scheduleHoldOffset(
                action.playerId,
                action.playerId,
                1,
                fromState,
                timeline,
                activatingArrivalTime
            )
        }

        if (isReserveDiver) {
            const startLocation =
                dropPoints[reserveIndex] ??
                ({
                    x: targetMothership.x + radius * Math.cos(toRadians(dropAngles[reserveIndex])),
                    y: targetMothership.y + radius * Math.sin(toRadians(dropAngles[reserveIndex]))
                } as Point)

            const fadeDuration = 0.1
            const popDuration = 0.2
            const spiralDelay = 0.5
            const spiralDuration = 0.5
            const startTime = dropTimes[reserveIndex] ?? 0

            gsap.set(element, {
                opacity: 0,
                scale: 0,
                transformOrigin: '50% 50%',
                x: offsetFromCenter(startLocation).x,
                y: offsetFromCenter(startLocation).y
            })

            fadeIn({
                object: element,
                duration: fadeDuration,
                timeline,
                position: startTime
            })

            scale({
                object: element,
                to: 1.5,
                duration: popDuration,
                ease: 'back.out(2)',
                timeline,
                position: startTime
            })

            scale({
                object: element,
                to: 1,
                duration: 0.2,
                ease: 'power2.out',
                timeline,
                position: startTime + popDuration
            })

            timeline.add(
                gsap.to(element, {
                    xPercent: 3,
                    yPercent: 3,
                    duration: spiralDelay + spiralDuration / 2 + 0.1,
                    ease: 'wiggle({type:random, wiggles:20})'
                }),
                startTime + popDuration - 0.1
            )

            const spiralPoints: Point[] = []
            const startAngle = dropAngles[reserveIndex]
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
                object: element,
                path: spiralPoints.map((point) => offsetFromCenter(point)),
                curviness: 1,
                duration: spiralDuration,
                ease: 'power1.in',
                timeline,
                position: startTime + popDuration + spiralDelay
            })

            fadeOut({
                object: element,
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

    animateChainAction(
        action: Chain,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (!fromState) {
            return
        }

        const chainIndex = action.chain.findIndex((entry) => entry.sundiverId === sundiverId)
        if (chainIndex < 0) {
            return
        }

        const entry = action.chain[chainIndex]
        if (!entry) {
            return
        }

        const startCell = fromState.board.cellAt(entry.coords)
        const sundiver = startCell.sundivers.find((diver) => diver.id === sundiverId)
        if (!sundiver) {
            return
        }

        if (chainIndex % 2 !== 0) {
            return
        }

        const startLocation = this.gameSession.locationForDiverInCell(sundiver.playerId, startCell)
        const targetLocation = this.getMothershipLocationForPlayer(fromState, sundiver.playerId)
        if (!startLocation || !targetLocation) {
            return
        }

        const returnIndex = Math.floor(chainIndex / 2)
        const moveDuration = CHAIN_MOMENTUM_MOVE_DURATION
        const returnStartTime =
            CHAIN_MOMENTUM_STAGGER * Math.max(0, action.chain.length - 1) +
            CHAIN_SUNDIVER_RETURN_DELAY

        const returnStats = new Map<string, { count: number; lastReturnIndex: number }>()
        for (let i = 0; i < action.chain.length; i += 2) {
            const chainEntry = action.chain[i]
            if (!chainEntry?.sundiverId) {
                continue
            }
            const cell = fromState.board.cellAt(chainEntry.coords)
            const diver = cell.sundivers.find((candidate) => candidate.id === chainEntry.sundiverId)
            if (!diver) {
                continue
            }
            const entryIndex = i / 2
            const existing = returnStats.get(diver.playerId) ?? {
                count: 0,
                lastReturnIndex: -1
            }
            existing.count += 1
            existing.lastReturnIndex = Math.max(existing.lastReturnIndex, entryIndex)
            returnStats.set(diver.playerId, existing)
        }

        const stats = returnStats.get(sundiver.playerId)

        gsap.set(element, {
            opacity: 1,
            scale: 1,
            x: offsetFromCenter(startLocation).x,
            y: offsetFromCenter(startLocation).y
        })

        move({
            object: element,
            location: offsetFromCenter(targetLocation),
            duration: CHAIN_MOMENTUM_MOVE_DURATION,
            ease: 'power2.in',
            timeline,
            position: returnStartTime
        })

        fadeOut({
            object: element,
            duration: 0.1,
            timeline,
            position: '>'
        })

        if (stats && stats.lastReturnIndex === returnIndex) {
            this.scheduleHoldOffset(
                sundiver.playerId,
                sundiver.playerId,
                stats.count,
                fromState,
                timeline,
                returnStartTime + moveDuration
            )
        }
    }

    animateInvadeAction(
        action: Invade,
        timeline: gsap.core.Timeline,
        _toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement
    ) {
        if (!fromState || !action.metadata) {
            return
        }

        const removedIds = action.metadata.removedSundiverIds
        const index = removedIds.indexOf(sundiverId)
        if (index < 0) {
            return
        }

        const invadedStation = action.metadata.invadedStation
        const stationType = invadedStation?.type ?? fromState.board.cellAt(action.coords).station?.type
        if (!stationType) {
            return
        }

        const stationCell = fromState.board.cellAt(action.coords)
        const stationLocation = this.gameSession.locationForStationInCell(stationCell)
        if (!stationLocation) {
            return
        }

        const stationWidth = stationType === StationType.TransmitTower ? 48 : 46
        const stationHeight = stationType === StationType.TransmitTower ? 100 : 48
        const diverWidth = 30
        const diverHeight = 40
        const gap = 8
        const stationTop = stationLocation.y - stationHeight / 2
        const sidePointOffset = diverHeight / 3
        const topOffset = 10
        const sideTopY = stationTop + diverHeight / 2 - sidePointOffset
        const topCenterY = stationTop - gap - topOffset - diverHeight / 2
        const offsetX = stationWidth / 2 + diverWidth / 2 + gap

        const positions =
            removedIds.length >= 3
                ? [
                      { x: stationLocation.x - offsetX, y: sideTopY },
                      { x: stationLocation.x + offsetX, y: sideTopY },
                      { x: stationLocation.x, y: topCenterY }
                  ]
                : [
                      { x: stationLocation.x - offsetX, y: sideTopY },
                      { x: stationLocation.x + offsetX, y: sideTopY }
                  ]

        const target = positions[index] ?? positions[0]
        const bottom = { x: target.x, y: target.y + stationHeight }

        const startLocation = this.gameSession.locationForDiverInCell(action.playerId, stationCell)
        if (!startLocation) {
            return
        }

        const approachDuration = 0.2
        const holdDelay = 0.5
        const hideDuration = 1
        const revealDuration = 1
        const hideStart = approachDuration + holdDelay
        const revealStart = hideStart + hideDuration

        timeline.set(
            element,
            {
                opacity: 1,
                x: offsetFromCenter(startLocation).x,
                y: offsetFromCenter(startLocation).y
            },
            0
        )

        move({
            object: element,
            location: offsetFromCenter(target),
            duration: approachDuration,
            ease: 'power2.out',
            timeline,
            position: 0
        })

        move({
            object: element,
            location: offsetFromCenter(bottom),
            duration: hideDuration,
            ease: 'none',
            timeline,
            position: hideStart
        })

        move({
            object: element,
            location: offsetFromCenter(target),
            duration: revealDuration,
            ease: 'power2.in',
            timeline,
            position: revealStart
        })

        fadeOut({
            object: element,
            duration: 0.3,
            timeline,
            position: revealStart + revealDuration
        })
    }

    animateCreatedSundivers(
        createdSundiverIds: string[],
        startCoords: OffsetCoordinates,
        playerId: string,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState: HydratedSolGameState | undefined,
        sundiverId: string,
        element: HTMLElement | SVGElement,
        holdDelta: number = 0,
        reserveDelta: number = 0,
        moveDuration: number = 0.5,
        delayBetween: number = 0.2
    ) {
        const createdCount = createdSundiverIds.length
        if (!sundiverId || !element) {
            return
        }
        const index = createdSundiverIds.indexOf(sundiverId)
        const returnTime = holdDelta > createdCount ? 0.5 : 0
        const scheduleTime = Math.max(
            this.getCreatedSundiverArrivalTime(createdCount, moveDuration, delayBetween),
            returnTime
        )
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

        const startOffset = index * delayBetween
        const stationCell = board.cellAt(startCoords)
        const diverLocation = this.gameSession.locationForStationInCell(stationCell)

        const targetLocation = this.getMothershipLocationForPlayer(fromState ?? toState, playerId)

        if (!diverLocation || !targetLocation) {
            return
        }

        // Appear... move... disappear
        gsap.set(element, {
            opacity: 1,
            scale: 0,
            x: offsetFromCenter(diverLocation).x,
            y: offsetFromCenter(diverLocation).y
        })

        scale({
            object: element,
            to: 1,
            duration: 0.1,
            ease: 'power2.in',
            timeline,
            position: startOffset
        })

        move({
            object: element,
            location: offsetFromCenter(targetLocation),
            duration: moveDuration,
            ease: 'power2.in',
            timeline,
            position: startOffset
        })

        fadeOut({
            object: element,
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

export function animateSundiver(
    node: HTMLElement | SVGElement,
    params?: { animator: SundiverAnimator; sundiverId: string }
): { destroy: () => void } {
    if (!params?.animator || !params.sundiverId) {
        return {
            destroy() {}
        }
    }

    params.animator.addSundiver(params.sundiverId, node)
    return {
        destroy() {
            params.animator.removeSundiver(params.sundiverId)
        }
    }
}
