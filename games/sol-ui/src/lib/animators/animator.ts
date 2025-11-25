import type { GameState, HydratedGameState } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'

export abstract class StateAnimator<
    T extends GameState,
    U extends HydratedGameState & T,
    S extends GameSession<T, U>
> {
    protected element: HTMLElement | SVGElement | undefined

    constructor(protected gameSession: S) {}

    abstract onGameStateChange({
        to,
        from,
        timeline
    }: {
        to: U
        from?: U
        timeline: gsap.core.Timeline
    }): Promise<void>

    setElement(element: HTMLElement | SVGElement): void {
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
        animator.register()

        return () => {
            animator.unregister()
        }
    }
}
