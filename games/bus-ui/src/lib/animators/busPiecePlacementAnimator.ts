import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import { Color } from '@tabletop/common'
import { isAddBus, type BusGameState, type HydratedBusGameState } from '@tabletop/bus'
import { BUS_BUSES_TABLE_SLOT_POINTS_BY_COLOR } from '$lib/definitions/busBoardGraph.js'
import { busesTableColumnKeyForColor } from '$lib/utils/busesTableColumn.js'
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
    onPlacementStart: (state: AnimatedBusPieceState) => void
    onPlacementUpdate: (state: Pick<AnimatedBusPieceState, 'key' | 'scale' | 'opacity'>) => void
    onRemovalStart: (state: AnimatedBusPieceState) => void
    onRemovalUpdate: (state: Pick<AnimatedBusPieceState, 'key' | 'scale' | 'opacity'>) => void
}

type BusesTablePiecePlacement = {
    key: string
    point: { x: number; y: number }
    playerId: string
    color: string
}

export function buildBusesTablePiecePlacements(
    state: HydratedBusGameState,
    getPlayerColor: (playerId: string) => Color | undefined,
    getPlayerUiColor: (playerId: string) => string
): BusesTablePiecePlacement[] {
    const placements: BusesTablePiecePlacement[] = []

    for (const playerState of state.players) {
        const columnKey = busesTableColumnKeyForColor(getPlayerColor(playerState.playerId))
        if (!columnKey) {
            continue
        }

        const slots = BUS_BUSES_TABLE_SLOT_POINTS_BY_COLOR[columnKey]
        if (!slots?.length) {
            continue
        }

        const count = Math.max(0, Math.min(Math.round(playerState.buses), slots.length))
        const color = getPlayerUiColor(playerState.playerId)
        for (let index = 0; index < count; index += 1) {
            const point = slots[index]
            if (!point) {
                continue
            }
            placements.push({
                key: `buses:${playerState.playerId}:${index}`,
                point,
                playerId: playerState.playerId,
                color
            })
        }
    }

    return placements
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
        if (!from) {
            return
        }

        const hasAddBusAction = !!action && isAddBus(action)
        const placementPopDuration = hasAddBusAction ? 0.18 : 0.1
        const placementSettleDuration = hasAddBusAction ? 0.14 : 0.08
        const removalPopDuration = hasAddBusAction ? 0.12 : 0.08
        const removalShrinkDuration = hasAddBusAction ? 0.2 : 0.12

        const fromPlacements = buildBusesTablePiecePlacements(
            from,
            (playerId) => this.gameSession.colors.getPlayerColor(playerId),
            (playerId) => this.gameSession.colors.getPlayerUiColor(playerId)
        )
        const toPlacements = buildBusesTablePiecePlacements(
            to,
            (playerId) => this.gameSession.colors.getPlayerColor(playerId),
            (playerId) => this.gameSession.colors.getPlayerUiColor(playerId)
        )

        const fromByKey = new Map(fromPlacements.map((placement) => [placement.key, placement]))
        const toByKey = new Map(toPlacements.map((placement) => [placement.key, placement]))

        for (const [key, removedPlacement] of fromByKey) {
            if (toByKey.has(key)) {
                continue
            }

            const transient = {
                key,
                scale: 1,
                opacity: 1
            }

            this.callbacks.onRemovalStart({
                key,
                x: removedPlacement.point.x,
                y: removedPlacement.point.y,
                color: removedPlacement.color,
                scale: transient.scale,
                opacity: transient.opacity
            })

            animationContext.actionTimeline.to(
                transient,
                {
                    scale: 1.14,
                    duration: removalPopDuration,
                    ease: 'power1.out',
                    onUpdate: () => {
                        this.callbacks.onRemovalUpdate({
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
                    duration: removalShrinkDuration,
                    ease: 'power2.in',
                    onUpdate: () => {
                        this.callbacks.onRemovalUpdate({
                            key: transient.key,
                            scale: transient.scale,
                            opacity: transient.opacity
                        })
                    }
                },
                removalPopDuration
            )
        }

        for (const [key, addedPlacement] of toByKey) {
            if (fromByKey.has(key)) {
                continue
            }

            const transient = {
                key,
                scale: 0.22,
                opacity: 0.95
            }

            this.callbacks.onPlacementStart({
                key,
                x: addedPlacement.point.x,
                y: addedPlacement.point.y,
                color: addedPlacement.color,
                scale: transient.scale,
                opacity: transient.opacity
            })

            animationContext.actionTimeline.to(
                transient,
                {
                    scale: 1.16,
                    opacity: 1,
                    duration: placementPopDuration,
                    ease: 'back.out(2.2)',
                    onUpdate: () => {
                        this.callbacks.onPlacementUpdate({
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
                    scale: 1,
                    duration: placementSettleDuration,
                    ease: 'power2.out',
                    onUpdate: () => {
                        this.callbacks.onPlacementUpdate({
                            key: transient.key,
                            scale: transient.scale,
                            opacity: transient.opacity
                        })
                    }
                },
                placementPopDuration
            )
        }
    }
}
