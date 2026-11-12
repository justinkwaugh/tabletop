import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createLetterNumberLocationFactory,
    createStagedTileRevenue as revenue,
    createTrackTileFace as track,
    createTownTileFace as town,
    createCityTileFace as city,
    createSeparateCitiesTileFace as cities,
    createOffboardTileFace as offboard,
    type CityReservation,
    type MapLocation,
    type TileEdge,
    type TileFace,
    type TileRevenue
} from '@tabletop/18xx'

const Names: Readonly<Record<string, string>> = {
    A4: 'Great Britain',
    A8: 'Boulogne-sur-Mer',
    A10: 'London',
    A12: 'London shipping',
    B3: 'Le Havre',
    B9: 'Calais',
    B11: 'Dunkerque',
    B15: 'Oostende',
    C6: 'Blangy-sur-Bresle & Abbeville',
    C14: 'Brugge',
    C18: 'Netherlands',
    D1: 'Elbeuf',
    D3: 'Rouen',
    D7: 'Pont-Remy & Doullens',
    D9: 'Lens',
    D11: 'Lille',
    D15: 'Gent',
    D17: 'Antwerpen',
    E2: 'Évreux',
    E6: 'Amiens',
    E10: 'Arras',
    E12: 'Douai & Valenciennes',
    E16: 'Mechelen',
    F1: 'Dreux',
    F7: 'Beauvais & Compiègne',
    F15: 'Bruxelles',
    G2: 'Houdan',
    G4: 'Versailles',
    G6: 'Paris',
    G10: 'Saint-Quentin',
    G12: 'Caudry & Maubeuge',
    G14: 'Charleroi',
    G16: 'Namur & Sint-Truiden',
    G18: 'Hasselt',
    H1: 'Voves',
    H3: 'Chartres',
    H9: 'Soissons',
    H17: 'Liège',
    I2: 'Centre & Bourgogne',
    I10: 'Reims',
    I16: 'Arlon',
    I18: 'Luxembourg'
}

const Homes: Readonly<Record<string, string | CityReservation>> = {
    B3: 'Ouest',
    E6: 'Ouest',
    D9: 'Nord',
    G14: 'Nord',
    D3: 'CFOR',
    H3: 'CFOR',
    D15: 'AG',
    E16: 'Belge',
    // The PLM's home is Paris's marked city, which every Paris tile keeps as its first city.
    G6: { companyId: 'PLM', nodeId: 'city-0' },
    I10: 'Est'
}

const Markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>> = {
    I14: [
        {
            id: 'blocks-LRC',
            label: 'LRC',
            privateCompanyId: 'LRC',
            description: 'No track while Ligne de Reims à Charleville is player-owned.'
        }
    ],
    H17: [
        {
            id: 'blocks-GLG',
            label: 'GLG',
            privateCompanyId: 'GLG',
            description: 'No track while Gare de Liège-Guillemins is player-owned.'
        }
    ],
    D17: [
        {
            id: 'blocks-SAC',
            label: 'SAC',
            privateCompanyId: 'SAC',
            description: 'No track while Station Antwerpen Centraal is player-owned.'
        }
    ],
    G10: [
        {
            id: 'SQG',
            label: 'LSQG',
            description:
                'Ligne de Saint-Quentin à Guise earns ₣70 while Saint-Quentin is green and ₣100 while it is brown.'
        }
    ],
    A12: [
        {
            id: 'ferry',
            label: 'Ferry +₣80',
            description: 'Four ferry markers, ₣80 each, open London to the companies owning them.',
            count: 4
        }
    ],
    I18: [
        {
            id: 'largest',
            label: 'Largest',
            description: 'Luxembourg is worth the largest other revenue on the route.'
        }
    ],
    C18: [
        {
            id: 'netherlands-bonus',
            label: '+₣100 to offboard',
            description: 'A route to the Netherlands and another offboard location earns ₣100 more.'
        }
    ]
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Pointy,
    numberOffset: 0,
    fixedColors: ['gray', 'red', 'blue'],
    names: Names,
    homes: Homes,
    markers: Markers
})

