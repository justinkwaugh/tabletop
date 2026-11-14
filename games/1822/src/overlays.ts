import type { TileDefinition, TileFace } from '@tabletop/18xx'
import { HexSides, greyCity, phasedRevenue, terminus, throughTrack } from './faces.js'

// The overlays of the scenario pack (sheet "1822 Scenario Overlays", 16 July 2016): grey areas
// laid over the edge of the part of the map a regional scenario plays on. Each is a station with
// its values by phase, reached where the overlay prints an arrow; a route that reaches it ends
// there. The pack's tile manifest counts them as the pre-printed tiles OB1, OB3 and OB4.

function overlayTile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1822:${printedNumber}`, printedNumber, aliases: [], scope: '1822', face }
}

const { south, north, northEast, southEast } = HexSides

/** Glasgow and Edinburgh, each entered from the hex south of it. */
const Glasgow = overlayTile('OB1G', greyCity(phasedRevenue(40, 50, 60, 70), 2, [terminus(south)]))
const Edinburgh = overlayTile('OB1E', greyCity(phasedRevenue(30, 40, 50, 60), 2, [terminus(south)]))
/**
 * Southwest England, one station across two hexes with four arrows: two into its own hex, and
 * two into the hex south of it, whose tracks run on to the station side by side.
 */
const Southwest = overlayTile(
    'OB3',
    greyCity(phasedRevenue(20, 30, 40, 50), 3, [
        terminus(northEast),
        terminus(southEast),
        terminus(south, 2)
    ])
)
const SouthwestApproach = overlayTile(
    'OB3A',
    throughTrack([
        [northEast, north, 0, 0],
        [southEast, north, 0, 1]
    ])
)
/** South Wales, entered from Newport. */
const SouthWales = overlayTile(
    'OB4',
    greyCity(phasedRevenue(20, 30, 40, 50), 3, [terminus(northEast)])
)
/** A hex an overlay covers, or cuts off from the rest of the map: no track, and none to come. */
const OutOfPlay = overlayTile('OUT', { color: 'gray', nodes: [], paths: [], labels: [] })

export const OutOfPlayTileId1822 = OutOfPlay.id
/** Southwest England's two overlay tiles, joined along the station's south side. */
export const SouthwestTileIds1822 = { station: Southwest.id, approach: SouthwestApproach.id }

const arrowAt = (side: number) => `edge-${side}`

/**
 * Each overlay tile with how many the set holds, the tracks it prints as arrows, the name it
 * prints by its station, and whether it covers a hex that takes no part. Southwest England's
 * tracks from its second hex are not printed: that hex's own arrows stand for them.
 */
export const OverlayPieces1822: readonly {
    tile: TileDefinition
    arrowPathIds: readonly string[]
    name?: string
    outOfPlay?: true
}[] = [
    { tile: Glasgow, arrowPathIds: [arrowAt(south)], name: 'Glasgow' },
    { tile: Edinburgh, arrowPathIds: [arrowAt(south)], name: 'Edinburgh' },
    {
        tile: Southwest,
        arrowPathIds: [arrowAt(northEast), arrowAt(southEast)],
        name: 'Southwest England'
    },
    {
        tile: SouthwestApproach,
        arrowPathIds: SouthwestApproach.face.paths.map((path) => path.id)
    },
    { tile: SouthWales, arrowPathIds: [arrowAt(northEast)], name: 'South Wales' },
    { tile: OutOfPlay, arrowPathIds: [], outOfPlay: true }
]

export type ScenarioOverlay1822 = {
    id: string
    /** The hexes the overlay's stations stand on. */
    stations: readonly { locationId: string; definitionId: string }[]
    /** Track the overlay prints on a hex beside its station. */
    approaches: readonly { locationId: string; definitionId: string }[]
    /** Hexes the overlay covers, and those it cuts off from the rest of the map. */
    outOfPlay: readonly string[]
}

const hexes = (ids: string) => ids.split(' ')

// Scotland north of the overlay, with Galloway: Dumfries' only ways south are the red-bordered
// side of Carlisle and the hex the overlay covers.
const Scotland = hexes('C10 D9 D11 E2 E4 E6 E8 E10 E12 F3 F5 F7 F9 F11 G2 G4 G6 G8 H1 H3 H5 H7 I6')

/** The northern overlay for Scotland: Glasgow north of Carlisle, Edinburgh north of J9. */
export const ScotlandNorthOverlay1822: ScenarioOverlay1822 = {
    id: 'scotland-north',
    stations: [
        { locationId: 'G10', definitionId: Glasgow.id },
        { locationId: 'J7', definitionId: Edinburgh.id }
    ],
    approaches: [],
    outOfPlay: [...Scotland, 'H9', 'I8']
}

/**
 * The southern overlay for Scotland, which also takes the north of England: Glasgow north of
 * Preston, Edinburgh north of K18.
 */
export const ScotlandSouthOverlay1822: ScenarioOverlay1822 = {
    id: 'scotland-south',
    stations: [
        { locationId: 'H17', definitionId: Glasgow.id },
        { locationId: 'K16', definitionId: Edinburgh.id }
    ],
    approaches: [],
    outOfPlay: [
        ...Scotland,
        ...hexes(
            'F15 F17 G10 G12 G14 G16 H9 H11 H13 H15 I8 I10 I12 I14 I16 I18 J7 J9 J11 J13 J15 J17 K8 K10 K12 K14 L11 L15'
        )
    ]
}

/** The overlay for southwest England, entered from F37, F39 and F41. */
export const SouthwestOverlay1822: ScenarioOverlay1822 = {
    id: 'southwest-england',
    stations: [{ locationId: 'E38', definitionId: Southwest.id }],
    approaches: [{ locationId: 'E40', definitionId: SouthwestApproach.id }],
    outOfPlay: hexes('A42 B39 B41 B43 C38 C40 C42 D37 D39 D41 D43')
}

/**
 * The overlay for South Wales, on Cardiff, Pontypool and Merthyr Tydfil; Swansea and Fishguard
 * lie beyond it.
 */
export const SouthWalesOverlay1822: ScenarioOverlay1822 = {
    id: 'south-wales',
    stations: [{ locationId: 'F35', definitionId: SouthWales.id }],
    approaches: [],
    outOfPlay: hexes('C34 D35 E34 E36 F33')
}
