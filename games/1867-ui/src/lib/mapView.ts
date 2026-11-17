import {
    CnColor,
    CnId,
    DetroitLocationIds,
    Majors1867,
    Map1867,
    Minors1867,
    TileSet1867,
    TimminsLocationId,
    TitleRules1867,
    YellowTileStubs1867
} from '@tabletop/1867'
import type { Point } from '@tabletop/common'
import {
    StandardTileLayouts,
    towardTileEdge,
    type MapViewDefinition,
    type TileLayout,
    type TilePrintedShape
} from '@tabletop/18xx-ui'
import { CompanyNames1867 } from './companyPresentation.js'
import { TrainColors1867 } from './trainPresentation.js'

const SeparateCityReach = 22
const Centre = { x: 0, y: 0 }

// Every city of a Montreal or Toronto tile has the same value, so it is printed once.
const cityTile = (cities: readonly Point[], value: Point, label: Point): TileLayout => ({
    nodePositions: Object.fromEntries(cities.map((point, index) => [`city-${index}`, point])),
    revenuePositions: { 'city-0': value },
    hideRevenue: cities.slice(1).map((_, index) => `city-${index + 1}`),
    labelPosition: label
})

const toward = (position: number) => towardTileEdge(position, SeparateCityReach)

const oneCityTile = (value: Point, label: Point): TileLayout => ({
    revenuePositions: { city: value },
    labelPosition: label
})

export const TileLayouts1867: Readonly<Record<string, TileLayout>> = {
    ...StandardTileLayouts,
    '1867:637': cityTile(
        [toward(0.5), toward(2.5), toward(4.5)],
        towardTileEdge(1.5, 36),
        towardTileEdge(3.5, 33)
    ),
    '1867:X1': cityTile(
        [{ x: 0, y: 22 }, toward(4), toward(2)],
        { x: -38, y: 0 },
        { x: 21, y: 31 }
    ),
    '1867:X2': cityTile(
        [Centre, { x: -20, y: 27 }, { x: 20, y: -27 }],
        { x: -30, y: 0 },
        { x: 31, y: 0 }
    ),
    '1867:X3': cityTile(
        [
            { x: 10, y: 20 },
            { x: -28, y: 0 },
            { x: 12, y: -22 }
        ],
        { x: -16, y: 27 },
        { x: -20, y: -30 }
    ),
    '1867:X4': cityTile(
        [Centre, { x: -28, y: 0 }, { x: 28, y: 0 }],
        towardTileEdge(3.5, 30),
        towardTileEdge(2.5, 30)
    ),
    '1867:X5': {
        ...cityTile(
            [
                { x: -23, y: 0 },
                { x: 0, y: -25 }
            ],
            { x: 17, y: 29 },
            { x: 22, y: -27 }
        ),
        slotRowTurns: { 'city-0': 90 },
        pathControls: {
            'city-0-edge-4': [
                { x: 26, y: -8 },
                { x: 8, y: -2 }
            ],
            'city-0-edge-5': [
                { x: 26, y: 12 },
                { x: 8, y: 6 }
            ]
        }
    },
    '1867:X6': {
        ...cityTile(
            [
                { x: 12, y: 2 },
                { x: -29, y: 0 }
            ],
            { x: -12, y: -28 },
            { x: -14, y: 30 }
        ),
        slotRowTurns: { 'city-0': 90 }
    },
    '1867:X7': cityTile(
        [
            { x: -10, y: 8 },
            { x: 14, y: -24 }
        ],
        { x: 32, y: -2 },
        { x: 18, y: 33 }
    ),
    // Off centre: the four-space city leaves no room for the M otherwise.
    '1867:639': {
        ...oneCityTile({ x: -36, y: 0 }, { x: 37.5, y: 0 }),
        nodePositions: { city: { x: -3, y: 0 } }
    },
    '1867:120': cityTile([toward(0.5), toward(2.5)], towardTileEdge(1.5, 36), { x: 30, y: 0 }),
    '1867:122': cityTile(
        [
            { x: 0, y: 24 },
            { x: 0, y: -24 }
        ],
        { x: -36, y: 0 },
        { x: 36, y: 0 }
    ),
    '1867:124': oneCityTile({ x: -35, y: 0 }, { x: 38, y: 0 })
}

const StubYellow = '#f2c300'

/**
 * A yellow triangle on a side, pointing in: a yellow tile laid in its hex must connect to that
 * side (GTG §8.6.2).
 */
