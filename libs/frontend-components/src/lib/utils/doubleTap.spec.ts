import { describe, expect, it } from 'vitest'
import { DoubleTapDetector } from './doubleTap.js'

function tap(detector: DoubleTapDetector, x: number, at: number, holdMs = 80) {
    detector.begin({ x, y: 100 }, at)
    return detector.endCompletesDoubleTap(at + holdMs)
}

describe('DoubleTapDetector', () => {
    it('recognises a second quick tap close to the first', () => {
        const detector = new DoubleTapDetector()
        expect(tap(detector, 100, 0)).toBe(false)
        expect(tap(detector, 110, 200)).toBe(true)
    })

    it('starts over after a double tap, so a third tap is a first tap', () => {
        const detector = new DoubleTapDetector()
        tap(detector, 100, 0)
        tap(detector, 100, 200)
        expect(tap(detector, 100, 400)).toBe(false)
        expect(tap(detector, 100, 600)).toBe(true)
    })

    it('ignores taps too far apart in time or place', () => {
        const detector = new DoubleTapDetector()
        tap(detector, 100, 0)
        expect(tap(detector, 100, 500)).toBe(false)
        expect(tap(detector, 200, 700)).toBe(false)
    })

    it('does not count a held touch or a drag as a tap', () => {
        const detector = new DoubleTapDetector()
        tap(detector, 100, 0)
        expect(tap(detector, 100, 150, 400)).toBe(false)
        tap(detector, 100, 1000)
        detector.begin({ x: 100, y: 100 }, 1100)
        detector.move({ x: 130, y: 100 })
        expect(detector.endCompletesDoubleTap(1150)).toBe(false)
    })

    it('forgets the first tap when another touch intervenes', () => {
        const detector = new DoubleTapDetector()
        tap(detector, 100, 0)
        detector.reset()
        expect(tap(detector, 100, 200)).toBe(false)
    })
})
