import { HexOrientation, assertExists } from '@tabletop/common'
import {
    RailwayMap,
    createCityTileFace as city,
    createLetterNumberLocationFactory,
    createOffboardTileFace as offboard,
    createStagedTileRevenue as revenue,
    createTownTileFace as town,
    createTrackTileFace as track,
    type TileEdge,
    type TileFace,
    type TileRevenue
} from '@tabletop/18xx'

const Names: Readonly<Record<string, string>> = {
    A6: 'Ciudad Juárez / El Paso',
    B1: 'Baja California',
    B3: 'Nogales / Tucson',
    D3: 'Hermosillo',
    D11: 'San Antonio',
    E6: 'Chihuahua',
    F5: 'Copper Canyon',
    G10: 'Nuevo Laredo',
    I4: 'Los Mochis',
    I8: 'Torreón',
    I10: 'Monterrey',
    I12: 'Matamoros',
    J5: 'Culiacán',
    J7: 'Durango',
    K6: 'Mazatlán',
    K8: 'Zacatecas',
    L9: 'San Luis Potosí',
    M10: 'Querétaro',
    M12: 'Tampico',
    O8: 'Guadalajara',
    O10: 'Mexico City',
    P7: 'Puerto Vallarta',
    P11: 'Puebla',
    P13: 'Veracruz',
    Q14: 'Mérida',
    S10: 'Acapulco',
    S12: 'Oaxaca',
    U14: 'Guatemala'
}

/** Each company's home, by hex: the eight majors' and the three minors' (Table III). */
export const HomesMex: Readonly<Record<string, string>> = {
    E6: 'CHI',
    O10: 'NdM',
    I8: 'MC',
    B3: 'PAC',
    I12: 'TM',
    P13: 'MEX',
    O8: 'SPM',
    Q14: 'UdY',
    M12: 'A',
    K6: 'B',
    S12: 'C'
}

export function homeLocationMex(companyId: string): string {
    const home = Object.entries(HomesMex).find(([, id]) => id === companyId)
    assertExists(home, `No home for ${companyId}`)
    return home[0]
}

export const MexicoCityLocationId = 'O10'
export const PueblaLocationId = 'P11'
export const CopperCanyonLocationId = 'F5'
export const LosMochisLocationId = 'I4'
export const GuadalajaraLocationId = 'O8'
export const MeridaLocationId = 'Q14'

/** The double hex's labels: only the Mexico City tiles are laid there (4.4.1(g)). */
export const MexicoCityLabel = 'MC'
export const PueblaLabel = 'P'
export const CopperCanyonLabel = 'CC'

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    // The board letters its rows; row A's hexes are even-numbered.
    numberOffset: 0,
    letters: 'rows',
    fixedColors: ['gray', 'red'],
    names: Names,
    homes: HomesMex,
    markers: {}
})

const terrain = (cost: number, kind: string) => ({ terrain: { cost, kinds: [kind] } })
const mountain = terrain(120, 'mountain')
const hill = terrain(60, 'hill')
const water = terrain(20, 'water')
const desert = terrain(20, 'desert')
const swamp = terrain(40, 'swamp')
const impassable = (...edges: TileEdge[]) => ({
    borders: edges.map((edge) => ({ edge, kind: 'impassable' as const }))
})

/** Red areas, and Matamoros, Nogales/Tucson and San Antonio, pay more from the first 5-train. */
const staged = (low: number, high: number): TileRevenue =>
    revenue([
        ['yellow', low],
        ['brown', high]
    ])

const blank = track('white', [])
const emptyCity = city('white', [], 0, 1)
const emptyTown = town('white', [[]], 0)

/**
 * A city with a seaport town at the end of a spur (4.4.1(f)): a run through the port must begin
 * or end there.
 */
export function portCity(
    color: string,
    edges: readonly TileEdge[],
    cityRevenue: number,
    portRevenue: number,
    stationSlots: number,
    labels: readonly string[],
    spur = true
): TileFace {
    const face = city(color, edges, cityRevenue, stationSlots, labels)
    return {
        ...face,
        nodes: [...face.nodes, { id: 'port', kind: 'town', revenue: fixed(portRevenue) }],
        paths: spur
            ? [
                  ...face.paths,
                  {
                      id: 'port',
                      endpoints: [
                          { kind: 'node', nodeId: 'city' },
                          { kind: 'node', nodeId: 'port' }
                      ]
                  }
              ]
            : face.paths
    }
}

