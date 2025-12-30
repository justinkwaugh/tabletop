import {
    Activate,
    ActivateEffect,
    CENTER_COORDS,
    Convert,
    EffectType,
    Fly,
    Hatch,
    Hurl,
    HydratedSolGameState,
    isActivate,
    isActivateEffect,
    isConvert,
    isFly,
    isHatch,
    isHurl,
    isLaunch,
    isSacrifice,
    Launch,
    Sacrifice,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { GameAction, OffsetCoordinates, range, sameCoordinates, samePoint } from '@tabletop/common'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { fadeIn, fadeOut, move, scale } from '$lib/utils/animations.js'
import { gsap } from 'gsap'
import { offsetFromCenter } from '$lib/utils/boardGeometry.js'
import type { AnimationContext } from '@tabletop/frontend-components'
import { SundiverAnimator } from './sundiverAnimator.js'
import { getFlightDuration, getFlightPaths } from '$lib/utils/flight.js'

type SetQuantityCallback = (quantity: number) => void

export class CellSundiverAnimator extends StateAnimator<
    SolGameState,
    HydratedSolGameState,
    SolGameSession
> {
    private quantityCallback?: SetQuantityCallback

    constructor(
        gameSession: SolGameSession,
        private playerId: string,
        private coords: OffsetCoordinates
    ) {
        super(gameSession)
    }

    setQuantityCallback(callback: SetQuantityCallback): void {
        this.quantityCallback = callback
    }

    override onAttach(): void {
        gsap.set(this.element!, { opacity: 0 })
        if (
            this.gameSession.gameState.board.sundiversForPlayerAt(this.playerId, this.coords)
                .length > 0
        ) {
            fadeIn({
                object: this.element,
                duration: 0.3
            })
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
        }

        if (action && !this.mayBeAffectedByAction(action)) {
            return
        }

        const isFallback = !action
        const timeline = animationContext.actionTimeline
        const fallbackArrivalTime = 0.2
        const appearTime = isFallback ? fallbackArrivalTime : 0
        const appearDuration = isFallback ? 0 : 0.3
        const moveDuration = isFallback ? 0.3 : 1
        const moveEase = isFallback ? 'power1.inOut' : 'power2.inOut'

        const toCell = to.board.cellAt(this.coords)
        const fromCell = from?.board.cellAt(this.coords)
        if (!toCell && !fromCell) {
            return
        }

        const toDivers = to.board.sundiversForPlayerAt(this.playerId, this.coords)
        const fromDivers = from?.board.sundiversForPlayerAt(this.playerId, this.coords) ?? []

        if (toDivers.length > 0) {
            gsap.set(this.element!, { scale: 1 })
            // Check locations
            const targetLocation = this.gameSession.locationForDiverInCell(this.playerId, toCell)
            if (!targetLocation) {
                return
            }
            if (fromCell) {
                if (fromDivers.length === 0) {
                    gsap.set(this.element!, {
                        opacity: 0,
                        translateX: offsetFromCenter(targetLocation).x,
                        translateY: offsetFromCenter(targetLocation).y
                    })
                    if (isFallback) {
                        timeline.set(this.element!, { opacity: 1 }, appearTime)
                    } else {
                        fadeIn({
                            object: this.element,
                            duration: appearDuration,
                            timeline,
                            position: 0
                        })
                    }
                    return
                }

                const sourceLocation = this.gameSession.locationForDiverInCell(
                    this.playerId,
                    fromCell!
                )
                if (sourceLocation && !samePoint(sourceLocation, targetLocation)) {
                    gsap.set(this.element!, {
                        opacity: 1,
                        translateX: offsetFromCenter(sourceLocation).x,
                        translateY: offsetFromCenter(sourceLocation).y
                    })
                    move({
                        object: this.element,
                        timeline,
                        location: offsetFromCenter(targetLocation),
                        ease: moveEase,
                        duration: moveDuration,
                        position: 0
                    })
                }
            } else {
                if (isFallback) {
                    gsap.set(this.element!, {
                        opacity: 0,
                        translateX: offsetFromCenter(targetLocation).x,
                        translateY: offsetFromCenter(targetLocation).y
                    })
                    timeline.set(this.element!, { opacity: 1 }, appearTime)
                } else {
                    gsap.set(this.element!, {
                        opacity: 1,
                        translateX: offsetFromCenter(targetLocation).x,
                        translateY: offsetFromCenter(targetLocation).y
                    })
                }
            }
        } else {
            gsap.set(this.element!, { opacity: 0 })
        }
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
        } else if (isLaunch(action)) {
            this.animateLaunchAction(action, timeline, toState, fromState)
        } else if (isFly(action) || isHurl(action)) {
            this.animateFlyOrHurlAction(action, timeline, toState, fromState)
        } else if (isHatch(action)) {
            this.animateHatchAction(action, timeline, toState, fromState)
        } else if (isActivateEffect(action)) {
            this.animateActivateEffectAction(action, timeline, toState, fromState)
        } else if (isSacrifice(action)) {
            this.animateSacrificeAction(action, timeline)
        }
    }

    mayBeAffectedByAction(action: GameAction): boolean {
        if (isLaunch(action)) {
            return (
                action.playerId !== this.playerId &&
                sameCoordinates(action.destination, this.coords)
            )
        } else if (isFly(action) || isHurl(action)) {
            return (
                (action.playerId !== this.playerId || action.stationId !== undefined) &&
                (sameCoordinates(action.start, this.coords) ||
                    sameCoordinates(action.destination, this.coords))
            )
        } else if (isConvert(action)) {
            if (action.playerId !== this.playerId || sameCoordinates(action.coords, this.coords)) {
                return true
            }
        } else if (isActivate(action)) {
            return action.playerId !== this.playerId && sameCoordinates(action.coords, this.coords)
        }

        return false
    }

    animateLaunchAction(
        launch: Launch,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (
            this.playerId !== launch.playerId ||
            !sameCoordinates(launch.destination, this.coords)
        ) {
            return
        }

        const board = toState.board
        const targetCell = board.cellAt(launch.destination)
        const targetLocation = this.gameSession.locationForDiverInCell(launch.playerId, targetCell)

        if (!targetLocation) {
            return
        }

        const numBefore =
            fromState?.board.sundiversForPlayerAt(launch.playerId, this.coords).length ?? 0
        const numAfter = toState.board.sundiversForPlayerAt(launch.playerId, this.coords).length

        const moveDuration = 0.5
        const delayBetween = 0.3
        if (!numBefore) {
            gsap.set(this.element!, {
                opacity: 0,
                x: offsetFromCenter(targetLocation).x,
                y: offsetFromCenter(targetLocation).y
            })

            // Appear right when the first one arrives
            fadeIn({
                object: this.element,
                duration: 0,
                timeline,
                position: moveDuration
            })
        }

        for (const arriving of range(1, numAfter - numBefore)) {
            timeline.call(
                () => {
                    this.quantityCallback!(numBefore + arriving)
                },
                [],
                moveDuration + delayBetween * (arriving - 1)
            )
        }
    }

    animateHatchAction(
        action: Hatch,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState || !sameCoordinates(action.coords, this.coords)) {
            return
        }

        if (this.playerId === action.playerId) {
            const numBefore = fromState.board.sundiversForPlayerAt(
                action.playerId,
                this.coords
            ).length

            const scaleUp = 1.4
            const scaleUpDuration = 0.2
            const delayBetween = 0.2
            const scaleDownDuration = 0.3

            gsap.set(this.element!, { transformOrigin: 'center center' })

            scale({
                object: this.element,
                to: scaleUp,
                duration: scaleUpDuration,
                ease: 'power2.out',
                timeline,
                position: 0
            })

            timeline.call(
                () => {
                    this.quantityCallback?.(numBefore + 1)
                },
                [],
                scaleUpDuration
            )
            timeline.call(
                () => {
                    this.quantityCallback?.(numBefore + 2)
                },
                [],
                scaleUpDuration + delayBetween
            )

            const scaleDownStart = scaleUpDuration + delayBetween + 0.1
            scale({
                object: this.element,
                to: 1,
                duration: scaleDownDuration,
                ease: 'back.out(3)',
                timeline,
                position: scaleDownStart
            })
            return
        }

        if (this.playerId === action.targetPlayerId) {
            const numBefore = fromState.board.sundiversForPlayerAt(
                action.targetPlayerId,
                this.coords
            ).length

            if (numBefore <= 0) {
                return
            }

            const numAfter = numBefore - 1

            const leaveStart = 0.5
            timeline.call(
                () => {
                    this.quantityCallback?.(numBefore - 1)
                },
                [],
                leaveStart
            )

            if (numAfter === 0) {
                fadeOut({
                    object: this.element!,
                    duration: 0,
                    timeline,
                    position: leaveStart
                })
            }
        }
    }

    animateActivateEffectAction(
        action: ActivateEffect,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (
            !fromState ||
            action.effect !== EffectType.Procreate ||
            this.playerId !== action.playerId
        ) {
            return
        }

        const procreatedCoords = action.metadata?.procreatedCoords
        if (!procreatedCoords?.length) {
            return
        }

        const isTargetCell = procreatedCoords.some((coords) =>
            sameCoordinates(coords, this.coords)
        )
        if (!isTargetCell) {
            return
        }

        const numBefore = fromState.board.sundiversForPlayerAt(
            action.playerId,
            this.coords
        ).length

        const scaleUp = 1.4
        const scaleUpDuration = 0.2
        const scaleDownDuration = 0.3

        gsap.set(this.element!, { transformOrigin: 'center center' })

        scale({
            object: this.element,
            to: scaleUp,
            duration: scaleUpDuration,
            ease: 'power2.out',
            timeline,
            position: 0
        })

        timeline.call(
            () => {
                this.quantityCallback?.(numBefore + 1)
            },
            [],
            scaleUpDuration
        )

        const scaleDownStart = scaleUpDuration + 0.1
        scale({
            object: this.element,
            to: 1,
            duration: scaleDownDuration,
            ease: 'back.out(3)',
            timeline,
            position: scaleDownStart
        })
    }

    animateSacrificeAction(action: Sacrifice, timeline: gsap.core.Timeline) {
        if (!sameCoordinates(action.coords, this.coords)) {
            return
        }

        const sacrificedSundivers = action.metadata?.sacrificedSundivers
        if (!sacrificedSundivers?.length) {
            return
        }

        const playerIds = Array.from(
            new Set(sacrificedSundivers.map((sundiver) => sundiver.playerId))
        )
        const playerIndex = playerIds.indexOf(this.playerId)
        if (playerIndex < 0) {
            return
        }

        const staggerDelay = 0.15
        const start = playerIndex * staggerDelay

        const scaleUp = 1.4
        const scaleUpDuration = 0.2
        const scaleDownDuration = 0.3

        gsap.set(this.element!, { transformOrigin: 'center center' })

        scale({
            object: this.element,
            to: scaleUp,
            duration: scaleUpDuration,
            ease: 'power2.out',
            timeline,
            position: start
        })

        const scaleDownStart = start + scaleUpDuration
        timeline.call(
            () => {
                this.quantityCallback?.(0)
            },
            [],
            scaleDownStart
        )

        scale({
            object: this.element,
            to: 0,
            duration: scaleDownDuration,
            ease: 'power2.in',
            timeline,
            position: scaleDownStart
        })

        fadeOut({
            object: this.element,
            duration: scaleDownDuration,
            ease: 'power2.in',
            timeline,
            position: scaleDownStart
        })
    }

    animateFlyOrHurlAction(
        action: Fly | Hurl,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (!fromState) {
            return
        }

        const isStart =
            this.playerId === action.playerId && sameCoordinates(action.start, this.coords)
        const isDestination =
            this.playerId === action.playerId &&
            sameCoordinates(action.destination, this.coords) &&
            !sameCoordinates(action.destination, CENTER_COORDS)
        if (!isStart && !isDestination) {
            return
        }

        const moveDuration = 0.5
        const delayBetween = 0.3

        if (isStart && fromState) {
            const board = fromState.board
            const startCell = board.cellAt(action.start)
            const startLocation = this.gameSession.locationForDiverInCell(
                action.playerId,
                startCell
            )

            if (!startLocation) {
                return
            }

            const numBefore = fromState.board.sundiversForPlayerAt(
                action.playerId,
                this.coords
            ).length
            const numAfter = toState.board.sundiversForPlayerAt(action.playerId, this.coords).length
            const leaving = numBefore - numAfter

            if (!numAfter) {
                // Disappear right when the last one leaves
                fadeOut({
                    object: this.element,
                    duration: 0,
                    timeline,
                    position: delayBetween * (leaving - 1)
                })
            }

            for (const index of range(1, leaving).reverse()) {
                timeline.call(
                    () => {
                        this.quantityCallback!(numBefore - index)
                    },
                    [],
                    0 + delayBetween * (index - 1)
                )
            }
        }

        if (isDestination) {
            const board = toState.board
            const destCell = board.cellAt(action.destination)
            const destLocation = this.gameSession.locationForDiverInCell(action.playerId, destCell)

            if (!destLocation) {
                return
            }

            const numBefore =
                fromState?.board.sundiversForPlayerAt(action.playerId, this.coords).length ?? 0
            const numAfter = toState.board.sundiversForPlayerAt(action.playerId, this.coords).length

            const flightPathCoords = action.metadata?.flightPath
            if (!flightPathCoords || flightPathCoords.length < 2) {
                return
            }

            const actualFlightPaths = getFlightPaths({
                action,
                gameSession: this.gameSession,
                playerId: action.playerId,
                pathCoords: flightPathCoords,
                toState,
                fromState
            })
            if (actualFlightPaths.length === 0) {
                return
            }

            const flightDuration = actualFlightPaths.reduce((total, path) => {
                return total + getFlightDuration(action, path.length)
            }, 0)

            if (!numBefore) {
                gsap.set(this.element!, {
                    opacity: 0,
                    x: offsetFromCenter(destLocation).x,
                    y: offsetFromCenter(destLocation).y
                })

                // Appear right when they arrive
                fadeIn({
                    object: this.element,
                    duration: 0,
                    timeline,
                    position: flightDuration
                })
            }

            for (const arriving of range(1, numAfter - numBefore)) {
                timeline.call(
                    () => {
                        this.quantityCallback!(numBefore + arriving)
                    },
                    [],
                    flightDuration + delayBetween * (arriving - 1)
                )
            }
        }
    }

    animateConvertAction(
        convert: Convert,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (this.playerId !== convert.playerId) {
            return
        }
        const localSundivers =
            fromState?.board.sundiversForPlayerAt(convert.playerId, this.coords) || []
        if (!localSundivers.find((diver) => convert.sundiverIds.includes(diver.id))) {
            return
        }

        const numAfter = toState.board.sundiversForPlayerAt(convert.playerId, this.coords).length
        if (numAfter > 0) {
            if (this.quantityCallback) {
                this.quantityCallback(numAfter)
            }

            const toCell = toState.board.cellAt(this.coords)

            const targetLocation = this.gameSession.locationForDiverInCell(convert.playerId, toCell)
            if (!targetLocation) {
                return
            }

            move({
                object: this.element,
                timeline,
                location: offsetFromCenter(targetLocation),
                ease: 'power1.in',
                duration: 0.5,
                position: 0
            })
        } else {
            // Disappear immediately
            fadeOut({
                object: this.element!,
                duration: 0,
                timeline,
                position: 0
            })
        }
    }

    animateActivateAction(
        activate: Activate,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        if (this.playerId !== activate.playerId || !sameCoordinates(activate.coords, this.coords)) {
            return
        }

        const numAfter = toState.board.sundiversForPlayerAt(activate.playerId, this.coords).length
        if (numAfter > 0) {
            if (this.quantityCallback) {
                this.quantityCallback(numAfter)
            }

            return
        } else {
            // Disappear immediately
            fadeOut({
                object: this.element!,
                duration: 0,
                timeline,
                position: 0
            })
        }
    }
}
