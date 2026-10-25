import { describe, expect, it } from 'vitest'
import { assertExists, createAction, GameEngine, type GameAction } from '@tabletop/common'
import {
    createPrivateHandGame,
    runtime,
    DrawSchema,
    PlaySchema,
    type HydratedPrivateHandState,
    type SharedState
} from '@tabletop/common/test-fixtures/private-hand'
import {
    TransitionPresenter,
    type AnimationTimeline,
    type PresentableContext,
    type PresentedTransition,
    type TransitionStep
} from './transitionPresenter.js'

type Context = PresentableContext<SharedState, HydratedPrivateHandState>

class HeldAnimations {
    private pending: Array<() => void> = []

    create(): AnimationTimeline {
        return {
            play: () => new Promise<void>((resolve) => this.pending.push(resolve)),
            runAfterAnimations() {}
        }
    }

    async release() {
        await this.settleTimers()
        const pending = this.pending
        this.pending = []
        for (const resolve of pending) resolve()
        await this.settleTimers()
    }

    private settleTimers() {
        return new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
}

function fixture() {
    const { game, state } = createPrivateHandGame()
    const engine = new GameEngine(runtime)
    const context: Context & { state: SharedState; actions: GameAction[] } = {
        state,
        actions: [],
        game,
        engine,
        runtime
    }
    let source: Context = context
    const animations = new HeldAnimations()
    const published: HydratedPrivateHandState[] = []
    const transitions: PresentedTransition[] = []
    const publishedActions: GameAction[][] = []
    const pendingLog: boolean[] = []
    const errors: unknown[] = []
    const steps: TransitionStep<HydratedPrivateHandState, AnimationTimeline>[] = []
    const output = {
        publish: (
            state: HydratedPrivateHandState,
            transition: PresentedTransition,
            actions: GameAction[]
        ) => {
            published.push(state)
            transitions.push(transition)
            publishedActions.push(actions)
        },
        setPending: (pending: boolean) => {
            pendingLog.push(pending)
        }
    }
    const presenter = new TransitionPresenter<
        SharedState,
        HydratedPrivateHandState,
        AnimationTimeline
    >({
        source: () => source,
        output,
        createAnimationContext: () => animations.create(),
        onError: (error) => errors.push(error)
    })
    presenter.addListener(async (step) => {
        steps.push(step)
    })
    const apply = (action: GameAction) => {
        const result = engine.executeCanonicalAction({ action, state: context.state, game })
        context.state = result.updatedState
        context.actions = [...context.actions, ...result.processedActions]
    }
    const play = (playerId: string, cardId: string) =>
        apply(createAction(PlaySchema, { gameId: game.id, playerId, cardId }))
    const draw = (playerId: string) =>
        apply(createAction(DrawSchema, { gameId: game.id, playerId, revealsInfo: true }))
    const switchContext = () => {
        source = { ...context }
    }
    const start = async () => {
        presenter.presentInitial()
        await animations.release()
    }
    return {
        presenter,
        animations,
        output,
        context,
        published,
        transitions,
        publishedActions,
        pendingLog,
        errors,
        steps,
        play,
        draw,
        switchContext,
        start
    }
}

function runStarted() {
    return Promise.resolve()
}

describe('TransitionPresenter', () => {
    it('presents the first state with no prior state', async () => {
        const f = fixture()
        f.presenter.presentInitial()
        expect(f.pendingLog).toEqual([true])
        await f.animations.release()
        expect(f.steps).toHaveLength(1)
        expect(f.steps[0].from).toBeUndefined()
        expect(f.steps[0].kind).toBe('initial')
        expect(f.published).toHaveLength(1)
        expect(f.transitions[0]).toEqual({ kind: 'initial', actions: [], intent: 'actions' })
        expect(f.pendingLog).toEqual([true, false])
    })

    it('publishes the actions that led to each state, read when the change was made', async () => {
        const f = fixture()
        await f.start()
        expect(f.publishedActions).toEqual([[]])

        f.presenter.present({ kind: 'own-action' }, () => f.play('p1', 'r1'))
        const played = f.context.actions.at(-1)
        assertExists(played, 'The play was recorded')
        // The context appends in place while the play is still animating
        f.context.actions.push({ ...structuredClone(played), id: 'later', index: 1 })
        await f.animations.release()

        expect(f.published.at(-1)?.actionCount).toBe(1)
        expect(f.publishedActions.at(-1)?.map((action) => action.id)).toEqual([played.id])
    })

    it('animates the actions between the displayed and the new state in order', async () => {
        const f = fixture()
        await f.start()
        f.presenter.present({ kind: 'other-action' }, () => {
            f.play('p1', 'r1')
            f.play('p2', 'r2')
        })
        await f.animations.release()
        await f.animations.release()
        const actionSteps = f.steps.slice(1)
        expect(actionSteps.map((step) => step.action?.id)).toEqual(
            f.context.actions.map((action) => action.id)
        )
        expect(actionSteps[0].from?.actionCount).toBe(0)
        expect(actionSteps[1].to.actionCount).toBe(2)
        expect(f.published.at(-1)?.actionCount).toBe(2)
        expect(f.transitions.at(-1)?.actions.map((action) => action.type)).toEqual(['play', 'play'])
    })

    it('waits for the run in flight and merges later changes into the latest target', async () => {
        const f = fixture()
        await f.start()
        f.presenter.present({ kind: 'own-action' }, () => f.play('p1', 'r1'))
        await runStarted()
        f.presenter.present({ kind: 'other-action' }, () => f.play('p2', 'r2'))
        f.presenter.present({ kind: 'other-action' }, () => f.draw('p1'))
        expect(f.published).toHaveLength(1)
        await f.animations.release()
        expect(f.published).toHaveLength(2)
        expect(f.published[1].actionCount).toBe(1)
        await f.animations.release()
        await f.animations.release()
        expect(f.published).toHaveLength(3)
        expect(f.published[2].actionCount).toBe(3)
        expect(f.steps.slice(2).map((step) => step.action?.type)).toEqual(['play', 'draw'])
    })

    it('stays pending and unsettled until the last queued change is shown', async () => {
        const f = fixture()
        await f.start()
        f.presenter.present({ kind: 'own-action' }, () => f.play('p1', 'r1'))
        let settled = false
        const waiting = f.presenter.settled().then(() => {
            settled = true
        })
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        expect(settled).toBe(false)
        expect(f.pendingLog.at(-1)).toBe(true)
        await f.animations.release()
        await waiting
        expect(settled).toBe(true)
        expect(f.pendingLog.at(-1)).toBe(false)
    })

    it('merges intents to the quietest while a run is in flight', async () => {
        const f = fixture()
        await f.start()
        f.presenter.present({ kind: 'own-action' }, () => f.play('p1', 'r1'))
        await runStarted()
        f.presenter.present({ kind: 'undo' }, () => f.play('p2', 'r2'))
        f.presenter.present({ kind: 'other-action' }, () => f.draw('p1'))
        await f.animations.release()
        await f.animations.release()
        expect(f.steps).toHaveLength(3)
        expect(f.steps[2].action).toBeUndefined()
        expect(f.published.at(-1)?.actionCount).toBe(3)
    })

    it('lets the latest kind describe a merged change', async () => {
        const f = fixture()
        await f.start()
        f.presenter.present({ kind: 'own-action' }, () => f.play('p1', 'r1'))
        await runStarted()
        f.presenter.present({ kind: 'other-action' }, () => f.play('p2', 'r2'))
        f.presenter.present({ kind: 'reconciliation' }, () => f.draw('p1'))
        await f.animations.release()
        await f.animations.release()
        expect(f.transitions.map((transition) => transition.kind)).toEqual([
            'initial',
            'own-action',
            'reconciliation'
        ])
        expect(f.transitions.at(-1)?.actions).toEqual([])
    })

    it('skips a change equal to the displayed state from the same context, and runs one from another context', async () => {
        const f = fixture()
        await f.start()
        f.presenter.present({ kind: 'edit' }, () => {
            f.context.state = structuredClone(f.context.state)
        })
        await f.presenter.settled()
        expect(f.steps).toHaveLength(1)
        expect(f.published).toHaveLength(1)
        f.presenter.present({ kind: 'exploration' }, () => f.switchContext())
        await f.animations.release()
        expect(f.steps).toHaveLength(2)
        expect(f.published).toHaveLength(2)
        expect(f.transitions[1].kind).toBe('exploration')
    })

    it('presents a change whose write throws partway, and rethrows', async () => {
        const f = fixture()
        await f.start()
        expect(() =>
            f.presenter.present({ kind: 'own-action' }, () => {
                f.play('p1', 'r1')
                throw new Error('interrupted')
            })
        ).toThrow('interrupted')
        await f.animations.release()
        expect(f.published.at(-1)?.actionCount).toBe(1)
        expect(f.transitions.at(-1)?.kind).toBe('own-action')
    })

    it('presents nothing for a write that changes nothing', async () => {
        const f = fixture()
        await f.start()
        f.presenter.present({ kind: 'undo' }, () => {})
        await f.presenter.settled()
        expect(f.pendingLog).toEqual([true, false])
        expect(f.published).toHaveLength(1)
    })

    it('publishes immediately and lets the run in flight publish nothing', async () => {
        const f = fixture()
        await f.start()
        f.presenter.present({ kind: 'own-action' }, () => f.play('p1', 'r1'))
        f.presenter.publishNow('view-switch', () => f.play('p2', 'r2'))
        expect(f.published).toHaveLength(2)
        expect(f.published[1].actionCount).toBe(2)
        expect(f.transitions[1]).toEqual({ kind: 'view-switch', actions: [], intent: 'silent' })
        await f.animations.release()
        await f.presenter.settled()
        expect(f.published).toHaveLength(2)
    })

    it('reports a failing listener and still publishes the target', async () => {
        const f = fixture()
        await f.start()
        f.presenter.addListener(async () => {
            throw new Error('animator failed')
        })
        f.presenter.present({ kind: 'own-action' }, () => f.play('p1', 'r1'))
        await f.presenter.settled()
        expect(f.errors).toHaveLength(1)
        expect(f.published.at(-1)?.actionCount).toBe(1)
        expect(f.pendingLog.at(-1)).toBe(false)
    })

    it('reports a failing publication and continues with the next change', async () => {
        const f = fixture()
        await f.start()
        let failures = 1
        const publish = f.output.publish
        f.output.publish = (state, transition, actions) => {
            if (failures-- > 0) throw new Error('hook failed')
            publish(state, transition, actions)
        }
        f.presenter.present({ kind: 'own-action' }, () => f.play('p1', 'r1'))
        await f.animations.release()
        expect(f.errors).toHaveLength(1)
        expect(f.presenter.incoming).toBeUndefined()
        f.presenter.present({ kind: 'other-action' }, () => f.play('p2', 'r2'))
        await f.animations.release()
        await f.animations.release()
        expect(f.published.at(-1)?.actionCount).toBe(2)
        expect(f.pendingLog.at(-1)).toBe(false)
    })

    it('gives each kind its default intent', async () => {
        const f = fixture()
        await f.start()
        f.presenter.present({ kind: 'undo' }, () => f.play('p1', 'r1'))
        await f.animations.release()
        expect(f.steps.at(-1)?.action).toBeUndefined()
        expect(f.steps.at(-1)?.kind).toBe('undo')
        expect(f.transitions.at(-1)?.intent).toBe('state')
        f.presenter.present({ kind: 'view-switch' }, () => f.play('p2', 'r2'))
        await f.presenter.settled()
        expect(f.steps).toHaveLength(2)
        expect(f.published.at(-1)?.actionCount).toBe(2)
        // No listener saw the silent change, and its publication says so.
        expect(f.transitions.at(-1)?.intent).toBe('silent')
        f.presenter.present({ kind: 'own-action' }, () => f.draw('p1'))
        await f.animations.release()
        expect(f.steps.at(-1)?.action?.type).toBe('draw')
    })

    it('exposes the incoming state while a change is presented', async () => {
        const f = fixture()
        await f.start()
        f.presenter.present({ kind: 'own-action' }, () => f.play('p1', 'r1'))
        await Promise.resolve()
        expect(f.presenter.incoming?.actionCount).toBe(1)
        await f.animations.release()
        expect(f.presenter.incoming).toBeUndefined()
    })
})
