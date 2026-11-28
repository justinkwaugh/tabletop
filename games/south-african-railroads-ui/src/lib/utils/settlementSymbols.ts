import { SettlementKind, type PointSettlementKind } from '@tabletop/south-african-railroads'

export type SymbolShape = 'square' | 'hexagon' | 'circle' | 'pentagon' | 'triangle'

export type SettlementSymbol = {
    shape: SymbolShape
    // Half the icon's width on the board.
    size: number
    // Railroad bases take their railroad's colour.
    fill?: string
    darkText: boolean
    // The income's baseline, below the icon's centre.
    incomeBaseline: number
    // The legend's name, in two lines.
    name: readonly [string, string]
}

export const UNOWNED_BASE_FILL = '#8a7860'

export const SETTLEMENT_SYMBOLS: Record<PointSettlementKind, SettlementSymbol> = {
    [SettlementKind.AgriculturalRailhead]: {
        shape: 'hexagon',
        size: 18.5,
        fill: '#f2b81e',
        darkText: true,
        incomeBaseline: 5,
        name: ['Agricultural', 'Railhead']
    },
    [SettlementKind.MercantileCenter]: {
        shape: 'circle',
        size: 16.3,
        fill: '#d42a22',
        darkText: false,
        incomeBaseline: 5,
        name: ['Mercantile', 'Center']
    },
    [SettlementKind.RailroadStation]: {
        shape: 'square',
        size: 13.5,
        fill: '#2d58b0',
        darkText: false,
        incomeBaseline: 5,
        name: ['Railroad', 'Station']
    },
    [SettlementKind.RailroadBase]: {
        shape: 'pentagon',
        size: 23,
        darkText: false,
        incomeBaseline: 5,
        name: ['Railroad', 'Base']
    },
    [SettlementKind.NaturalResource]: {
        shape: 'hexagon',
        size: 18.5,
        fill: '#f5df1f',
        darkText: true,
        incomeBaseline: 5,
        name: ['Natural', 'Resource']
    },
    [SettlementKind.Town]: {
        shape: 'circle',
        size: 15,
        fill: '#d42a22',
        darkText: false,
        incomeBaseline: 5,
        name: ['Town', '']
    },
    [SettlementKind.City]: {
        shape: 'square',
        size: 14.5,
        fill: '#2d58b0',
        darkText: false,
        incomeBaseline: 5,
        name: ['City', '']
    },
    [SettlementKind.Mine]: {
        shape: 'hexagon',
        size: 18.5,
        fill: '#f2b81e',
        darkText: true,
        incomeBaseline: 5,
        name: ['Mine', '']
    },
    [SettlementKind.Port]: {
        shape: 'triangle',
        size: 22,
        fill: '#3d7d2f',
        darkText: false,
        incomeBaseline: 1,
        name: ['Port', '']
    }
}
