import { describe, expect, it } from 'vitest'
import { createAction, GameEngine, type GameAction } from '@tabletop/common'
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
    const pendingLog: boolean[] = []
    const errors: unknown[] = []
    const steps: TransitionStep<HydratedPrivateHandState, AnimationTimeline>[] = []
    const output = {
        publish: (state: HydratedPrivateHandState) => {
            published.push(state)
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
    return {
        presenter,
        animations,
        output,
        context,
        published,
        pendingLog,
        errors,
        steps,
        play,
        draw,
        switchContext
    }
}

function runStarted() {
    return Promise.resolve()
}

describe('TransitionPresenter', () => {
    it('presents the first change with no prior state', async () => {
        const f = fixture()
        f.presenter.visibleStateChanged()
        expect(f.pendingLog).toEqual([true])
        await f.animations.release()
        expect(f.steps).toHaveLength(1)
        expect(f.steps[0].from).toBeUndefined()
        expect(f.published).toHaveLength(1)
        expect(f.pendingLog).toEqual([true, false])
    })

    it('animates the actions between the displayed and the new state in order', async () => {
        const f = fixture()
        f.presenter.visibleStateChanged()
        await f.animations.release()
        f.play('p1', 'r1')
        f.play('p2', 'r2')
        f.presenter.visibleStateChanged()
        await f.animations.release()
        await f.animations.release()
        const actionSteps = f.steps.slice(1)
        expect(actionSteps.map((step) => step.action?.id)).toEqual(
            f.context.actions.map((action) => action.id)
        )
        expect(actionSteps[0].from?.actionCount).toBe(0)
        expect(actionSteps[1].to.actionCount).toBe(2)
        expect(f.published.at(-1)?.actionCount).toBe(2)
    })

    it('waits for the run in flight and merges later changes into the latest target', async () => {
        const f = fixture()
        f.presenter.visibleStateChanged()
        await f.animations.release()
        f.play('p1', 'r1')
        f.presenter.visibleStateChanged()
        await runStarted()
        f.play('p2', 'r2')
        f.presenter.visibleStateChanged()
        f.draw('p1')
        f.presenter.visibleStateChanged()
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
        f.presenter.visibleStateChanged()
        await f.animations.release()
        f.play('p1', 'r1')
        f.presenter.visibleStateChanged()
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
        f.presenter.visibleStateChanged()
        await f.animations.release()
        f.play('p1', 'r1')
        f.presenter.visibleStateChanged()
        await runStarted()
        f.presenter.present('state', () => f.play('p2', 'r2'))
        f.draw('p1')
        f.presenter.visibleStateChanged()
        await f.animations.release()
        await f.animations.release()
        expect(f.steps).toHaveLength(3)
        expect(f.steps[2].action).toBeUndefined()
        expect(f.published.at(-1)?.actionCount).toBe(3)
    })

    it('skips a change equal to the displayed state from the same context, and runs one from another context', async () => {
        const f = fixture()
        f.presenter.visibleStateChanged()
        await f.animations.release()
        f.context.state = structuredClone(f.context.state)
        f.presenter.visibleStateChanged()
        await f.presenter.settled()
        expect(f.steps).toHaveLength(1)
        expect(f.published).toHaveLength(1)
        f.switchContext()
        f.presenter.visibleStateChanged()
        await f.animations.release()
        expect(f.steps).toHaveLength(2)
        expect(f.published).toHaveLength(2)
    })

    it('publishes immediately and lets the run in flight publish nothing', async () => {
        const f = fixture()
        f.presenter.visibleStateChanged()
        await f.animations.release()
        f.play('p1', 'r1')
        f.presenter.visibleStateChanged()
        f.presenter.publishNow(() => f.play('p2', 'r2'))
        expect(f.published).toHaveLength(2)
        expect(f.published[1].actionCount).toBe(2)
        await f.animations.release()
        await f.presenter.settled()
        expect(f.published).toHaveLength(2)
    })

    it('reports a failing listener and still publishes the target', async () => {
        const f = fixture()
        f.presenter.visibleStateChanged()
        await f.animations.release()
        f.presenter.addListener(async () => {
            throw new Error('animator failed')
        })
        f.play('p1', 'r1')
        f.presenter.visibleStateChanged()
        await f.presenter.settled()
        expect(f.errors).toHaveLength(1)
        expect(f.published.at(-1)?.actionCount).toBe(1)
        expect(f.pendingLog.at(-1)).toBe(false)
    })

    it('reports a failing publication and continues with the next change', async () => {
        const f = fixture()
        f.presenter.visibleStateChanged()
        await f.animations.release()
        let failures = 1
        const publish = f.output.publish
        f.output.publish = (state) => {
            if (failures-- > 0) throw new Error('hook failed')
            publish(state)
        }
        f.play('p1', 'r1')
        f.presenter.visibleStateChanged()
        await f.animations.release()
        expect(f.errors).toHaveLength(1)
        expect(f.presenter.incoming).toBeUndefined()
        f.play('p2', 'r2')
        f.presenter.visibleStateChanged()
        await f.animations.release()
        await f.animations.release()
        expect(f.published.at(-1)?.actionCount).toBe(2)
        expect(f.pendingLog.at(-1)).toBe(false)
    })

    it('scopes an intent to the write it wraps', async () => {
        const f = fixture()
        f.presenter.visibleStateChanged()
        await f.animations.release()
        f.presenter.present('state', () => f.play('p1', 'r1'))
        f.presenter.visibleStateChanged()
        await f.animations.release()
        expect(f.steps.at(-1)?.action).toBeUndefined()
        expect(f.published.at(-1)?.actionCount).toBe(1)
        f.presenter.present('silent', () => {})
        f.play('p2', 'r2')
        f.presenter.visibleStateChanged()
        await f.animations.release()
        expect(f.steps.at(-1)?.action?.playerId).toBe('p2')
    })

    it('presents nothing for a silent change', async () => {
        const f = fixture()
        f.presenter.visibleStateChanged()
        await f.animations.release()
        f.presenter.present('silent', () => f.play('p1', 'r1'))
        f.presenter.visibleStateChanged()
        await f.presenter.settled()
        expect(f.steps).toHaveLength(1)
        expect(f.published.at(-1)?.actionCount).toBe(1)
    })

    it('exposes the incoming state while a change is presented', async () => {
        const f = fixture()
        f.presenter.visibleStateChanged()
        await f.animations.release()
        f.play('p1', 'r1')
        f.presenter.visibleStateChanged()
        await Promise.resolve()
        expect(f.presenter.incoming?.actionCount).toBe(1)
        await f.animations.release()
        expect(f.presenter.incoming).toBeUndefined()
    })
})
