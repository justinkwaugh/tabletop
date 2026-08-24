import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedLowenherzGameState } from '@tabletop/lowenherz'
import { untrack } from 'svelte'
import type { LowenherzGameSession } from '$lib/model/session.svelte.js'

/**
 * Arguments every animator receives, straight from the session. See
 * libs/frontend-components/src/lib/utils/ANIMATION_PATTERN.md for the contract; the two parts that
 * matter most here:
 *
 * - The session gathers each listener's tweens, plays the shared timelines, runs afterAnimations,
 *   and ONLY THEN assigns the new reactive state. So during a tween `gameSession.gameState` is
 *   still `from`, and anything that must show the `to` values first has to render them transiently.
 * - `action` present means cinematic; `action` absent means fast fallback. That is how the three
 *   history intents reach an animator: `full-action` replay delivers each action, plain navigation
 *   and undo suppress them (see GameSession.onHistoryAction setting suppressStateChangeActions),
 *   and `silent-swap` never calls listeners at all. Branching on `isViewingHistory` instead - which
 *   is what this code used to do - throws that distinction away and makes replay silent.
 */
export type StateChange = {
    to: HydratedLowenherzGameState
    from?: HydratedLowenherzGameState
    action?: GameAction
    animationContext: AnimationContext
}

/**
 * Base for Löwenherz's animators, modelled on bus-ui's StateAnimator. Concrete rather than generic
 * over game/state/session types, since there is exactly one game here to be generic over.
 *
 * Fallback budget for the action-absent path. The spec asks for <= 200ms; Justin's guidance is
 * ~0.1s, which is also what bus-ui's FALLBACK_* constants land on.
 */
export const FALLBACK_DURATION = 0.1

export abstract class StateAnimator {
    private registered = false
    private readonly handler: (change: StateChange) => Promise<void>

    constructor(protected gameSession: LowenherzGameSession) {
        this.handler = this.onGameStateChange.bind(this)
    }

    abstract onGameStateChange(change: StateChange): Promise<void>

    /** Called when the host element mounts/unmounts, for animators that hold a single node. */
    onAttach(_element: HTMLElement | SVGElement): void {}
    onDetach(): void {}

    register(): void {
        if (this.registered) return
        this.gameSession.addGameStateChangeListener(this.handler)
        this.registered = true
    }

    unregister(): void {
        if (!this.registered) return
        this.gameSession.removeGameStateChangeListener(this.handler)
        this.registered = false
    }
}

/**
 * `{@attach attachAnimator(animator)}` ties an animator's registration to the lifetime of the
 * element that hosts it, so there is no mount/unmount bookkeeping in the component.
 *
 * untrack, as in bus-ui: registering reads session state, and an attachment runs inside an effect,
 * so without it the attachment would re-run on unrelated state changes.
 */
export function attachAnimator(animator: StateAnimator) {
    return (element: HTMLElement | SVGElement) => {
        untrack(() => {
            animator.onAttach(element)
            animator.register()
        })
        return () => {
            animator.onDetach()
            animator.unregister()
        }
    }
}
