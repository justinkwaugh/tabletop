const grainSvg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='520' height='180'>" +
    "<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.003 0.12' numOctaves='3' seed='7' stitchTiles='stitch'/>" +
    "<feColorMatrix values='0 0 0 0 0.42  0 0 0 0 0.26  0 0 0 0 0.1  0 0 0 0.32 -0.06'/></filter>" +
    "<rect width='100%' height='100%' filter='url(#g)'/></svg>"

export const WoodGrain = `url("data:image/svg+xml,${encodeURIComponent(grainSvg)}")`

export const TablePalette = {
    slateHigh: '#4a5d6e',
    slateLow: '#2a3540',
    slatePanel: '#2f3c48',
    slateEdge: '#566a7c',
    cream: '#f3e6cc',
    creamQuiet: '#b9ab94',
    maple: '#ecd3a6',
    mapleLight: '#f6e6c6',
    mapleDeep: '#d9b47c',
    mapleEdge: '#a77a4b',
    ink: '#3a2412',
    inkQuiet: '#6f5034',
    gold: '#e0a91a',
    goldDeep: '#a87808',
    sightline: '#b4301f'
} as const

export const SlateBackground = `radial-gradient(ellipse at 50% 25%, ${TablePalette.slateHigh}, ${TablePalette.slateLow} 75%)`

export const MaplePlank = `${WoodGrain}, linear-gradient(180deg, ${TablePalette.mapleLight}, ${TablePalette.maple})`

export function woodFill(color: string): string {
    return `${WoodGrain}, linear-gradient(180deg, color-mix(in oklab, ${color} 88%, #fff4e0), color-mix(in oklab, ${color} 90%, #2a1406))`
}

const DARK_LUMINANCE = 0.12

function linearChannel(value: number): number {
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function isDarkColor(hex: string): boolean {
    const [red, green, blue] = [1, 3, 5].map((start) => linearChannel(parseInt(hex.slice(start, start + 2), 16) / 255))
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue < DARK_LUMINANCE
}
