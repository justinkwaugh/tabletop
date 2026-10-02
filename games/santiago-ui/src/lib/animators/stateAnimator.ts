import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedSantiagoGameState } from '@tabletop/santiago'
import { untrack } from 'svelte'
import type { SantiagoGameSession } from '$lib/stores/SantiagoGameSession.svelte.js'

// Arguments every animator receives from the session; see
// libs/frontend-components/src/lib/utils/ANIMATION_PATTERN.md. The session plays the shared
// timelines and runs afterAnimations before it assigns the new reactive state, so during a tween
// gameSession.gameState is still `from`. `action` present means cinematic; absent means the fast
// fallback used by undo and state-only history navigation.
export type StateChange = {
    to: HydratedSantiagoGameState
    from?: HydratedSantiagoGameState
    action?: GameAction
    animationContext: AnimationContext
}

export const FALLBACK_DURATION = 0.1

export abstract class StateAnimator {
    private registered = false
    private readonly handler: (change: StateChange) => Promise<void>

    constructor(protected gameSession: SantiagoGameSession) {
        this.handler = this.onGameStateChange.bind(this)
    }

    abstract onGameStateChange(change: StateChange): Promise<void>

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

// Ties an animator's registration to the lifetime of the element that hosts it. Registering reads
// session state and attachments run inside an effect, so untrack keeps unrelated state changes
// from re-running it.
export function attachAnimator(animator: StateAnimator) {
    return (_element: HTMLElement | SVGElement) => {
        untrack(() => animator.register())
        return () => animator.unregister()
    }
}
