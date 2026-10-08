export const UNCLAIMED_STALL = '#8f9397'

export const MARKET_GROUND = '#a9a9a9'
export const MARKET_TABLE = '#55595d'

export const TRUCK_WOOD = '#d6b07a'
export const TRUCK_GROUND = '#2a2c2f'

export const LABEL_LIGHT = '#ecebe6'
export const LABEL_DARK = '#2a1d0b'

export const TRAY = '#0d1014'

export const PAINT_LIGHT = '#f3ead2'
export const PAINT_DARK = '#4a3216'

export function rgbOf(hex: string): [number, number, number] {
    const value = hex.replace('#', '')
    const channel = (start: number) => parseInt(value.slice(start, start + 2), 16)
    return [channel(0), channel(2), channel(4)]
}

/** Perceived brightness, 0–255. */
export function luminance([r, g, b]: readonly number[]): number {
    return 0.299 * r + 0.587 * g + 0.114 * b
}

export function isLightColor(hex: string): boolean {
    return luminance(rgbOf(hex)) > 170
}
