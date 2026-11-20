import type { ComponentProps } from 'svelte'
import { visualClientRect, type Floater } from '@tabletop/frontend-components'
import { findInTable, tableOf, viewOf } from './tableScope.js'

export type Box = { left: number; top: number; width: number; height: number }
export type Size = { width: number; height: number }
export type Spot = { left: number; top: number }

export type Side = 'above' | 'below' | 'left' | 'right'
type Across = 'left' | 'right'
type Vertical = 'above' | 'below'
/** A corner of the anchor: past it on one side and on the side beside that one. */
export type Corner = `${Vertical}-${Across}`
/** Where a floating control may stand beside its anchor. */
export type Place = Side | Corner

/**
 * The attribute on everything drawn that no floating control may cover: each lit hex, the marks
 * and chevrons a lit hex draws past its own edge, each city a journey's route reaches, and the
 * route's link count.
 */
export const KEEP_CLEAR_ATTRIBUTE = 'data-keep-clear'

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
function sideOf(box: Box, size: Size, side: Side, view: Box, gap = POPUP_GAP): Box {
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
            ? { left: centredLeft, top: box.top - gap - size.height }
            : side === 'below'
              ? { left: centredLeft, top: box.top + box.height + gap }
              : side === 'left'
                ? { left: box.left - gap - size.width, top: centredTop }
                : { left: box.left + box.width + gap, top: centredTop }
    return { ...spot, ...size }
}

/** The popup past one corner of a box, a gap from both of its edges. */
function cornerOf(box: Box, size: Size, corner: Corner, gap: number): Box {
    const [vertical, across] = corner.split('-')
    return {
        left: across === 'left' ? box.left - gap - size.width : box.left + box.width + gap,
        top: vertical === 'above' ? box.top - gap - size.height : box.top + box.height + gap,
        ...size
    }
}

function isSide(place: Place): place is Side {
    return !place.includes('-')
}

function placeBox(box: Box, size: Size, place: Place, view: Box, gap: number): Box {
    return isSide(place) ? sideOf(box, size, place, view, gap) : cornerOf(box, size, place, gap)
}

/**
 * The map's Ride button's sides in the order it tries them: on wider screens the side away from
 * the route's incoming link, then the side across, below and above; on phones below, above, then
 * the side away from the route and the side across (Contract, Phone layout).
 */
export function rideSides(away: Across, onPhone: boolean): Side[] {
    const across: Side[] = away === 'left' ? ['left', 'right'] : ['right', 'left']
    const vertical: Side[] = ['below', 'above']
    return onPhone ? [...vertical, ...across] : [...across, ...vertical]
}

/**
 * Every place a floating control tries beside its anchor: the four sides in the order given, then
 * the corners, those beside its first side first.
 */
export function placesFrom(sides: readonly Side[]): Place[] {
    const across = sides.filter((side): side is Across => side === 'left' || side === 'right')
    const vertical = sides.filter((side): side is Vertical => side === 'above' || side === 'below')
    const first = sides[0]
    const corners: Corner[] =
        first === 'left' || first === 'right'
            ? across.flatMap((h) => vertical.map((v): Corner => `${v}-${h}`))
            : vertical.flatMap((v) => across.map((h): Corner => `${v}-${h}`))
    return [...sides, ...corners]
}

/**
 * Contract, Pick conventions: no control floats over a pick target. The first of `places` beside
 * `anchor` that lies inside the view and covers neither the anchor nor a box of `keepClear`; none
 * when every place is covered or leaves the view, or when the anchor itself is out of view.
 */
export function clearPlace(
    anchor: Box,
    size: Size,
    places: readonly Place[],
    keepClear: readonly Box[],
    view: Box,
    gap: number
): Spot | undefined {
    if (!overlaps(anchor, view)) return undefined
    const covered = [anchor, ...keepClear]
    const clear = places
        .map((place) => placeBox(anchor, size, place, view, gap))
        .find((box) => fits(box, view) && !covered.some((other) => overlaps(box, other)))
    return clear && { left: clear.left, top: clear.top }
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

/**
 * A Floater placement that keeps the popup across the window, `margin` in from either side, as
 * the phone's page gutter is.
 */
export function acrossView(margin: number): Middleware {
    return {
        name: 'acrossView',
        fn({ x, y, rects, elements }) {
            const anchor = elements.reference.getBoundingClientRect()
            const view = viewOf(elements.floating)
            // From the Floater's coordinates to the view's and back.
            const shift = anchor.left - rects.reference.x
            const left = clamp(x + shift, margin, view.width - rects.floating.width - margin)
            return { x: left - shift, y }
        }
    }
}

/**
 * A Floater placement that keeps a control clear of the picks (`clearPlace`): it measures every
 * element of the table marked with `KEEP_CLEAR_ATTRIBUTE` as drawn on screen, the board being
 * inside its view's CSS zoom (`docs/phone-rendering.md`, Measuring under zoom), and keeps the
 * control inside the part of the page that shows its anchor. `onPlaced` hears on each placement
 * whether a clear place was found; when none is, the control waits just past the window's left
 * edge, for the caller to hide, so that its box takes no press meant for a pick. The Floater places
 * again whenever the anchor moves on screen, as a pan or a zoom does.
 */
export function clearOfPicks(
    places: readonly Place[],
    gap: number,
    onPlaced: (clear: boolean) => void
): Middleware {
    return {
        name: 'clearOfPicks',
        async fn({ rects, elements, platform, strategy }) {
            const anchor = elements.reference.getBoundingClientRect()
            const table = tableOf(elements.floating)
            const keepClear = table
                ? [...table.querySelectorAll(`[${KEEP_CLEAR_ATTRIBUTE}]`)]
                      .map((element) => visualClientRect(element))
                      .filter((box) => box.width > 0 || box.height > 0)
                : []
            const reference =
                elements.reference instanceof Element
                    ? elements.reference
                    : elements.reference.contextElement
            // What the Floater's own flip and shift kept it inside: the anchor's clipping
            // ancestors, here the board's view, within the window.
            const shown = await platform.getClippingRect({
                element: reference ?? elements.floating,
                boundary: 'clippingAncestors',
                rootBoundary: 'viewport',
                strategy
            })
            const view = { left: shown.x, top: shown.y, width: shown.width, height: shown.height }
            const clear = clearPlace(anchor, rects.floating, places, keepClear, view, gap)
            onPlaced(clear !== undefined)
            const spot = clear ?? { left: -rects.floating.width - VIEW_MARGIN, top: 0 }
            // From the view's coordinates to the Floater's, as in clearOfChoice.
            return {
                x: spot.left + rects.reference.x - anchor.left,
                y: spot.top + rects.reference.y - anchor.top
            }
        }
    }
}
