import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { holdTallest } from './holdTallest.js'

// A panel whose laid-out height is its content's or its min-height, whichever is taller, with
// the ResizeObserver and animation frames driven by hand.
function panel({ width = 360, content = 50, boxSizing = 'border-box', padding = 0 } = {}) {
    const node = {
        clientWidth: width,
        content,
        style: { minHeight: '' },
        get offsetHeight() {
            const held = parseFloat(this.style.minHeight) || 0
            const frame = boxSizing === 'content-box' ? 2 * padding : 0
            return Math.max(this.content, held + frame)
        }
    }
    vi.stubGlobal('getComputedStyle', () => ({
        boxSizing,
        paddingTop: `${padding}px`,
        paddingBottom: `${padding}px`,
        borderTopWidth: '0px',
        borderBottomWidth: '0px'
    }))
    return node
}

let observed: (() => void) | undefined
let disconnected = false
let frames: Map<number, () => void>

beforeEach(() => {
    observed = undefined
    disconnected = false
    frames = new Map()
    let next = 1
    vi.stubGlobal(
        'ResizeObserver',
        class {
            constructor(callback: () => void) {
                observed = callback
            }
            observe() {}
            disconnect() {
                disconnected = true
            }
        }
    )
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
        frames.set(next, callback)
        return next++
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})

afterEach(() => {
    vi.unstubAllGlobals()
})

function resize() {
    observed?.()
}

function runFrames() {
    const queued = [...frames.values()]
    frames.clear()
    for (const callback of queued) callback()
}

function attach(node: ReturnType<typeof panel>) {
    const cleanup = holdTallest(node as unknown as HTMLElement)
    return typeof cleanup === 'function' ? cleanup : () => {}
}

describe('holdTallest', () => {
    it('holds the panel at the tallest height its content has reached', () => {
        const node = panel()
        attach(node)
        expect(node.style.minHeight).toBe('50px')

        node.content = 80
        resize()
        expect(node.style.minHeight).toBe('80px')

        node.content = 50
        resize()
        expect(node.style.minHeight).toBe('80px')
        expect(node.offsetHeight).toBe(80)
    })

    it('starts over a frame after the width changes', () => {
        const node = panel()
        attach(node)
        node.content = 80
        resize()

        node.clientWidth = 420
        node.content = 50
        resize()
        expect(node.style.minHeight).toBe('80px')

        runFrames()
        expect(node.style.minHeight).toBe('50px')
    })

    it('cancels a queued start-over and stops observing when the panel goes', () => {
        const node = panel()
        const cleanup = attach(node)
        node.content = 80
        resize()
        node.clientWidth = 420
        node.content = 50
        resize()

        cleanup()
        expect(disconnected).toBe(true)
        expect(frames.size).toBe(0)
        expect(node.style.minHeight).toBe('80px')
    })

    it('leaves the padding out of the min-height of a content-box panel', () => {
        const node = panel({ boxSizing: 'content-box', padding: 4, content: 58 })
        attach(node)
        expect(node.style.minHeight).toBe('50px')
        resize()
        expect(node.style.minHeight).toBe('50px')
        expect(node.offsetHeight).toBe(58)
    })
})
