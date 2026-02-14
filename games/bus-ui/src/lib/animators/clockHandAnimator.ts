import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    BuildingType,
    isRotateTime,
    isStopTime,
    type BusGameState,
    type HydratedBusGameState
} from '@tabletop/bus'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

export type ClockHandGeometry = {
    originX: number
    originY: number
    pivotX: number
    pivotY: number
}

export function clockHandRotationDegreesForLocation(location: BuildingType): number {
    switch (location) {
        case BuildingType.House:
            return 0
        case BuildingType.Office:
            return 120
        case BuildingType.Pub:
            return 240
        default:
            return 0
    }
}

export function buildClockHandTransform(geometry: ClockHandGeometry, angle: number): string {
    return `translate(${geometry.originX} ${geometry.originY}) rotate(${angle} ${geometry.pivotX} ${geometry.pivotY})`
}

const LOCATION_CYCLE: BuildingType[] = [BuildingType.House, BuildingType.Office, BuildingType.Pub]
const STEP_DEGREES = 120

function clockHandStepDelta(from: BuildingType, to: BuildingType): number {
    if (from === to) {
        return 0
    }

    const fromIndex = LOCATION_CYCLE.indexOf(from)
    const toIndex = LOCATION_CYCLE.indexOf(to)
    if (fromIndex < 0 || toIndex < 0) {
        return 0
    }

    const clockwiseIndex = (fromIndex + 1) % LOCATION_CYCLE.length
    if (LOCATION_CYCLE[clockwiseIndex] === to) {
        return STEP_DEGREES
    }

    const counterClockwiseIndex = (fromIndex - 1 + LOCATION_CYCLE.length) % LOCATION_CYCLE.length
    if (LOCATION_CYCLE[counterClockwiseIndex] === to) {
        return -STEP_DEGREES
    }

    // Should not occur in Bus (clock always moves one space), but keep deterministic fallback.
    const clockwiseDistance = (toIndex - fromIndex + LOCATION_CYCLE.length) % LOCATION_CYCLE.length
    const counterClockwiseDistance =
        (fromIndex - toIndex + LOCATION_CYCLE.length) % LOCATION_CYCLE.length

    return clockwiseDistance <= counterClockwiseDistance
        ? clockwiseDistance * STEP_DEGREES
        : -counterClockwiseDistance * STEP_DEGREES
}

export class ClockHandAnimator extends StateAnimator<BusGameState, HydratedBusGameState, BusGameSession> {
    constructor(
        gameSession: BusGameSession,
        private geometry: ClockHandGeometry
    ) {
        super(gameSession)
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
        if (!this.element || !from) {
            return
        }

        if (action && isStopTime(action)) {
            const fromAngle = clockHandRotationDegreesForLocation(from.currentLocation)
            const halfwayAngle = fromAngle + 60
            const wiggleDelta = 7
            const rotation = { angle: fromAngle }
            const startAt = 0
            const toHalfDuration = 0.24
            const wiggleOneDuration = 0.07
            const wiggleTwoDuration = 0.08
            const wiggleThreeDuration = 0.06
            const returnDuration = 0.22

            this.setRotation(fromAngle)

            animationContext.actionTimeline.to(
                rotation,
                {
                    angle: halfwayAngle,
                    duration: toHalfDuration,
                    ease: 'power2.out',
                    onUpdate: () => {
                        this.setRotation(rotation.angle)
                    }
                },
                startAt
            )

            animationContext.actionTimeline.to(
                rotation,
                {
                    angle: halfwayAngle + wiggleDelta,
                    duration: wiggleOneDuration,
                    ease: 'power1.inOut',
                    onUpdate: () => {
                        this.setRotation(rotation.angle)
                    }
                },
                startAt + toHalfDuration
            )

            animationContext.actionTimeline.to(
                rotation,
                {
                    angle: halfwayAngle - wiggleDelta * 0.85,
                    duration: wiggleTwoDuration,
                    ease: 'power1.inOut',
                    onUpdate: () => {
                        this.setRotation(rotation.angle)
                    }
                },
                startAt + toHalfDuration + wiggleOneDuration
            )

            animationContext.actionTimeline.to(
                rotation,
                {
                    angle: halfwayAngle + wiggleDelta * 0.35,
                    duration: wiggleThreeDuration,
                    ease: 'power1.inOut',
                    onUpdate: () => {
                        this.setRotation(rotation.angle)
                    }
                },
                startAt + toHalfDuration + wiggleOneDuration + wiggleTwoDuration
            )

            animationContext.actionTimeline.to(
                rotation,
                {
                    angle: fromAngle,
                    duration: returnDuration,
                    ease: 'power2.inOut',
                    onUpdate: () => {
                        this.setRotation(rotation.angle)
                    }
                },
                startAt + toHalfDuration + wiggleOneDuration + wiggleTwoDuration + wiggleThreeDuration
            )

            animationContext.afterAnimations(() => {
                this.setRotation(fromAngle)
            })
            return
        }

        if (action && !isRotateTime(action)) {
            return
        }

        if (from.currentLocation === to.currentLocation) {
            return
        }

        const fromAngle = clockHandRotationDegreesForLocation(from.currentLocation)
        const delta = clockHandStepDelta(from.currentLocation, to.currentLocation)
        if (delta === 0) {
            return
        }

        const rotation = { angle: fromAngle }
        const targetAngle = fromAngle + delta
        const toAngle = clockHandRotationDegreesForLocation(to.currentLocation)
        const duration = action ? 0.42 : 0.18

        this.setRotation(fromAngle)
        animationContext.actionTimeline.to(
            rotation,
            {
                angle: targetAngle,
                duration,
                ease: 'power2.inOut',
                onUpdate: () => {
                    this.setRotation(rotation.angle)
                }
            },
            0
        )

        animationContext.afterAnimations(() => {
            this.setRotation(toAngle)
        })
    }

    private setRotation(angle: number): void {
        if (!this.element) {
            return
        }
        this.element.setAttribute('transform', buildClockHandTransform(this.geometry, angle))
    }
}
