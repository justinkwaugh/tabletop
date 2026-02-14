import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    isBusNodeId,
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
        animationContext: _animationContext
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