const yellowBrown = (yellow: number, brown: number): TileRevenue =>
    revenue([
        ['yellow', yellow],
        ['brown', brown]
    ])
const water = (cost: number) => ({ terrain: { cost, kinds: ['water'] } })
const province = (...edges: TileEdge[]) => ({
    borders: edges.map((edge) => ({ edge, kind: 'province' as const }))
})
const blank = track('white', [])
const emptyCity = city('white', [], 0, 1)
const doubleTown = town('white', [[], []], 0)

type Endpoint = TileEdge | 'node'
/** A fixed face whose single stop is joined by paths, with through track beside it. */
function stopFace(
    color: string,
    kind: 'city' | 'town',
    value: number | TileRevenue,
    stopPaths: readonly TileEdge[],
    through: readonly (readonly [Endpoint, Endpoint])[] = []
): TileFace {
    const nodeId = kind
    const endpoint = (end: Endpoint) =>
        end === 'node' ? { kind: 'node' as const, nodeId } : { kind: 'edge' as const, edge: end }
    const amount = typeof value === 'number' ? { kind: 'fixed' as const, amount: value } : value
    return {
        color,
        nodes: [
            kind === 'city'
                ? { id: nodeId, kind, revenue: amount, stationSlots: 1 }
                : { id: nodeId, kind, revenue: amount }
        ],
        paths: [
            ...stopPaths.map((edge) => ({
                id: `edge-${edge}`,
                endpoints: [endpoint(edge), endpoint('node')] as const
            })),
            ...through.map(([a, b], index) => ({
                id: `through-${index}`,
                endpoints: [endpoint(a), endpoint(b)] as const
            }))
        ],
        labels: []
    }
}

/** A double town whose second town already has printed track to one edge. */
function partlyBuiltDoubleTown(edge: TileEdge): TileFace {
    return {
        color: 'white',
        nodes: [
            { id: 'town-0', kind: 'town', revenue: { kind: 'fixed', amount: 0 } },
            { id: 'town-1', kind: 'town', revenue: { kind: 'fixed', amount: 10 } }
        ],
        paths: [
            {
                id: 'town-1-edge',
                endpoints: [
                    { kind: 'edge', edge },
                    { kind: 'node', nodeId: 'town-1' }
                ]
            }
        ],
        labels: []
    }
}

// London is one city without station spaces; the London shipping hex holds one station.
const London = city('blue', [0, 1, 5], yellowBrown(30, 80), 0)
const LondonShipping = city('blue', [], 0, 1)

export const ParisLocationId = 'G6'
export const LondonLocationId = 'A10'
export const LondonShippingLocationId = 'A12'
export const LuxembourgLocationId = 'I18'
export const NetherlandsLocationId = 'C18'
export const OffboardLocationIds = ['A4', 'I2', 'I18'] as const

