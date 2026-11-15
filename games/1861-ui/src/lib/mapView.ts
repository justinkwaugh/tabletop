import {
    CaucasusLocationIds,
    CentralAsiaLocationIds,
    EkaterinburgLocationId,
    Majors1861,
    Map1861,
    Minors1861,
    PolandLocationIds,
    PrivateLocationIds1861,
    RomaniaLocationIds,
    RsrColor,
    RsrId,
    TileSet1861,
    TitleRules1861
} from '@tabletop/1861'
import {
    StandardTileLayouts,
    towardTileEdge,
    type MapViewDefinition,
    type TileLayout
} from '@tabletop/18xx-ui'
import { CompanyNames1861 } from './companyPresentation.js'
import { TrainColors1861 } from './trainPresentation.js'

/** How far a separate city of Kiev, Moscow or St. Petersburg stands toward its own track. */
const SeparateCityReach = 22

// Kiev's and Moscow's green tiles join two sides to each of three cities, which stand toward the
// corner between those sides; the printed yellow hexes and St. Petersburg's green one give each
// city one side, which it stands toward. Each city's value goes beside it, away from the middle.
const separateCities = (sides: readonly number[]): TileLayout => ({
    nodePositions: Object.fromEntries(
        sides.map((side, index) => [`city-${index}`, towardTileEdge(side, SeparateCityReach)])
    ),
    revenuePositions: Object.fromEntries(
        sides.map((side, index) => [`city-${index}`, towardTileEdge(side + 1, 30)])
    ),
    labelPosition: towardTileEdge(sides[0] + 1.5, 34)
})
const GreenThreeCities = separateCities([0.5, 2.5, 4.5])

export const TileLayouts1861: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    '1861:635': GreenThreeCities,
    '1861:637': GreenThreeCities
}

const Stations: MapViewDefinition['stations'] = {
    ...Object.fromEntries(
        [...Minors1861, ...Majors1861].map((company) => [
            company.id,
            { label: CompanyNames1861[company.id]?.initials ?? company.id, color: company.color }
        ])
    ),
    [RsrId]: { label: 'RSR', color: RsrColor }
}

/** A red area spread over several hexes is drawn as one, its name and values printed once. */
const Areas: readonly (readonly string[])[] = [
    PolandLocationIds,
    RomaniaLocationIds,
    CaucasusLocationIds,
    CentralAsiaLocationIds
]
const AreaJoins: Readonly<Record<string, readonly (0 | 1 | 2 | 3 | 4 | 5)[]>> = {
    A9: [0],
    A11: [3, 0],
    A13: [3, 0],
    A15: [3],
    B18: [0],
    B20: [3],
    J20: [1, 5],
    I21: [4],
    K21: [2],
    Q11: [0],
    Q13: [3]
}
/** The hex of each area that prints its name and values. */
const AreaFaces: readonly string[] = ['A11', 'B18', 'J20', 'Q11']
const AreaOthers = Areas.flat().filter((locationId) => !AreaFaces.includes(locationId))

const blocked = (privateCompanyId: string) => `private-${privateCompanyId}`

export const MapView1861: MapViewDefinition = {
    map: Map1861,
    tileSet: TileSet1861,
    // East of the map at its full height; the depot stands in the market's empty lower right.
    boardAreas: {
        market: { x: 1258, y: -60, width: 1310, height: 762 },
        depot: { x: 1990, y: 330, width: 381, height: 187 }
    },
    stations: Stations,
    terrainCostPrefix: TitleRules1861.currencySymbol,
    offboardNames: { fontSize: 11, color: '#4a0b0b' },
    joinedEdges: AreaJoins,
    nameLines: Object.fromEntries(AreaOthers.map((locationId) => [locationId, []])),
    revenueStageColors: {
        yellow: TrainColors1861['2'],
        green: [TrainColors1861['3'], TrainColors1861['4']],
        brown: TrainColors1861['5'],
        gray: [TrainColors1861['6'], TrainColors1861['7'], TrainColors1861['8']]
    },
    layouts: {
        ...TileLayouts1861,
        ...Object.fromEntries(AreaOthers.map((locationId) => [locationId, { hideRevenue: true }])),
        // Moscow's and Kiev's printed cities each face their one track; St. Petersburg's two too.
        H8: separateCities([0, 2, 4]),
        D14: separateCities([0, 2, 4]),
        // St. Petersburg's values stand above its two cities, its S between them.
        E1: {
            ...separateCities([1, 5]),
            revenuePositions: { 'city-0': towardTileEdge(2, 30), 'city-1': towardTileEdge(4, 30) },
            labelPosition: { x: 0, y: -14 }
        },
        // Ekaterinburg is worth R80 on a route that also includes Moscow (§10.6).
        [EkaterinburgLocationId]: {
            revenuePositions: { city: { x: 0, y: -31 } },
            printedText: [
                {
                    content: `${TitleRules1861.currencySymbol}80 with`,
                    at: { x: 18, y: 22 },
                    fontSize: 6
                },
                { content: 'Moscow', at: { x: 18, y: 29 }, fontSize: 6 }
            ]
        }
    },
    markerArt: Object.fromEntries(
        Object.keys(PrivateLocationIds1861).map((privateCompanyId) => [
            blocked(privateCompanyId),
            { localLine: true, above: true }
        ])
    )
}
