import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import { Color } from '@tabletop/common'
import { isAddBus, type BusGameState, type HydratedBusGameState } from '@tabletop/bus'
import { BUS_BUSES_TABLE_SLOT_POINTS_BY_COLOR } from '$lib/definitions/busBoardGraph.js'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

type AnimatedBusPieceState = {
    key: string
    x: number
    y: number
    color: string
    scale: number
    opacity: number
}

type BusPiecePlacementAnimatorCallbacks = {
    onStart: (state: AnimatedBusPieceState) => void
    onUpdate: (state: Pick<AnimatedBusPieceState, 'scale' | 'opacity'>) => void
}

function busesTableColumnKeyForColor(
    color: Color | undefined
): keyof typeof BUS_BUSES_TABLE_SLOT_POINTS_BY_COLOR | undefined {
    switch (color) {
        case Color.Purple:
            return 'purple'
        case Color.Blue:
            return 'blue'
        case Color.Green:
            return 'green'
        case Color.Yellow:
            return 'yellow'
        case Color.Red:
            return 'red'
        default:
            return undefined
    }
}

export class BusPiecePlacementAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    constructor(
        gameSession: BusGameSession,
        private callbacks: BusPiecePlacementAnimatorCallbacks
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
        if (!from || !action || !isAddBus(action)) {
            return
        }

        const fromPlayer = from.getPlayerState(action.playerId)
        const toPlayer = to.getPlayerState(action.playerId)
        const fromCount = Math.max(0, Math.round(fromPlayer.buses))
        const toCount = Math.max(0, Math.round(toPlayer.buses))
        if (toCount <= fromCount) {
            return
        }

        const columnKey = busesTableColumnKeyForColor(toPlayer.color)
        if (!columnKey) {
            return
        }

        const slots = BUS_BUSES_TABLE_SLOT_POINTS_BY_COLOR[columnKey]
        if (!slots?.length) {
            return
        }

        const newIndex = Math.min(toCount - 1, slots.length - 1)
        const point = slots[newIndex]
        if (!point) {
            return
        }

        const transient = {
            scale: 0.22,
            opacity: 0.95
        }

        this.callbacks.onStart({
            key: `buses:${action.playerId}:${newIndex}`,
            x: point.x,
            y: point.y,
            color: this.gameSession.colors.getPlayerUiColor(action.playerId),
            scale: transient.scale,
            opacity: transient.opacity
        })

        const startAt = 0
        const popDuration = 0.18

        animationContext.actionTimeline.to(
            transient,
            {
                scale: 1.16,
                opacity: 1,
                duration: popDuration,
                ease: 'back.out(2.2)',
                onUpdate: () => {
                    this.callbacks.onUpdate({
                        scale: transient.scale,
                        opacity: transient.opacity
                    })
                }
            },
            startAt
        )

        animationContext.actionTimeline.to(
            transient,
            {
                scale: 1,
                duration: 0.14,
                ease: 'power2.out',
                onUpdate: () => {
                    this.callbacks.onUpdate({
                        scale: transient.scale,
                        opacity: transient.opacity
                    })
                }
            },
            startAt + popDuration
        )

    }
}
