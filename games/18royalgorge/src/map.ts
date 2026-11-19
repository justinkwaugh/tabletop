import { HexOrientation, assertExists } from '@tabletop/common'
import {
    RailwayMap,
    createCityTileFace as city,
    createLetterNumberLocationFactory,
    createOffboardTileFace as offboard,
    createStagedTileRevenue as revenue,
    createTownTileFace as town,
    createTrackTileFace as track,
    type MapLocation,
    type TileEdge,
    type TileRevenue
} from '@tabletop/18xx'
import { CmId, CsId, CsccId, FccId, KpId, NoId, PavId, RgId, SId, SfId, SppId } from './ids.js'

const Names: Readonly<Record<string, string>> = {
    A3: 'Leadville',
    B2: 'Leadville',
    B6: 'Buena Vista',
    B8: 'Nathrop',
    C3: 'Fairplay',
    C11: 'Salida',
    C15: 'Silverton',
    C17: 'Silverton',
    D12: 'Royal Gorge',
    E3: 'Sulphur Springs',
    E13: 'Royal Gorge',
    E19: 'Crestone',
    F6: 'Guffy',
    F12: 'Royal Gorge',
    F16: 'Westcliffe',
    G9: 'Current',
    G17: 'Silvercliffe',
    H4: 'Divide',
    H12: 'Cañon City',
    H14: 'Coal Creek',
    I7: 'Cripple Creek',
    I9: 'Victor',
    I13: 'Florence',
    I17: 'Augusta',
    J2: 'Denver',
    K1: 'Denver',
    L2: 'Denver',
    K3: 'Castle Rock',
    K7: 'Colorado Springs',
    L8: 'Fountain',
    L12: 'Eden',
    L14: 'Pueblo',
    M3: 'Peyton',
    O3: 'Kit Carson',
    O5: 'Kit Carson',
    O15: 'La Junta',
    O17: 'La Junta'
}

/**
 * Where each railroad starts, in a city printed on the board. Florence and Fountain are towns,
 * cities only when their railroad is in the game (`HomeTowns`).
 */
export const HomesRoyalGorge: Readonly<Record<string, string>> = {
    L2: RgId,
    O15: SfId,
    O5: KpId,
    B6: SppId,
    L14: PavId,
    B2: CmId,
    C17: SId,
    K7: CsccId,
    J2: CsId
}

/** The towns that are a railroad's home, and become cities if it is in the game (Rule 1). */
export const HomeTowns: Readonly<Record<string, string>> = {
    [FccId]: 'I13',
    [NoId]: 'L8'
}

/** The home of each railroad, by its id. */
export function homeLocationRoyalGorge(companyId: string): string {
    const town = HomeTowns[companyId]
    if (town) return town
    const home = Object.entries(HomesRoyalGorge).find(([, id]) => id === companyId)
    assertExists(home, `No home for ${companyId}`)
    return home[0]
}

/** The three hexes of the Royal Gorge, its west and east cities and the town between. */
export const GorgeWestId = 'D12'
export const GorgeTownId = 'E13'
export const GorgeEastId = 'F12'
export const GorgeLocationIds: readonly string[] = [GorgeWestId, GorgeTownId, GorgeEastId]

/** Gold mines printed on the board, by hex: a cube for each when its first tile is laid (GO-1). */
export const GoldMines: Readonly<Record<string, number>> = {
    E7: 1,
    H8: 1,
    F18: 1,
    J8: 1,
    B10: 1,
    D4: 1,
    D6: 1,
    D8: 1,
    D18: 1,
    K15: 1,
    M15: 1,
    H4: 1,
    I9: 1,
    F6: 1,
    H14: 1,
    B6: 2,
    I7: 2
}

export const CoalCreekLocationId = 'H14'
export const SulphurSpringsLocationId = 'E3'
export const SalidaLocationId = 'C11'
/** Salida's letter: only the S tiles upgrade it (Letter Tiles). */
export const SalidaLabel = 'S'
/** Sulphur Springs's letter, on the city tiles its private lays (B2). */
export const SulphurSpringsLabel = 'R'
export const SilvercliffeLocationId = 'G17'
export const CanonCityLocationId = 'H12'

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 1,
    fixedColors: ['gray', 'red'],
    names: Names,
    homes: HomesRoyalGorge,
    markers: {}
})

