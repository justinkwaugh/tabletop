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
        if (!this.element || !from || !action) {
            return
        }

        if (isStopTime(action)) {
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

        if (!isRotateTime(action)) {
            return
        }

        const fromAngle = clockHandRotationDegreesForLocation(from.currentLocation)
        const toAngle = clockHandRotationDegreesForLocation(to.currentLocation)
        let delta = (toAngle - fromAngle + 360) % 360
        if (delta === 0 && from.currentLocation !== to.currentLocation) {
            delta = 360
        }
        if (delta === 0) {
            return
        }

        const rotation = { angle: fromAngle }
        const targetAngle = fromAngle + delta

        this.setRotation(fromAngle)
        animationContext.actionTimeline.to(
            rotation,
            {
                angle: targetAngle,
                duration: 0.42,
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
