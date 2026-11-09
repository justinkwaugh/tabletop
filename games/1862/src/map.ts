import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createLetterNumberLocationFactory,
    createStagedTileRevenue as revenue,
    createTownTileFace as town,
    createCityTileFace as city,
    type MapLocation,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'

/** Off-board areas pay the lowest printed figure in A–B, the middle in C–D, the highest after (§9). */
export const OffboardStages = ['A-B', 'C-D', 'E-H'] as const
export type OffboardStage = (typeof OffboardStages)[number]

type OffboardAreaDefinition = {
    name: string
    kind: 'red' | 'port'
    values: readonly [lowest: number, middle: number, highest: number]
}

/**
 * Each red area or port pays once per company however many of its hexes the company reaches
 * (§7.8). The north coast has three separate ports, by King's Lynn, Wells and Cromer.
 */
export const OffboardAreas = {
    midlands: { name: 'Midlands', kind: 'red', values: [40, 90, 140] },
    west: { name: 'The West', kind: 'red', values: [70, 100, 120] },
    london: { name: 'London', kind: 'red', values: [100, 150, 200] },
    'north-lynn': { name: "North (King's Lynn)", kind: 'port', values: [80, 90, 100] },
    'north-wells': { name: 'North (Wells)', kind: 'port', values: [80, 90, 100] },
    'north-cromer': { name: 'North (Cromer)', kind: 'port', values: [80, 90, 100] },
    'north-east': { name: 'North East', kind: 'port', values: [80, 100, 120] },
    east: { name: 'East', kind: 'port', values: [60, 90, 120] },
    denmark: { name: 'Denmark', kind: 'port', values: [70, 100, 130] },
    holland: { name: 'Holland', kind: 'port', values: [70, 100, 130] }
} as const satisfies Record<string, OffboardAreaDefinition>
export type OffboardAreaId = keyof typeof OffboardAreas
export const OffboardAreaIds = Object.keys(OffboardAreas).filter(isOffboardAreaId)

function isOffboardAreaId(id: string): id is OffboardAreaId {
    return id in OffboardAreas
}

/** A route may include at most one red off-board area and at most one port (§7.4). */
export const RedStopGroup = 'red'
export const PortStopGroup = 'port'

export const IpswichLocationId = 'F11'
export const HarwichLocationId = 'F13'
/** The hex printing London's four station spaces, where companies build to London (§7.6.5). */
export const LondonSpacesLocationId = 'C14'
export const LondonSpacesNodeId = 'london-spaces'
export const LondonSpaceCount = 4

const Names: Readonly<Record<string, string>> = {
    B3: 'Holbeach',
    B5: 'Wisbech',
    B7: 'March',
    B9: 'Cambridge',
    B11: 'Royston',
    B13: "Bishop's Stortford",
    C4: "King's Lynn",
    C6: 'Downham Market',
    C8: 'Ely',
    C10: 'Newmarket',
    C12: 'Great Dunmow',
    D3: 'Hunstanton',
    D5: 'Swaffham',
    D7: 'Brandon',
    D9: 'Bury St Edmunds',
    D11: 'Sudbury',
    D13: 'Witham',
    E2: 'Wells-next-the-Sea',
    E4: 'Fakenham',
    E6: 'Watton',
    E8: 'Thetford',
    E10: 'Stowmarket',
    E12: 'Colchester',
    E14: 'Tiptree',
    F3: 'Cromer',
    F5: 'Norwich',
    F7: 'Diss',
    F9: 'Framlingham',
    F11: 'Ipswich',
    F13: 'Harwich',
    G4: 'North Walsham',
    G6: 'Acle',
    G8: 'Beccles',
    G10: 'Woodbridge',
    G12: 'Felixstowe',
    H5: 'Great Yarmouth',
    H7: 'Lowestoft'
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 0,
    fixedColors: ['red', 'blue'],
    names: Names,
    homes: {},
    markers: {}
})

type OffboardEntry = readonly [area: OffboardAreaId, edges: readonly TileEdge[]]

function offboardFace(color: 'red' | 'blue', entries: readonly OffboardEntry[]): TileFace {
    return {
        color,
        labels: [],
        nodes: entries.map(([area]) => ({
            id: area,
            kind: 'offboard',
            revenue: revenue(
                OffboardStages.map((stage, index): readonly [string, number] => [
                    stage,
                    OffboardAreas[area].values[index]
                ])
            )
        })),
        paths: entries.flatMap(([area, edges]) =>
            edges.map((edge) => ({
                id: `${area}-edge-${edge}`,
                endpoints: [
                    { kind: 'edge', edge },
                    { kind: 'node', nodeId: area }
                ]
            }))
        )
    }
}

