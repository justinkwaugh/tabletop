import { assertExists, type BoundingBox, type Point } from '@tabletop/common'
import {
    MapId,
    SettlementKind,
    sarMap,
    type PointSettlementKind,
    type SarMap,
    type SettlementDefinition
} from '@tabletop/south-african-railroads'
import {
    LINK_BOX_SIZE,
    METRO_CELL,
    boardLayout,
    type BaseName,
    type BoardLayout,
    type MapLabel
} from './boardLayout.js'
import { CONNECTION_STAR_RADIUS, connectionLabelBox } from './mapGeometry.js'

// Libre Baskerville metrics, measured generously so estimates never undershoot the glyphs.
const NAME_CHAR_WIDTH = 7.6
const NAME_ASCENT = 11
const NAME_DESCENT = 4
const BASE_NAME_CHAR_WIDTH = 18
const BASE_NAME_ASCENT = 21
const LABEL_GAP = 3
const FRAME_INSET = 20

const ICON_HALF_SIZE: Record<PointSettlementKind, number> = {
    [SettlementKind.RailroadStation]: 13.5,
    [SettlementKind.AgriculturalRailhead]: 18.5,
    [SettlementKind.NaturalResource]: 18.5,
    [SettlementKind.MercantileCenter]: 16.3,
    [SettlementKind.RailroadBase]: 23
}
const LINK_BOX_HALF_SIZE = LINK_BOX_SIZE / 2

export const METRO_FRAME_PAD = 3
const METRO_CAPTION_CHAR_WIDTH = 7
const METRO_CAPTION_HEIGHT = 18
const PLATE_SHIFTS = [8, 16, 24, 32, 40]

const RING_DISTANCES = [3, 8, 14, 20, 28, 38, 48]
const RING_DIRECTIONS = 16

export type Segment = readonly [Point, Point]

function square(x: number, y: number, half: number): BoundingBox {
    return { x: x - half, y: y - half, width: half * 2, height: half * 2 }
}

function unionBox(a: BoundingBox, b: BoundingBox): BoundingBox {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    return {
        x,
        y,
        width: Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y
    }
}

export function nameBox(name: string, label: MapLabel): BoundingBox {
    const length = name.length * NAME_CHAR_WIDTH
    return label.rotate === 90
        ? {
              x: label.x - NAME_DESCENT,
              y: label.y,
              width: NAME_ASCENT + NAME_DESCENT,
              height: length
          }
        : {
              x: label.x,
              y: label.y - NAME_ASCENT,
              width: length,
              height: NAME_ASCENT + NAME_DESCENT
          }
}

// Liang-Barsky clipping: the segment touches the box if any part survives the clip.
export function segmentCrossesBox([from, to]: Segment, box: BoundingBox, gap = 0): boolean {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const edges: [number, number][] = [
        [-dx, from.x - (box.x - gap)],
        [dx, box.x + box.width + gap - from.x],
        [-dy, from.y - (box.y - gap)],
        [dy, box.y + box.height + gap - from.y]
    ]
    let enter = 0
    let exit = 1
    for (const [direction, distance] of edges) {
        if (direction === 0) {
            if (distance < 0) {
                return false
            }
            continue
        }
        const t = distance / direction
        if (direction < 0) {
            enter = Math.max(enter, t)
        } else {
            exit = Math.min(exit, t)
        }
        if (enter > exit) {
            return false
        }
    }
    return true
}

export function boxesOverlap(a: BoundingBox, b: BoundingBox, gap = 0): boolean {
    return (
        a.x < b.x + b.width + gap &&
        b.x < a.x + a.width + gap &&
        a.y < b.y + b.height + gap &&
        b.y < a.y + a.height + gap
    )
}

function labelFromBox(box: BoundingBox, vertical: boolean): MapLabel {
    return vertical
        ? { x: box.x + NAME_DESCENT, y: box.y, rotate: 90 }
        : { x: box.x, y: box.y + NAME_ASCENT }
}

// Name and plate placement for one map, worked out once from its static data.
export class MapLabels {
    readonly metroCaptions: Readonly<Record<string, BoundingBox>>
    readonly trackSegments: readonly Segment[]
    readonly settlementLabels: Readonly<Record<string, MapLabel>>

