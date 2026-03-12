import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import { gsap } from 'gsap'
import {
    isPlaceBusLine,
    isBusNodeId,
    type BusGameState,
    type BusNodeId,
    type HydratedBusGameState
} from '@tabletop/bus'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

export type AnimatedBusLineSegment = {
    playerId: string
    sourceNodeId: BusNodeId
    targetNodeId: BusNodeId
    progress: number
}

type BusLinePlacementRenderAnimatorCallbacks = {
    onStart: (args: {
        overrides: Map<string, BusNodeId[]>
        animatedSegment?: AnimatedBusLineSegment
    }) => void
    onUpdate: (animatedSegment: AnimatedBusLineSegment) => void
    onComplete: (args: { overrides: Map<string, BusNodeId[]> }) => void
}

export class BusLinePlacementRenderAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    constructor(
        gameSession: BusGameSession,
        private callbacks: BusLinePlacementRenderAnimatorCallbacks
    ) {
        super(gameSession)
    }

    private lineOverridesForState(
        state: HydratedBusGameState
    ): Map<string, BusNodeId[]> {
        const overrides = new Map<string, BusNodeId[]>()
        for (const playerState of state.players) {
            if (!playerState.busLine.every(isBusNodeId)) {
                continue
            }
            overrides.set(playerState.playerId, [...playerState.busLine])
        }
        return overrides
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

        const fromPlayerLineById = new Map(from.players.map((playerState) => [playerState.playerId, playerState.busLine]))
        const lineChanged = to.players.some((playerState) => {
            const fromLine = fromPlayerLineById.get(playerState.playerId)
            if (!fromLine || fromLine.length !== playerState.busLine.length) {
                return true
            }

            return playerState.busLine.some((nodeId, index) => nodeId !== fromLine[index])
        })
        if (!lineChanged) {
            return
        }

        const finalOverrides = this.lineOverridesForState(to)
        if (
            !action ||
            !isPlaceBusLine(action) ||
            !isBusNodeId(action.segment[0]) ||
            !isBusNodeId(action.segment[1])
        ) {
            this.callbacks.onStart({ overrides: finalOverrides })
            return
        }

        const sourceNodeId = action.segment[0]
        const targetNodeId = action.segment[1]
        const priorLine = fromPlayerLineById.get(action.playerId)
        const nextLine = to.players.find((playerState) => playerState.playerId === action.playerId)?.busLine
        if (!priorLine?.every(isBusNodeId) || !nextLine?.every(isBusNodeId)) {
            this.callbacks.onStart({ overrides: finalOverrides })
            return
        }

        const animatedSegment: AnimatedBusLineSegment = {
            playerId: action.playerId,
            sourceNodeId,
            targetNodeId,
            progress: 0
        }

        this.callbacks.onStart({
            overrides: finalOverrides,
            animatedSegment
        })

        animationContext.actionTimeline.to(
            animatedSegment,
            {
                progress: 1,
                duration: 0.28,
                ease: 'power2.out',
                onUpdate: () => {
                    this.callbacks.onUpdate({ ...animatedSegment })
                },
                onComplete: () => {
                    this.callbacks.onComplete({ overrides: finalOverrides })
                }
            },
            0
        )
    }
}
