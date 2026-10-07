import type { StationAppearance } from '../maps/stationPresentation.js'
import type { TileAppearance } from './tileAppearance.js'

export type TileSymbolName = 'port' | 'horns'

export const PortSymbol = {
    radius: 8,
    strokeWidth: 1.5,
    ring: { cy: -4, r: 1.5 },
    path: 'M 0 -2.5 V 6 M -3 -1 H 3 M -5 2 Q -5 6 0 6 Q 5 6 5 2 M -5 2 L -6 3 M 5 2 L 6 3'
}

// A steer's spreading horns either side of its poll, filled in ink, as for a meat packing bonus.
export const HornsSymbol = {
    radius: 8,
    paths: [
        'M -1.6 0.4 L -1.81 0.43 L -2.02 0.46 L -2.23 0.49 L -2.43 0.52 L -2.62 0.54 L -2.81 0.56 L -2.99 0.58 L -3.17 0.6 L -3.35 0.61 L -3.52 0.62 L -3.69 0.63 L -3.85 0.63 L -4 0.63 L -4.16 0.63 L -4.31 0.62 L -4.45 0.61 L -4.59 0.6 L -4.73 0.58 L -4.86 0.55 L -5 0.52 L -5.13 0.49 L -5.26 0.45 L -5.38 0.4 L -5.51 0.35 L -5.63 0.28 L -5.75 0.21 L -5.87 0.13 L -5.99 0.04 L -6.11 -0.06 L -6.22 -0.17 L -6.33 -0.29 L -6.45 -0.42 L -6.55 -0.56 L -6.66 -0.72 L -6.76 -0.88 L -6.85 -1.06 L -6.95 -1.25 L -7.04 -1.46 L -7.12 -1.67 L -7.2 -1.9 L -7.2 -1.9 L -7.18 -1.66 L -7.16 -1.42 L -7.14 -1.2 L -7.1 -0.98 L -7.06 -0.77 L -7.02 -0.57 L -6.96 -0.37 L -6.91 -0.18 L -6.84 0.01 L -6.77 0.19 L -6.68 0.36 L -6.6 0.53 L -6.5 0.7 L -6.39 0.86 L -6.28 1.01 L -6.16 1.15 L -6.03 1.29 L -5.9 1.43 L -5.75 1.55 L -5.6 1.68 L -5.45 1.79 L -5.28 1.9 L -5.11 2 L -4.94 2.1 L -4.76 2.18 L -4.57 2.27 L -4.38 2.35 L -4.19 2.42 L -3.99 2.49 L -3.79 2.55 L -3.59 2.61 L -3.38 2.67 L -3.17 2.72 L -2.95 2.77 L -2.73 2.81 L -2.51 2.85 L -2.29 2.89 L -2.06 2.93 L -1.83 2.97 L -1.6 3 Z',
        'M 1.6 0.4 L 1.81 0.43 L 2.02 0.46 L 2.23 0.49 L 2.43 0.52 L 2.62 0.54 L 2.81 0.56 L 2.99 0.58 L 3.17 0.6 L 3.35 0.61 L 3.52 0.62 L 3.69 0.63 L 3.85 0.63 L 4 0.63 L 4.16 0.63 L 4.31 0.62 L 4.45 0.61 L 4.59 0.6 L 4.73 0.58 L 4.86 0.55 L 5 0.52 L 5.13 0.49 L 5.26 0.45 L 5.38 0.4 L 5.51 0.35 L 5.63 0.28 L 5.75 0.21 L 5.87 0.13 L 5.99 0.04 L 6.11 -0.06 L 6.22 -0.17 L 6.33 -0.29 L 6.45 -0.42 L 6.55 -0.56 L 6.66 -0.72 L 6.76 -0.88 L 6.85 -1.06 L 6.95 -1.25 L 7.04 -1.46 L 7.12 -1.67 L 7.2 -1.9 L 7.2 -1.9 L 7.18 -1.66 L 7.16 -1.42 L 7.14 -1.2 L 7.1 -0.98 L 7.06 -0.77 L 7.02 -0.57 L 6.96 -0.37 L 6.91 -0.18 L 6.84 0.01 L 6.77 0.19 L 6.68 0.36 L 6.6 0.53 L 6.5 0.7 L 6.39 0.86 L 6.28 1.01 L 6.16 1.15 L 6.03 1.29 L 5.9 1.43 L 5.75 1.55 L 5.6 1.68 L 5.45 1.79 L 5.28 1.9 L 5.11 2 L 4.94 2.1 L 4.76 2.18 L 4.57 2.27 L 4.38 2.35 L 4.19 2.42 L 3.99 2.49 L 3.79 2.55 L 3.59 2.61 L 3.38 2.67 L 3.17 2.72 L 2.95 2.77 L 2.73 2.81 L 2.51 2.85 L 2.29 2.89 L 2.06 2.93 L 1.83 2.97 L 1.6 3 Z',
        'M -2.1 1.7 C -2.1 0.3 -1.16 -0.3 0 -0.3 C 1.16 -0.3 2.1 0.3 2.1 1.7 C 2.1 3.1 1.16 3.7 0 3.7 C -1.16 3.7 -2.1 3.1 -2.1 1.7 Z'
    ]
}

function symbolMarkup(symbol: TileSymbolName, ink: string): string {
    if (symbol === 'horns')
        return HornsSymbol.paths
            .map((path) => `<path fill="${ink}" stroke="none" d="${path}"/>`)
            .join('')
    const { strokeWidth, ring, path } = PortSymbol
    return `<g fill="none" stroke="${ink}" stroke-width="${strokeWidth}" stroke-linecap="round"><circle cy="${ring.cy}" r="${ring.r}"/><path d="${path}"/></g>`
}

export function tileSymbolAppearance(
    symbol: TileSymbolName,
    { ink, paper }: Pick<TileAppearance, 'ink' | 'paper'>
): StationAppearance {
    const { radius } = PortSymbol
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-radius} ${-radius} ${radius * 2} ${radius * 2}"><circle r="${radius}" fill="${paper}"/>${symbolMarkup(symbol, ink)}</svg>`
    return {
        label: symbol,
        color: 'transparent',
        imageUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`
    }
}
