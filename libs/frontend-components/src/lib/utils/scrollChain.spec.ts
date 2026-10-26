import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollAncestorsWithFinger } from './scrollChain.js'

type FakeScroller = {
    parentElement: FakeScroller | null
    scrollLeft: number
    scrollTop: number
    scrollWidth: number
    clientWidth: number
    scrollHeight: number
    clientHeight: number
}

/** A sideways scroller that, like WebKit, rounds its scroll position down to a whole pixel. */
function scroller(scrollWidth: number, scrollLeft: number, parent: FakeScroller | null = null) {
    let left = scrollLeft
    return {
        parentElement: parent,
        get scrollLeft() {
            return left
        },
        set scrollLeft(value: number) {
            left = Math.floor(Math.min(Math.max(value, 0), scrollWidth - 100))
        },
        scrollTop: 0,
        scrollWidth,
        clientWidth: 100,
        scrollHeight: 100,
        clientHeight: 100
    } satisfies FakeScroller
}

let scrollBy: ReturnType<typeof vi.fn>

beforeEach(() => {
    scrollBy = vi.fn()
    vi.stubGlobal('getComputedStyle', () => ({ overflowX: 'auto', overflowY: 'auto' }))
    // iOS lets a script push the page past its edges, as a finger's rubber-band does.
    vi.stubGlobal('window', { scrollX: 0, scrollY: 0, scrollBy })
    vi.stubGlobal('document', {
        scrollingElement: {
            scrollWidth: 100,
            clientWidth: 100,
            scrollHeight: 100,
            clientHeight: 100
        }
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

function fingerOn(parent: FakeScroller) {
    return { parentElement: parent } as unknown as HTMLElement
}

describe('scrollAncestorsWithFinger', () => {
    it('keeps a whole-pixel rounding shortfall on the scroller instead of pushing the page', () => {
        const table = scroller(500, 200)

        const moved = scrollAncestorsWithFinger(fingerOn(table), 'x', 13.7)

        expect(table.scrollLeft).toBe(186)
        expect(moved).toBeCloseTo(14)
        expect(scrollBy).not.toHaveBeenCalled()
    })

    it('does not push a page that cannot scroll once the scroller reaches its edge', () => {
        const table = scroller(500, 5)

        const moved = scrollAncestorsWithFinger(fingerOn(table), 'x', 20)

        expect(table.scrollLeft).toBe(0)
        expect(moved).toBe(5)
        expect(scrollBy).not.toHaveBeenCalled()
        expect(scrollAncestorsWithFinger(fingerOn(table), 'x', 20)).toBe(0)
    })

    it('carries the rest into the next scroller out once the inner one reaches its edge', () => {
        const outer = scroller(500, 100)
        const inner = scroller(300, 5, outer)

        scrollAncestorsWithFinger(fingerOn(inner), 'x', 20)

        expect(inner.scrollLeft).toBe(0)
        expect(outer.scrollLeft).toBe(85)
    })

    it('scrolls a page that has room once every scroller reaches its edge', () => {
        vi.stubGlobal('window', { scrollX: 50, scrollY: 0, scrollBy })
        vi.stubGlobal('document', {
            scrollingElement: {
                scrollWidth: 300,
                clientWidth: 100,
                scrollHeight: 100,
                clientHeight: 100
            }
        })
        const table = scroller(500, 0)

        scrollAncestorsWithFinger(fingerOn(table), 'x', 20)

        expect(scrollBy).toHaveBeenCalledWith({ left: -20 })
    })
})
