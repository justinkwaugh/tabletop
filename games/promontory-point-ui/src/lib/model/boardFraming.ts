import type { BoundingBox, Point, RectangleDimensions } from '@tabletop/common'
import type { SpaceId } from '@tabletop/promontory-point'
import { BOARD_BOUNDS, HEX, HOME_HEX_CENTRES, SPACE_CENTRES } from '$lib/utils/boardGeometry.js'

// The board is drawn at half the map's pixels; the scaling wrapper zooms up to them. Rects the
// wrapper frames are in these drawn units, measured from the drawn surface's top left, which is
// the strip's left edge (BOARD_BOUNDS), not the map's.
export const BOARD_DRAWN_SCALE = 0.5

// Contract, "Phone layout": a pick frames its lit hexes at up to twice the resting scale.
export const PICK_FRAME_ZOOM = 2

// Room kept around the framed hexes, in screen pixels, so a lit hex never sits under the edge.
export const PICK_FRAME_PADDING = 12

function boundsOf(centres: readonly Point[]): BoundingBox {
    const xs = centres.map((centre) => centre.x)
    const ys = centres.map((centre) => centre.y)
    const left = Math.min(...xs) - HEX.xRadius
    const top = Math.min(...ys) - HEX.yRadius
    const right = Math.max(...xs) + HEX.xRadius
    const bottom = Math.max(...ys) + HEX.yRadius
    return {
        x: (left - BOARD_BOUNDS.x) * BOARD_DRAWN_SCALE,
        y: (top - BOARD_BOUNDS.y) * BOARD_DRAWN_SCALE,
        width: (right - left) * BOARD_DRAWN_SCALE,
        height: (bottom - top) * BOARD_DRAWN_SCALE
    }
}

// R-1.1, R-1.1-H3: every space and home hex, edge to edge, without the price track or the sea.
export const HEX_FIELD_RECT: BoundingBox = boundsOf([
    ...SPACE_CENTRES.values(),
    ...Object.values(HOME_HEX_CENTRES)
])

// R-3.3: the lit hexes of a picked piece, edge to edge; nothing to frame when none are lit.
export function litFrameRect(lit: readonly SpaceId[]): BoundingBox | undefined {
    const centres = lit.flatMap((spaceId) => {
        const centre = SPACE_CENTRES.get(spaceId)
        return centre === undefined ? [] : [centre]
    })
    return centres.length === 0 ? undefined : boundsOf(centres)
}

// The scale the board rests at on a phone: the hex field fitted to the view.
export function hexFieldScale(view: RectangleDimensions): number {
    return Math.min(view.width / HEX_FIELD_RECT.width, view.height / HEX_FIELD_RECT.height)
}

// A pick's framing zooms no further than twice the resting scale.
export function pickFrameMaxScale(view: RectangleDimensions): number {
    return PICK_FRAME_ZOOM * hexFieldScale(view)
}

// Which lit set a framing belongs to, so the same pick is framed once and a new one again.
export function litKey(lit: readonly SpaceId[]): string {
    return [...lit].sort().join(' ')
}

export enum FramingCommand {
    // Frame the lit hexes of the pick.
    Frame = 'Frame',
    // Return to the hex field.
    Rest = 'Rest',
    None = 'None'
}

// Contract, "Phone layout": a pick frames its lit hexes once; a hand pan or zoom clears that
// framing and leaves the view to the player until the next pick; when the pick ends, a framing
// still standing returns to the hex field. Framing only moves the view: it never changes an offer.
export class PickFraming {
    // The lit set the view is framed on, until a hand pan or the pick ends.
    private framedKey: string | undefined
    // The lit set a hand pan cleared, so it is not framed again.
    private dismissedKey: string | undefined
    // A hand pan or zoom since the board last rested or framed.
    private handMoved = false
    private rested = false

    // The lit set on display changed (or the board appeared): what the view should do.
    litChanged(lit: readonly SpaceId[]): FramingCommand {
        const key = litKey(lit)
        if (lit.length > 0) {
            if (key === this.framedKey || key === this.dismissedKey) {
                return FramingCommand.None
            }
            this.framedKey = key
            this.dismissedKey = undefined
            this.handMoved = false
            return FramingCommand.Frame
        }
        this.dismissedKey = undefined
        if (this.framedKey !== undefined || (!this.rested && !this.handMoved)) {
            this.framedKey = undefined
            this.rested = true
            this.handMoved = false
            return FramingCommand.Rest
        }
        return FramingCommand.None
    }

    // The player panned or zoomed by hand while these hexes were lit.
    handMove(lit: readonly SpaceId[]) {
        this.dismissedKey = lit.length > 0 ? litKey(lit) : undefined
        this.framedKey = undefined
        this.handMoved = true
    }
}
