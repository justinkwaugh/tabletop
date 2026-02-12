import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import type { BusGameState, HydratedBusGameState } from '@tabletop/bus'
import { buildActionWorkerPlacements } from './workerCylinderPlacementAnimator.js'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

type AnimatedRemovedWorkerCylinderState = {
    key: string
    x: number
    y: number
    color: string
    scale: number
    opacity: number
}

type WorkerCylinderRemovalAnimatorCallbacks = {
    onStart: (state: AnimatedRemovedWorkerCylinderState) => void
    onUpdate: (state: Pick<AnimatedRemovedWorkerCylinderState, 'key' | 'scale' | 'opacity'>) => void
    onComplete: (key: string) => void
}

export class WorkerCylinderRemovalAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    constructor(
        gameSession: BusGameSession,
        private callbacks: WorkerCylinderRemovalAnimatorCallbacks
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
        if (!from || !action) {
            return
        }

        const fromPlacements = buildActionWorkerPlacements(from)
        const toPlacementKeys = new Set(buildActionWorkerPlacements(to).map((placement) => placement.key))
        const removedPlacements = fromPlacements.filter((placement) => !toPlacementKeys.has(placement.key))

        if (removedPlacements.length === 0) {
            return
        }

        for (const removedPlacement of removedPlacements) {
            const transient = {
                key: removedPlacement.key,
                scale: 1,
                opacity: 1
            }

            this.callbacks.onStart({
                key: removedPlacement.key,
                x: removedPlacement.point.x,
                y: removedPlacement.point.y,
                color: this.gameSession.colors.getPlayerUiColor(removedPlacement.playerId),
                scale: transient.scale,
                opacity: transient.opacity
            })

            animationContext.actionTimeline.to(
                transient,
                {
                    scale: 1.16,
                    duration: 0.12,
                    ease: 'power1.out',
                    onUpdate: () => {
                        this.callbacks.onUpdate({
                            key: transient.key,
                            scale: transient.scale,
                            opacity: transient.opacity
                        })
                    }
                },
                0
            )

            animationContext.actionTimeline.to(
                transient,
                {
                    scale: 0.2,
                    opacity: 0,
                    duration: 0.2,
                    ease: 'power2.in',
                    onUpdate: () => {
                        this.callbacks.onUpdate({
                            key: transient.key,
                            scale: transient.scale,
                            opacity: transient.opacity
                        })
                    }
                },
                0.12
            )

            animationContext.afterAnimations(() => {
                this.callbacks.onComplete(removedPlacement.key)
            })
        }
    }
}
