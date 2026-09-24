import type { GameAction, GameState, HydratedGameState } from '@tabletop/common'
import type { AnimationContext, GameSession } from '@tabletop/frontend-components'
import { untrack } from 'svelte'

export abstract class StateAnimator<
    T extends GameState,
    U extends HydratedGameState<T> & T,
    S extends GameSession<T, U>
> {
    protected element: HTMLElement | SVGElement | undefined
    private registered = false
    private readonly onGameStateChangeHandler: ({
        to,
        from,
        action,
        animationContext
    }: {
        to: U
        from?: U
        action?: GameAction
        animationContext: AnimationContext
    }) => Promise<void>

    constructor(protected gameSession: S) {
        this.onGameStateChangeHandler = this.onGameStateChange.bind(this)
    }

    onAttach(): void {}
    onDetach(): void {}

    abstract onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: U
        from?: U
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void>

    setElement(element?: HTMLElement | SVGElement): void {
        this.element = element
    }

    register(): void {
        if (this.registered) return
        this.gameSession.addGameStateChangeListener(this.onGameStateChangeHandler)
        this.registered = true
    }

    unregister(): void {
        if (!this.registered) return
        this.gameSession.removeGameStateChangeListener(this.onGameStateChangeHandler)
        this.registered = false
    }
}

// The lifecycle the attach helpers drive. Picked from StateAnimator so any animator fits,
// whatever its game's state types (the full class type is invariant in them).
type AttachableAnimator = Pick<
    StateAnimator<GameState, HydratedGameState, GameSession<GameState, HydratedGameState>>,
    'setElement' | 'onAttach' | 'onDetach' | 'register' | 'unregister'
>

export function attachAnimator(
    animator: AttachableAnimator
): (element: HTMLElement | SVGElement) => () => void {
    return (element: HTMLElement | SVGElement) => {
        animator.setElement(element)
        untrack(() => {
            animator.onAttach()
            animator.register()
        })
        return () => {
            animator.onDetach()
            animator.setElement(undefined)
            animator.unregister()
        }
    }
}
