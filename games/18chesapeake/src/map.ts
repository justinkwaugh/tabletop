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
import {
    BoId,
    BsId,
    CaId,
    CoId,
    CocId,
    CpId,
    DrId,
    LvId,
    NwId,
    PleId,
    PrrId,
    SrrId
} from './ids.js'

const Names: Readonly<Record<string, string>> = {
    A3: 'Pittsburgh',
    B2: 'Pittsburgh',
    A7: 'Ohio',
    A13: 'West Virginia Coal',
    B14: 'West Virginia Coal',
    B4: 'Charleroi & Connellsville',
    C5: 'Green Spring',
    C13: 'Lynchburg',
    D2: 'Berlin',
    D8: 'Leesburg',
    D12: 'Charlottesville',
    E3: 'Hagerstown',
    E11: 'Fredericksburg',
    F2: 'Harrisburg',
    F8: 'Washington DC',
    G3: 'Columbia',
    G13: 'Richmond',
    H4: 'Strasburg',
    H6: 'Baltimore',
    H14: 'Norfolk',
    I5: 'Wilmington',
    I9: 'Delmarva Peninsula',
    J2: 'Allentown',
    J4: 'Philadelphia',
    J6: 'Camden',
    K1: 'Easton',
    K3: 'Trenton & Amboy',
    K5: 'Burlington & Princeton',
    L2: 'New York'
}

/** Where the public companies start; the B&O takes Baltimore's western city. */
export const HomesChesapeake: Readonly<Record<string, string | CityReservation>> = {
    F2: PrrId,
    A3: PleId,
    H4: SrrId,
    H6: { companyId: BoId, nodeId: 'city-0' },
    G13: CoId,
    J2: LvId,
    J6: CaId,
    C13: NwId
}

/** The hexes each private blocks while a player owns it. */
export const PrivateBlocks: Readonly<Record<string, readonly string[]>> = {
    [DrId]: ['K3'],
    [CpId]: ['H2', 'I3'],
    [BsId]: ['F4', 'G5'],
    [CocId]: ['D2']
}

const PrivateInitials: Readonly<Record<string, string>> = {
    [DrId]: 'D&R',
    [CpId]: 'C-P',
    [BsId]: 'B&S',
    [CocId]: 'C&OC'
}

function markers(): Record<string, NonNullable<MapLocation['markers']>> {
    const result: Record<string, NonNullable<MapLocation['markers']>> = {}
    for (const [privateCompanyId, locationIds] of Object.entries(PrivateBlocks))
        for (const locationId of locationIds)
            result[locationId] = [
                {
                    id: `blocks-${privateCompanyId}`,
                    label: PrivateInitials[privateCompanyId],
                    privateCompanyId,
                    description: `No track while ${PrivateInitials[privateCompanyId]} is player-owned.`
                }
            ]
    return result
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 1,
    fixedColors: ['gray', 'red'],
    names: Names,
    homes: HomesChesapeake,
    markers: markers()
})

const mountain = { terrain: { cost: 80, kinds: ['mountain'] } }
const water = { terrain: { cost: 40, kinds: ['water'] } }
// Pittsburgh and the West Virginia coal fields are each one area of two hexes: a route may
// visit only one of them.
const pittsburgh = { stopGroup: 'Pittsburgh' }
const coal = { stopGroup: 'West Virginia Coal' }

const blank = track('white', [])
const emptyCity = city('white', [], 0, 1)
const emptyTown = town('white', [[]], 0)
const twoTowns = town('white', [[], []], 0)

const staged = (yellow: number, green: number, brown: number, gray: number): TileRevenue =>
    revenue([
        ['yellow', yellow],
        ['green', green],
        ['brown', brown],
        ['gray', gray]
    ])
const exit = (edges: readonly TileEdge[], amount: TileRevenue): TileFace => offboard(edges, amount)

/** Pittsburgh's red city, the PLE's home: one station, paying as the red areas do. */
const PittsburghCity: TileFace = city('red', [5], staged(40, 50, 60, 80), 1)

/** The two printed OO cities of Baltimore and Philadelphia, each with its one track. */
const printedOO = (first: TileEdge, second: TileEdge): TileFace =>
    cities(
        'yellow',
        [
            { edges: [first], revenue: 30, stationSlots: 1 },
            { edges: [second], revenue: 30, stationSlots: 1 }
        ],
        ['OO']
    )

export const MapChesapeake = new RailwayMap({
    id: '18chesapeake',
    name: '18Chesapeake',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations('A3', PittsburghCity, pittsburgh),
        ...locations('B2', exit([0], staged(40, 50, 60, 80)), pittsburgh),
        ...locations('A7', exit([4, 5], staged(40, 60, 80, 100))),
        ...locations('A13', exit([4], staged(40, 50, 60, 80)), coal),
        ...locations('B14', exit([3, 4], staged(40, 50, 60, 80)), coal),
        ...locations('H14', exit([2], staged(30, 40, 50, 60))),
        ...locations('L2', exit([0, 1], staged(40, 60, 80, 100))),

        ...locations('E1', track('gray', [[1, 5]])),
        ...locations('F14', track('gray', [[3, 4]])),
        ...locations(
            'G1',
            track('gray', [
                [1, 5],
                [0, 1]
            ])
        ),
        ...locations('I9', town('gray', [[3, 5]], 30)),
        ...locations('K1', town('gray', [[0, 1]], 30)),
        ...locations('K7', track('gray', [[2, 3]])),

        ...locations('B6 B8 B10 C3 C7 C9 C11 E7 E9 E13 F6 F12 G7 I7 J8 J10 L4 F4 G5 H2 I3', blank),
        ...locations('B12 D4 D6 D10 E5', blank, mountain),
        ...locations('F10 G9 G11 H12', blank, water),
        ...locations('B4 K3 K5', twoTowns),
        ...locations('C5 D12 E3 F2 G13 J2', emptyCity),
        ...locations('C13 D2 D8', emptyCity, mountain),
        ...locations('E11', emptyTown),
        ...locations('F8', city('white', [], 0, 1, ['DC'])),
        ...locations('G3 I5', emptyTown, water),
        ...locations('H4 J6', emptyCity, water),

        ...locations('H6', printedOO(1, 4), water),
        ...locations('J4', printedOO(0, 3))
    ]
})
