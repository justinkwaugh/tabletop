import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace,
    type TileDefinition,
    type TileFace
} from '@tabletop/18xx'

function titleTile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1870:${printedNumber}`, printedNumber, aliases: [], scope: '1870', face }
}

const AllEdges = [0, 1, 2, 3, 4, 5] as const

// Kansas City's and St. Louis's gray tiles. The printed tiles hold three stations in Kansas City
// and two in St. Louis; the manifest's columns transpose them (p. 30).
export const TileCatalog1870 = new TileCatalog([
    titleTile('171', createCityTileFace('gray', AllEdges, 60, 3, ['K'])),
    titleTile('172', createCityTileFace('gray', AllEdges, 60, 2, ['L']))
])

// The tile manifest (p. 30).
const StandardCounts: Readonly<Record<string, number>> = {
    '1': 1,
    '2': 1,
    '3': 3,
    '4': 6,
    '5': 2,
    '6': 2,
    '7': 9,
    '8': 22,
    '9': 23,
    '55': 1,
    '56': 1,
    '57': 5,
    '58': 4,
    '69': 1,
    '14': 4,
    '15': 4,
    '16': 2,
    '17': 2,
    '18': 2,
    '19': 2,
    '20': 2,
    '23': 4,
    '24': 4,
    '25': 3,
    '26': 2,
    '27': 2,
    '28': 2,
    '29': 2,
    '141': 2,
    '142': 2,
    '143': 1,
    '144': 1,
    '39': 1,
    '40': 2,
    '41': 3,
    '42': 3,
    '43': 2,
    '44': 1,
    '45': 2,
    '46': 2,
    '47': 2,
    '63': 5,
    '70': 2,
    '145': 2,
    '146': 2,
    '147': 2,
    '170': 4
}
const TitleCounts: Readonly<Record<string, number>> = { '171': 1, '172': 1 }

export const TileSet1870 = new TileSet(
    {
        id: '1870:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1870:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1870]
)
export const Tiles1870 = TileSet1870.definitions
