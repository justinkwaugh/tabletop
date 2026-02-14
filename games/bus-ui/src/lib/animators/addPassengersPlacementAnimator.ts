import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import { gsap } from 'gsap'
import {
    BUS_STATION_IDS,
    isAddPassengers,
    isBusNodeId,
    type BusGameState,
    type BusNodeId,
    type HydratedBusGameState,
    type BusStationId
} from '@tabletop/bus'
import { tick } from 'svelte'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

type AddPassengersPlacementAnimatorCallbacks = {
    onPrepareCount: (args: { nodeId: BusNodeId; count: number }) => void
}

const INITIAL_SCALE = 0.2
const POP_OVERSHOOT_SCALE = 1.16
const FALLBACK_POP_DURATION = 0.1
const FALLBACK_SETTLE_DURATION = 0.08
const FALLBACK_POP_OUT_DURATION = 0.08
const FALLBACK_SHRINK_OUT_DURATION = 0.1

export class AddPassengersPlacementAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    private passengerElements = new Map<BusNodeId, HTMLElement | SVGElement>()

    constructor(
        gameSession: BusGameSession,
        private callbacks: AddPassengersPlacementAnimatorCallbacks
    ) {
        super(gameSession)
    }

    setPassengerElement(nodeId: BusNodeId, element?: HTMLElement | SVGElement): void {
        if (!element) {
            this.passengerElements.delete(nodeId)
            return
        }
        this.passengerElements.set(nodeId, element)
    }

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedBusGameState
        from?: HydratedBusGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from) {
            return
        }

        const stationId: BusStationId | undefined = (() => {
            if (action && isAddPassengers(action) && isBusNodeId(action.stationId)) {
                return action.stationId as BusStationId
            }

            for (const candidateStationId of BUS_STATION_IDS) {
                const fromCount = from.board.passengersAtNode(candidateStationId).length
                const toCount = to.board.passengersAtNode(candidateStationId).length
                if (toCount > fromCount) {
                    return candidateStationId
                }
            }

            for (const candidateStationId of BUS_STATION_IDS) {
                const fromCount = from.board.passengersAtNode(candidateStationId).length
                const toCount = to.board.passengersAtNode(candidateStationId).length
                if (toCount < fromCount) {
                    return candidateStationId
                }
            }

            return undefined
        })()

        if (!stationId) {
            return
        }

        const fromCount = from.board.passengersAtNode(stationId).length
        const toCount = to.board.passengersAtNode(stationId).length
        const delta = toCount - fromCount
        if (delta === 0) {
            return
        }

        // For additions and non-empty decrements, pre-write the resulting count so the
        // persistent station passenger updates immediately before state reactivity.
        if (toCount > 0) {
            this.callbacks.onPrepareCount({
                nodeId: stationId,
                count: toCount
            })
            await tick()
        }

        const element = this.passengerElements.get(stationId)
        if (!element) {
            return
        }

        const popDuration = action ? 0.18 : FALLBACK_POP_DURATION
        const settleDuration = action ? 0.16 : FALLBACK_SETTLE_DURATION
        const popOutDuration = action ? 0.12 : FALLBACK_POP_OUT_DURATION
        const shrinkOutDuration = action ? 0.16 : FALLBACK_SHRINK_OUT_DURATION

        if (delta > 0) {
            const startScale = fromCount === 0 ? INITIAL_SCALE : 1
            gsap.set(element, {
                transformOrigin: 'center center',
                scale: startScale,
                opacity: 1
            })

            animationContext.actionTimeline.to(
                element,
                {
                    scale: POP_OVERSHOOT_SCALE,
                    duration: popDuration,
                    ease: 'back.out(2.2)'
                },
                0
            )

            animationContext.actionTimeline.to(
                element,
                {
                    scale: 1,
                    duration: settleDuration,
                    ease: 'power2.out'
                },
                popDuration
            )
            return
        }

        // Undo/decrement path.
        gsap.set(element, {
            transformOrigin: 'center center',
            scale: 1,
            opacity: 1
        })

        animationContext.actionTimeline.to(
            element,
            {
                scale: POP_OVERSHOOT_SCALE,
                duration: popOutDuration,
                ease: 'power1.out'
            },
            0
        )

        if (toCount <= 0) {
            animationContext.actionTimeline.to(
                element,
                {
                    scale: INITIAL_SCALE,
                    opacity: 0,
                    duration: shrinkOutDuration,
                    ease: 'power2.in'
                },
                popOutDuration
            )
            return
        }

        animationContext.actionTimeline.to(
            element,
            {
                scale: 1,
                duration: settleDuration,
                ease: 'power2.out'
            },
            popOutDuration
        )
    }
}

export function animateStationPassenger(
    node: HTMLElement | SVGElement,
    params: { animator: AddPassengersPlacementAnimator; nodeId: BusNodeId }
): {
    update: (next: { animator: AddPassengersPlacementAnimator; nodeId: BusNodeId }) => void
    destroy: () => void
} {
    let currentAnimator = params.animator
    let currentNodeId = params.nodeId
    currentAnimator.setPassengerElement(currentNodeId, node)

    return {
        update(next) {
            if (next.animator === currentAnimator && next.nodeId === currentNodeId) {
                return
            }

            currentAnimator.setPassengerElement(currentNodeId, undefined)
            currentAnimator = next.animator
            currentNodeId = next.nodeId
            currentAnimator.setPassengerElement(currentNodeId, node)
        },
        destroy() {
            currentAnimator.setPassengerElement(currentNodeId, undefined)
        }
    }
}
