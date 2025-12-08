import {
    Activate,
    Convert,
    Fly,
    HydratedSolGameState,
    isActivate,
    isConvert,
    isFly,
    isLaunch,
    Launch,
    type SolGameState
} from '@tabletop/sol'
import { StateAnimator } from './stateAnimator.js'
import { GameAction, OffsetCoordinates, range, sameCoordinates, samePoint } from '@tabletop/common'
import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'
import { fadeIn, fadeOut, move } from '$lib/utils/animations.js'
import { gsap } from 'gsap'
import { offsetFromCenter } from '$lib/utils/boardGeometry.js'

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
        // console.log('CellSundiverAnimator attached for player', this.playerId, 'at', this.coords)
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
        timeline
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action?: GameAction
        timeline: gsap.core.Timeline
    }) {
        if (!this.element) {
            return
        }

        if (action) {
            this.animateAction(action, timeline, to, from)
        }

        const toCell = to.board.cellAt(this.coords)
        const fromCell = from?.board.cellAt(this.coords)
        if (!toCell && !fromCell) {
            return
        }

        const toDivers = to.board.sundiversForPlayerAt(this.playerId, this.coords)
        const fromDivers = from?.board.sundiversForPlayerAt(this.playerId, this.coords) ?? []

        if (toDivers.length > 0) {
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
                    fadeIn({
                        object: this.element,
                        duration: 0.3,
                        timeline,
                        position: 0
                    })
                    return
                }

                const sourceLocation = this.gameSession.locationForDiverInCell(
                    this.playerId,
                    fromCell!
                )
                if (sourceLocation && !samePoint(sourceLocation, targetLocation)) {
                    console.log('animating sundiver from ', sourceLocation, 'to', targetLocation)
                    move({
                        object: this.element,
                        timeline,
                        location: offsetFromCenter(targetLocation),
                        duration: 0.4,
                        position: 0
                    })
                }
            } else {
                gsap.set(this.element!, {
                    opacity: 1,
                    translateX: offsetFromCenter(targetLocation).x,
                    translateY: offsetFromCenter(targetLocation).y
                })
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
        } else if (isFly(action)) {
            this.animateFlyAction(action, timeline, toState, fromState)
        }
    }

    mayBeAffectedByAction(action: GameAction): boolean {
        if (isLaunch(action)) {
            return (
                action.playerId !== this.playerId &&
                sameCoordinates(action.destination, this.coords)
            )
        } else if (isFly(action)) {
            return (
                action.playerId !== this.playerId &&
                (sameCoordinates(action.start, this.coords) ||
                    sameCoordinates(action.destination, this.coords))
            )
        } else if (isConvert(action)) {
            if (action.playerId !== this.playerId) {
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

    animateFlyAction(
        fly: Fly,
        timeline: gsap.core.Timeline,
        toState: HydratedSolGameState,
        fromState?: HydratedSolGameState
    ) {
        const isStart = this.playerId === fly.playerId && sameCoordinates(fly.start, this.coords)
        const isDestination =
            this.playerId === fly.playerId && sameCoordinates(fly.destination, this.coords)
        if (!isStart && !isDestination) {
            return
        }

        const moveDuration = 0.5
        const delayBetween = 0.3

        if (isStart && fromState) {
            const board = fromState.board
            const startCell = board.cellAt(fly.start)
            const startLocation = this.gameSession.locationForDiverInCell(fly.playerId, startCell)

            if (!startLocation) {
                return
            }

            const numBefore = fromState.board.sundiversForPlayerAt(fly.playerId, this.coords).length
            const numAfter = toState.board.sundiversForPlayerAt(fly.playerId, this.coords).length
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
            const destCell = board.cellAt(fly.destination)
            const destLocation = this.gameSession.locationForDiverInCell(fly.playerId, destCell)

            if (!destLocation) {
                return
            }

            const numBefore =
                fromState?.board.sundiversForPlayerAt(fly.playerId, this.coords).length ?? 0
            const numAfter = toState.board.sundiversForPlayerAt(fly.playerId, this.coords).length

            const flightPath = fly.metadata?.flightPath
            if (!flightPath || flightPath.length < 2) {
                return
            }

            const firstArrivalTime = (flightPath.length - 1) * moveDuration

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
                    position: firstArrivalTime
                })
            }

            for (const arriving of range(1, numAfter - numBefore)) {
                timeline.call(
                    () => {
                        this.quantityCallback!(numBefore + arriving)
                    },
                    [],
                    firstArrivalTime + delayBetween * (arriving - 1)
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
