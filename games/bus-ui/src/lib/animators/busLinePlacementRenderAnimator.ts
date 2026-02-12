import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    isBusNodeId,
    isPlaceBusLine,
    type BusGameState,
    type BusNodeId,
    type HydratedBusGameState
} from '@tabletop/bus'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

type BusLinePlacementRenderAnimatorCallbacks = {
    onStart: (overrides: Map<string, BusNodeId[]>) => void
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

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext: _animationContext
    }: {
        to: HydratedBusGameState
        from?: HydratedBusGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from || !action || !isPlaceBusLine(action)) {
            return
        }

        const overrides = new Map<string, BusNodeId[]>()
        for (const playerState of to.players) {
            if (!playerState.busLine.every(isBusNodeId)) {
                continue
            }
            overrides.set(playerState.playerId, [...playerState.busLine])
        }

        this.callbacks.onStart(overrides)
    }
}
