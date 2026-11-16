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
    type TileRevenue
} from '@tabletop/18xx'
import { CvId, Majors1856, Privates1856, ThbId } from './companies.js'
import {
    BarrieLabel,
    BarrieLondonLabel,
    HamiltonLabel,
    LLabel,
    LondonLabel,
    OoLabel,
    TorontoLabel
} from './tiles.js'

export const TorontoLocationId = 'N11'
export const HamiltonLocationId = 'L15'
export const KitchenerLocationId = 'I12'
export const WellandLocationId = 'N17'
export const LondonLocationId = 'F15'
export const BarrieLocationId = 'M4'
export const GoderichLocationId = 'F9'
export const SarniaLocationId = 'B13'
export const PortHuronLocationId = 'A14'
export const BuffaloLocationIds: readonly string[] = ['P17', 'P19']
export const CanadianWestLocationIds: readonly string[] = ['N1', 'O2']
export const LowerCanadaLocationIds: readonly string[] = ['Q8', 'Q10']
export const CanadaCompanyLocationId = 'H11'
/** The CV starts in South Toronto, the city on Toronto's south-west track (Public Companies). */
export const TorontoSouthNodeId = 'city-0'
/** The hexes printed L, which take brown #125 in place of #63 (Lay or Upgrade Track). */
export const LLocationIds: readonly string[] = ['B19', 'C14', 'F17', 'L13', 'N3', 'O18', 'P9']
/** The cities and red areas printed with an anchor, for the port token (Private Companies). */
export const PortLocationIds1856: readonly string[] = [
    'C14',
    'D19',
    'E18',
    'F17',
    'F9',
    'H17',
    'H7',
    'H5',
    'J17',
    'J5',
    'K2',
    'M18',
    'O18'
]

export const LocationNames1856: Readonly<Record<string, string>> = {
    A20: 'Detroit - Windsor',
    A14: 'Port Huron',
    B13: 'Sarnia',
    B19: 'Chatham',
    C14: 'Maudaumin',
    D17: 'Glencoe',
    F9: 'Goderich',
    F15: 'London',
    F17: 'St. Thomas',
    H5: 'Lake Huron',
    H15: 'Woodstock',
    I12: 'Kitchener',
    I14: 'Drumbo',
    J11: 'Guelph',
    J13: 'Galt',
    J15: 'Brantford',
    K2: 'Georgian Bay',
    K8: 'Orangeville',
    L13: 'Burlington',
    L15: 'Hamilton',
    M4: 'Barrie',
    N1: 'Canadian West',
    N11: 'Toronto',
    N17: 'Welland',
    O2: 'Canadian West',
    O16: 'Niagara Falls',
    O18: 'Fort Erie',
    P9: 'Oshawa',
    P17: 'Buffalo',
    P19: 'Buffalo',
    Q8: 'Lower Canada',
    Q10: 'Lower Canada'
}

/** Each company's home hex (Public Companies). */
export const Homes1856: Readonly<Record<string, string>> = Object.fromEntries(
    Majors1856.map((company) => [company.id, company.home])
)

/**
 * The homes the map reserves: the CV's South Toronto city, and each other company's one city.
 * The THB may start in either of Hamilton's cities, so its claim is on the hex.
 */
const MapHomes: Readonly<Record<string, string | CityReservation>> = Object.fromEntries(
    Majors1856.filter((company) => company.id !== ThbId).map((company) => [
        company.home,
        company.id === CvId ? { companyId: CvId, nodeId: TorontoSouthNodeId } : company.id
    ])
)

function markers(): Record<string, NonNullable<MapLocation['markers']>> {
    const result: Record<string, NonNullable<MapLocation['markers']>> = {}
    const add = (id: string, marker: NonNullable<MapLocation['markers']>[number]) => {
        result[id] = [...(result[id] ?? []), marker]
    }
    for (const { id: privateCompanyId, name, blocks } of Privates1856)
        for (const locationId of blocks?.locationIds ?? [])
            add(locationId, {
                id: `blocks-${privateCompanyId}`,
                label: privateCompanyId,
                privateCompanyId,
                description: `No track while ${name} is player-owned.`
            })
    for (const locationId of PortLocationIds1856)
        add(locationId, {
            id: 'port',
            label: 'Port',
            description: 'An anchor: the Great Lakes Shipping Company’s port token may go here.'
        })
    return result
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 0,
    fixedColors: ['gray', 'red', 'blue'],
    names: LocationNames1856,
    homes: MapHomes,
    markers: markers()
})

