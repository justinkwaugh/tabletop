import type { StationAppearance } from '../maps/stationPresentation.js'
import type { TileAppearance } from './tileAppearance.js'

export type TileSymbolName = 'port'

export const PortSymbol = {
    radius: 8,
    strokeWidth: 1.5,
    ring: { cy: -4, r: 1.5 },
    path: 'M 0 -2.5 V 6 M -3 -1 H 3 M -5 2 Q -5 6 0 6 Q 5 6 5 2 M -5 2 L -6 3 M 5 2 L 6 3'
}

export function tileSymbolAppearance(
    symbol: TileSymbolName,
    { ink, paper }: Pick<TileAppearance, 'ink' | 'paper'>
): StationAppearance {
    const { radius, strokeWidth, ring, path } = PortSymbol
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-radius} ${-radius} ${radius * 2} ${radius * 2}"><circle r="${radius}" fill="${paper}"/><g fill="none" stroke="${ink}" stroke-width="${strokeWidth}" stroke-linecap="round"><circle cy="${ring.cy}" r="${ring.r}"/><path d="${path}"/></g></svg>`
    return {
        label: symbol,
        color: 'transparent',
        imageUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`
    }
}
