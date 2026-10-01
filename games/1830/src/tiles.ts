import { StandardTileCatalog, TileSet } from '@tabletop/18xx'

const TileCounts: Readonly<Record<string, number>> = {
    '1': 1,
    '2': 1,
    '3': 2,
    '4': 2,
    '7': 4,
    '8': 8,
    '9': 7,
    '14': 3,
    '15': 2,
    '16': 1,
    '18': 1,
    '19': 1,
    '20': 1,
    '23': 3,
    '24': 3,
    '25': 1,
    '26': 1,
    '27': 1,
    '28': 1,
    '29': 1,
    '39': 1,
    '40': 1,
    '41': 2,
    '42': 2,
    '43': 2,
    '44': 1,
    '45': 2,
    '46': 2,
    '47': 1,
    '53': 2,
    '54': 1,
    '55': 1,
    '56': 1,
    '57': 4,
    '58': 2,
    '59': 2,
    '61': 2,
    '62': 1,
    '63': 3,
    '64': 1,
    '65': 1,
    '66': 1,
    '67': 1,
    '68': 1,
    '69': 1,
    '70': 1
}

export const EighteenThirtyTileSet = new TileSet(
    {
        id: '1830:standard',
        entries: Object.entries(TileCounts).map(([number, count]) => ({
            id: number,
            faceDefinitionIds: [`18xx:${number}`],
            count
        }))
    },
    [StandardTileCatalog]
)
export const EighteenThirtyTiles = EighteenThirtyTileSet.definitions
