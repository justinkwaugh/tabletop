import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import { isStopTime, type BusGameState, type HydratedBusGameState } from '@tabletop/bus'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

export type TimeStoneKey = 'bottom-left' | 'bottom' | 'right' | 'top-right' | 'top-left'

export type TimeStoneRender = {
    key: TimeStoneKey
    point: { x: number; y: number }
    spriteHref: string
}

type AnimatedTimeStoneState = {
    key: TimeStoneKey
    point: { x: number; y: number }
    spriteHref: string
    scale: number
    yOffset: number
    opacity: number
}

type TimeStoneSelectionAnimatorCallbacks = {
    onStart: (stone: AnimatedTimeStoneState) => void
    onUpdate: (state: Pick<AnimatedTimeStoneState, 'scale' | 'yOffset' | 'opacity'>) => void
    onComplete: () => void
}

const PRESS_SCALE = 0.93
const PRESS_Y_OFFSET = 2.2
const PRESS_DURATION = 0.1
const PRESS_PAUSE_DURATION = 0.1
const SHRINK_DURATION = 0.28

export class TimeStoneSelectionAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    constructor(
        gameSession: BusGameSession,
        private renderOrder: readonly TimeStoneRender[],
        private clickPriority: readonly TimeStoneKey[],
        private callbacks: TimeStoneSelectionAnimatorCallbacks
    ) {
        super(gameSession)
    }

    override async onGameStateChange({
        from,
        action,
        animationContext
    }: {
        to: HydratedBusGameState
        from?: HydratedBusGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from || !action || !isStopTime(action)) {
            return
        }

        const visibleFromCount = Math.max(0, Math.min(from.stones, this.renderOrder.length))
        const visibleFromStones = this.renderOrder.slice(0, visibleFromCount)
        if (visibleFromStones.length === 0) {
            return
        }

        const visibleKeys = new Set(visibleFromStones.map((stone) => stone.key))
        const selectedKey = this.clickPriority.find((key) => visibleKeys.has(key))
        if (!selectedKey) {
            return
        }

        const selectedStone = visibleFromStones.find((stone) => stone.key === selectedKey)
        if (!selectedStone) {
            return
        }

        const transient = {
            scale: 1,
            yOffset: 0,
            opacity: 1
        }

        this.callbacks.onStart({
            ...selectedStone,
            ...transient
        })

        animationContext.actionTimeline.to(transient, {
            scale: PRESS_SCALE,
            yOffset: PRESS_Y_OFFSET,
            duration: PRESS_DURATION,
            ease: 'power2.out',
            onUpdate: () => {
                this.callbacks.onUpdate({
                    scale: transient.scale,
                    yOffset: transient.yOffset,
                    opacity: transient.opacity
                })
            }
        })

        animationContext.actionTimeline.to({}, { duration: PRESS_PAUSE_DURATION })

        animationContext.actionTimeline.to(transient, {
            scale: 0,
            opacity: 0,
            duration: SHRINK_DURATION,
            ease: 'power2.in',
            onUpdate: () => {
                this.callbacks.onUpdate({
                    scale: transient.scale,
                    yOffset: transient.yOffset,
                    opacity: transient.opacity
                })
            }
        })

        animationContext.afterAnimations(() => {
            this.callbacks.onComplete()
        })
    }
}
