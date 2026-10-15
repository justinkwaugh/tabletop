import type {
    Game,
    GameAction,
    GameEngine,
    GameRuntime,
    GameState,
    HydratedGameState
} from '@tabletop/common'
import { sameStoredState } from './storedState.js'

export type TransitionIntent = 'actions' | 'state' | 'silent'

export interface AnimationTimeline {
    play(): Promise<void>
    runAfterAnimations(): void
}

export type TransitionStep<U, A> = {
    to: U
    from?: U
    action?: GameAction
    animationContext: A
}

export type TransitionListener<U, A> = (step: TransitionStep<U, A>) => Promise<void>

export interface PresentableContext<T extends GameState, U extends HydratedGameState<T> & T> {
    readonly state: T
    readonly actions: readonly GameAction[]
    readonly game: Game
    readonly engine: Pick<GameEngine<T, U>, 'applyProcessedAction'>
    readonly runtime: Pick<GameRuntime<T, U>, 'hydrator'>
}

export interface DisplayedStateOutput<U> {
    publish(state: U): void
    setPending(pending: boolean): void
}

export interface TransitionPresenterDependencies<
    T extends GameState,
    U extends HydratedGameState<T> & T,
    A extends AnimationTimeline
> {
    source(): PresentableContext<T, U>
    output: DisplayedStateOutput<U>
    createAnimationContext(): A
    onError(error: unknown): void
}

type PendingChange<T extends GameState, U extends HydratedGameState<T> & T> = {
    context: PresentableContext<T, U>
    state: T
    intent: TransitionIntent
}

const QUIETNESS: Record<TransitionIntent, number> = { silent: 0, state: 1, actions: 2 }

export class TransitionPresenter<
    T extends GameState,
    U extends HydratedGameState<T> & T,
    A extends AnimationTimeline
> {
    private readonly listeners = new Set<TransitionListener<U, A>>()
    private displayed?: U
    private displayedContext?: PresentableContext<T, U>
    private incomingState?: U
    private running = false
    private pending?: PendingChange<T, U>
    private waiters: Array<() => void> = []

    constructor(private readonly deps: TransitionPresenterDependencies<T, U, A>) {}

    get incoming(): U | undefined {
        return this.incomingState
    }

    addListener(listener: TransitionListener<U, A>) {
        this.listeners.add(listener)
    }

    removeListener(listener: TransitionListener<U, A>) {
        this.listeners.delete(listener)
    }

    visibleStateChanged(): void {
        const { context, state } = this.observe()
        this.queue(context, state, 'actions')
    }

    present(intent: TransitionIntent, write: () => void): void {
        const before = this.observe()
        write()
        const after = this.observe()
        if (after.context === before.context && after.state === before.state) return
        this.queue(after.context, after.state, intent)
    }

    publishNow(write: () => void): void {
        write()
        const { context, state } = this.observe()
        this.pending = undefined
        this.show(context, context.runtime.hydrator.hydrateState(state))
    }

    async settled(): Promise<void> {
        if (!this.running && !this.pending) return
        await new Promise<void>((resolve) => this.waiters.push(resolve))
    }

    private observe() {
        const context = this.deps.source()
        return { context, state: context.state }
    }

    private queue(context: PresentableContext<T, U>, state: T, intent: TransitionIntent) {
        this.pending = {
            context,
            state,
            intent: this.pending ? this.quietest(this.pending.intent, intent) : intent
        }
        this.deps.output.setPending(true)
        if (!this.running) {
            this.running = true
            queueMicrotask(() => void this.drain())
        }
    }

    private async drain() {
        try {
            while (this.pending) {
                const { context, state, intent } = this.pending
                this.pending = undefined
                const from = this.displayed
                if (
                    from !== undefined &&
                    context === this.displayedContext &&
                    sameStoredState(from.dehydrate(), state)
                ) {
                    continue
                }
                await this.transition(
                    context,
                    from,
                    context.runtime.hydrator.hydrateState(state),
                    intent
                )
            }
        } finally {
            this.running = false
            this.deps.output.setPending(false)
            const waiters = this.waiters
            this.waiters = []
            for (const resolve of waiters) resolve()
        }
    }

    private async transition(
        context: PresentableContext<T, U>,
        from: U | undefined,
        to: U,
        intent: TransitionIntent
    ) {
        this.incomingState = to
        try {
            await this.animate(context, from, to, intent)
            if (this.displayed === from) this.show(context, to)
        } catch (error) {
            this.deps.onError(error)
        } finally {
            this.incomingState = undefined
        }
    }

    private async animate(
        context: PresentableContext<T, U>,
        from: U | undefined,
        to: U,
        intent: TransitionIntent
    ) {
        try {
            await this.playSteps(context, from, to, intent)
        } catch (error) {
            this.deps.onError(error)
        }
    }

    private async playSteps(
        context: PresentableContext<T, U>,
        from: U | undefined,
        to: U,
        intent: TransitionIntent
    ) {
        if (intent === 'silent') return
        const actions = intent === 'actions' ? this.actionsBetween(context, from, to) : []
        if (from === undefined || actions.length === 0) {
            await this.step({ to, from })
            return
        }
        const hydrate = (state: T) => context.runtime.hydrator.hydrateState(state)
        let prior = from.dehydrate()
        for (const action of actions) {
            const next = context.engine.applyProcessedAction({
                action: structuredClone(action),
                state: prior,
                game: context.game
            })
            await this.step({ to: hydrate(next), from: hydrate(prior), action })
            prior = next
        }
    }

    private async step(step: { to: U; from?: U; action?: GameAction }) {
        const animationContext = this.deps.createAnimationContext()
        await Promise.all(
            [...this.listeners].map((listener) => listener({ ...step, animationContext }))
        )
        await animationContext.play()
        animationContext.runAfterAnimations()
    }

    private show(context: PresentableContext<T, U>, state: U) {
        this.deps.output.publish(state)
        this.displayed = state
        this.displayedContext = context
    }

    private actionsBetween(
        context: PresentableContext<T, U>,
        from: U | undefined,
        to: U
    ): GameAction[] {
        if (!from || to.gameId !== from.gameId || to.actionCount < from.actionCount) return []
        return context.actions.filter(
            (action) =>
                action.index !== undefined &&
                action.index >= from.actionCount &&
                action.index < to.actionCount
        )
    }

    private quietest(left: TransitionIntent, right: TransitionIntent): TransitionIntent {
        return QUIETNESS[left] <= QUIETNESS[right] ? left : right
    }
}
