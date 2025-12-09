import type { GameAction, GameState, HydratedGameState } from '@tabletop/common'
import type { AnimationContext, GameSession } from '@tabletop/frontend-components'
import { untrack } from 'svelte'

export abstract class StateAnimator<
    T extends GameState,
    U extends HydratedGameState & T,
    S extends GameSession<T, U>
> {
    protected element: HTMLElement | SVGElement | undefined

    constructor(protected gameSession: S) {}

    onAttach(): void {
        // Optional override
    }

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
        this.gameSession.addGameStateChangeListener(this.onGameStateChange.bind(this))
    }

    unregister(): void {
        this.gameSession.removeGameStateChangeListener(this.onGameStateChange.bind(this))
    }
}

export function attachAnimator(
    animator: StateAnimator<any, any, any>
): (element: HTMLElement | SVGElement) => () => void {
    return (element: HTMLElement | SVGElement) => {
        animator.setElement(element)

        untrack(() => {
            animator.onAttach()
            animator.register()
        })

        return () => {
            animator.unregister()
        }
    }
}