const mountain = { terrain: { cost: 40, kinds: ['mountain'] } }
const water = { terrain: { cost: 40, kinds: ['water'] } }
const lHex = { upgradeLabels: [{ color: 'brown', label: LLabel }] }
const canadianWest = { stopGroup: 'Canadian West' }
const lowerCanada = { stopGroup: 'Lower Canada' }
const buffalo = { stopGroup: 'Buffalo' }

const blank = track('white', [])
const emptyCity = city('white', [], 0, 1)
const emptyTown = town('white', [[]], 0)
const twoTowns = town('white', [[], []], 0)

/** Red areas pay their values from the start, from the 5s and from the last phase (Game Phases). */
const RevenueStages = ['yellow', 'brown', 'black'] as const
const staged = (...amounts: readonly number[]): TileRevenue =>
    revenue(amounts.map((amount, index) => [RevenueStages[index], amount]))

const barrieLondon = city('yellow', [0, 4], 30, 1, [BarrieLondonLabel])

const toronto = cities(
    'yellow',
    [
        { edges: [1], revenue: 30, stationSlots: 1 },
        { edges: [4], revenue: 30, stationSlots: 1 }
    ],
    [TorontoLabel]
)

/** The yellow-edged OO hexes take the #59 (Lay or Upgrade Track). */
const printedOO = cities(
    'yellow',
    [
        { edges: [], revenue: 0, stationSlots: 1 },
        { edges: [], revenue: 0, stationSlots: 1 }
    ],
    [OoLabel]
)

export const Map1856 = new RailwayMap({
    id: '1856',
    name: '1856',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations('A20', offboard([4, 5], staged(30, 50, 60))),
        ...locations('A14', track('red', [])),
        ...locations('B13', offboard([0, 5], staged(30, 50))),
        ...locations('H5', offboard([0, 5], staged(30, 50, 40))),
        ...locations('K2', offboard([0, 5], staged(20, 30))),
        ...locations('N1', offboard([0, 1], staged(20, 30, 50)), canadianWest),
        ...locations('O2', offboard([0, 1, 5], staged(20, 30, 50)), canadianWest),
        ...locations('Q8', offboard([1, 2], staged(20, 30, 50)), lowerCanada),
        ...locations('Q10', offboard([2], staged(20, 30, 50)), lowerCanada),
        ...locations('P17', offboard([1, 2], staged(30, 40)), buffalo),
        ...locations('P19', offboard([2], staged(30, 40)), buffalo),

        ...locations('F9', town('gray', [[0, 4, 5]], staged(30, 50, 40))),
        ...locations('N5', track('blue', [])),

        ...locations(BarrieLocationId, barrieLondon, {
            upgradeLabels: [{ color: 'brown', label: BarrieLabel }]
        }),
        ...locations(LondonLocationId, barrieLondon, {
            upgradeLabels: [{ color: 'brown', label: LondonLabel }]
        }),
        ...locations(TorontoLocationId, toronto),
        ...locations(`${KitchenerLocationId} ${WellandLocationId}`, printedOO),
        ...locations(HamiltonLocationId, printedOO, {
            ...mountain,
            upgradeLabels: [{ color: 'gray', label: HamiltonLabel }]
        }),

        ...locations('D17 G12 H15 I8 J11 J13 J15 K8 O16', emptyCity),
        ...locations('B19 C14 F17 L13 O18 P9', emptyCity, lHex),
        ...locations('N3', emptyCity, { ...lHex, ...water }),
        ...locations('D19 H11 H17 J5 J9 K16 L9 M6 M18 N9', emptyTown),
        ...locations('E18 F13 H7 I14 J17 M10', twoTowns),
        ...locations('K10 K12 K14 M16 N15', blank, mountain),
        ...locations('N19 P7', blank, water),
        ...locations(
            'B15 B17 B21 C16 C18 C20 D13 D15 E12 E14 E16 F11 G8 G10 G14 G16 G18 H9 H13 I6 I10 I16 I18 J7 K4 K6 K18 L3 L5 L7 L11 L17 M2 M8 M12 N7 O4 O6 O8 O10 P3 P5',
            blank
        )
    ]
})
