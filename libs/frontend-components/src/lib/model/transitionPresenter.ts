import type {
    Game,
    GameAction,
    GameEngine,
    GameRuntime,
    GameState,
    HydratedGameState
} from '@tabletop/common'
import { sameStoredState } from './storedState.js'

export type TransitionKind =
    | 'initial'
    | 'own-action'
    | 'other-action'
    | 'reconciliation'
    | 'undo'
    | 'history'
    | 'exploration'
    | 'view-switch'
    | 'edit'

export type TransitionIntent = 'actions' | 'state' | 'silent'

export type TransitionRequest = { kind: TransitionKind; intent?: TransitionIntent }

export type PresentedTransition = { kind: TransitionKind; actions: readonly GameAction[] }

export interface AnimationTimeline {
    play(): Promise<void>
    runAfterAnimations(): void
}

export type TransitionStep<U, A> = {
    kind: TransitionKind
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
    publish(state: U, transition: PresentedTransition): void
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
    kind: TransitionKind
    origin: ChangeOrigin
    intent: TransitionIntent
}

type ChangeOrigin = 'producer' | 'watch'

const DEFAULT_INTENT: Record<TransitionKind, TransitionIntent> = {
    initial: 'actions',
    'own-action': 'actions',
    'other-action': 'actions',
    reconciliation: 'state',
    undo: 'state',
    history: 'state',
    exploration: 'state',
    'view-switch': 'silent',
    edit: 'actions'
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
    private observed = false
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
        const kind = this.observed ? 'edit' : 'initial'
        this.observed = true
        this.queue(context, state, { kind }, 'watch')
    }

    present(request: TransitionRequest, write: () => void): void {
        const before = this.observe()
        write()
        const after = this.observe()
        if (after.context === before.context && after.state === before.state) return
        this.queue(after.context, after.state, request, 'producer')
    }

    publishNow(kind: TransitionKind, write: () => void): void {
        write()
        const { context, state } = this.observe()
        this.pending = undefined
        this.show(context, context.runtime.hydrator.hydrateState(state), { kind, actions: [] })
    }

    async settled(): Promise<void> {
        if (!this.running && !this.pending) return
        await new Promise<void>((resolve) => this.waiters.push(resolve))
    }

    private observe() {
        const context = this.deps.source()
        return { context, state: context.state }
    }

    private queue(
        context: PresentableContext<T, U>,
        state: T,
        request: TransitionRequest,
        origin: ChangeOrigin
    ) {
        const intent = request.intent ?? DEFAULT_INTENT[request.kind]
        const earlier = this.pending
        this.pending = {
            context,
            state,
            kind:
                earlier?.origin === 'producer' && origin === 'watch' ? earlier.kind : request.kind,
            origin: origin === 'producer' || earlier?.origin === 'producer' ? 'producer' : 'watch',
            intent: earlier ? this.quietest(earlier.intent, intent) : intent
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
                const { context, state, kind, intent } = this.pending
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
                    kind,
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
        kind: TransitionKind,
        intent: TransitionIntent
    ) {
        this.incomingState = to
        try {
            const actions = await this.animate(context, from, to, kind, intent)
            if (this.displayed === from) this.show(context, to, { kind, actions })
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
        kind: TransitionKind,
        intent: TransitionIntent
    ): Promise<GameAction[]> {
        if (intent === 'silent') return []
        const actions = intent === 'actions' ? this.actionsBetween(context, from, to) : []
        try {
            if (from === undefined || actions.length === 0) {
                await this.step({ kind, to, from })
            } else {
                await this.replay(context, from, actions, kind)
            }
        } catch (error) {
            this.deps.onError(error)
        }
        return actions
    }

    private async replay(
        context: PresentableContext<T, U>,
        from: U,
        actions: GameAction[],
        kind: TransitionKind
    ) {
        const hydrate = (state: T) => context.runtime.hydrator.hydrateState(state)
        let prior = from.dehydrate()
        for (const action of actions) {
            const next = context.engine.applyProcessedAction({
                action: structuredClone(action),
                state: prior,
                game: context.game
            })
            await this.step({ kind, to: hydrate(next), from: hydrate(prior), action })
            prior = next
        }
    }

    private async step(step: { kind: TransitionKind; to: U; from?: U; action?: GameAction }) {
        const animationContext = this.deps.createAnimationContext()
        await Promise.all(
            [...this.listeners].map((listener) => listener({ ...step, animationContext }))
        )
        await animationContext.play()
        animationContext.runAfterAnimations()
    }

    private show(context: PresentableContext<T, U>, state: U, transition: PresentedTransition) {
        this.deps.output.publish(state, transition)
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
