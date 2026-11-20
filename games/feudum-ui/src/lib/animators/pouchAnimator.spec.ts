import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { AnimationContext } from '@tabletop/frontend-components'
import {
    ActionCards,
    ActionType,
    HydratedFeudumGameState,
    MachineState,
    handSizeFor
} from '@tabletop/feudum'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import { seatPouchOf } from '$lib/model/seatPanel.js'
import { PouchAnimator, PouchTurnSeconds, type PouchElement } from './pouchAnimator.svelte.js'

let host: FeudumHost | undefined

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

const hydrated = (table: FeudumHost) => new HydratedFeudumGameState(structuredClone(table.state))

/**
 * R-3.1-H1 Three seats finalise, the first with saltpeter in its pouch: the states either side of the
 * last finalise, which reveals every pouch, and that Action.
 */
async function aroundTheReveal() {
    host = new FeudumHost(3)
    await host.playStartingGoods()
    await host.playStartingPawns()
    const { order } = host
    let before = hydrated(host)
    let last: GameAction | undefined
    for (const [index, playerId] of order.entries()) {
        const pouchGood = index === 0 ? ('saltpeter' as const) : undefined
        before = hydrated(host)
        const move = {
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: ActionCards.map(({ kind }) => kind).slice(0, handSizeFor(pouchGood)),
            ...(pouchGood ? { pouchGood } : {})
        }
        last = { id: `f${index}`, gameId: 'g', source: ActionSource.User, playerId, ...move }
        await host.send(host.state.activePlayerIds[0] ?? playerId, move)
    }
    const after = hydrated(host)
    expect(after.machineState).not.toBe(MachineState.SelectingHands)
    const viewer = order[1]
    return {
        order,
        before,
        after,
        action: last,
        pouchOf: (state: HydratedFeudumGameState, playerId: string) =>
            seatPouchOf(state, playerId, viewer)
    }
}

/** GSAP writes a plain object's own property: the tween's target is the pouch, not a proxy. */
class FakePouch implements PouchElement {
    rotationY?: number
    readonly style = {
        transform: '',
        removeProperty: (name: string) => {
            if (name === 'transform') {
                this.style.transform = ''
            }
            this.rotationY = undefined
            return ''
        }
    }

    get degrees(): number {
        return this.rotationY ?? NaN
    }
}

function rig(seats: readonly string[], reduced = false) {
    const animator = new PouchAnimator(() => reduced)
    const pouches = new Map(seats.map((playerId) => [playerId, new FakePouch()]))
    for (const [playerId, pouch] of pouches) {
        animator.pouch(playerId)(pouch)
    }
    return { animator, pouches }
}

describe('R-3.1-H1 the pouches turn over at the reveal, as a motion of the state change', () => {
    it('with the Action, a pouch the reveal turns face up shows its face first and turns from edge on; an empty one has none to turn', async () => {
        const { order, before, after, action, pouchOf } = await aroundTheReveal()
        const { animator, pouches } = rig(order)
        const context = new AnimationContext()
        await animator.onGameStateChange({
            from: before,
            to: after,
            action,
            animationContext: context,
            pouchOf
        })
        const timeline = context.actionTimeline
        timeline.pause()
        // Before the state shows, each panel reads the face it is turning to.
        expect([...animator.revealing.keys()]).toEqual([order[0]])
        expect(animator.revealing.get(order[0])).toMatchObject({
            status: 'finalised',
            good: 'saltpeter'
        })
        expect(timeline.duration()).toBeCloseTo(PouchTurnSeconds, 5)
        const turning = pouches.get(order[0])
        expect(timeline.getChildren().flatMap((tween) => tween.targets())).toEqual([turning])
        expect(turning?.degrees).toBe(90)
        timeline.time(PouchTurnSeconds / 2)
        expect(turning?.degrees).toBeGreaterThan(0)
        expect(turning?.degrees).toBeLessThan(90)
        timeline.progress(1)
        expect(turning?.degrees).toBe(0)
        expect([order[1], order[2]].map((seat) => pouches.get(seat)?.rotationY)).toEqual([
            undefined,
            undefined
        ])

        animator.settle()
        expect(animator.revealing.size).toBe(0)
        expect([...pouches.values()].map(({ rotationY }) => rotationY)).toEqual([
            undefined,
            undefined,
            undefined
        ])
    })

    it('without an Action (a step through history) the face simply shows: nothing turns, nothing is held', async () => {
        const { order, before, after, pouchOf } = await aroundTheReveal()
        const { animator, pouches } = rig(order)
        const context = new AnimationContext()
        await animator.onGameStateChange({
            from: before,
            to: after,
            animationContext: context,
            pouchOf
        })
        expect(animator.revealing.size).toBe(0)
        expect(context.actionTimeline.duration()).toBe(0)
        expect([...pouches.values()].map(({ style }) => style.transform)).toEqual(['', '', ''])
    })

    it('Undo or a step back across the reveal never turns a pouch back over', async () => {
        const { order, before, after, action, pouchOf } = await aroundTheReveal()
        const { animator, pouches } = rig(order)
        for (const backwards of [undefined, action]) {
            const context = new AnimationContext()
            await animator.onGameStateChange({
                from: after,
                to: before,
                ...(backwards ? { action: backwards } : {}),
                animationContext: context,
                pouchOf
            })
            expect(animator.revealing.size).toBe(0)
            expect(context.actionTimeline.duration()).toBe(0)
        }
        expect([...pouches.values()].map(({ style }) => style.transform)).toEqual(['', '', ''])
    })

    it('with reduced motion the face shows with the Action and does not turn', async () => {
        const { order, before, after, action, pouchOf } = await aroundTheReveal()
        const { animator, pouches } = rig(order, true)
        const context = new AnimationContext()
        await animator.onGameStateChange({
            from: before,
            to: after,
            action,
            animationContext: context,
            pouchOf
        })
        expect([...animator.revealing.keys()]).toEqual([order[0]])
        expect(context.actionTimeline.duration()).toBe(0)
        expect([...pouches.values()].map(({ style }) => style.transform)).toEqual(['', '', ''])
    })
})