const mountain = (cost: number) => ({ terrain: { cost, kinds: ['mountain'] } })
const water = { terrain: { cost: 20, kinds: ['water'] } }

const blank = track('white', [])
const emptyCity = city('white', [], 0, 1)
const emptyTown = town('white', [[]], 0)

const staged = (yellow: number, green: number, brown: number, gray: number): TileRevenue =>
    revenue([
        ['yellow', yellow],
        ['green', green],
        ['brown', brown],
        ['gray', gray]
    ])
const leadville = staged(30, 50, 70, 90)
const denver = staged(30, 40, 60, 90)
const kitCarson = staged(30, 40, 60, 90)
const laJunta = staged(30, 50, 70, 90)
const silverton = staged(70, 60, 50, 40)
const redCity = (edges: readonly TileEdge[], amount: TileRevenue) => city('red', edges, amount, 1)

/** The yellow gorge printed on the board: its two cities' stubs and the empty gap between them. */
const GorgeLocations: MapLocation[] = [
    ...locations(GorgeWestId, city('yellow', [2], 20, 1)),
    ...locations(GorgeTownId, track('yellow', [])),
    ...locations(GorgeEastId, city('yellow', [4], 40, 1))
]

export const MapRoyalGorge = new RailwayMap({
    id: '18royalgorge',
    name: '18RoyalGorge',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations('A3', offboard([5], leadville), { stopGroup: 'Leadville' }),
        ...locations('B2', redCity([0, 5], leadville), { stopGroup: 'Leadville' }),
        ...locations('J2', redCity([0], denver), { stopGroup: 'Denver' }),
        ...locations('K1', redCity([0], denver), { stopGroup: 'Denver' }),
        ...locations('L2', redCity([0, 1], denver), { stopGroup: 'Denver' }),
        ...locations('O3', offboard([1], kitCarson), { stopGroup: 'Kit Carson' }),
        ...locations('O5', redCity([1], kitCarson), { stopGroup: 'Kit Carson' }),
        ...locations('O15', redCity([1, 2], laJunta), { stopGroup: 'La Junta' }),
        ...locations('O17', offboard([2], laJunta), { stopGroup: 'La Junta' }),
        ...locations('C15', offboard([5], silverton), { stopGroup: 'Silverton' }),
        ...locations('C17', redCity([4, 5], silverton), { stopGroup: 'Silverton' }),

        // The canyon walls about the gorge: no track may be laid on or into them (TR-4).
        ...locations('C13 D10 D14 E11 E15 F10 F14', track('gray', [])),
        ...GorgeLocations,

        ...locations(
            'N2 G3 F4 L4 N4 C5 G5 M5 H6 N6 C7 G7 M7 F8 E9 K9 M9 H10 L10 I11 K11 M11 J12 N12 G13 K13 M13 N14 G15 I15 H16 J16 L16 E17 K17 H18 G19 E7 H8 F18',
            blank
        ),
        ...locations('J10 L6 J8', blank, mountain(10)),
        ...locations('C9 D16 E5 I5 J4 J6 K5', blank, mountain(20)),
        ...locations('B10 D4 D6 D8 D18', blank, mountain(30)),
        ...locations('K15 M15 B4 G11 J14 N16', blank, water),
        ...locations('B8 C3 G9 I17 K3 L12 M3 H4 I9 F6 H14 E3 L8', emptyTown),
        ...locations('E19 F16', emptyTown, mountain(10)),
        ...locations('I13', emptyTown, water),
        ...locations('G17 K7 I7', emptyCity),
        ...locations('B6 H12 L14', emptyCity, water),
        ...locations(SalidaLocationId, city('white', [], 0, 1, [SalidaLabel]), water)
    ]
})
