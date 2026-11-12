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