export const EighteenNinetyFourMap = new RailwayMap({
    id: '1894',
    name: '1894',
    orientation: HexOrientation.Pointy,
    locations: [
        ...locations('A4', offboard([0, 1], { kind: 'fixed', amount: 50 })),
        ...locations('C18', offboard([0, 1], yellowBrown(30, 40))),
        ...locations('I2', offboard([2, 4], yellowBrown(30, 60))),
        ...locations('I18', offboard([1, 2], { kind: 'fixed', amount: 0 })),
        ...locations('A10', London),
        ...locations('A12', LondonShipping),
        ...locations(
            'A2',
            track('gray', [
                [5, 0],
                [0, 4]
            ])
        ),
        ...locations(
            'A8',
            stopFace(
                'gray',
                'town',
                20,
                [0, 4],
                [
                    [0, 5],
                    [5, 4]
                ]
            )
        ),
        ...locations(
            'B5',
            track('gray', [
                [1, 5],
                [1, 0],
                [5, 0]
            ])
        ),
        ...locations('B15', stopFace('gray', 'town', 20, [0, 1])),
        ...locations(
            'C16',
            track('gray', [
                [0, 1],
                [4, 5],
                [5, 0]
            ])
        ),
        ...locations('D1', stopFace('gray', 'town', 20, [4, 5])),
        ...locations(
            'F1',
            stopFace(
                'gray',
                'town',
                20,
                [3, 5],
                [
                    [3, 4],
                    [4, 5]
                ]
            )
        ),
        ...locations('G2', stopFace('gray', 'town', 20, [2, 3])),
        ...locations(
            'G18',
            stopFace(
                'gray',
                'city',
                yellowBrown(20, 30),
                [0, 2],
                [
                    [0, 1],
                    [1, 2]
                ]
            )
        ),
        ...locations('H1', stopFace('gray', 'town', 20, [4, 5])),
        ...locations('H3', stopFace('gray', 'city', yellowBrown(20, 30), [1, 3, 4])),
        ...locations(
            'I16',
            stopFace(
                'gray',
                'town',
                20,
                [1, 4],
                [
                    [1, 2],
                    [2, 3],
                    [3, 4]
                ]
            )
        ),
        ...locations('G4', city('yellow', [2, 4, 5], 20, 1)),
        ...locations('I10', city('yellow', [2, 3, 4], 10, 1)),
        ...locations('C4 C8 C10 D5 E18 F3 F9 F17 H5 H7 I6 I8 I12', blank),
        ...locations('B1 C2 E4 E8 F5 H11', blank, water(40)),
        ...locations('B7 G8 I4', blank, water(60)),
        ...locations('B3 B9 D3 D9 D15 D17 E2 E6 E10 E16 G10 H9 H17', emptyCity),
        ...locations('F7 G16', doubleTown),
        ...locations('B11', emptyCity, province(4)),
        ...locations('B13', blank, province(0, 1)),
        ...locations('C6', partlyBuiltDoubleTown(5)),
        ...locations('C12', blank, { ...water(40), ...province(3, 4, 5) }),
        ...locations('C14', emptyCity, province(1)),
        ...locations('D7', partlyBuiltDoubleTown(2)),
        ...locations('D11', city('white', [], 0, 1, ['L']), province(4)),
        ...locations('D13', blank, province(0, 1, 2)),
        ...locations('E12', doubleTown, province(3, 4, 5)),
        ...locations('E14', blank, { ...water(60), ...province(1) }),
        ...locations('F11', blank, province(4)),
        ...locations('F13', blank, province(0, 1, 2)),
        ...locations('F15', city('white', [], 0, 1, ['B'])),
        ...locations(
            'G6',
            cities(
                'white',
                [
                    { edges: [], revenue: 0, stationSlots: 1 },
                    { edges: [], revenue: 0, stationSlots: 1 }
                ],
                ['P']
            ),
            { stopGroup: 'Paris' }
        ),
        ...locations('G12', doubleTown, province(3, 4)),
        ...locations('G14', emptyCity, province(0, 1)),
        ...locations('H13', blank, { ...water(40), ...province(3, 4) }),
        ...locations('H15', blank, { ...water(60), ...province(0, 1) }),
        ...locations('I14', blank, province(3))
    ]
})

/** Hexes a late company may choose as its home, by the country it belongs to (§11.3.3). */
export const LateHomeLocationIds: Readonly<Record<'France' | 'Belgium', readonly string[]>> = {
    France: [
        'B3',
        'B9',
        'B11',
        'D3',
        'D9',
        'D11',
        'E2',
        'E6',
        'E10',
        'G4',
        'G6',
        'G10',
        'H9',
        'I10'
    ],
    Belgium: ['C14', 'D15', 'D17', 'E16', 'F15', 'G14', 'G18', 'H17']
}
