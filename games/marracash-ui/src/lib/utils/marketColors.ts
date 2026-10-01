import { MarketColor } from '@tabletop/marracash'

export enum MarketSymbol {
    Triangle = 'triangle',
    Circle = 'circle',
    Square = 'square',
    Diamond = 'diamond',
    Star = 'star'
}

export type MarketPalette = { fill: string; stroke: string; tint: string; symbol: MarketSymbol }

export const MarketPalettes: Record<MarketColor, MarketPalette> = {
    [MarketColor.Red]: {
        fill: '#d9534a',
        stroke: '#8f2620',
        tint: '#f2b8b3',
        symbol: MarketSymbol.Triangle
    },
    [MarketColor.Blue]: {
        fill: '#4f7fd6',
        stroke: '#24468c',
        tint: '#b9cdf2',
        symbol: MarketSymbol.Circle
    },
    [MarketColor.Green]: {
        fill: '#4fae62',
        stroke: '#256b33',
        tint: '#bfe3c6',
        symbol: MarketSymbol.Square
    },
    [MarketColor.Purple]: {
        fill: '#9a5cc6',
        stroke: '#5a2c80',
        tint: '#dcc4ee',
        symbol: MarketSymbol.Diamond
    },
    [MarketColor.Yellow]: {
        fill: '#e8b830',
        stroke: '#8a6a0c',
        tint: '#f6e2a3',
        symbol: MarketSymbol.Star
    }
}

export function symbolPath(symbol: MarketSymbol): string {
    switch (symbol) {
        case MarketSymbol.Triangle:
            return 'M 0 -1 L 0.95 0.75 L -0.95 0.75 Z'
        case MarketSymbol.Circle:
            return 'M 0.85 0 A 0.85 0.85 0 1 1 -0.85 0 A 0.85 0.85 0 1 1 0.85 0 Z'
        case MarketSymbol.Square:
            return 'M -0.75 -0.75 H 0.75 V 0.75 H -0.75 Z'
        case MarketSymbol.Diamond:
            return 'M 0 -1 L 0.85 0 L 0 1 L -0.85 0 Z'
        case MarketSymbol.Star:
            return 'M 0 -1 L 0.24 -0.31 L 0.95 -0.31 L 0.38 0.12 L 0.59 0.81 L 0 0.4 L -0.59 0.81 L -0.38 0.12 L -0.95 -0.31 L -0.24 -0.31 Z'
    }
}