    constructor(
        private readonly map: SarMap,
        private readonly layout: BoardLayout
    ) {
        this.metroCaptions = Object.fromEntries(
            map.settlements
                .filter((place) => place.kind === SettlementKind.MetroArea && this.isNamed(place))
                .map((place) => [place.id, this.placeMetroCaption(place)])
        )
        this.trackSegments = [
            ...map.links.flatMap((trackLink): Segment[] => {
                const [a, b] = trackLink.ends.map((id) => map.settlement(id))
                return [
                    [a, trackLink.box],
                    [trackLink.box, b]
                ]
            }),
            ...map.externalConnections.map((connection): Segment => [
                map.settlement(connection.settlementId),
                connection
            ])
        ]
        this.settlementLabels = this.placeLabels()
    }

    get baseNames(): readonly BaseName[] {
        return this.layout.spec.baseNames
    }

    metroFrameBox(place: SettlementDefinition): BoundingBox {
        const grid = this.layout.metroGrid(place.id)
        const rows = Math.ceil(this.map.incomeLevels(place.id).length / grid.columns)
        return {
            x: grid.origin.x - METRO_FRAME_PAD,
            y: grid.origin.y - METRO_FRAME_PAD,
            width: grid.columns * METRO_CELL + METRO_FRAME_PAD * 2,
            height: rows * METRO_CELL + METRO_FRAME_PAD * 2
        }
    }

    // Metro areas carry their names on a plate; natural resources go unnamed, as printed.
    private isNamed(place: SettlementDefinition): boolean {
        const named = this.layout.spec.namedSettlements
        return place.kind !== SettlementKind.NaturalResource && (!named || named.includes(place.id))
    }

    hasNameLabel(place: SettlementDefinition): boolean {
        return place.kind !== SettlementKind.MetroArea && this.isNamed(place)
    }

    metroCaption(place: SettlementDefinition): BoundingBox | undefined {
        return this.metroCaptions[place.id]
    }

    settlementIconBox(place: SettlementDefinition): BoundingBox {
        if (place.kind !== SettlementKind.MetroArea) {
            return this.pointIconBox(place)
        }
        const caption = this.metroCaption(place)
        return caption ? unionBox(this.metroFrameBox(place), caption) : this.metroFrameBox(place)
    }

    private pointIconBox(place: SettlementDefinition): BoundingBox {
        return place.kind === SettlementKind.MetroArea
            ? this.metroFrameBox(place)
            : square(place.x, place.y, ICON_HALF_SIZE[place.kind])
    }

    private linkBoxes(): BoundingBox[] {
        return this.map.links.map((trackLink) =>
            square(trackLink.box.x, trackLink.box.y, LINK_BOX_HALF_SIZE)
        )
    }

    // Track converges on the metro grids from every side, so their names hang on a plate attached
    // to the grid, on the first side clear of link boxes and other settlements.
    private placeMetroCaption(place: SettlementDefinition): BoundingBox {
        const frame = this.metroFrameBox(place)
        const width = Math.max(frame.width, place.name.length * METRO_CAPTION_CHAR_WIDTH + 12)
        const height = METRO_CAPTION_HEIGHT
        const centredX = frame.x + frame.width / 2 - width / 2
        const centredY = frame.y + frame.height / 2 - height / 2
        const centred: BoundingBox[] = [
            { x: centredX, y: frame.y + frame.height - 1, width, height },
            { x: centredX, y: frame.y - height + 1, width, height },
            { x: frame.x + frame.width - 1, y: centredY, width, height },
            { x: frame.x - width + 1, y: centredY, width, height }
        ]
        // Where track crowds every side, a plate slides along a side, still touching the grid.
        const shifts = PLATE_SHIFTS.flatMap((shift) => [shift, -shift])
        const sides = [
            ...centred,
            ...shifts.flatMap((shift) => [
                ...centred.slice(0, 2).map((side) => ({ ...side, x: side.x + shift })),
                ...centred.slice(2).map((side) => ({
                    ...side,
                    y: side.y + Math.max(-frame.height / 2, Math.min(frame.height / 2, shift))
                }))
            ])
        ]
        const obstacles = [
            ...this.linkBoxes(),
            ...this.map.settlements
                .filter((other) => other.id !== place.id)
                .map((other) => this.pointIconBox(other))
        ]
        const caption = sides.find((side) => !obstacles.some((other) => boxesOverlap(side, other)))
        assertExists(caption, `No clear side for the ${place.name} plate`)
        return caption
    }

