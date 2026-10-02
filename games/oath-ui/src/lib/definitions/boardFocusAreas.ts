import { mapSlotsFor, type Region } from '@tabletop/oath'
import type { BoundingBox } from '@tabletop/common'
import {
    BOARD_WIDTH,
    CARD_STRIP_RECTS,
    DISCARD_RECTS,
    FAVOR_BANK_CENTERS,
    FAVOR_BANK_RADIUS,
    REGIONS,
    SHARED_FAVOR_CENTER,
    SITE_SLOT_RECTS,
    SURFACE_HEIGHT
} from './boardGeometry.js'

export type FocusView = 'full' | Region | 'banks'

// Neighbouring regions sit 26 px apart, so the sides stay inside half of that; above and below
// there is room for the region's title art and a site's chip, which hangs 13 px under its card.
const PADDING_X = 12
const PADDING_Y = 24

function union(rects: readonly BoundingBox[]): BoundingBox {
    const left = Math.min(...rects.map((r) => r.x))
    const top = Math.min(...rects.map((r) => r.y))
    const right = Math.max(...rects.map((r) => r.x + r.width))
    const bottom = Math.max(...rects.map((r) => r.y + r.height))
    return { x: left, y: top, width: right - left, height: bottom - top }
}

function padded(rect: BoundingBox): BoundingBox {
    const x = Math.max(0, rect.x - PADDING_X)
    const y = Math.max(0, rect.y - PADDING_Y)
    return {
        x,
        y,
        width: Math.min(BOARD_WIDTH, rect.x + rect.width + PADDING_X) - x,
        height: Math.min(SURFACE_HEIGHT, rect.y + rect.height + PADDING_Y) - y
    }
}

function present(slotId: string, table: Readonly<Record<string, BoundingBox>>): BoundingBox[] {
    const rect = table[slotId]
    return rect ? [rect] : []
}

/** R-2.1.1 — a region's column: its discard pile, its sites and the cards beside them. */
export function regionFocusRect(region: Region): BoundingBox {
    const slots = mapSlotsFor(region)
    return padded(
        union([
            DISCARD_RECTS[region],
            ...slots.flatMap((slotId) => present(slotId, SITE_SLOT_RECTS)),
            ...slots.flatMap((slotId) => present(slotId, CARD_STRIP_RECTS))
        ])
    )
}

/** R-2.1.3, R-2.1.7 — the six favor banks and the shared one. */
export function banksFocusRect(): BoundingBox {
    const discs = [...Object.values(FAVOR_BANK_CENTERS), SHARED_FAVOR_CENTER].map((center) => ({
        x: center.x - FAVOR_BANK_RADIUS,
        y: center.y - FAVOR_BANK_RADIUS,
        width: FAVOR_BANK_RADIUS * 2,
        height: FAVOR_BANK_RADIUS * 2
    }))
    return padded(union(discs))
}

export function siteFocusRect(slotId: string): BoundingBox {
    return padded(
        union([...present(slotId, SITE_SLOT_RECTS), ...present(slotId, CARD_STRIP_RECTS)])
    )
}

export function focusRect(view: Exclude<FocusView, 'full'>): BoundingBox {
    return view === 'banks' ? banksFocusRect() : regionFocusRect(view)
}

export const FOCUS_REGIONS: readonly Region[] = REGIONS
