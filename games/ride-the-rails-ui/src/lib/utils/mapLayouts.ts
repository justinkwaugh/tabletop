import type { BoundingBox, Point } from '@tabletop/common'
import {
    RAILROAD_INTRODUCTIONS,
    type MapId,
    type RailroadId,
    type StartRule
} from '@tabletop/ride-the-rails'

// Art plan, Board: what each map's sea holds besides its capacity marks, in board units.

export type MapLayout = {
    /** The map's printed name, under the title. */
    readonly name: string
    /** The board's accessible name. */
    readonly boardLabel: string
    /** The middle of the title's first line, on its baseline. */
    readonly title: Point
    /** The start legend's bottom-left corner. */
    readonly legend: Point
}

// R-8: an expansion map adds its own row.
export const MAP_LAYOUTS: Readonly<Record<MapId, MapLayout>> = {
    // The title in the open water north-east of Michigan, clear of land from x 1660 to 1940 above
    // y 230; the legend in the open sea south-west of California, clear of land below y 975 from
    // the board's left edge to x 790.
    'map.usa': {
        name: 'USA',
        boardLabel: 'Map of the USA',
        title: { x: 1800, y: 118 },
        legend: { x: 52, y: 1196 }
    },
    // The board prints no title. The title in the open sea north of Perth, clear of land by 72;
    // the legend in the sea south-east of Melbourne, clear of land by 36.
    'map.au': {
        name: 'Australia',
        boardLabel: 'Map of Australia',
        title: { x: 200, y: 118 },
        legend: { x: 1460, y: 1264 }
    },
    // The board prints no title. The title in the open water south of Sherbrooke, the legend in
    // the open water south of Kingston, each clear of land by 200 or more.
    'map.ca': {
        name: 'Canada',
        boardLabel: 'Map of Canada',
        title: { x: 1800, y: 780 },
        legend: { x: 1240, y: 1100 }
    }
}

/** "Ride the Rails" over the map's name, in white like the capacity marks. */
export const MAP_TITLE = {
    size: 52,
    letterSpacing: 1,
    nameSize: 26,
    nameLetterSpacing: 6,
    /** From the title's baseline down to the name's. */
    nameDrop: 40,
    /**
     * The box the two lines take round the title's point, as the browser draws them: the title
     * line is the wider, 252.3 across, from 51.6 above its baseline to the name's 6.2 below.
     */
    halfWidth: 128,
    above: 54,
    below: 48
} as const

export function titleBox(layout: MapLayout): BoundingBox {
    return {
        x: layout.title.x - MAP_TITLE.halfWidth,
        y: layout.title.y - MAP_TITLE.above,
        width: 2 * MAP_TITLE.halfWidth,
        height: MAP_TITLE.above + MAP_TITLE.below
    }
}

/** The start legend's card and rows. */
export const START_LEGEND = {
    width: 610,
    pad: 16,
    titleSize: 20,
    textSize: 17,
    row: 30,
    cube: 18
} as const

// R-4.2.1 to R-4.2.5, R-8: each start rule in the legend's words.
const START_RULE_TEXT: Readonly<Record<StartRule, string>> = {
    'east-coast-apart': 'Different East Coast cities',
    'east-coast-or-chicago': 'An East Coast city or Chicago',
    'chicago-or-westernmost': 'Chicago or the 3 westernmost developed cities',
    'west-coast': 'A West Coast city',
    'any-city': 'Any city with room',
    'printed-colour': 'A city of its colour',
    'printed-colour-or-berlin': 'A city of its colour, or Berlin'
}

export type LegendRow = { railroadIds: readonly RailroadId[]; text: string }

/**
 * One row per start rule, in the order the map introduces its railroads; the railroads that share
 * a rule (Red and Blue) share a row.
 */
export function legendRows(mapId: MapId): LegendRow[] {
    const rows = new Map<StartRule, RailroadId[]>()
    for (const { railroadId, startRule } of RAILROAD_INTRODUCTIONS[mapId]) {
        rows.set(startRule, [...(rows.get(startRule) ?? []), railroadId])
    }
    return [...rows].map(([rule, railroadIds]) => ({ railroadIds, text: START_RULE_TEXT[rule] }))
}

/** The legend's card, standing on its layout's corner. */
export function legendBox(mapId: MapId): BoundingBox {
    const { pad, titleSize, row } = START_LEGEND
    const height = pad + titleSize + 10 + legendRows(mapId).length * row + pad - 8
    const { legend } = MAP_LAYOUTS[mapId]
    return { x: legend.x, y: legend.y - height, width: START_LEGEND.width, height }
}
