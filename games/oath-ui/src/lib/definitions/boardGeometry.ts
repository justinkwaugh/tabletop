import { FAVOR_BANK_ORDER, Region, Suit, mapSlotsFor } from '@tabletop/oath'
import { assert, type BoundingBox, type Point } from '@tabletop/common'

// Every number is a pixel of `images/board/map.jpg` (2572 x 1024), measured off the art, so a
// resized map makes it wrong (`images/board/README.md`).

export const BOARD_WIDTH = 2572
export const BOARD_HEIGHT = 1024

// The rail under the map carries what the map does not print.
export const RAIL_HEIGHT = 220
export const SURFACE_HEIGHT = BOARD_HEIGHT + RAIL_HEIGHT

export function centerOf(rect: BoundingBox): Point {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

// The printed slot is 1.310:1 and a site card 1.292:1; drawing to the slot's
// width would overrun the printed box on every slot.
export function fitRect(rect: BoundingBox, aspect: number): BoundingBox {
    const width = Math.min(rect.width, rect.height * aspect)
    const height = width / aspect
    return {
        x: rect.x + (rect.width - width) / 2,
        y: rect.y + (rect.height - height) / 2,
        width,
        height
    }
}

export type LaidCard = { width: number; height: number; center: Point }

// A card lying sideways: fit it turned, and hand back its upright size for a transform to rotate.
export function laidCardIn(rect: BoundingBox, aspect: number, inset = 0): LaidCard {
    const box = {
        x: rect.x + inset,
        y: rect.y + inset,
        width: rect.width - inset * 2,
        height: rect.height - inset * 2
    }
    const laid = fitRect(box, 1 / aspect)
    return { width: laid.height, height: laid.width, center: centerOf(box) }
}

// A site slot's printed rectangle is a site card's own footprint (296 x 226),
// which is why denizens sit beside a site and never under it.
const SITE_SLOT_WIDTH = 296
const SITE_SLOT_HEIGHT = 226

// R-2.1.1 — Cradle, Provinces, Hinterland, left to right.
export const REGION_COLUMN_LEFT: Readonly<Record<Region, number>> = {
    [Region.Cradle]: 32,
    [Region.Provinces]: 884,
    [Region.Hinterland]: 1753
}

const SITE_ROW_TOP: readonly number[] = [190, 428, 665]

export const REGIONS: readonly Region[] = Object.values(Region)

function byRegion<T>(value: (region: Region) => T): Readonly<Record<Region, T>> {
    return {
        [Region.Cradle]: value(Region.Cradle),
        [Region.Provinces]: value(Region.Provinces),
        [Region.Hinterland]: value(Region.Hinterland)
    }
}

function bySuit<T>(value: (suit: Suit) => T): Readonly<Record<Suit, T>> {
    return {
        [Suit.Discord]: value(Suit.Discord),
        [Suit.Hearth]: value(Suit.Hearth),
        [Suit.Nomad]: value(Suit.Nomad),
        [Suit.Order]: value(Suit.Order),
        [Suit.Beast]: value(Suit.Beast),
        [Suit.Arcane]: value(Suit.Arcane)
    }
}

// Keyed by the engine's slot ids (`mapSlotsFor`): a slot is a position whose
// card may be facedown (R-9.4) and which R-8.3.5's refill moves cards between.
export const SITE_SLOT_RECTS: Readonly<Record<string, BoundingBox>> = Object.fromEntries(
    REGIONS.flatMap((region) =>
        mapSlotsFor(region).map((slotId, index) => [
            slotId,
            {
                x: REGION_COLUMN_LEFT[region],
                y: SITE_ROW_TOP[index],
                width: SITE_SLOT_WIDTH,
                height: SITE_SLOT_HEIGHT
            }
        ])
    )
)

// R-2.1.2 — a world-deck card turned (1.53:1); R-9.4 keeps the fronts private.
export const DISCARD_RECTS: Readonly<Record<Region, BoundingBox>> = byRegion((region) => ({
    x: REGION_COLUMN_LEFT[region] + 413,
    y: 30,
    width: 227,
    height: 148
}))

export const DISCARD_ROTATED = true

export const DISCARD_CARD_INSET = 12

// R-2.1.3 — six evenly spaced discs (pitch 178.4 from centre 1086), generated
// from the first and the pitch.
const FAVOR_BANK_FIRST_CENTER_X = 1086
const FAVOR_BANK_PITCH_X = 178.4
const FAVOR_BANK_CENTER_Y = 958
export const FAVOR_BANK_RADIUS = 38

export const FAVOR_BANK_CENTERS: Readonly<Record<Suit, Point>> = bySuit((suit) => ({
    x: Math.round(FAVOR_BANK_FIRST_CENTER_X + FAVOR_BANK_ORDER.indexOf(suit) * FAVOR_BANK_PITCH_X),
    y: FAVOR_BANK_CENTER_Y
}))

// R-2.1.6 — six printed cells, 0 to 5. The gaps are uneven because cells sit
// under the three Search-price bands, so they are transcribed, not generated.
export const VISIONS_TRACK_CELLS: readonly BoundingBox[] = [
    { x: 358, y: 751, width: 45, height: 70 },
    { x: 444, y: 751, width: 46, height: 70 },
    { x: 497, y: 751, width: 46, height: 70 },
    { x: 576, y: 751, width: 45, height: 70 },
    { x: 629, y: 751, width: 45, height: 70 },
    { x: 681, y: 751, width: 46, height: 70 }
]

// A relic card's footprint: square.
export const RELIC_DECK_RECT: BoundingBox = { x: 389, y: 847, width: 151, height: 149 }

// A world-deck card turned (1.51:1): the deck lies sideways, covering R-8.3's
// printed refill legend as it does on the table.
export const WORLD_DECK_RECT: BoundingBox = { x: 571, y: 849, width: 220, height: 146 }
export const WORLD_DECK_ROTATED = true

// The strip beside a site for its denizens and relics: from past
// the site's right edge to short of the next region's column, or the board's edge.
const NEXT_COLUMN_LEFT: Readonly<Record<Region, number>> = {
    [Region.Cradle]: REGION_COLUMN_LEFT[Region.Provinces],
    [Region.Provinces]: REGION_COLUMN_LEFT[Region.Hinterland],
    [Region.Hinterland]: BOARD_WIDTH
}

const CARD_STRIP_GAP_BEFORE = 18
const CARD_STRIP_GAP_AFTER = 26
const CARD_STRIP_INSET_Y = 16

export const CARD_STRIP_RECTS: Readonly<Record<string, BoundingBox>> = Object.fromEntries(
    REGIONS.flatMap((region) => {
        const left = REGION_COLUMN_LEFT[region] + SITE_SLOT_WIDTH + CARD_STRIP_GAP_BEFORE
        const right = NEXT_COLUMN_LEFT[region] - CARD_STRIP_GAP_AFTER
        return mapSlotsFor(region).map((slotId, index) => [
            slotId,
            {
                x: left,
                y: SITE_ROW_TOP[index] + CARD_STRIP_INSET_Y,
                width: right - left,
                height: SITE_SLOT_HEIGHT - CARD_STRIP_INSET_Y * 2
            }
        ])
    })
)

export const DENIZEN_ASPECT = 651 / 1016

export const STRIP_SLOT_GAP = 10

export type StripSpace = { kind: 'denizen' | 'relic'; pickable: boolean }
export type StripPlacement<S extends StripSpace> = BoundingBox & { space: S; zIndex: number }

// One width for every space so denizens and relics share a pitch; relics, being square,
// sit centred against the denizens.
export function stripLayout<S extends StripSpace>(
    strip: BoundingBox,
    spaces: readonly S[]
): StripPlacement<S>[] {
    const count = spaces.length
    if (count === 0) return []
    const naturalWidth = strip.height * DENIZEN_ASPECT
    const width = Math.min(naturalWidth, (strip.width - STRIP_SLOT_GAP * (count - 1)) / count)
    const pitch = width + STRIP_SLOT_GAP
    const denizenHeight = width / DENIZEN_ASPECT
    return spaces.map((space, index) => ({
        space,
        x: strip.x + index * pitch,
        y: space.kind === 'relic' ? strip.y + (denizenHeight - width) / 2 : strip.y,
        width,
        height: space.kind === 'relic' ? width : denizenHeight,
        // A pickable card sits above its neighbours when the pitch has narrowed into overlap.
        zIndex: space.pickable ? 100 + index : index
    }))
}

// Pieces are drawn to a height and the width follows the art: the pawns are
// different shapes cut onto one canvas so their relative heights survive.
export const WARBAND_HEIGHT = 58
export const PIECE_ROW_HEIGHT = 82
export const PAWN_HEIGHT = 82
export const PIECE_ROW_GAP = 6
export const PIECE_ROW_INSET_X = 12
// Clears the site card's name band along its bottom.
export const PIECE_ROW_INSET_Y = 48

export const SITE_TOKEN_RADIUS = FAVOR_BANK_RADIUS

// R-4, R-3.3 — the printed wheel of eight segments, read clockwise from the needle.
const ROUND_WHEEL = { center: { x: 171, y: 857 }, markerRadius: 100, segments: 8 }

export function roundMarkerCenter(round: number): Point {
    assert(round >= 1 && round <= ROUND_WHEEL.segments, `Round ${round} is not on the wheel`)
    const index = round - 1
    const angle = (-90 + (index + 0.5) * (360 / ROUND_WHEEL.segments)) * (Math.PI / 180)
    return {
        x: ROUND_WHEEL.center.x + ROUND_WHEEL.markerRadius * Math.cos(angle),
        y: ROUND_WHEEL.center.y + ROUND_WHEEL.markerRadius * Math.sin(angle)
    }
}

// R-2.1.7 — not printed; a seventh disc to the right of the six banks.
export const SHARED_FAVOR_CENTER: Point = { x: 2100, y: FAVOR_BANK_CENTER_Y }
