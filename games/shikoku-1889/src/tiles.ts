import { StandardTileCatalog, TileSet } from '@tabletop/18xx'

const TileCounts: Readonly<Record<string, number>> = {
    '3': 2,
    '5': 2,
    '6': 2,
    '7': 2,
    '8': 5,
    '9': 5,
    '12': 1,
    '13': 1,
    '14': 1,
    '15': 3,
    '16': 1,
    '19': 1,
    '20': 1,
    '23': 2,
    '24': 2,
    '25': 1,
    '26': 1,
    '27': 1,
    '28': 1,
    '29': 1,
    '39': 1,
    '40': 1,
    '41': 1,
    '42': 1,
    '45': 1,
    '46': 1,
    '47': 1,
    '57': 2,
    '58': 3,
    '205': 1,
    '206': 1,
    '437': 1,
    '438': 1,
    '439': 1,
    '440': 1,
    '448': 4,
    '465': 1,
    '466': 1,
    '492': 1,
    '611': 2
}

const BeginnerExtras: Readonly<Record<string, number>> = {
    '6': 2,
    '7': 1,
    '8': 1,
    '9': 1,
    '23': 1,
    '24': 1,
    '57': 1
}

export const Shikoku1889TileSet = createTileSet('shikoku-1889:standard', {})
export const Shikoku1889BeginnerTileSet = createTileSet('shikoku-1889:beginner', BeginnerExtras)
export const Shikoku1889Tiles = Shikoku1889TileSet.definitions

function createTileSet(id: string, extras: Readonly<Record<string, number>>): TileSet {
    return new TileSet(
        {
            id,
            entries: Object.entries(TileCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count: count + (extras[number] ?? 0)
            }))
        },
        [StandardTileCatalog]
    )
}
