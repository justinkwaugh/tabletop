import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createCityTileFace as city,
    createLetterNumberLocationFactory,
    createStagedTileRevenue as revenue,
    createTownTileFace as town,
    createTrackTileFace as track,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'
import { Companies1860, company1860 } from './companies.js'

const Names: Readonly<Record<string, string>> = {
    A5: 'Norton Green',
    A7: 'Totland',
    B4: 'Yarmouth',
    B6: 'Freshwater',
    C5: 'Ningwood',
    C7: 'Shalcombe',
    D6: 'Calbourne',
    E5: 'Watchingwell',
    E9: 'Shorwell',
    F2: 'Cowes',
    F4: 'Cement Mills',
    F6: 'Carisbrooke',
    F10: 'Chale Green',
    F12: 'Chale',
    G1: 'East Cowes',
    G3: 'Whippingham',
    G5: 'Newport',
    G7: 'Merstone',
    G9: 'Godshill',
    G11: 'Whitwell',
    H4: 'Wootton & Havenstreet',
    H8: 'Horringford',
    H10: 'Wroxall',
    H12: 'St. Lawrence',
    I3: 'Ryde Esplanade',
    I5: 'Ashey',
    I7: 'Newchurch & Alverstone',
    I9: 'Shanklin',
    I11: 'Ventnor',
    J2: 'Ryde Pier',
    J4: 'Ryde',
    J6: 'Brading',
    J8: 'Sandown',
    K5: 'St. Helens',
    L6: 'Bembridge'
}

export const CowesLocationId = 'F2'
export const RydeEsplanadeLocationId = 'I3'
export const NewportLocationId = 'G5'
export const MerstoneLocationId = 'G7'
export const VentnorLocationId = 'I11'
export const RydePierLocationId = 'J2'

const Homes: Readonly<Record<string, string>> = Object.fromEntries(
    Companies1860.map((company) => [company.home, company.id])
)

export function homeLocation1860(companyId: string): string {
    return company1860(companyId).home
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 1,
    fixedColors: ['blue'],
    names: Names,
    homes: Homes,
    markers: {}
})

/** Hilly areas (triangles) and difficult ground (olive) cost £60 to lay yellow track on. */
const hill = { terrain: { cost: 60, kinds: ['hill'] } }
const difficult = { terrain: { cost: 60, kinds: ['marsh'] } }
/** Red borders: the Medina, Arreton Down and the Earl of Yarborough's land; and the sea. */
const impassable = (...edges: TileEdge[]) => ({
    borders: edges.map((edge) => ({ edge, kind: 'impassable' as const }))
})

const blank = track('white', [])
const village = town('white', [[]], 0)
const villages: TileFace = town('white', [[], []], 0)
const largeStation = (labels: readonly string[] = []) => city('white', [], 0, 1, labels)

/** Cowes: its large station, a small station and a halt, before any track (tile #787). */
const Cowes: TileFace = {
    color: 'white',
    nodes: [
        { id: 'city', kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 0 } },
        { id: 'town', kind: 'town', revenue: { kind: 'fixed', amount: 0 } },
        { id: 'halt', kind: 'town', revenue: { kind: 'fixed', amount: 0 }, halt: true }
    ],
    paths: [],
    labels: ['C']
}

/** Merstone: its large station joined to Newport, and the unconnected village of Blackwater. */
const Merstone: TileFace = {
    ...city('yellow', [5], 10, 1, ['M']),
    nodes: [
        { id: 'city', kind: 'city', stationSlots: 1, revenue: { kind: 'fixed', amount: 10 } },
        { id: 'halt', kind: 'town', revenue: { kind: 'fixed', amount: 0 }, halt: true }
    ]
}

/**
 * Ryde Pier: reached once Ryde Esplanade is upgraded, a large station paying nothing, then 20
 * from the green tiles and 40 from the russet (The Map).
 */
const RydePier: TileFace = {
    color: 'blue',
    nodes: [
        {
            id: 'offboard',
            kind: 'offboard',
            revenue: revenue([
                ['yellow', 0],
                ['green', 20],
                ['brown', 40]
            ])
        }
    ],
    paths: [
        {
            id: 'edge-1',
            endpoints: [
                { kind: 'edge', edge: 1 },
                { kind: 'node', nodeId: 'offboard' }
            ]
        }
    ],
    labels: []
}

/**
 * The second edition's extended map, recommended for three or four players, with Totland and
 * Norton Green in the west (The Map). The original map, for two or three, is not offered.
 */
export const Map1860 = new RailwayMap({
    id: '1860',
    name: '1860',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations('G1', village, impassable(1)),
        ...locations('G3', village, impassable(1, 2)),
        ...locations('H8 G11 F6 D6 E5 C5 F10', village),
        ...locations('F4', village, impassable(4)),
        ...locations('A5', village, impassable(4)),
        ...locations('I5', village, impassable(0)),
        ...locations(CowesLocationId, Cowes, impassable(4, 5)),
        ...locations('H2 D4', blank, difficult),
        ...locations('E3 E11 K7 D8', blank),
        ...locations('B4', largeStation(), impassable(1)),
        ...locations('J4 A7 B6 J8 L6 F12', largeStation()),
        ...locations('I9', largeStation(), impassable(0)),
        ...locations('H4', villages),
        ...locations('I7', villages, impassable(3)),
        ...locations('K5', village, difficult),
        ...locations('C7 H10 H12', village, hill),
        ...locations('H6 E7 F8 G13', blank, hill),
        ...locations('J6 E9 G9', largeStation(['B'])),
        ...locations(RydePierLocationId, RydePier),
        ...locations(RydeEsplanadeLocationId, city('yellow', [5], 30, 1, ['R'])),
        ...locations(NewportLocationId, city('yellow', [2, 3], 30, 1, ['N'])),
        ...locations(MerstoneLocationId, Merstone),
        ...locations(VentnorLocationId, city('yellow', [2], 30, 1, ['V']), impassable(3))
    ]
})