function stubTriangle(edge: number): TilePrintedShape {
    const middle = towardTileEdge(edge, 43.3)
    const apex = towardTileEdge(edge, 31)
    const along = towardTileEdge(edge + 1.5, 9)
    return {
        points: [
            { x: middle.x + along.x, y: middle.y + along.y },
            apex,
            { x: middle.x - along.x, y: middle.y - along.y }
        ],
        color: StubYellow
    }
}

const Offboards: Readonly<
    Record<
        string,
        {
            name: Point
            lines: readonly string[]
            values: Point
            stack: NonNullable<TileLayout['revenueStack']>
        }
    >
> = {
    A7: {
        name: { x: -4, y: -30 },
        lines: ['Sault Ste.', 'Marie'],
        values: { x: -18, y: 14 },
        stack: 'column'
    },
    P8: {
        name: { x: 4, y: -30 },
        lines: ['Maritime', 'Provinces'],
        values: { x: 18, y: 14 },
        stack: 'column'
    },
    F18: { name: { x: 0, y: 10 }, lines: ['Buffalo'], values: { x: 0, y: 21 }, stack: 'row' },
    M15: { name: { x: 0, y: 10 }, lines: ['New England'], values: { x: 0, y: 21 }, stack: 'row' },
    O13: { name: { x: 0, y: 10 }, lines: ['Maine'], values: { x: 0, y: 21 }, stack: 'row' }
}

const Stations: MapViewDefinition['stations'] = {
    ...Object.fromEntries(
        [...Minors1867, ...Majors1867].map((company) => [
            company.id,
            { label: CompanyNames1867[company.id]?.initials ?? company.id, color: company.color }
        ])
    ),
    [CnId]: { label: 'CN', color: CnColor }
}

export const MapView1867: MapViewDefinition = {
    map: Map1867,
    tileSet: TileSet1867,
    boardAreas: {
        market: { x: 50, y: -175, width: 1020, height: 108 },
        depot: { x: 720, y: -55, width: 346, height: 170 }
    },
    stations: Stations,
    terrainCostPrefix: TitleRules1867.currencySymbol,
    offboardNames: { fontSize: 11, color: '#4a0b0b' },
    // Detroit is one off-board location printed over two hexes (GTG §8.8.1).
    joinedEdges: { [DetroitLocationIds[0]]: [0], [DetroitLocationIds[1]]: [3] },
    nameLines: {
        [DetroitLocationIds[1]]: [],
        ...Object.fromEntries(Object.entries(Offboards).map(([id, { lines }]) => [id, lines]))
    },
    namePositions: Object.fromEntries([
        ...Object.entries(Offboards).map(([id, { name }]) => [id, name]),
        [DetroitLocationIds[0], { x: -6, y: 4 }]
    ]),
    revenueStageColors: {
        yellow: TrainColors1867['2'],
        green: [TrainColors1867['3'], TrainColors1867['4']],
        brown: [TrainColors1867['5'], TrainColors1867['6']],
        gray: [TrainColors1867['7'], TrainColors1867['8']]
    },
    layouts: {
        ...TileLayouts1867,
        [DetroitLocationIds[0]]: { hideRevenue: true },
        [DetroitLocationIds[1]]: {
            revenuePositions: { offboard: { x: -14, y: -10 } },
            revenueStack: 'column'
        },
        ...Object.fromEntries(
            Object.entries(Offboards).map(([id, { values, stack }]) => [
                id,
                { revenuePositions: { offboard: values }, revenueStack: stack }
            ])
        ),
        ...Object.fromEntries(
            Object.entries(YellowTileStubs1867).map(([locationId, edge]) => [
                locationId,
                { printedShapes: [stubTriangle(edge)] }
            ])
        ),
        L12: cityTile(
            [toward(1), toward(3), toward(5)],
            towardTileEdge(2, 30),
            towardTileEdge(4, 30)
        ),
        F16: cityTile([toward(1), toward(4)], towardTileEdge(5, 28), towardTileEdge(2.5, 36)),
        // Timmins is worth $80 on a route that also counts Toronto, Montreal or Quebec (GTG §8.8.2).
        [TimminsLocationId]: {
            revenuePositions: { city: { x: -21, y: -20 } },
            printedText: [
                {
                    content: `${TitleRules1867.currencySymbol}80 with T, M or Q`,
                    at: { x: 0, y: -35 },
                    fontSize: 6
                }
            ]
        }
    }
}
