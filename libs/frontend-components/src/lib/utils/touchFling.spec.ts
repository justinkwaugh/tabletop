import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fling } from './touchFling.js'

const FRAME_MS = 1000 / 60

let frames: Map<number, FrameRequestCallback>
let nextFrame: number

function runFrame(timestamp: number) {
    const callbacks = [...frames.values()]
    frames.clear()
    for (const callback of callbacks) callback(timestamp)
}

beforeEach(() => {
    frames = new Map()
    nextFrame = 1
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.set(nextFrame, callback)
        return nextFrame++
    })
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('fling', () => {
    it('moves on the frame after the finger lifts, so the content does not halt', () => {
        const moves: number[] = []
        fling({ x: 1.2, y: 0 }, 0, (offset) => {
            moves.push(offset.x)
            return offset
        })

        runFrame(1000)
        runFrame(1000 + FRAME_MS)

        expect(moves).toHaveLength(2)
        expect(moves[0]).toBeCloseTo(1.2 * FRAME_MS)
        expect(moves[1]).toBeLessThan(moves[0])
    })

    it('does not fling a finger that rested before lifting', () => {
        const move = vi.fn((offset) => offset)
        const flung = fling({ x: 1.2, y: 0 }, 150, move)

        runFrame(1000)

        expect(move).not.toHaveBeenCalled()
        expect(flung.running).toBe(false)
    })
})

describe('stopping a fling', () => {
    class FakeNode {
        constructor(private readonly children: FakeNode[] = []) {}
        contains(other: FakeNode): boolean {
            return other === this || this.children.some((child) => child.contains(other))
        }
        addEventListener = vi.fn()
    }

    let listeners: Map<string, (event: Partial<Event>) => void>
    // The window listeners go on once per page, so each test loads its own copy of the module.
    let freshFling: typeof fling

    beforeEach(async () => {
        listeners = new Map()
        vi.stubGlobal('Node', FakeNode)
        vi.stubGlobal('window', {
            addEventListener: vi.fn((type: string, listener: (event: Partial<Event>) => void) =>
                listeners.set(type, listener)
            )
        })
        vi.resetModules()
        freshFling = (await import('./touchFling.js')).fling
    })

    it('adds no listeners as flings start, since WebKit restyles the page for each one', () => {
        const scroller = new FakeNode()
        freshFling({ x: 1.2, y: 0 }, 0, (offset) => offset, scroller as unknown as Node)
        const listenersAfterFirst = vi.mocked(window.addEventListener).mock.calls.length
        freshFling({ x: 1.2, y: 0 }, 0, (offset) => offset, scroller as unknown as Node)

        expect(vi.mocked(window.addEventListener).mock.calls.length).toBe(listenersAfterFirst)
        expect(scroller.addEventListener).not.toHaveBeenCalled()
    })

    it('stops on a touch inside its scroller, not on a touch elsewhere', () => {
        const cell = new FakeNode()
        const scroller = new FakeNode([cell])
        const flung = freshFling(
            { x: 1.2, y: 0 },
            0,
            (offset) => offset,
            scroller as unknown as Node
        )
        const touchStart = listeners.get('touchstart')

        touchStart?.({ target: new FakeNode() as unknown as EventTarget })
        expect(flung.running).toBe(true)

        touchStart?.({ target: cell as unknown as EventTarget })
        expect(flung.running).toBe(false)
    })
})
