import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace,
    createSeparateCitiesTileFace,
    type SeparateCity,
    type TileDefinition,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'

function tile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1894:${printedNumber}`, printedNumber, aliases: [], scope: '1894', face }
}
const withCost = (face: TileFace, upgradeCost: number): TileFace => ({ ...face, upgradeCost })
const separate = (edges: readonly TileEdge[], revenue: number, stationSlots = 1): SeparateCity => ({
    edges,
    revenue,
    stationSlots
})
/** Paris tiles: the first city is the station space marked for the PLM. */
const paris = (color: string, cities: readonly SeparateCity[], upgradeCost?: number) => {
    const face = createSeparateCitiesTileFace(color, cities, ['P'])
    return upgradeCost === undefined ? face : withCost(face, upgradeCost)
}
/** A brown tile splitting a green city into two cities of one station space each (§12.3.2). */
const split = (first: readonly TileEdge[], second: readonly TileEdge[]) =>
    createSeparateCitiesTileFace('brown', [separate(first, 40), separate(second, 40)])

export const EighteenNinetyFourTileCatalog = new TileCatalog([
    tile('X1', paris('yellow', [separate([0, 1], 30), separate([3], 30)], 40)),
    tile('X2', withCost(createCityTileFace('yellow', [0, 2], 30, 1, ['B']), 40)),
    tile('X3', withCost(createCityTileFace('yellow', [0, 1], 30, 1, ['L']), 40)),
    tile('X4', paris('green', [separate([0, 1], 40), separate([2, 3], 40)], 60)),
    tile('X5', paris('green', [separate([0, 1], 40), separate([3, 4], 40)], 60)),
    tile('X6', withCost(createCityTileFace('green', [0, 2, 4], 50, 2, ['B']), 60)),
    tile('X7', withCost(createCityTileFace('green', [0, 1, 4], 50, 1, ['L']), 60)),
    tile('X8', withCost(createCityTileFace('green', [0, 1, 3, 4], 40, 2, ['L']), 60)),
    tile('X9', paris('brown', [separate([0, 1], 80), separate([2, 3], 80, 2)])),
    tile('X10', paris('brown', [separate([0, 1], 80), separate([3, 4], 80, 2)])),
    tile('X11', paris('brown', [separate([0, 1], 90), separate([2, 3], 90)])),
    tile('X12', paris('brown', [separate([0, 1], 90), separate([3, 4], 90)])),
    tile('X13', createCityTileFace('brown', [0, 1, 2, 3, 4, 5], 70, 2, ['B'])),
    tile('X14', createCityTileFace('brown', [0, 1, 3, 4], 60, 2, ['L'])),
    tile('X15', createCityTileFace('brown', [0, 1, 2, 3, 4, 5], 50, 3, ['L'])),
    tile('X16', split([0, 3], [1, 4])),
    tile('X17', split([1, 3], [0, 4])),
    tile('X18', split([0, 1], [3, 4])),
    tile('X19', split([1, 3], [0, 2])),
    tile('X20', split([0, 3], [1, 2])),
    tile('X21', split([0, 1], [2, 3])),
    tile('X22', split([0, 3], [2, 4])),
    tile('X23', split([0, 2], [3, 4])),
    tile('X24', split([0, 4], [2, 3]))
])

/** The brown tiles each non-big green city may become, splitting its city in two (§12.3.2). */
export const SplitCityTiles: Readonly<Record<string, readonly string[]>> = {
    '18xx:14': ['1894:X16', '1894:X17', '1894:X18'],
    '18xx:15': ['1894:X19', '1894:X20', '1894:X21'],
    '18xx:619': ['1894:X22', '1894:X23', '1894:X24']
}

const StandardCounts: Readonly<Record<string, number>> = {
    '1': 1,
    '7': 4,
    '8': 15,
    '9': 12,
    '14': 4,
    '15': 4,
    '16': 1,
    '17': 1,
    '18': 1,
    '19': 1,
    '20': 1,
    '23': 3,
    '24': 3,
    '25': 2,
    '26': 2,
    '27': 2,
    '28': 1,
    '29': 1,
    '30': 1,
    '31': 1,
    '39': 1,
    '40': 1,
    '41': 1,
    '42': 1,
    '43': 1,
    '44': 1,
    '45': 1,
    '46': 1,
    '47': 1,
    '56': 1,
    '57': 10,
    '70': 1,
    '619': 4,
    '624': 1,
    '630': 1,
    '631': 1,
    '632': 1,
    '633': 1
}
const SpecialCounts: Readonly<Record<string, number>> = {
    ...Object.fromEntries(
        ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8', 'X9', 'X10', 'X11', 'X12'].map((id) => [
            id,
            1
        ])
    ),
    X13: 1,
    X14: 1,
    X15: 1,
    ...Object.fromEntries(
        ['X16', 'X17', 'X18', 'X19', 'X20', 'X21', 'X22', 'X23', 'X24'].map((id) => [id, 2])
    )
}

export const EighteenNinetyFourTileSet = new TileSet(
    {
        id: '1894:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(SpecialCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1894:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, EighteenNinetyFourTileCatalog]
)
export const EighteenNinetyFourTiles = EighteenNinetyFourTileSet.definitions
