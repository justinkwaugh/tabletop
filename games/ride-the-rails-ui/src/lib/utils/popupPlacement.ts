import type { ComponentProps } from 'svelte'
import type { Floater } from '@tabletop/frontend-components'
import { findInTable, tableOf, viewOf } from './tableScope.js'

export type Box = { left: number; top: number; width: number; height: number }
export type Size = { width: number; height: number }
export type Spot = { left: number; top: number }

type Side = 'above' | 'below' | 'left' | 'right'

/** The space between a popup and its hex, or between the two popups. */
export const POPUP_GAP = 8
/** The space kept between a popup and the edge of the view. */
const VIEW_MARGIN = 4

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, Math.max(min, max)))
}

function overlaps(a: Box, b: Box): boolean {
    return (
        a.left < b.left + b.width &&
        b.left < a.left + a.width &&
        a.top < b.top + b.height &&
        b.top < a.top + a.height
    )
}

function fits(box: Box, view: Box): boolean {
    return (
        box.left >= view.left &&
        box.top >= view.top &&
        box.left + box.width <= view.left + view.width &&
        box.top + box.height <= view.top + view.height
    )
}

/** The popup on one side of a box, centred on it along that side and kept inside the view. */
function sideOf(box: Box, size: Size, side: Side, view: Box): Box {
    const inner = {
        left: view.left + VIEW_MARGIN,
        top: view.top + VIEW_MARGIN,
        right: view.left + view.width - VIEW_MARGIN,
        bottom: view.top + view.height - VIEW_MARGIN
    }
    const centredLeft = clamp(
        box.left + box.width / 2 - size.width / 2,
        inner.left,
        inner.right - size.width
    )
    const centredTop = clamp(
        box.top + box.height / 2 - size.height / 2,
        inner.top,
        inner.bottom - size.height
    )
    const spot =
        side === 'above'
            ? { left: centredLeft, top: box.top - POPUP_GAP - size.height }
            : side === 'below'
              ? { left: centredLeft, top: box.top + box.height + POPUP_GAP }
              : side === 'left'
                ? { left: box.left - POPUP_GAP - size.width, top: centredTop }
                : { left: box.left + box.width + POPUP_GAP, top: centredTop }
    return { ...spot, ...size }
}

/**
 * Contract, Coexistence and precedence: where the hex detail opens while the railroad popup shows.
 * It takes a side of its own hex, first the one away from the railroad popup, and only a side
 * that is inside the view and clear of that popup; when its hex has no such side, it takes a side
 * of the railroad popup itself, so the two never cover each other.
 */
export function detailClearOfChoice(
    hex: Box,
    size: Size,
    choice: Box,
    view: Box,
    onPhone: boolean
): Spot {
    const choiceBelow = choice.top + choice.height / 2 >= hex.top + hex.height / 2
    const choiceRight = choice.left + choice.width / 2 >= hex.left + hex.width / 2
    const vertical: Side[] = choiceBelow ? ['above', 'below'] : ['below', 'above']
    const across: Side[] = choiceRight ? ['left', 'right'] : ['right', 'left']
    const sides = onPhone ? [...vertical, ...across] : [...across, ...vertical]
    const candidates = [
        ...sides.map((side) => sideOf(hex, size, side, view)),
        ...sides.map((side) => sideOf(choice, size, side, view))
    ]
    const clear = candidates.find((box) => fits(box, view) && !overlaps(box, choice))
    const fallback = candidates.find((box) => !overlaps(box, choice)) ?? candidates[0]
    const chosen = clear ?? fallback
    return { left: chosen.left, top: chosen.top }
}

type Middleware = NonNullable<ComponentProps<typeof Floater>['middlewares']>[number]

/**
 * A Floater placement for the hex detail that reads where the railroad popup is on screen, found
 * by `choiceSelector`, and keeps clear of it (`detailClearOfChoice`).
 */
export function clearOfChoice(choiceSelector: string, onPhone: boolean): Middleware {
    return {
        name: 'clearOfChoice',
        fn({ x, y, rects, elements }) {
            const table = tableOf(elements.floating)
            const choice = findInTable(table, choiceSelector)?.getBoundingClientRect()
            const hex = elements.reference.getBoundingClientRect()
            if (!choice) return { x, y }
            const view = viewOf(elements.floating)
            const spot = detailClearOfChoice(hex, rects.floating, choice, view, onPhone)
            // From the view's coordinates to the Floater's, which measure from the reference's
            // offset parent.
            return {
                x: spot.left + rects.reference.x - hex.left,
                y: spot.top + rects.reference.y - hex.top
            }
        }
    }
}
