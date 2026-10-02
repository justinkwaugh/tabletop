import { MarketColor } from '@tabletop/marracash'
import { ColorblindColor } from '@tabletop/frontend-components'

export type MarketPalette = { fill: string; stroke: string; tint: string; wash: number }

const StandardMarketPalettes: Record<MarketColor, MarketPalette> = {
    [MarketColor.Red]: { fill: '#d9534a', stroke: '#8f2620', tint: '#f2b8b3', wash: 0.55 },
    [MarketColor.Blue]: { fill: '#4f7fd6', stroke: '#24468c', tint: '#b9cdf2', wash: 0.55 },
    [MarketColor.Green]: { fill: '#4fae62', stroke: '#256b33', tint: '#bfe3c6', wash: 0.55 },
    [MarketColor.Purple]: { fill: '#9a5cc6', stroke: '#5a2c80', tint: '#dcc4ee', wash: 0.55 },
    [MarketColor.Yellow]: { fill: '#e8b830', stroke: '#8a6a0c', tint: '#f6e2a3', wash: 0.55 }
}

const ColorblindMarketPalettes: Record<MarketColor, MarketPalette> = {
    [MarketColor.Red]: { fill: '#d64f00', stroke: '#702900', tint: '#f5ab80', wash: 0.72 },
    [MarketColor.Blue]: {
        fill: ColorblindColor.Blue,
        stroke: '#003f63',
        tint: '#a8d1ea',
        wash: 0.55
    },
    [MarketColor.Green]: {
        fill: ColorblindColor.BluishGreen,
        stroke: '#005740',
        tint: '#a6dcc9',
        wash: 0.55
    },
    [MarketColor.Purple]: {
        fill: ColorblindColor.ReddishPurple,
        stroke: '#7d3a60',
        tint: '#ecc9dc',
        wash: 0.55
    },
    [MarketColor.Yellow]: {
        fill: ColorblindColor.Yellow,
        stroke: '#857c10',
        tint: '#f8f2b0',
        wash: 0.55
    }
}

export function marketPalettes(colorBlind: boolean): Record<MarketColor, MarketPalette> {
    return colorBlind ? ColorblindMarketPalettes : StandardMarketPalettes
}
