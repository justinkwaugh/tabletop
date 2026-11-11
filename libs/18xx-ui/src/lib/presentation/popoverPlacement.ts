import type { BoundingBox, Point, RectangleDimensions } from '@tabletop/common'

export type PopoverAbove = { left: number; bottom: number }

export function popoverAbove(anchor: HTMLElement, width = 0, margin = 8): PopoverAbove {
    const bounds = anchor.getBoundingClientRect()
    return {
        left: Math.max(margin, Math.min(bounds.left, window.innerWidth - width - margin)),
        bottom: window.innerHeight - bounds.top + 6
    }
}

/** Beside the anchor, so the anchor stays readable; over it only when neither side has room. */
export function popoverBeside(
    anchor: BoundingBox,
    pointerY: number,
    popover: RectangleDimensions,
    viewport: RectangleDimensions,
    margin = 8
): Point {
    const clamp = (value: number, size: number, limit: number) =>
        Math.max(margin, Math.min(value, limit - size - margin))
    const right = anchor.x + anchor.width + margin
    const left = anchor.x - margin - popover.width
    const x =
        right + popover.width + margin <= viewport.width
            ? right
            : left >= margin
              ? left
              : clamp(anchor.x + (anchor.width - popover.width) / 2, popover.width, viewport.width)
    return { x, y: clamp(pointerY - popover.height / 2, popover.height, viewport.height) }
}
