import type { MarketZone } from '../session/titlePresentation.js'
import type { StockMarketSpace } from '@tabletop/18xx'

export const marketColors: Record<string, string> = {
    white: '#fffefa',
    pink: '#f2c7d4',
    yellow: '#f6df81',
    orange: '#efa960',
    brown: '#a77b52',
    green: '#9cccaa',
    blue: '#accbe9',
    red: '#e8a59f',
    black: '#3b3b3b'
}

export const marketDarkLightness: Readonly<Record<string, number>> = { brown: 0.5, black: 0.22 }

const RecessedMarketSpace =
    'light-dark(#ece6da, color-mix(in oklab, var(--rail-surface-raised, #2b3744) 35%, var(--rail-surface-inset, #1b232d)))'

export function marketZone(
    zones: readonly MarketZone[] | undefined,
    color: string
): MarketZone | undefined {
    return zones?.find((zone) => zone.color === color)
}

export function marketSpaceColor(color: string, zone?: MarketZone): string {
    const fill = zone?.fill
    switch (fill?.kind) {
        case 'solid':
            return fill.color
        case 'recessed':
            return RecessedMarketSpace
        default:
            return marketColors[color] ?? color
    }
}

export function marketZoneTitle(zone: MarketZone): string {
    return `${zone.name}: ${zone.description}`
}

// A solid fill keeps its colour in dark mode, so its text keeps the light-mode ink.
export function marketSolidInk(zone: MarketZone | undefined): string | undefined {
    return zone?.fill?.kind === 'solid' ? (zone.fill.ink ?? 'var(--market-solid-ink)') : undefined
}

export type MarketValueMark = {
    /** Custom properties for an element with the `market-zone-tint` class. */
    style: string
    title: string
}

export function marketValueMark(
    space: Pick<StockMarketSpace, 'color'> | undefined,
    zones: readonly MarketZone[] | undefined
): MarketValueMark | undefined {
    if (!space) return undefined
    const zone = marketZone(zones, space.color)
    if (!zone?.marksCompanyValue) return undefined
    const lightness = marketDarkLightness[space.color]
    const ink = marketSolidInk(zone)
    return {
        style: [
            `--market-color:${marketSpaceColor(space.color, zone)}`,
            ...(lightness === undefined ? [] : [`--market-lightness:${lightness}`]),
            ...(zone.fill ? ['--market-tint:var(--market-color)'] : []),
            ...(ink ? [`--market-tint-ink:${ink}`] : [])
        ].join(';'),
        title: marketZoneTitle(zone)
    }
}
