import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedBoard, HydratedMagnaGreciaGameState } from '@tabletop/magna-grecia'
import { tick } from 'svelte'
import {
    CityFlowMode,
    cityFlowDuration,
    cityFlowPlan,
    type CityFlowPlan
} from '$lib/utils/cityFlow.js'

export type CityFlow = { plan: CityFlowPlan; mode: CityFlowMode }

// Writes one frame of the flow straight to the mounted SVG.
export type CityFlowDraw = (elapsed: number) => void

type CityFlowCallbacks = {
    // Presence only: mounts the flow in place of the cities it replaces.
    show: (flow: CityFlow) => void
    // Hands the cities layer the board the flow ended on and unmounts the flow.
    settle: (board: HydratedBoard) => void
}

// A city tile placed, undone or stepped through in history pours into place (see cityFlow.ts).
// Action playback gets the full flow; undo and history steps get the same shapes in 200ms.
export class CityFlowAnimator {
    private draw: CityFlowDraw | undefined

    constructor(private callbacks: CityFlowCallbacks) {}

    attach(draw: CityFlowDraw): () => void {
        this.draw = draw
        return () => {
            if (this.draw === draw) {
                this.draw = undefined
            }
        }
    }

    async onGameStateChange({
        from,
        to,
        action,
        animationContext
    }: {
        from?: HydratedMagnaGreciaGameState
        to: HydratedMagnaGreciaGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!from) {
            return
        }
        const plan = cityFlowPlan(from.board, to.board)
        if (!plan) {
            return
        }
        const mode = action ? CityFlowMode.Action : CityFlowMode.Fast
        this.callbacks.show({ plan, mode })
        // A full-action replay keeps the reactive state frozen until its last action, so the
        // cities layer holds this action's result rather than dropping back to the old board.
        animationContext.afterAnimations(() => this.callbacks.settle(to.board))

        await tick()
        const draw = this.draw
        if (!draw) {
            return
        }
        const duration = cityFlowDuration(plan, mode)
        const clock = { elapsed: 0 }
        animationContext.actionTimeline.to(
            clock,
            {
                elapsed: duration,
                duration: duration / 1000,
                ease: 'none',
                onUpdate: () => draw(clock.elapsed)
            },
            0
        )
    }
}
