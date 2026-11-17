import type { BoundingBox, Point } from '@tabletop/common'
import {
    RAILROAD_INTRODUCTIONS,
    boardMap,
    type CityId,
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
    /** The start legend's width, where the map's open sea is narrower than the usual card. */
    readonly legendWidth?: number
    /**
     * The cities whose limit mark stands inside the hex although a side opens past the land: those
     * on the board's land border, where a mark in the margin would read as off the map.
     */
    readonly limitMarksInHex?: readonly CityId[]
}

// R-8: an expansion map adds its own row.
export const MAP_LAYOUTS: Readonly<Record<MapId, MapLayout>> = {
    // The title in the open water north-east of Michigan, clear of land from x 1660 to 1940 above
    // y 230; the legend in the open sea south-west of California, clear of land below y 975 from
    // the board's left edge to x 790. Fitted to a desktop view, the board puts the zoom control in
    // its bottom-left corner, up to 260 across, and in a view near the board's own shape it reaches
    // higher than any card that sea holds could clear. So the legend stands right of the control,
    // from x 284, narrowed to 500 (its widest row's text ends at 425).
    'map.usa': {
        name: 'USA',
        boardLabel: 'Map of the USA',
        title: { x: 1800, y: 118 },
        legend: { x: 284, y: 1196 },
        legendWidth: 500
    },
    // The board prints no title: the title in the open sea north of Perth, clear of land by 72.
    // The legend in the south-west, where the board prints its railroad introduction panel: in the
    // open sea south of the west coast, narrowed to 520 for its two rows (Black's, naming Perth and
    // Brisbane, ends at 453), and raised clear of the zoom control in the fitted board's
    // bottom-left corner.
    'map.au': {
        name: 'Australia',
        boardLabel: 'Map of Australia',
        title: { x: 200, y: 118 },
        legend: { x: 40, y: 1180 },
        legendWidth: 520
    },
    // The board prints no title: the title in the open water south of Sherbrooke, clear of land
    // by 200. The legend towards the south-west, where the board prints its railroad introduction
    // panel: in Lake Erie's open water south of Niagara, clear of land by 46. Two rows need less
    // than the usual card.
    'map.ca': {
        name: 'Canada',
        boardLabel: 'Map of Canada',
        title: { x: 1800, y: 780 },
        legend: { x: 712, y: 1136 },
        legendWidth: 440
    },
    // The board prints no title: the title in the Channel north of Cherbourg, clear of land by 90.
    // The legend in the south-west, where the board prints its railroad introduction panel: in
    // the Bay of Biscay along the board's west edge, clear of land by 24. Fitted to a 1024-wide
    // window's view the board is near square, so the zoom control reaches up the bay's mouth to
    // y 1483, and the open water above it is narrower: the legend stands above the control,
    // narrowed to 300 (its widest row's text ends at 275). Lille, Valenciennes, Sedan and Metz
    // stand on the board's land border, so their 1 goes in the hex.
    'map.fr': {
        name: 'France',
        boardLabel: 'Map of France',
        title: { x: 160, y: 96 },
        legend: { x: 16, y: 1464 },
        legendWidth: 300,
        limitMarksInHex: ['city.fr.lille', 'city.fr.valenciennes', 'city.fr.sedan', 'city.fr.metz']
    },
    // The board prints no title: the title off the board's land south-east of Dresden, clear of
    // land by 86. The board prints its railroad introduction panel in the south-west, but no open
    // sea there holds even a card 360 wide, so the legend stands in the North Sea, clear of land by
    // 24. That sea is 520 wide at most, so the legend is narrowed to 480, wider than its rows need.
    'map.de': {
        name: 'Germany',
        boardLabel: 'Map of Germany',
        title: { x: 1360, y: 1360 },
        legend: { x: 16, y: 160 },
        legendWidth: 480
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

type NamedStartRule = Exclude<StartRule, 'any-city-but-long-distance'>

// R-4.2.1 to R-4.2.5, R-8: each start rule in the legend's words.
const START_RULE_TEXT: Readonly<Record<NamedStartRule, string>> = {
    'east-coast-apart': 'Different East Coast cities',
    'east-coast-or-chicago': 'An East Coast city or Chicago',
    'chicago-or-westernmost': 'Chicago or the 3 westernmost developed cities',
    'west-coast': 'A West Coast city',
    'any-city': 'Any city with room',
    'printed-colour': 'A city of its colour',
    'printed-colour-or-berlin': 'A city of its colour, or Berlin'
}

// R-8.2: a rule that leaves out the map's long-distance cities names them, from the map's data
// ("Any city with room but Perth and Brisbane").
function startRuleText(mapId: MapId, rule: StartRule): string {
    if (rule !== 'any-city-but-long-distance') return START_RULE_TEXT[rule]
    const map = boardMap(mapId)
    const names = map.longDistanceCities.map((cityId) => map.city(cityId).name)
    const last = names.pop() ?? ''
    const listed = names.length > 0 ? `${names.join(', ')} and ${last}` : last
    return `${START_RULE_TEXT['any-city']} but ${listed}`
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
    return [...rows].map(([rule, railroadIds]) => ({
        railroadIds,
        text: startRuleText(mapId, rule)
    }))
}

const LEGEND_CUBE_GAP = 4
const LEGEND_TEXT_GAP = 12
/** The text column never starts left of where the USA's rows, two cubes at most, put it. */
const LEGEND_FEWEST_CUBES = 2

/** The middle of a legend row's cube at this place in the row, from the card's left edge. */
export function legendCubeX(place: number): number {
    const { pad, cube } = START_LEGEND
    return pad + cube / 2 + place * (cube + LEGEND_CUBE_GAP)
}

/**
 * Where the rows' text starts, from the card's left edge: past the widest row's cubes (R-8: five
 * share a row on Australia, Canada and France), so every row's text lines up clear of its cubes.
 */
export function legendTextX(mapId: MapId): number {
    const widest = Math.max(
        LEGEND_FEWEST_CUBES,
        ...legendRows(mapId).map((row) => row.railroadIds.length)
    )
    return legendCubeX(widest - 1) + START_LEGEND.cube / 2 + LEGEND_TEXT_GAP
}

/** The legend's card, standing on its layout's corner. */
export function legendBox(mapId: MapId): BoundingBox {
    const { pad, titleSize, row } = START_LEGEND
    const height = pad + titleSize + 10 + legendRows(mapId).length * row + pad - 8
    const { legend, legendWidth = START_LEGEND.width } = MAP_LAYOUTS[mapId]
    return { x: legend.x, y: legend.y - height, width: legendWidth, height }
}
