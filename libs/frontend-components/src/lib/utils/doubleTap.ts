import type { Point } from '@tabletop/common'
import { pointDistance } from './pointDistance.js'

const TAP_MAX_MS = 300
const TAP_SLOP_PX = 10
const DOUBLE_TAP_GAP_MS = 300
const DOUBLE_TAP_REACH_PX = 30

const INTERACTIVE_SELECTOR = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    ...['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'option', 'menuitem'].map(
        (role) => `[role="${role}"]`
    )
].join(', ')

const DISABLED_SELECTOR = ':disabled, [aria-disabled="true"]'

type TouchStart = { point: Point; startedAt: number }
type Tap = { point: Point; endedAt: number }

/** Whether a tap on this target within the boundary belongs to something the player can press. */
export function isInteractiveTarget(target: EventTarget | null, boundary: Element) {
    if (!(target instanceof Element)) return false
    const control = target.closest(INTERACTIVE_SELECTOR)
    if (control && boundary.contains(control) && !control.matches(DISABLED_SELECTOR)) return true
    return getComputedStyle(target).cursor === 'pointer'
}

/** Recognises two quick single-finger taps close together; any other touch starts over. */
export class DoubleTapDetector {
    #touch: TouchStart | null = null
    #lastTap: Tap | null = null

    begin(point: Point, startedAt: number) {
        this.#touch = { point, startedAt }
    }

    move(point: Point) {
        if (this.#touch && pointDistance(this.#touch.point, point) > TAP_SLOP_PX) this.reset()
    }

    endCompletesDoubleTap(endedAt: number) {
        const touch = this.#touch
        this.#touch = null
        if (!touch || endedAt - touch.startedAt > TAP_MAX_MS) {
            this.#lastTap = null
            return false
        }
        const lastTap = this.#lastTap
        if (
            lastTap &&
            touch.startedAt - lastTap.endedAt <= DOUBLE_TAP_GAP_MS &&
            pointDistance(lastTap.point, touch.point) <= DOUBLE_TAP_REACH_PX
        ) {
            this.#lastTap = null
            return true
        }
        this.#lastTap = { point: touch.point, endedAt }
        return false
    }

    reset() {
        this.#touch = null
        this.#lastTap = null
    }
}
