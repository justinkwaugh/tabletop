import { describe, expect, it } from 'vitest'
import type { Point } from '@tabletop/common'
import { AnimationContext, type GameStateChangeListener } from '@tabletop/frontend-components'
import { MarketColor, type HydratedMarracashGameState } from '@tabletop/marracash'
import { startedGameState } from '$lib/testing/startedGameState.js'
import { pointAtQueueSlot } from '$lib/utils/boardGeometry.js'
import { placeQueueVisitor, QueueAnimator, type QueueAnimationHost } from './queueAnimator.js'

class FakeVisitor {
    attributes = new Map<string, string>()
    setAttribute(name: string, value: string) {
        this.attributes.set(name, value)
    }
    getAttribute(name: string) {
        return this.attributes.get(name) ?? null
    }
}

function standing(element: FakeVisitor): Point {
    const transform = element.getAttribute('transform') ?? ''
    const match = /^translate\((\S+) (\S+)\)$/.exec(transform)
    if (!match) throw Error(`${transform} is not a translate transform`)
    return { x: Number(match[1]), y: Number(match[2]) }
}

function expectAt(element: FakeVisitor, { x, y }: Point) {
    const at = standing(element)
    expect(at.x).toBeCloseTo(x, 4)
    expect(at.y).toBeCloseTo(y, 4)
}

function createHost() {
    let listener: GameStateChangeListener<HydratedMarracashGameState> | undefined
    const host: QueueAnimationHost & { listener(): typeof listener } = {
        addGameStateChangeListener(added) {
            listener = added
        },
        removeGameStateChangeListener() {
            listener = undefined
        },
        listener: () => listener
    }
    const animator = new QueueAnimator(host)
    animator.register()
    return { host, animator }
}

function mountQueue(animator: QueueAnimator, firstId: number, count: number) {
    return Array.from({ length: count }, (_, place) => {
        const element = new FakeVisitor()
        placeQueueVisitor(element, {
            animator,
            visitorId: firstId + place,
            at: pointAtQueueSlot(place)
        })
        return element
    })
}

function queueState(queue: MarketColor[]): HydratedMarracashGameState {
    const state = startedGameState('queue-animation', 3)
    state.queue = queue
    return state
}

const Line = [
    MarketColor.Red,
    MarketColor.Blue,
    MarketColor.Green,
    MarketColor.Yellow,
    MarketColor.Purple
]

// Firefox 140 leaves the offset of an SVG matrix() transform out of the board's CSS zoom.
describe('the visitor queue', () => {
    it('places each visitor with a translate transform', () => {
        const { animator } = createHost()
        const at = pointAtQueueSlot(3)
        const element = new FakeVisitor()
        const action = placeQueueVisitor(element, {
            animator,
            visitorId: 3,
            at
        })
        expectAt(element, at)

        const next = pointAtQueueSlot(1)
        action.update({ animator, visitorId: 3, at: next })
        expectAt(element, next)
    })

    it('moves the line straight to its new places with translate transforms', async () => {
        const { host, animator } = createHost()
        const elements = mountQueue(animator, 2, 3)
        const animationContext = new AnimationContext()
        // Undoing a front refill puts two visitors back ahead of the line.
        await host.listener()?.({
            kind: 'other-action',
            from: queueState(Line.slice(2)),
            to: queueState(Line),
            animationContext
        })
        animationContext.actionTimeline.progress(1)

        elements.forEach((element, place) => expectAt(element, pointAtQueueSlot(place + 2)))
    })
})
