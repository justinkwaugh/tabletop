import { MarketColor } from '@tabletop/marracash'
import { ColorblindColor } from '@tabletop/frontend-components'
import { mixColors, shiftLightness } from '$lib/utils/colorLightness.js'

export type AwningColors = {
    base: string
    outline: string
    band: string
}

export type MarketPalette = { fill: string; stroke: string; tint: string; awning: AwningColors }

type MarketInks = { fill: string; stroke: string; tint: string }

const White = '#ffffff'
type AwningStyle = { band: number; shade: number }

const StandardAwning: AwningStyle = { band: 0.45, shade: -0.1 }
const DeepRedAwning: AwningStyle = { ...StandardAwning, band: 0.2 }

function marketPalette(inks: MarketInks, style: AwningStyle = StandardAwning): MarketPalette {
    const base = shiftLightness(inks.fill, style.shade)
    const outline = shiftLightness(inks.stroke, style.shade)
    return {
        ...inks,
        awning: {
            base,
            outline,
            band: mixColors(base, White, style.band)
        }
    }
}

const StandardMarketPalettes: Record<MarketColor, MarketPalette> = {
    [MarketColor.Red]: marketPalette(
        { fill: '#d9534a', stroke: '#8f2620', tint: '#f2b8b3' },
        DeepRedAwning
    ),
    [MarketColor.Blue]: marketPalette({ fill: '#4f7fd6', stroke: '#24468c', tint: '#b9cdf2' }),
    [MarketColor.Green]: marketPalette({ fill: '#4fae62', stroke: '#256b33', tint: '#bfe3c6' }),
    [MarketColor.Purple]: marketPalette({ fill: '#9a5cc6', stroke: '#5a2c80', tint: '#dcc4ee' }),
    [MarketColor.Yellow]: marketPalette({ fill: '#e8b830', stroke: '#8a6a0c', tint: '#f6e2a3' })
}

const ColorblindMarketPalettes: Record<MarketColor, MarketPalette> = {
    [MarketColor.Red]: marketPalette({
        fill: ColorblindColor.Vermilion,
        stroke: '#702900',
        tint: '#f5ab80'
    }),
    [MarketColor.Blue]: marketPalette({
        fill: ColorblindColor.Blue,
        stroke: '#003f63',
        tint: '#a8d1ea'
    }),
    [MarketColor.Green]: marketPalette({
        fill: ColorblindColor.BluishGreen,
        stroke: '#005740',
        tint: '#a6dcc9'
    }),
    [MarketColor.Purple]: marketPalette({
        fill: ColorblindColor.ReddishPurple,
        stroke: '#7d3a60',
        tint: '#ecc9dc'
    }),
    [MarketColor.Yellow]: marketPalette({
        fill: ColorblindColor.Yellow,
        stroke: '#857c10',
        tint: '#f8f2b0'
    })
}

export function marketPalettes(colorBlind: boolean): Record<MarketColor, MarketPalette> {
    return colorBlind ? ColorblindMarketPalettes : StandardMarketPalettes
}