function fixed(amount: number): TileRevenue {
    return { kind: 'fixed', amount }
}

/** Mérida: a red area with a station circle that a route may only begin or end at. */
const Merida: TileFace = {
    color: 'red',
    nodes: [{ id: 'city', kind: 'city', stationSlots: 1, revenue: staged(10, 50) }],
    paths: ([1, 2] as const).map((edge) => ({
        id: `edge-${edge}`,
        endpoints: [
            { kind: 'edge', edge },
            { kind: 'node', nodeId: 'city' }
        ],
        terminus: true
    })),
    labels: []
}

/** Mexico City's printed yellow half of the double hex, with Toluca's unconnected town. */
export const MexicoCityYellow: TileFace = {
    ...city('yellow', [3, 5], 20, 1, [MexicoCityLabel]),
    nodes: [
        { id: 'city', kind: 'city', stationSlots: 1, revenue: fixed(20) },
        { id: 'toluca', kind: 'town', revenue: fixed(0) }
    ]
}

/** Puebla's printed yellow half of the double hex. */
export const PueblaYellow: TileFace = { ...town('yellow', [[2, 5]], 10), labels: [PueblaLabel] }

export const MapMex = new RailwayMap({
    id: '18mex',
    name: '18MEX',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations('A6', offboard([0, 1], staged(30, 60))),
        ...locations('B1', offboard([5], staged(30, 50))),
        ...locations('U14', offboard([2], staged(30, 40))),
        ...locations(MeridaLocationId, Merida),
        ...locations('B3', city('gray', [0, 1], staged(30, 50), 1)),
        ...locations('D11', city('gray', [0, 1], staged(30, 60), 2)),
        ...locations('I12', city('gray', [0, 1, 2, 3], staged(20, 40), 2)),
        ...locations('U12', track('gray', [[3, 4]])),

        ...locations('B5 C4 D7 E4 F7 F9 G8 H5 I6 N9 P9', blank, mountain),
        ...locations(CopperCanyonLocationId, blank, mountain),
        ...locations('Q10', blank, { ...mountain, ...impassable(4) }),
        ...locations('R11', blank, { ...mountain, ...impassable(3) }),
        ...locations('C2 L11 Q8 Q12', blank, hill),
        ...locations('N11', blank, { ...hill, ...impassable(0, 1) }),
        ...locations('O12', blank, { ...hill, ...impassable(5) }),
        ...locations('E2 C6 D5 E8 E10 F3 G6 H9 J9 J11', blank, desert),
        ...locations('D9 H11 N7 T11 T13', blank, water),
        ...locations('G12 K12', blank, swamp),
        ...locations('F11 G4 H7 K10 L7 M8 R9', blank),

        ...locations('D3 M10', emptyCity, hill),
        ...locations('G10', emptyCity, water),
        ...locations(LosMochisLocationId, emptyCity, {
            ...water,
            upgradeLabels: [{ color: 'green', label: 'L' }]
        }),
        ...locations(GuadalajaraLocationId, emptyCity, {
            ...water,
            upgradeLabels: [{ color: 'brown', label: 'G' }, { color: 'gray' }]
        }),
        ...locations('I8 I10', emptyCity),
        ...locations('J5 L9 P7', emptyTown),
        ...locations('J7', emptyTown, hill),
        ...locations('K8', emptyTown, desert),
        ...locations('S10', emptyTown, mountain),
        ...locations('K6', portCity('white', [], 20, 10, 1, ['M']), water),
        ...locations('M12', portCity('white', [], 20, 10, 1, ['T']), swamp),
        ...locations('P13', portCity('white', [], 0, 0, 1, ['V'], false), {
            ...swamp,
            ...impassable(2)
        }),
        ...locations('S12', city('white', [4], 20, 1), water),

        ...locations('E6', city('yellow', [0, 1, 3], 20, 1)),
        ...locations(MexicoCityLocationId, MexicoCityYellow, impassable(4)),
        // The double hex's first upgrade costs $60 (Table IV), printed on Puebla's half.
        ...locations(PueblaLocationId, PueblaYellow, { ...hill, ...impassable(0, 1, 3) }),
        ...locations('R13', track('yellow', [[1, 4]]), hill)
    ]
})
