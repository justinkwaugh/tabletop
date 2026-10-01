import { MarketColor } from '@tabletop/marracash'

export type MarketPalette = { fill: string; stroke: string; tint: string }

export const MarketPalettes: Record<MarketColor, MarketPalette> = {
    [MarketColor.Red]: { fill: '#d9534a', stroke: '#8f2620', tint: '#f2b8b3' },
    [MarketColor.Blue]: { fill: '#4f7fd6', stroke: '#24468c', tint: '#b9cdf2' },
    [MarketColor.Green]: { fill: '#4fae62', stroke: '#256b33', tint: '#bfe3c6' },
    [MarketColor.Purple]: { fill: '#9a5cc6', stroke: '#5a2c80', tint: '#dcc4ee' },
    [MarketColor.Yellow]: { fill: '#e8b830', stroke: '#8a6a0c', tint: '#f6e2a3' }
}