function offboards(id: string, entries: readonly OffboardEntry[], face?: TileFace): MapLocation[] {
    const kind = OffboardAreas[entries[0][0]].kind
    return locations(id, face ?? offboardFace(kind === 'red' ? 'red' : 'blue', entries), {
        stopGroup: kind === 'red' ? RedStopGroup : PortStopGroup
    }).map((location) => ({
        ...location,
        name: [...new Set(entries.map(([area]) => OffboardAreas[area].name))].join(' & ')
    }))
}

const London = offboardFace('red', [['london', [2, 3, 4]]])
const LondonWithSpaces: TileFace = {
    ...London,
    nodes: [
        ...London.nodes,
        {
            id: LondonSpacesNodeId,
            kind: 'city',
            revenue: { kind: 'fixed', amount: 0 },
            stationSlots: LondonSpaceCount
        }
    ]
}

const village = town('white', [[]], 0)
const largeStation = (labels: readonly string[] = []) => city('white', [], 0, 1, labels)
const impassable = (...edges: TileEdge[]) => ({
    borders: edges.map((edge) => ({ edge, kind: 'impassable' as const }))
})

export const Map1862 = new RailwayMap({
    id: '1862',
    name: '1862',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations('B3 D3 G4 E6 G6 D7 F9 E10 G10 B11 C12', village),
        ...locations('E14', village, impassable(4)),
        ...locations('E2 F3 E4 B5 D5 C6 B7 F7 H7 E8 G8 C10 D11 B13 D13', largeStation()),
        ...locations('F5 B9 E12', largeStation(['N'])),
        ...locations('H5 C4 C8 D9', largeStation(['Y'])),
        // Ipswich and Harwich take only their own russet tiles (§7.6.1).
        ...locations(IpswichLocationId, largeStation(['N']), {
            ...impassable(0),
            upgradeLabels: [{ color: 'brown', label: 'I' }]
        }),
        ...locations('G12', largeStation(), impassable(1)),
        ...locations(HarwichLocationId, largeStation(['Y']), {
            ...impassable(1, 3, 4),
            upgradeLabels: [{ color: 'brown', label: 'H' }]
        }),
        ...offboards('A2', [['midlands', [5]]]),
        ...offboards('A4', [['midlands', [4, 5]]]),
        ...offboards('A6', [['midlands', [4, 5]]]),
        ...offboards('A8', [
            ['midlands', [4]],
            ['west', [5]]
        ]),
        ...offboards('A10', [['west', [4, 5]]]),
        ...offboards('A12', [
            ['london', [5]],
            ['west', [4]]
        ]),
        ...offboards('A14', [['london', [4]]]),
        ...offboards(LondonSpacesLocationId, [['london', [2, 3, 4]]], LondonWithSpaces),
        ...offboards('B15', [['london', [3]]]),
        ...offboards('D15', [['london', [3, 4]]]),
        ...offboards('C2', [['north-lynn', [0]]]),
        ...offboards('D1', [['north-wells', [5]]]),
        ...offboards('E0', [['north-wells', []]]),
        ...offboards('F1', [
            ['north-wells', [1]],
            ['north-cromer', [0]]
        ]),
        ...offboards('G2', [['north-cromer', []]]),
        ...offboards('I4', [['north-east', [1]]]),
        ...offboards('I6', [
            ['north-east', [2]],
            ['east', [1]]
        ]),
        ...offboards('I8', [['east', [2]]]),
        ...offboards('H9', [['east', [3]]]),
        ...offboards('H11', [['denmark', [1]]]),
        ...offboards('H13', [['denmark', [2]]]),
        ...offboards('G14', [
            ['denmark', [3]],
            ['holland', [2]]
        ]),
        ...offboards('F15', [['holland', [3]]])
    ]
})

function locationIdsWhere(test: (location: MapLocation) => boolean): readonly string[] {
    return Map1862.definition.locations.filter(test).map((location) => location.id)
}

export const RedOffboardLocationIds = locationIdsWhere(
    (location) => location.stopGroup === RedStopGroup
)
export const PortLocationIds = locationIdsWhere((location) => location.stopGroup === PortStopGroup)
export const LondonLocationIds = offboardAreaLocationIds('london')

/** The off-board area an off-board node belongs to; undefined for any other node. */
export function offboardArea(locationId: string, nodeId: string): OffboardAreaId | undefined {
    const node = Map1862.location(locationId).preprintedTile.nodes.find(
        (candidate) => candidate.id === nodeId
    )
    return node?.kind === 'offboard' && isOffboardAreaId(node.id) ? node.id : undefined
}

export function offboardAreaLocationIds(area: OffboardAreaId): readonly string[] {
    return locationIdsWhere((location) =>
        location.preprintedTile.nodes.some((node) => node.kind === 'offboard' && node.id === area)
    )
}
