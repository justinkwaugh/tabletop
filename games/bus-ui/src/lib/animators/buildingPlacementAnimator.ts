import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    isPlaceBuilding,
    isSiteId,
    type BuildingSiteId,
    type BuildingType,
    type BusGameState,
    type HydratedBusGameState
} from '@tabletop/bus'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

type BuildingPlacementAnimatorCallbacks = {
    onStart: (args: { siteId: BuildingSiteId; buildingType: BuildingType; scale: number }) => void
    onUpdate: (scale: number) => void
    onComplete: () => void
}

const INITIAL_SCALE = 0.2
const POP_OVERSHOOT_SCALE = 1.16

export class BuildingPlacementAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    constructor(
        gameSession: BusGameSession,
        private callbacks: BuildingPlacementAnimatorCallbacks
    ) {
        super(gameSession)
    }

    override async onGameStateChange({
        action,
        animationContext
    }: {
        to: HydratedBusGameState
        from?: HydratedBusGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!action || !isPlaceBuilding(action) || !isSiteId(action.siteId)) {
            return
        }

        const scaleState = { scale: INITIAL_SCALE }
        this.callbacks.onStart({
            siteId: action.siteId,
            buildingType: action.buildingType,
            scale: INITIAL_SCALE
        })

        animationContext.actionTimeline.to(scaleState, {
            scale: POP_OVERSHOOT_SCALE,
            duration: 0.18,
            ease: 'back.out(2.2)',
            onUpdate: () => {
                this.callbacks.onUpdate(scaleState.scale)
            }
        })

        animationContext.actionTimeline.to(scaleState, {
            scale: 1,
            duration: 0.14,
            ease: 'power2.out',
            onUpdate: () => {
                this.callbacks.onUpdate(scaleState.scale)
            }
        })

        animationContext.afterAnimations(() => {
            this.callbacks.onComplete()
        })
    }
}