    private baseNameBox(base: BaseName): BoundingBox {
        const name = this.map.railroad(base.railroadId).shortName
        return {
            x: base.x,
            y: base.y - BASE_NAME_ASCENT,
            width: name.length * BASE_NAME_CHAR_WIDTH,
            height: BASE_NAME_ASCENT + 6
        }
    }

    private insideFrame(box: BoundingBox): boolean {
        const layout = this.layout
        return (
            box.x >= FRAME_INSET &&
            box.x + box.width <= layout.width - FRAME_INSET &&
            box.y >= layout.top + FRAME_INSET &&
            box.y + box.height <= layout.top + layout.height - FRAME_INSET
        )
    }

    // Spots around the icon, nearest ring first: each name box touches a point just off the icon
    // in one of sixteen directions, on the side that faces away from it. Vertical names, as the
    // SAR board prints Vereeniging, come after every horizontal spot.
    private ringLabels(place: SettlementDefinition, vertical: boolean): MapLabel[] {
        const icon = this.settlementIconBox(place)
        const length = place.name.length * NAME_CHAR_WIDTH
        const thickness = NAME_ASCENT + NAME_DESCENT
        const width = vertical ? thickness : length
        const height = vertical ? length : thickness
        const centre = { x: icon.x + icon.width / 2, y: icon.y + icon.height / 2 }
        return RING_DISTANCES.flatMap((distance) =>
            Array.from({ length: RING_DIRECTIONS }, (_, index) => {
                const angle = (2 * Math.PI * index) / RING_DIRECTIONS
                const cos = Math.cos(angle)
                const sin = Math.sin(angle)
                const x = centre.x + cos * (icon.width / 2 + distance)
                const y = centre.y + sin * (icon.height / 2 + distance)
                return labelFromBox(
                    {
                        x: cos > 0.3 ? x : cos < -0.3 ? x - width : x - width / 2,
                        y: sin > 0.3 ? y : sin < -0.3 ? y - height : y - height / 2,
                        width,
                        height
                    },
                    vertical
                )
            })
        )
    }

    // Each name keeps its printed spot when that is clear, else takes the nearest clear spot
    // around its icon; the names with the fewest clear spots are placed first.
    private placeLabels(): Record<string, MapLabel> {
        const fixed: BoundingBox[] = [
            ...this.map.settlements.map((place) => this.settlementIconBox(place)),
            ...this.linkBoxes(),
            ...this.map.externalConnections.flatMap((connection) => [
                square(connection.x, connection.y, CONNECTION_STAR_RADIUS),
                connectionLabelBox(connection, this.layout.width)
            ]),
            ...this.baseNames.map((base) => this.baseNameBox(base)),
            ...this.layout.furniture
        ]
        const clearOfMap = (box: BoundingBox) =>
            this.insideFrame(box) &&
            !fixed.some((other) => boxesOverlap(box, other, LABEL_GAP)) &&
            !this.trackSegments.some((segment) => segmentCrossesBox(segment, box, LABEL_GAP))
        const printed = this.layout.spec.printedLabels
        const options = this.map.settlements
            .filter((place) => this.hasNameLabel(place))
            .map((place) => ({
                place,
                labels: [
                    ...(printed[place.id] ? [printed[place.id]] : []),
                    ...this.ringLabels(place, false),
                    ...this.ringLabels(place, true)
                ].filter((label) => clearOfMap(nameBox(place.name, label)))
            }))
        options.sort((a, b) => a.labels.length - b.labels.length)
        const placedBoxes: BoundingBox[] = []
        const placed: Record<string, MapLabel> = {}
        for (const { place, labels } of options) {
            const label = labels.find(
                (candidate) =>
                    !placedBoxes.some((other) =>
                        boxesOverlap(nameBox(place.name, candidate), other, LABEL_GAP)
                    )
            )
            assertExists(label, `No clear spot for ${place.name}`)
            placed[place.id] = label
            placedBoxes.push(nameBox(place.name, label))
        }
        return placed
    }
}

const cache = new Map<MapId, MapLabels>()

export function mapLabels(mapId: MapId): MapLabels {
    let labels = cache.get(mapId)
    if (!labels) {
        labels = new MapLabels(sarMap(mapId), boardLayout(mapId))
        cache.set(mapId, labels)
    }
    return labels
}
